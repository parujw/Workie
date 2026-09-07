'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ConflictError, EMPTY_DATA, type CollectionName, type Repo } from './repo';
import { LocalRepo } from './repo-local';
import { FirestoreRepo, joinWorkspace } from './repo-firestore';
import { ensureAnonymousUser, getDb, isFirebaseConfigured } from './firebase';
import { newId, newWorkspaceId, randomId } from './id';
import { buildSamples } from './samples';
import { today } from './date';
import type {
  BaseRecord,
  Brief,
  DayPlan,
  Note,
  Project,
  SaveState,
  StorageMode,
  Task,
  WorkspaceData,
} from './types';

const WORKSPACE_KEY = 'workier:workspaceId';
const DEVICE_KEY = 'workier:deviceId';
const SEEDED_KEY = 'workier:seeded:';

function readOrCreate(key: string, make: () => string): string {
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const value = make();
    localStorage.setItem(key, value);
    return value;
  } catch {
    return make();
  }
}

type Patch<T> = Partial<Omit<T, keyof BaseRecord>>;

interface StoreValue {
  ready: boolean;
  loadError: string | null;
  storageMode: StorageMode | null;
  workspaceId: string;
  deviceId: string;
  saveState: SaveState;
  dismissSaveState: () => void;

  projects: Project[];
  activeProjects: Project[];
  tasks: Task[];
  notes: Note[];
  dayPlans: DayPlan[];
  briefs: Brief[];

  projectById: (id: string | null) => Project | undefined;
  projectName: (id: string | null) => string;
  tasksOfProject: (projectId: string) => Task[];

