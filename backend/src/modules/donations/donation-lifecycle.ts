import type { AuthUser } from '../auth/auth.types';

export type DonationStatus =
  | 'listed'
  | 'claimed'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'verified'
  | 'expired'
  | 'cancelled';

/**
 * The donation lifecycle state machine:
 * listed → claimed → assigned → in_transit → delivered → verified
 * listed/claimed/assigned → cancelled ;  listed → expired (cron/expiry check)
 */
export const ALLOWED_TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  listed: ['claimed', 'cancelled', 'expired'],
  claimed: ['assigned', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: ['verified'],
  verified: [],
  expired: [],
  cancelled: [],
};

export function canTransition(from: DonationStatus, to: DonationStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Who may trigger which transition (admin always allowed). */
export function actorAllowed(user: AuthUser, to: DonationStatus): boolean {
  if (user.role === 'admin') return true;
  switch (to) {
    case 'claimed':
      return user.role === 'ngo';
    case 'assigned':
      return user.role === 'ngo' || user.role === 'donor';
    case 'in_transit':
    case 'delivered':
      return user.role === 'volunteer';
    case 'verified':
      return user.role === 'ngo';
    case 'cancelled':
      return user.role === 'donor' || user.role === 'ngo';
    case 'expired':
      return false; // system only
    default:
      return false;
  }
}
