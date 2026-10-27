import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { VowPilotLogo } from '../common/VowPilotLogo';
import { useEvent } from '../../context/EventContext';
import {
  collaborationClient,
  CollaborationState,
  PendingInvite,
  InvitePreview,
} from '../../services/collaborationClient';
import {
  Users,
  UserPlus,
  Link,
  Copy,
  Check,
  Trash2,
  Clock,
  Eye,
  AlertCircle,
  XCircle,
  Cloud,
  Lock,
  LogIn,
} from 'lucide-react';

interface CollaborationModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

export const CollaborationModal: React.FC<CollaborationModalProps> = ({
  isOpen,
  onClose,
  eventId,
}) => {
  const { setAuthModalOpen, currentUser, createEventOnServer } = useEvent();
  const [collabState, setCollabState] = useState<CollaborationState>(() => collaborationClient.getState());
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [inviteRole, setInviteRole] = useState<'owner' | 'editor' | 'viewer'>('editor');
  const [inviteExpiresHours, setInviteExpiresHours] = useState<number>(48);
  const [generatedInvite, setGeneratedInvite] = useState<PendingInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [joinTokenInput, setJoinTokenInput] = useState('');
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);

  useEffect(() => {
    const unsubscribe = collaborationClient.subscribe((state) => {
      setCollabState(state);
    });
    return unsubscribe;
  }, []);

  // Inspect URL query params for prefilled invite token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('inviteToken');
      if (token) {
        setJoinTokenInput(token);
      }
    }
  }, [isOpen]);

  const isOwner = collabState.role === 'owner' || collabState.role === null;
  const isEditor = collabState.role === 'editor';
  const canInvite = isOwner || isEditor;

  // Load existing invitations on open
  useEffect(() => {
    if (isOpen && eventId && canInvite) {
      loadInvites();
    }
  }, [isOpen, eventId, canInvite]);

  const loadInvites = async () => {
    const res = await collaborationClient.listInvites(eventId);
    if (res.success && res.invites) {
      setInvites(res.invites);
    }
  };

  const handleCreateInvite = async () => {
    setIsLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await collaborationClient.createInvite(eventId, inviteRole, inviteExpiresHours);
      if (res.success && res.invite) {
        setGeneratedInvite(res.invite);
        setActionSuccess(`Invitation created with ${inviteRole.toUpperCase()} permissions!`);
        await loadInvites();
      } else {
        setActionError(res.error || 'Failed to create invitation.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInvite) return;
    const shareableText = `${window.location.origin}?inviteToken=${generatedInvite.token}`;
    navigator.clipboard.writeText(shareableText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRevokeInvite = async (tokenHash: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation? Any unaccepted links will be invalidated immediately.')) {
      return;
    }
    setActionError(null);
    const res = await collaborationClient.revokeInvite(eventId, tokenHash);
    if (res.success) {
      setActionSuccess('Invitation revoked successfully.');
      await loadInvites();
    } else {
      setActionError(res.error || 'Failed to revoke invitation.');
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!window.confirm(`Revoke access for ${userName}? They will no longer be able to view or edit this event.`)) {
      return;
    }
    setActionError(null);
    const res = await collaborationClient.removeMember(eventId, userId);
    if (res.success) {
      setActionSuccess(`${userName}'s access was revoked.`);
    } else {
      setActionError(res.error || 'Failed to remove member.');
    }
  };

  const handleUpdateMemberRole = async (targetUserId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    setIsLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await collaborationClient.updateMemberRole(eventId, targetUserId, newRole);
      if (res.success) {
        setActionSuccess(`Collaborator role updated to ${newRole.toUpperCase()}.`);
      } else {
        setActionError(res.error || 'Failed to update member role.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncToCloud = async () => {
    setIsSyncingToCloud(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await createEventOnServer();
      if (res.success) {
        setActionSuccess('Event successfully synchronized to cloud! Real-time multi-user collaboration enabled.');
        await loadInvites();
      } else {
        setActionError(res.error || 'Failed to sync event to cloud.');
      }
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const handleInspectJoinToken = async () => {
    if (!joinTokenInput.trim()) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await collaborationClient.inspectInvite(joinTokenInput.trim());
      if (res.success && res.preview) {
        setInvitePreview(res.preview);
      } else {
        setActionError(res.error || 'Invitation token is invalid or does not exist.');
        setInvitePreview(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptJoin = async () => {
    if (!joinTokenInput.trim()) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await collaborationClient.joinEvent(joinTokenInput.trim());
      if (res.success && res.event) {
        setActionSuccess(`Successfully joined ${res.event.name}!`);
        setJoinTokenInput('');
        setInvitePreview(null);
        await collaborationClient.connectToEvent(res.event.id);
      } else {
        setActionError(res.error || 'Failed to accept invitation.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineJoin = async () => {
    if (!joinTokenInput.trim()) return;
    setIsLoading(true);
    setActionError(null);
    try {
      const res = await collaborationClient.declineInvite(joinTokenInput.trim());
      if (res.success) {
        setActionSuccess('Invitation declined.');
        setJoinTokenInput('');
        setInvitePreview(null);
      } else {
        setActionError(res.error || 'Failed to decline invitation.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Multi-User Event Collaboration"
      description="Coordinate real-time planning with family, partners, and event coordinators."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Messages */}
        {actionError && (
          <div role="alert" className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div role="status" aria-live="polite" className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Authentication Notice Banner */}
        {!currentUser && !collaborationClient.getToken() && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">Authentication Required for Team Collaboration</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  You are currently planning in Local Mode. Sign in or register to sync this event to the backend, invite collaborators, and assign roles.
                </p>
              </div>
            </div>
            <button
              onClick={() => setAuthModalOpen(true)}
              data-testid="collab-auth-btn"
              className="px-3.5 py-1.5 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-semibold rounded shrink-0 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}

        {/* Authenticated Cloud Sync Banner */}
        {currentUser && collabState.status === 'local_only' && (
          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Cloud className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-950">Sync Event to Cloud</p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Signed in as <strong>{currentUser.name}</strong>. This plan is currently saved in local browser storage. Sync it to the server to enable real-time collaboration.
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncToCloud}
              disabled={isSyncingToCloud}
              data-testid="sync-to-cloud-btn"
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded shrink-0 shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{isSyncingToCloud ? 'Syncing...' : 'Sync Event to Cloud'}</span>
            </button>
          </div>
        )}

        {/* Status & Active Role Overview */}
        <div className="bg-subtle p-3.5 rounded-lg border border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <VowPilotLogo variant="mark" size="xs" />
            <div>
              <span className="text-secondary">Your Active Role: </span>
              <span className="font-semibold uppercase px-2 py-0.5 rounded text-[10px] bg-accent-subtle text-accent border border-accent-subtle">
                {collabState.role || 'Coordinator'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-secondary">Plan Version: </span>
              <span className="font-mono font-bold text-primary">v{collabState.serverVersion}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  collabState.status === 'synced'
                    ? 'bg-emerald-500'
                    : collabState.status === 'conflict'
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
              />
              <span className="capitalize">{collabState.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Active Members List */}
        <div>
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-secondary" />
            <span>Celebration Collaborators ({collabState.members.length})</span>
          </h4>

          <div className="divide-y divide-subtle border border-subtle rounded-lg bg-surface overflow-hidden text-xs">
            {collabState.members.length === 0 ? (
              <p className="p-4 text-center text-secondary">No collaborators added yet.</p>
            ) : (
              collabState.members.map((member) => (
                <div key={member.userId} className="p-3 flex items-center justify-between gap-2 hover:bg-subtle transition">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary truncate">{member.userName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          member.role === 'owner'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : member.role === 'editor'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {member.role.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-secondary truncate">{member.userEmail}</p>
                  </div>

                  {isOwner && member.role !== 'owner' && (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Change role for ${member.userName}`}
                        data-testid={`member-role-select-${member.userId}`}
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateMemberRole(
                            member.userId,
                            e.target.value as 'owner' | 'editor' | 'viewer'
                          )
                        }
                        disabled={isLoading}
                        className="text-[11px] py-1 px-1.5 rounded border border-subtle bg-surface text-primary focus:outline-hidden focus:border-[#B85C3A] dark:focus:border-[#D48668]"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                        <option value="owner">Owner</option>
                      </select>

                      <button
                        onClick={() => handleRemoveMember(member.userId, member.userName)}
                        className="p-1 rounded text-secondary hover:text-rose-700 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Generate Invitation (Owner and Editor) */}
        {canInvite && (
          <div className="border border-subtle rounded-lg p-4 bg-subtle space-y-3">
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#B85C3A] dark:text-[#D48668]" />
              <span>Invite New Collaborator</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="collab-role-select" className="block text-[11px] font-medium text-secondary mb-1">Collaborator Role</label>
                <select
                  id="collab-role-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'owner' | 'editor' | 'viewer')}
                  className="w-full text-xs p-2 rounded border border-subtle bg-surface text-primary focus:outline-hidden focus:border-[#B85C3A] dark:focus:border-[#D48668]"
                >
                  <option value="editor">Editor (Can edit budget, tasks & vendors)</option>
                  <option value="viewer">Viewer (Read-only observation)</option>
                  {isOwner && <option value="owner">Owner (Full event control)</option>}
                </select>
              </div>

              <div>
                <label htmlFor="invite-duration" className="block text-[11px] font-medium text-secondary mb-1">Link Expiration</label>
                <select
                  id="invite-duration"
                  value={inviteExpiresHours}
                  onChange={(e) => setInviteExpiresHours(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2 rounded border border-subtle bg-surface text-primary focus:outline-hidden focus:border-[#B85C3A] dark:focus:border-[#D48668]"
                >
                  <option value={24}>24 Hours</option>
                  <option value={48}>48 Hours (Standard)</option>
                  <option value={168}>7 Days</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateInvite}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#B85C3A] hover:bg-[#9E4B2D] text-white text-xs font-medium rounded transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Generate Single-Use Secure Invite Link</span>
            </button>

            {/* Generated Invite Display */}
            {generatedInvite && (
              <div className="p-3 bg-surface border border-subtle rounded-md space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-secondary">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 uppercase">{generatedInvite.role} Invite</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}?inviteToken=${generatedInvite.token}`}
                    aria-label="Generated invitation link"
                    className="flex-1 text-xs p-1.5 bg-subtle border border-subtle rounded font-mono truncate select-all text-primary"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-2.5 py-1.5 bg-[#1C1917] hover:bg-black dark:bg-[#3D353B] dark:hover:bg-[#4D434B] text-white dark:text-[#F1E9E3] text-xs font-medium rounded flex items-center gap-1 transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Invitations List (Owner only) */}
        {isOwner && invites.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
              Pending Invitations ({invites.filter((i) => !i.used && !i.revoked).length})
            </h4>
            <div className="divide-y divide-subtle border border-subtle rounded-lg bg-surface text-xs max-h-36 overflow-y-auto">
              {invites.map((inv) => (
                <div key={inv.tokenHash} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-primary">{inv.token}</span>
                      <span className="text-[10px] px-1 rounded bg-accent-subtle text-accent border border-accent-subtle font-medium">
                        {inv.role}
                      </span>
                      {inv.used && <span className="text-[10px] text-zinc-500 font-medium">Consumed</span>}
                      {inv.revoked && <span className="text-[10px] text-rose-500 font-medium">Revoked</span>}
                    </div>
                    <span className="text-[10px] text-secondary">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  {!inv.used && !inv.revoked && (
                    <button
                      onClick={() => handleRevokeInvite(inv.tokenHash)}
                      className="text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3 h-3" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Join Event via Token Section */}
        <div className="border-t border-subtle pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Redeem / Preview Invitation Token
          </h4>

          <div className="flex items-center gap-2">
            <input
              id="join-token-input"
              data-testid="join-token-input"
              type="text"
              placeholder="Paste invitation token (inv_...)"
              aria-label="Invitation token"
              value={joinTokenInput}
              onChange={(e) => setJoinTokenInput(e.target.value)}
              className="flex-1 text-xs p-2 rounded border border-subtle bg-surface text-primary font-mono focus:outline-hidden focus:border-[#B85C3A] dark:focus:border-[#D48668]"
            />
            <button
              onClick={handleInspectJoinToken}
              disabled={isLoading || !joinTokenInput.trim()}
              className="px-3 py-2 bg-accent-subtle hover:bg-accent-subtle/80 text-accent text-xs font-medium rounded border border-accent-subtle transition flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
          </div>

          {/* Invitation Preview Card */}
          {invitePreview && (
            <div className="p-3 bg-surface border border-subtle rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-primary">
                <span>{invitePreview.eventName}</span>
                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {invitePreview.role}
                </span>
              </div>
              <p className="text-[11px] text-secondary">
                Invited by <span className="font-medium text-primary">{invitePreview.inviterName}</span> • Status:{' '}
                <strong className={invitePreview.status === 'valid' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                  {invitePreview.status.toUpperCase()}
                </strong>
              </p>

              {invitePreview.status === 'valid' ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAcceptJoin}
                    disabled={isLoading}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept & Join Event</span>
                  </button>
                  <button
                    onClick={handleDeclineJoin}
                    disabled={isLoading}
                    className="py-1.5 px-3 bg-subtle hover:bg-muted text-secondary text-xs font-medium rounded border border-subtle transition cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  This invitation cannot be accepted because it has been {invitePreview.status}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
