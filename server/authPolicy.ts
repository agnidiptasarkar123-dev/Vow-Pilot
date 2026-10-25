import { UserRole, User, ServerEventRecord } from './types';

/**
 * Centralized Role-Based Access Control (RBAC) and tenant authorization policies
 * for VowPilot collaboration and planning resources.
 */
export class AuthPolicy {
  /**
   * Evaluates if a role has read permission for event planning data.
   */
  public static canRead(role: UserRole): boolean {
    return role === 'owner' || role === 'editor' || role === 'viewer';
  }

  /**
   * Evaluates if a role has write/modification permission for event planning data.
   * Viewers are strictly read-only.
   */
  public static canModify(role: UserRole): boolean {
    return role === 'owner' || role === 'editor';
  }

  /**
   * Evaluates if a role can manage event membership (add/remove members, revoke access).
   * Only owners have membership management privileges.
   */
  public static canManageMembers(role: UserRole): boolean {
    return role === 'owner';
  }

  /**
   * Evaluates if a member with actorRole can issue an invite for targetRole.
   * - Owners can invite owners, editors, or viewers.
   * - Editors can invite editors or viewers (cannot invite owners to prevent privilege escalation).
   * - Viewers cannot generate any invitations.
   */
  public static canCreateInvite(actorRole: UserRole, targetRole: UserRole): boolean {
    if (actorRole === 'viewer') return false;
    if (actorRole === 'editor') {
      return targetRole === 'editor' || targetRole === 'viewer';
    }
    if (actorRole === 'owner') {
      return targetRole === 'owner' || targetRole === 'editor' || targetRole === 'viewer';
    }
    return false;
  }

  /**
   * Evaluates if a role can dispatch vendor clarification emails.
   */
  public static canDispatchVendorEmail(role: UserRole): boolean {
    return role === 'owner' || role === 'editor';
  }

  /**
   * Verifies that the requesting user belongs to the event and has at least the required role.
   * Throws descriptive authorization errors with appropriate security semantics.
   */
  public static authorize(
    event: ServerEventRecord,
    user: User,
    action: 'read' | 'modify' | 'manage_members' | 'dispatch_email'
  ): UserRole {
    const member = event.members.find((m) => m.userId === user.id);
    if (!member) {
      throw new Error('Unauthorized: You are not a member of this event.');
    }

    const role = member.role;
    switch (action) {
      case 'read':
        if (!this.canRead(role)) {
          throw new Error('Forbidden: Insufficient privileges to view event.');
        }
        break;
      case 'modify':
        if (!this.canModify(role)) {
          throw new Error('Forbidden: Viewer role does not have permission to modify event data.');
        }
        break;
      case 'manage_members':
        if (!this.canManageMembers(role)) {
          throw new Error('Forbidden: Only the event owner can manage event members.');
        }
        break;
      case 'dispatch_email':
        if (!this.canDispatchVendorEmail(role)) {
          throw new Error('Forbidden: Viewers are not permitted to dispatch vendor emails.');
        }
        break;
    }

    return role;
  }
}
