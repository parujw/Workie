import type { WorkspaceData } from './types';

export const COLLECTIONS = ['projects', 'tasks', 'notes', 'dayPlans', 'briefs'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const EMPTY_DATA: WorkspaceData = {
  projects: [],
  tasks: [],
  notes: [],
  dayPlans: [],
  briefs: [],
};

/** Thrown when the stored record is newer than the one being written. */
export class ConflictError extends Error {
  constructor(
    public readonly collection: CollectionName,
    public readonly id: string,
    public readonly storedRev: number,
    public readonly attemptedRev: number,
  ) {
    super(
      `ข้อมูลถูกแก้ไขจากหน้าต่างหรืออุปกรณ์อื่นแล้ว (rev ${storedRev} > ${attemptedRev}) — โปรดรีเฟรชแล้วแก้ไขอีกครั้ง`,
    );
    this.name = 'ConflictError';
  }
}

export interface Repo {
  readonly mode: 'firestore' | 'local';
  /** Live subscription. Fires immediately with the current snapshot. */
  subscribe(onData: (data: WorkspaceData) => void, onError: (err: Error) => void): () => void;
  /**
   * Write a record. `expectedRev` is the rev the caller last saw; the write is
   * rejected with ConflictError if storage already moved past it.
   */
  put<T extends { id: string; rev: number }>(
    collection: CollectionName,
    record: T,
    expectedRev: number,
  ): Promise<void>;
  remove(collection: CollectionName, id: string): Promise<void>;
  /** Bulk write used by seeding and by accepting several drafts at once. */
  putMany(writes: Array<{ collection: CollectionName; record: { id: string } }>): Promise<void>;
}
