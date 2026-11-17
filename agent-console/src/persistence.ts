import type { ConsoleState, ProjectTask } from './types'

const STORAGE_KEY = 'agent-console:state:v1'

export const DEFAULT_QUOTA_THRESHOLD = 0.1

export function createEmptyTask(partial?: Partial<ProjectTask>): ProjectTask {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: '',
    brief: '',
    acceptance: [],
    stage: 'intake',
    roles: [],
    modelNote: '',
    status: 'working',
    artifacts: [],
    noArtifact: false,
    checklist: [
      { id: crypto.randomUUID(), label: 'What worked', done: false },
      { id: crypto.randomUUID(), label: 'Gaps / risks', done: false },
      { id: crypto.randomUUID(), label: 'Next steps', done: false },
    ],
    retrospectiveNotes: '',
    closed: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

export function defaultState(): ConsoleState {
  return {
    version: 1,
    task: null,
    quotaThreshold: DEFAULT_QUOTA_THRESHOLD,
    lastSavedAt: null,
    lastAutoSavedAt: null,
  }
}

export function loadState(): ConsoleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as ConsoleState
    if (parsed?.version !== 1) return defaultState()
    return {
      ...defaultState(),
      ...parsed,
      quotaThreshold:
        typeof parsed.quotaThreshold === 'number'
          ? parsed.quotaThreshold
          : DEFAULT_QUOTA_THRESHOLD,
    }
  } catch {
    return defaultState()
  }
}

export function saveState(state: ConsoleState): ConsoleState {
  const now = new Date().toISOString()
  const next: ConsoleState = {
    ...state,
    lastSavedAt: now,
    task: state.task ? { ...state.task, updatedAt: now } : null,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function exportStateJson(state: ConsoleState): string {
  return JSON.stringify(state, null, 2)
}

export function importStateJson(json: string): ConsoleState {
  const parsed = JSON.parse(json) as ConsoleState
  if (parsed?.version !== 1) {
    throw new Error('Unsupported export version')
  }
  return saveState({
    ...defaultState(),
    ...parsed,
  })
}

export function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
