import {
  collection as fsCollection,
  doc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS, ConflictError, EMPTY_DATA, type CollectionName, type Repo } from './repo';
import type { WorkspaceData } from './types';

/**
 * Firestore-backed store. Layout:
 *   workspaces/{workspaceId}/{collection}/{docId}
 * The workspace id is the access secret (see firestore.rules).
 */
export class FirestoreRepo implements Repo {
  readonly mode = 'firestore' as const;

  constructor(
    private readonly db: Firestore,
    private readonly workspaceId: string,
  ) {}

  private path(collection: CollectionName) {
    return fsCollection(this.db, 'workspaces', this.workspaceId, collection);
  }

  subscribe(onData: (d: WorkspaceData) => void, onError: (e: Error) => void): () => void {
    const data: WorkspaceData = { ...EMPTY_DATA };
    const seen = new Set<CollectionName>();

    const unsubs = COLLECTIONS.map((name) =>
      onSnapshot(
        this.path(name),
        (snap) => {
          (data[name] as unknown[]) = snap.docs.map((d) => d.data());
          seen.add(name);
          // Emit only once every collection has reported, so the UI never
          // renders a half-loaded workspace.
          if (seen.size === COLLECTIONS.length) onData({ ...data });
        },
        (err) => onError(err as Error),
      ),
    );

    return () => unsubs.forEach((u) => u());
  }

  async put<T extends { id: string; rev: number }>(
    collection: CollectionName,
    record: T,
    expectedRev: number,
  ): Promise<void> {
    const ref = doc(this.db, 'workspaces', this.workspaceId, collection, record.id);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const storedRev = (snap.data().rev as number) ?? 0;
        if (storedRev > expectedRev) {
          throw new ConflictError(collection, record.id, storedRev, expectedRev);
        }
      }
      tx.set(ref, stripUndefined(record));
    });
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    await deleteDoc(doc(this.db, 'workspaces', this.workspaceId, collection, id));
  }

  async putMany(writes: Array<{ collection: CollectionName; record: { id: string } }>): Promise<void> {
    // Firestore batches cap at 500 writes; chunk to stay inside the limit.
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const w of writes.slice(i, i + 400)) {
        batch.set(
          doc(this.db, 'workspaces', this.workspaceId, w.collection, w.record.id),
          stripUndefined(w.record),
        );
      }
      await batch.commit();
    }
  }
}

/** Firestore rejects `undefined`; blank fields are stored as null or ''. */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (v === undefined ? null : v))) as T;
}

/** Records this device as a member so the security rules will let it read/write. */
export async function joinWorkspace(db: Firestore, workspaceId: string, uid: string): Promise<void> {
  const ref = doc(db, 'workspaces', workspaceId);
  await setDoc(
    ref,
    { id: workspaceId, members: { [uid]: true }, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}
