import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  collaborationClient,
  CollaborationState,
  PendingInvite,
  InvitePreview,
} from '../../services/collaborationClient';
import {
  Users,
  Shield,
  UserPlus,
  Link,
  Copy,
  Check,
  Trash2,
  Clock,
  Eye,
  AlertCircle,
  XCircle,
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

        {/* Status & Active Role Overview */}
        <div className="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#A2421D]" />
            <div>
              <span className="text-[#78716C]">Your Active Role: </span>
              <span className="font-semibold uppercase px-2 py-0.5 rounded text-[10px] bg-[#FAF0EB] text-[#A2421D] border border-[#F3CEBE]">
                {collabState.role || 'Coordinator'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[#78716C]">Plan Version: </span>
              <span className="font-mono font-bold text-[#1C1917]">v{collabState.serverVersion}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  collabState.status === 'synced'
                    ? 'bg-emerald-500'
                    : collabState.status === 'conflict'
                    ? 'bg-rose-500'
                    : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="capitalize">{collabState.status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Active Members List */}
        <div>
          <h4 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#78716C]" />
            <span>Celebration Collaborators ({collabState.members.length})</span>
          </h4>

          <div className="divide-y divide-[#F4EFEA] border border-[#E6DFD5] rounded-lg bg-[#FFFFFF] overflow-hidden text-xs">
            {collabState.members.length === 0 ? (
              <p className="p-4 text-center text-[#78716C]">No collaborators added yet.</p>
            ) : (
              collabState.members.map((member) => (
                <div key={member.userId} className="p-3 flex items-center justify-between gap-2 hover:bg-[#FAF8F5] transition">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1C1917] truncate">{member.userName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          member.role === 'owner'
                            ? 'bg-amber-100 text-amber-800'
                            : member.role === 'editor'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {member.role.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#78716C] truncate">{member.userEmail}</p>
                  </div>

                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.userName)}
                      className="p-1 rounded text-[#78716C] hover:text-rose-700 hover:bg-rose-50 transition"
                      title="Revoke access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Generate Invitation (Owner and Editor) */}
        {canInvite && (
          <div className="border border-[#E6DFD5] rounded-lg p-4 bg-[#FAF8F5] space-y-3">
            <h4 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#A2421D]" />
              <span>Invite New Collaborator</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="collab-role-select" className="block text-[11px] font-medium text-[#78716C] mb-1">Collaborator Role</label>
                <select
                  id="collab-role-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'owner' | 'editor' | 'viewer')}
                  className="w-full text-xs p-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] focus:outline-hidden focus:border-[#A2421D]"
                >
                  <option value="editor">Editor (Can edit budget, tasks & vendors)</option>
                  <option value="viewer">Viewer (Read-only observation)</option>
                  {isOwner && <option value="owner">Co-Owner (Full event control)</option>}
                </select>
              </div>

              <div>
                <label htmlFor="invite-duration" className="block text-[11px] font-medium text-[#78716C] mb-1">Link Expiration</label>
                <select
                  id="invite-duration"
                  value={inviteExpiresHours}
                  onChange={(e) => setInviteExpiresHours(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] focus:outline-hidden focus:border-[#A2421D]"
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
              className="w-full py-2 px-3 bg-[#A2421D] hover:bg-[#863414] text-white text-xs font-medium rounded transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Link className="w-3.5 h-3.5" />
              <span>Generate Single-Use Secure Invite Link</span>
            </button>

            {/* Generated Invite Display */}
            {generatedInvite && (
              <div className="p-3 bg-white border border-[#E6DFD5] rounded-md space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs text-[#78716C]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-emerald-700 uppercase">{generatedInvite.role} Invite</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}?inviteToken=${generatedInvite.token}`}
                    aria-label="Generated invitation link"
                    className="flex-1 text-xs p-1.5 bg-[#FAF8F5] border border-[#E6DFD5] rounded font-mono truncate select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-2.5 py-1.5 bg-[#1C1917] hover:bg-black text-white text-xs font-medium rounded flex items-center gap-1 transition"
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
            <h4 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider mb-2">
              Pending Invitations ({invites.filter((i) => !i.used && !i.revoked).length})
            </h4>
            <div className="divide-y divide-[#F4EFEA] border border-[#E6DFD5] rounded-lg bg-[#FFFFFF] text-xs max-h-36 overflow-y-auto">
              {invites.map((inv) => (
                <div key={inv.tokenHash} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#1C1917]">{inv.token}</span>
                      <span className="text-[10px] px-1 rounded bg-[#FAF0EB] text-[#A2421D] font-medium">
                        {inv.role}
                      </span>
                      {inv.used && <span className="text-[10px] text-zinc-500 font-medium">Consumed</span>}
                      {inv.revoked && <span className="text-[10px] text-rose-500 font-medium">Revoked</span>}
                    </div>
                    <span className="text-[10px] text-[#78716C]">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>

                  {!inv.used && !inv.revoked && (
                    <button
                      onClick={() => handleRevokeInvite(inv.tokenHash)}
                      className="text-rose-700 hover:text-rose-900 text-[11px] font-medium flex items-center gap-1"
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
        <div className="border-t border-[#E6DFD5] pt-4 space-y-3">
          <h4 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
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
              className="flex-1 text-xs p-2 rounded border border-[#D6CFC7] bg-[#FFFFFF] text-[#1C1917] font-mono focus:outline-hidden focus:border-[#A2421D]"
            />
            <button
              onClick={handleInspectJoinToken}
              disabled={isLoading || !joinTokenInput.trim()}
              className="px-3 py-2 bg-[#FAF0EB] hover:bg-[#F3CEBE] text-[#A2421D] text-xs font-medium rounded border border-[#F3CEBE] transition flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect</span>
            </button>
          </div>

          {/* Invitation Preview Card */}
          {invitePreview && (
            <div className="p-3 bg-white border border-[#E6DFD5] rounded-md space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[#1C1917]">
                <span>{invitePreview.eventName}</span>
                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">
                  {invitePreview.role}
                </span>
              </div>
              <p className="text-[11px] text-[#78716C]">
                Invited by <span className="font-medium text-[#1C1917]">{invitePreview.inviterName}</span> • Status:{' '}
                <strong className={invitePreview.status === 'valid' ? 'text-emerald-700' : 'text-rose-700'}>
                  {invitePreview.status.toUpperCase()}
                </strong>
              </p>

              {invitePreview.status === 'valid' ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAcceptJoin}
                    disabled={isLoading}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded transition flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept & Join Event</span>
                  </button>
                  <button
                    onClick={handleDeclineJoin}
                    disabled={isLoading}
                    className="py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium rounded transition"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-rose-600 font-medium">
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
