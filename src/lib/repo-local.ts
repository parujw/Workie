import { COLLECTIONS, ConflictError, EMPTY_DATA, type CollectionName, type Repo } from './repo';
import type { WorkspaceData } from './types';

const KEY_PREFIX = 'workier:data:';
const CHANNEL = 'workier-sync';

type Listener = (data: WorkspaceData) => void;

function read(workspaceId: string): WorkspaceData {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + workspaceId);
    if (!raw) return { ...EMPTY_DATA };
    const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
    const out = { ...EMPTY_DATA } as WorkspaceData;
    for (const c of COLLECTIONS) {
      const arr = parsed[c];
      if (Array.isArray(arr)) (out[c] as unknown[]) = arr;
    }
    return out;
  } catch {
    return { ...EMPTY_DATA };
  }
}

function write(workspaceId: string, data: WorkspaceData) {
  localStorage.setItem(KEY_PREFIX + workspaceId, JSON.stringify(data));
}

/**
 * Fallback store used when Firebase is not configured. Data lives in this
 * browser only — the UI says so plainly rather than pretending it syncs.
 */
export class LocalRepo implements Repo {
  readonly mode = 'local' as const;
  private listeners = new Set<Listener>();
  private channel: BroadcastChannel | null = null;

  constructor(private readonly workspaceId: string) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (ev) => {
        if (ev.data?.workspaceId === this.workspaceId) this.emit();
      };
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === KEY_PREFIX + this.workspaceId) this.emit();
      });
    }
  }

  private emit() {
    const data = read(this.workspaceId);
    for (const l of this.listeners) l(data);
  }

  private broadcast() {
    this.channel?.postMessage({ workspaceId: this.workspaceId });
  }

  subscribe(onData: Listener): () => void {
    this.listeners.add(onData);
    onData(read(this.workspaceId));
    return () => {
      this.listeners.delete(onData);
    };
  }

  async put<T extends { id: string; rev: number }>(
    collection: CollectionName,
    record: T,
    expectedRev: number,
  ): Promise<void> {
    const data = read(this.workspaceId);
    const list = data[collection] as unknown as T[];
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      const stored = list[idx];
      if ((stored.rev ?? 0) > expectedRev) {
        throw new ConflictError(collection, record.id, stored.rev ?? 0, expectedRev);
      }
      list[idx] = record;
    } else {
      list.push(record);
    }
    write(this.workspaceId, data);
    this.broadcast();
    this.emit();
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const data = read(this.workspaceId);
    const list = data[collection] as unknown as Array<{ id: string }>;
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) list.splice(idx, 1);
    write(this.workspaceId, data);
    this.broadcast();
    this.emit();
  }

  async putMany(writes: Array<{ collection: CollectionName; record: { id: string } }>): Promise<void> {
    const data = read(this.workspaceId);
    for (const w of writes) {
      const list = data[w.collection] as unknown as Array<{ id: string }>;
      const idx = list.findIndex((r) => r.id === w.record.id);
      if (idx >= 0) list[idx] = w.record;
      else list.push(w.record);
    }
    write(this.workspaceId, data);
    this.broadcast();
    this.emit();
  }
}
