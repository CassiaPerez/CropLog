const SYNC_STATE_KEY = 'logistics_sync_state';

interface SyncState {
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  syncInProgress: boolean;
}

const DEFAULT_STATE: SyncState = {
  lastSyncAt: null,
  lastFullSyncAt: null,
  syncInProgress: false,
};

export function getSyncState(): SyncState {
  try {
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    if (!stored) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(stored) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function updateSyncState(updates: Partial<SyncState>): void {
  const current = getSyncState();
  const updated = { ...current, ...updates };
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(updated));
}

export function getLastSyncAt(): string | null {
  return getSyncState().lastSyncAt;
}

export function setLastSyncAt(timestamp: string): void {
  updateSyncState({ lastSyncAt: timestamp });
}

export function getLastFullSyncAt(): string | null {
  return getSyncState().lastFullSyncAt;
}

export function setLastFullSyncAt(timestamp: string): void {
  updateSyncState({ lastFullSyncAt: timestamp });
}

export function isSyncInProgress(): boolean {
  return getSyncState().syncInProgress;
}

export function setSyncInProgress(inProgress: boolean): void {
  updateSyncState({ syncInProgress: inProgress });
}

export function shouldDoFullSync(): boolean {
  const lastFullSync = getLastFullSyncAt();
  if (!lastFullSync) return true;

  const hoursSinceLastFull = (Date.now() - new Date(lastFullSync).getTime()) / (1000 * 60 * 60);
  return hoursSinceLastFull >= 24;
}