  createProject: (input: Partial<Project>) => Promise<Project | null>;
  updateProject: (id: string, patch: Patch<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  createTask: (input: Partial<Task> & { projectId: string; title: string }) => Promise<Task | null>;
  createTasks: (inputs: Array<Partial<Task> & { projectId: string; title: string }>) => Promise<Task[]>;
  updateTask: (id: string, patch: Patch<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  createNote: (input: Partial<Note>) => Promise<Note | null>;
  updateNote: (id: string, patch: Patch<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  dayPlanFor: (date: string) => DayPlan | undefined;
  updateDayPlan: (date: string, patch: Patch<DayPlan>) => Promise<void>;

  saveBrief: (input: Partial<Brief> & { projectId: string }) => Promise<Brief | null>;
  updateBrief: (id: string, patch: Patch<Brief>) => Promise<void>;
  deleteBrief: (id: string) => Promise<void>;

  hasSamples: boolean;
  seedSamples: () => Promise<void>;
  clearSamples: () => Promise<void>;
  switchWorkspace: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [data, setData] = useState<WorkspaceData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const repoRef = useRef<Repo | null>(null);
  // Always read the freshest snapshot when computing a patch, even if a
  // component closed over stale state.
  const dataRef = useRef<WorkspaceData>(EMPTY_DATA);
  dataRef.current = data;

  useEffect(() => {
    setWorkspaceId(readOrCreate(WORKSPACE_KEY, newWorkspaceId));
    setDeviceId(readOrCreate(DEVICE_KEY, () => `dev_${randomId(10)}`));
  }, []);

  useEffect(() => {
    if (!workspaceId || !deviceId) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    async function connect() {
      setReady(false);
      setLoadError(null);
      let repo: Repo;
      if (isFirebaseConfigured()) {
        try {
          const uid = await ensureAnonymousUser();
          const db = getDb();
          await joinWorkspace(db, workspaceId, uid);
          repo = new FirestoreRepo(db, workspaceId);
        } catch (err) {
          if (cancelled) return;
          // Be explicit: the app still works, but only on this device.
          setLoadError(
            `เชื่อมต่อฐานข้อมูลไม่สำเร็จ (${(err as Error).message}) — กำลังใช้ที่เก็บข้อมูลในเครื่องนี้แทน`,
          );
          repo = new LocalRepo(workspaceId);
        }
      } else {
        repo = new LocalRepo(workspaceId);
      }
      if (cancelled) return;
      repoRef.current = repo;
      setStorageMode(repo.mode);
      unsub = repo.subscribe(
        (next) => {
          if (cancelled) return;
          setData(next);
          setReady(true);
        },
        (err) => {
          if (cancelled) return;
          setLoadError(`อ่านข้อมูลไม่สำเร็จ: ${err.message}`);
          setReady(true);
        },
      );
    }

    void connect();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [workspaceId, deviceId]);

  // --- generic write helpers -------------------------------------------------

  const runWrite = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setSaveState({ kind: 'saving' });
    try {
      await fn();
      setSaveState({ kind: 'saved', at: new Date().toISOString() });
      return true;
    } catch (err) {
      if (err instanceof ConflictError) {
        setSaveState({ kind: 'conflict', message: err.message });
      } else {
        setSaveState({ kind: 'error', message: `บันทึกไม่สำเร็จ: ${(err as Error).message}` });
      }
      return false;
    }
  }, []);

  const insert = useCallback(
    async <T extends BaseRecord>(collection: CollectionName, record: T): Promise<T | null> => {
      const repo = repoRef.current;
      if (!repo) return null;
      const ok = await runWrite(() => repo.put(collection, record, 0));
      return ok ? record : null;
    },
    [runWrite],
  );

  const patchRecord = useCallback(
    async <T extends BaseRecord>(
      collection: CollectionName,
      id: string,
      patch: Record<string, unknown>,
    ): Promise<void> => {
      const repo = repoRef.current;
      if (!repo) return;
      const list = dataRef.current[collection] as unknown as T[];
      const current = list.find((r) => r.id === id);
      if (!current) {
        setSaveState({ kind: 'error', message: 'ไม่พบข้อมูลที่ต้องการแก้ไข (อาจถูกลบไปแล้ว)' });
        return;
      }
      const next = {
        ...current,
        ...patch,
        rev: (current.rev ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: deviceId,
      } as T;
      await runWrite(() => repo.put(collection, next, current.rev ?? 0));
    },
    [deviceId, runWrite],
  );

  const removeRecord = useCallback(
    async (collection: CollectionName, id: string) => {
      const repo = repoRef.current;
      if (!repo) return;
      await runWrite(() => repo.remove(collection, id));
    },
    [runWrite],
  );

  const stamp = useCallback((): Omit<BaseRecord, 'id'> => {
    const now = new Date().toISOString();
    return { createdAt: now, updatedAt: now, rev: 1, updatedBy: deviceId };
  }, [deviceId]);

  // --- projects --------------------------------------------------------------

  const createProject = useCallback(
    (input: Partial<Project>) =>
      insert<Project>('projects', {
        id: newId('prj'),
        ...stamp(),
        name: input.name?.trim() || 'โปรเจกต์ใหม่',
        description: input.description ?? '',
        goal: input.goal ?? '',
        endDate: input.endDate ?? null,
        status: input.status ?? 'active',
        color: input.color ?? '#3563e9',
      }),
    [insert, stamp],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      // Tasks/notes/briefs keep pointing at the project id; archiving is the
      // recommended path, so deletion also drops the dependent records.
      const repo = repoRef.current;
      if (!repo) return;
      await runWrite(async () => {
        for (const t of dataRef.current.tasks.filter((t) => t.projectId === id)) {
          await repo.remove('tasks', t.id);
        }
        for (const n of dataRef.current.notes.filter((n) => n.projectId === id)) {
          await repo.remove('notes', n.id);
        }
        for (const b of dataRef.current.briefs.filter((b) => b.projectId === id)) {
          await repo.remove('briefs', b.id);
        }
        await repo.remove('projects', id);
      });
    },
    [runWrite],
  );

  // --- tasks -----------------------------------------------------------------

  const buildTask = useCallback(
    (input: Partial<Task> & { projectId: string; title: string }): Task => ({
      id: newId('tsk'),
      ...stamp(),
      projectId: input.projectId,
      title: input.title,
      deliverable: input.deliverable ?? '',
      nextStep: input.nextStep ?? '',
      owner: input.owner ?? '',
      waitingFor: input.waitingFor ?? '',
      startDate: input.startDate ?? null,
      draftDate: input.draftDate ?? null,
      reviewDate: input.reviewDate ?? null,
      dueDate: input.dueDate ?? null,
      estimateHours: input.estimateHours ?? null,
      estimateSource: input.estimateSource ?? null,
      status: input.status ?? 'not_started',
      notes: input.notes ?? '',
      sourceNoteId: input.sourceNoteId ?? null,
      sourceExcerpt: input.sourceExcerpt ?? null,
      completedAt: null,
    }),
    [stamp],
  );

  const createTask = useCallback(
    (input: Partial<Task> & { projectId: string; title: string }) =>
      insert<Task>('tasks', buildTask(input)),
    [buildTask, insert],
  );

  const createTasks = useCallback(
    async (inputs: Array<Partial<Task> & { projectId: string; title: string }>): Promise<Task[]> => {
      const repo = repoRef.current;
      if (!repo || inputs.length === 0) return [];
      const records = inputs.map(buildTask);
      const ok = await runWrite(() =>
        repo.putMany(records.map((record) => ({ collection: 'tasks' as const, record }))),
      );
      return ok ? records : [];
    },
    [buildTask, runWrite],
  );

  const updateTask = useCallback(
    (id: string, patch: Patch<Task>) => {
      const extra: Record<string, unknown> = { ...patch };
      // Completing stamps the time; re-opening clears it so finished work can
      // come back into play.
      if (patch.status === 'done') extra.completedAt = new Date().toISOString();
      if (patch.status && patch.status !== 'done') extra.completedAt = null;
      return patchRecord<Task>('tasks', id, extra);
    },
    [patchRecord],
  );

  // --- notes -----------------------------------------------------------------

  const createNote = useCallback(
    (input: Partial<Note>) =>
      insert<Note>('notes', {
        id: newId('not'),
        ...stamp(),
        projectId: input.projectId ?? null,
        rawText: input.rawText ?? '',
        source: input.source ?? '',
        analysis: input.analysis ?? null,
        acceptedDraftIds: input.acceptedDraftIds ?? [],
      }),
    [insert, stamp],
  );

  // --- day plans -------------------------------------------------------------

  const dayPlanFor = useCallback(
    (date: string) => dataRef.current.dayPlans.find((p) => p.id === date),
    [],
  );

  const updateDayPlan = useCallback(
    async (date: string, patch: Patch<DayPlan>) => {
      const existing = dataRef.current.dayPlans.find((p) => p.id === date);
      if (existing) {
        await patchRecord<DayPlan>('dayPlans', date, patch as Record<string, unknown>);
        return;
      }
      await insert<DayPlan>('dayPlans', {
        id: date,
        ...stamp(),
        date,
        focusTaskIds: patch.focusTaskIds ?? [],
        capacityHours: patch.capacityHours ?? null,
        suggestion: patch.suggestion ?? null,
      });
    },
    [insert, patchRecord, stamp],
  );

  // --- briefs ----------------------------------------------------------------

  const saveBrief = useCallback(
    (input: Partial<Brief> & { projectId: string }) =>
      insert<Brief>('briefs', {
        id: newId('brf'),
        ...stamp(),
        projectId: input.projectId,
        userInput: input.userInput ?? '',
        fivePoints: input.fivePoints ?? {
          purpose: '',
          progress: '',
          changes: '',
          blockers: '',
          next: '',
        },
        onePager: input.onePager ?? '',
        script: input.script ?? '',
        slides: input.slides ?? [],
        qa: input.qa ?? [],
        unknowns: input.unknowns ?? [],
        model: input.model ?? null,
        saved: true,
      }),
    [insert, stamp],
  );

  // --- samples ---------------------------------------------------------------

  const hasSamples = useMemo(
    () => data.projects.some((p) => p.isSample) || data.tasks.some((t) => t.isSample),
    [data.projects, data.tasks],
  );

  const seedSamples = useCallback(async () => {
    const repo = repoRef.current;
    if (!repo) return;
    const { projects, tasks } = buildSamples(deviceId);
    await runWrite(() =>
      repo.putMany([
        ...projects.map((record) => ({ collection: 'projects' as const, record })),
        ...tasks.map((record) => ({ collection: 'tasks' as const, record })),
      ]),
    );
  }, [deviceId, runWrite]);

  const clearSamples = useCallback(async () => {
    const repo = repoRef.current;
    if (!repo) return;
    await runWrite(async () => {
      const d = dataRef.current;
      for (const t of d.tasks.filter((t) => t.isSample)) await repo.remove('tasks', t.id);
      for (const n of d.notes.filter((n) => n.isSample)) await repo.remove('notes', n.id);
      for (const b of d.briefs.filter((b) => b.isSample)) await repo.remove('briefs', b.id);
      for (const p of d.projects.filter((p) => p.isSample)) await repo.remove('projects', p.id);
    });
  }, [runWrite]);

  // Seed once per workspace, and only while it is genuinely empty.
  useEffect(() => {
    if (!ready || !workspaceId) return;
    if (data.projects.length > 0) return;
    const key = SEEDED_KEY + workspaceId;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      return;
    }
    void seedSamples();
  }, [ready, workspaceId, data.projects.length, seedSamples]);

  const switchWorkspace = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(WORKSPACE_KEY, trimmed);
    } catch {
      /* storage blocked — the in-memory switch below still applies */
    }
    setData(EMPTY_DATA);
    setWorkspaceId(trimmed);
  }, []);

  const activeProjects = useMemo(
    () => data.projects.filter((p) => p.status === 'active'),
    [data.projects],
  );

  const projectById = useCallback(
    (id: string | null) => (id ? data.projects.find((p) => p.id === id) : undefined),
    [data.projects],
  );

  const value: StoreValue = {
    ready,
    loadError,
    storageMode,
    workspaceId,
    deviceId,
    saveState,
    dismissSaveState: () => setSaveState({ kind: 'idle' }),

    projects: data.projects,
    activeProjects,
    tasks: data.tasks,
    notes: data.notes,
    dayPlans: data.dayPlans,
    briefs: data.briefs,

    projectById,
    projectName: (id) => projectById(id)?.name ?? 'ยังไม่กำหนดโปรเจกต์',
    tasksOfProject: (projectId) => data.tasks.filter((t) => t.projectId === projectId),

    createProject,
    updateProject: (id, patch) => patchRecord<Project>('projects', id, patch as Record<string, unknown>),
    deleteProject,

    createTask,
    createTasks,
    updateTask,
    deleteTask: (id) => removeRecord('tasks', id),

    createNote,
    updateNote: (id, patch) => patchRecord<Note>('notes', id, patch as Record<string, unknown>),
    deleteNote: (id) => removeRecord('notes', id),

    dayPlanFor,
    updateDayPlan,

    saveBrief,
    updateBrief: (id, patch) => patchRecord<Brief>('briefs', id, patch as Record<string, unknown>),
    deleteBrief: (id) => removeRecord('briefs', id),

    hasSamples,
    seedSamples,
    clearSamples,
    switchWorkspace,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore ต้องอยู่ภายใน StoreProvider');
  return ctx;
}

export { today };
