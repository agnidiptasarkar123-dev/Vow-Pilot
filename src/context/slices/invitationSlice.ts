import { AppState, ChangeRecord, InvitationDesign } from '../../types';

export function handleSaveInvitation(state: AppState, invitation: InvitationDesign): AppState {
  const existingInvitations = state.invitations || [];
  const existingIndex = existingInvitations.findIndex((inv) => inv.id === invitation.id);

  let updatedList: InvitationDesign[];
  const now = new Date().toISOString();
  const updatedItem = { ...invitation, updatedAt: now };

  if (existingIndex >= 0) {
    updatedList = [...existingInvitations];
    updatedList[existingIndex] = updatedItem;
  } else {
    updatedList = [...existingInvitations, updatedItem];
  }

  const changeRecord: ChangeRecord = {
    id: `chg-inv-${Date.now()}`,
    timestamp: now,
    changeType: 'invitation',
    description: `Saved invitation design "${invitation.name}".`,
    deltaSummary: `Template: ${invitation.templateId}, Format: ${invitation.printSize}.`,
  };

  return {
    ...state,
    invitations: updatedList,
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleDeleteInvitation(state: AppState, invitationId: string): AppState {
  const existingInvitations = state.invitations || [];
  const target = existingInvitations.find((inv) => inv.id === invitationId);
  if (!target) return state;

  const now = new Date().toISOString();
  const changeRecord: ChangeRecord = {
    id: `chg-inv-${Date.now()}`,
    timestamp: now,
    changeType: 'invitation',
    description: `Deleted invitation design "${target.name}".`,
  };

  return {
    ...state,
    invitations: existingInvitations.filter((inv) => inv.id !== invitationId),
    changeLog: [changeRecord, ...state.changeLog],
  };
}

export function handleDuplicateInvitation(state: AppState, invitationId: string): AppState {
  const existingInvitations = state.invitations || [];
  const target = existingInvitations.find((inv) => inv.id === invitationId);
  if (!target) return state;

  const now = new Date().toISOString();
  const newId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const duplicate: InvitationDesign = {
    ...target,
    id: newId,
    name: `${target.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };

  const changeRecord: ChangeRecord = {
    id: `chg-inv-${Date.now()}`,
    timestamp: now,
    changeType: 'invitation',
    description: `Duplicated invitation "${target.name}" to create "${duplicate.name}".`,
  };

  return {
    ...state,
    invitations: [...existingInvitations, duplicate],
    changeLog: [changeRecord, ...state.changeLog],
  };
}
