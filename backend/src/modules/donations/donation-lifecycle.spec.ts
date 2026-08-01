import { actorAllowed, canTransition } from './donation-lifecycle';
import type { AuthUser } from '../auth/auth.types';

const u = (role: AuthUser['role']): AuthUser => ({ id: 'x', email: 'x@x.com', role });

describe('donation lifecycle state machine', () => {
  it('follows the happy path', () => {
    expect(canTransition('listed', 'claimed')).toBe(true);
    expect(canTransition('claimed', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'in_transit')).toBe(true);
    expect(canTransition('in_transit', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'verified')).toBe(true);
  });

  it('rejects skipping states', () => {
    expect(canTransition('listed', 'delivered')).toBe(false);
    expect(canTransition('listed', 'in_transit')).toBe(false);
    expect(canTransition('claimed', 'verified')).toBe(false);
  });

  it('terminal states go nowhere', () => {
    expect(canTransition('verified', 'listed')).toBe(false);
    expect(canTransition('cancelled', 'listed')).toBe(false);
    expect(canTransition('expired', 'claimed')).toBe(false);
  });

  it('allows cancel only before transit', () => {
    expect(canTransition('listed', 'cancelled')).toBe(true);
    expect(canTransition('claimed', 'cancelled')).toBe(true);
    expect(canTransition('assigned', 'cancelled')).toBe(true);
    expect(canTransition('in_transit', 'cancelled')).toBe(false);
  });

  it('enforces actor roles', () => {
    expect(actorAllowed(u('ngo'), 'claimed')).toBe(true);
    expect(actorAllowed(u('donor'), 'claimed')).toBe(false);
    expect(actorAllowed(u('volunteer'), 'in_transit')).toBe(true);
    expect(actorAllowed(u('volunteer'), 'verified')).toBe(false);
    expect(actorAllowed(u('ngo'), 'verified')).toBe(true);
    expect(actorAllowed(u('admin'), 'verified')).toBe(true); // admin can do anything
    expect(actorAllowed(u('donor'), 'expired')).toBe(false); // system only
  });
});
