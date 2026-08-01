import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as QRCode from 'qrcode';
import { SUPABASE } from '../../lib/supabase.module';
import { NotificationsService } from '../notifications/notifications.service';
import { DonationsService } from '../donations/donations.service';
import type { AuthUser } from '../auth/auth.types';

@Injectable()
export class AssignmentsService {
  constructor(
    @Inject(SUPABASE) private supabase: SupabaseClient,
    private notifications: NotificationsService,
    private donations: DonationsService,
  ) {}

  /** NGO (or donor) offers the pickup task to a volunteer. */
  async create(user: AuthUser, donationId: string, volunteerId: string) {
    const donation = await this.donations.getById(donationId);

    const { data: volunteer } = await this.supabase
      .from('volunteers')
      .select('id, user_id')
      .eq('id', volunteerId)
      .maybeSingle();
    if (!volunteer) throw new NotFoundException('Volunteer not found');

    // Move donation claimed → assigned (state machine enforces validity + role)
    await this.donations.transition(user, donation, 'assigned');

    const { data, error } = await this.supabase
      .from('assignments')
      .insert({ donation_id: donationId, volunteer_id: volunteerId })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    await this.notifications.notify(
      volunteer.user_id,
      'assignment_offered',
      'New pickup task',
      `You've been assigned to pick up "${donation.title}"`,
      { assignment_id: data.id, donation_id: donationId },
    );
    return data;
  }

  async accept(user: AuthUser, assignmentId: string) {
    const assignment = await this.getOwned(user, assignmentId);
    if (assignment.status !== 'offered') {
      throw new BadRequestException(`Cannot accept from status '${assignment.status}'`);
    }
    await this.updateStatus(assignmentId, 'accepted');
    return this.getById(assignmentId);
  }

  /**
   * QR handoff #1 — at the donor's location. The donor displays the pickup QR
   * (encoding pickup_qr_token); the volunteer scans it and posts the token here.
   * Token match proves physical presence. Donation → in_transit.
   */
  async verifyPickup(user: AuthUser, assignmentId: string, qrToken: string) {
    const assignment = await this.getOwned(user, assignmentId);
    if (assignment.status !== 'accepted') {
      throw new BadRequestException('Assignment must be accepted first');
    }
    if (assignment.pickup_qr_token !== qrToken) {
      throw new ForbiddenException('Invalid pickup QR code');
    }

    const donation = await this.donations.getById(assignment.donation_id);
    await this.donations.transition(user, donation, 'in_transit');
    await this.updateStatus(assignmentId, 'picked_up', { pickup_verified_at: new Date().toISOString() });

    await this.notifyNgo(donation, 'pickup_verified', 'Food picked up',
      `"${donation.title}" is on its way`);
    return this.getById(assignmentId);
  }

  /**
   * QR handoff #2 — at the NGO. The NGO displays the delivery QR; volunteer scans.
   * Donation → delivered. (NGO then confirms receipt → verified.)
   */
  async verifyDelivery(user: AuthUser, assignmentId: string, qrToken: string) {
    const assignment = await this.getOwned(user, assignmentId);
    if (assignment.status !== 'picked_up') {
      throw new BadRequestException('Food has not been picked up yet');
    }
    if (assignment.delivery_qr_token !== qrToken) {
      throw new ForbiddenException('Invalid delivery QR code');
    }

    const donation = await this.donations.getById(assignment.donation_id);
    await this.donations.transition(user, donation, 'delivered');
    await this.updateStatus(assignmentId, 'delivered', { delivery_verified_at: new Date().toISOString() });

    await this.notifyNgo(donation, 'delivery_verified', 'Delivery arrived',
      `"${donation.title}" was delivered — please confirm receipt`);
    return this.getById(assignmentId);
  }

  /** NGO's final confirmation: delivered → verified (closes the loop for analytics). */
  async confirmReceipt(user: AuthUser, assignmentId: string) {
    const assignment = await this.getById(assignmentId);
    const donation = await this.donations.getById(assignment.donation_id);
    const ngo = await this.donations.getNgoByUser(user.id);
    if (donation.claimed_by_ngo !== ngo.id) throw new ForbiddenException('Not your donation');
    await this.donations.transition(user, donation, 'verified');
    return { ok: true };
  }

  async listMine(user: AuthUser) {
    const { data: volunteer } = await this.supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!volunteer) throw new ForbiddenException('No volunteer profile');
    const { data } = await this.supabase
      .from('assignments')
      .select('*, donations(*, donors(org_name, address), ngos:claimed_by_ngo(org_name, address))')
      .eq('volunteer_id', volunteer.id)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  /**
   * QR PNG (data URL) for display. Pickup QR → donor only; delivery QR → NGO only.
   * The volunteer never sees the token except by physically scanning.
   */
  async qrImage(user: AuthUser, assignmentId: string, kind: 'pickup' | 'delivery') {
    const assignment = await this.getById(assignmentId);
    const donation = await this.donations.getById(assignment.donation_id);

    if (user.role !== 'admin') {
      if (kind === 'pickup') {
        const donor = await this.donations.getDonorByUser(user.id);
        if (donor.id !== donation.donor_id) throw new ForbiddenException('Only the donor can view the pickup QR');
      } else {
        const ngo = await this.donations.getNgoByUser(user.id);
        if (ngo.id !== donation.claimed_by_ngo) throw new ForbiddenException('Only the receiving NGO can view the delivery QR');
      }
    }

    const token = kind === 'pickup' ? assignment.pickup_qr_token : assignment.delivery_qr_token;
    const payload = JSON.stringify({ assignment_id: assignmentId, kind, token });
    const dataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 2 });
    return { kind, data_url: dataUrl };
  }

  /** Latest active assignment for a donation (donor/NGO need this to show QRs). */
  async findByDonation(donationId: string) {
    const { data } = await this.supabase
      .from('assignments')
      .select('*')
      .eq('donation_id', donationId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) throw new NotFoundException('No active assignment for this donation');
    // Don't leak QR tokens here — QR images have their own authorized endpoints.
    const { pickup_qr_token, delivery_qr_token, ...safe } = data;
    return safe;
  }

  // ---- helpers ----

  private async getById(id: string) {
    const { data } = await this.supabase.from('assignments').select('*').eq('id', id).maybeSingle();
    if (!data) throw new NotFoundException('Assignment not found');
    return data;
  }

  /** Fetch assignment and assert the current volunteer owns it. */
  private async getOwned(user: AuthUser, id: string) {
    const assignment = await this.getById(id);
    const { data: volunteer } = await this.supabase
      .from('volunteers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!volunteer || volunteer.id !== assignment.volunteer_id) {
      throw new ForbiddenException('Not your assignment');
    }
    return assignment;
  }

  private async updateStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
    const { error } = await this.supabase
      .from('assignments')
      .update({ status, ...extra })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
  }

  private async notifyNgo(donation: any, type: any, title: string, body: string) {
    if (!donation.claimed_by_ngo) return;
    const { data } = await this.supabase
      .from('ngos')
      .select('user_id')
      .eq('id', donation.claimed_by_ngo)
      .maybeSingle();
    if (data) {
      await this.notifications.notify(data.user_id, type, title, body, { donation_id: donation.id });
    }
  }
}
