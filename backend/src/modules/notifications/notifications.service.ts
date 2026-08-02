import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../../lib/supabase.module';

export type NotificationType =
  | 'new_listing_nearby'
  | 'donation_claimed'
  | 'assignment_offered'
  | 'assignment_accepted'
  | 'pickup_verified'
  | 'delivery_verified'
  | 'pickup_reminder'
  | 'expiry_warning'
  | 'emergency_broadcast';

@Injectable()
export class NotificationsService {
  constructor(@Inject(SUPABASE) private supabase: SupabaseClient) {}

  /** Fire-and-forget in-app notification. Email/FCM hook in later (Phase 5). */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data: Record<string, unknown> = {},
  ) {
    await this.supabase.from('notifications').insert({ user_id: userId, type, title, body, data });
  }

  async notifyMany(userIds: string[], type: NotificationType, title: string, body: string, data = {}) {
    if (!userIds.length) return;
    await this.supabase
      .from('notifications')
      .insert(userIds.map((user_id) => ({ user_id, type, title, body, data })));
  }

  async list(userId: string, unreadOnly = false) {
    let q = this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (unreadOnly) q = q.eq('read', false);
    const { data } = await q;
    return data ?? [];
  }

  async markAllRead(userId: string) {
    await this.supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    return { ok: true };
  }

  /** Mark one notification read; scoped to the owner so IDs can't be probed. */
  async markRead(userId: string, id: number) {
    await this.supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);
    return { ok: true };
  }
}
