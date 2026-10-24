import { ChangeRecord } from '../../types';

export const createChangeRecord = (
  changeType: ChangeRecord['changeType'],
  description: string,
  deltaSummary?: string
): ChangeRecord => {
  return {
    id: `chg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    changeType,
    description,
    deltaSummary,
  };
};
