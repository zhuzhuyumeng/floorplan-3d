import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bindExtensionContext,
  listExtensions,
  runExtensions,
  type ExtensionContext,
} from '../extensions'
import {
  createEmptyTask,
  downloadJson,
  exportStateJson,
  importStateJson,
  loadState,
  saveState,
} from '../persistence'
import { createMockQuotaProvider } from '../quota/MockQuotaProvider'
import {
  createQuotaProvider,
  setQuotaProviderFactory,
} from '../quota/QuotaProvider'
import type {
  AgentRole,
  ConsoleState,
  ProjectTask,
  QuotaSnapshot,
  StageId,
} from '../types'
import { WORKFLOW_STAGES } from '../types'
import { canAdvanceFrom } from '../workflow/gates'

setQuotaProviderFactory(createMockQuotaProvider)

const SAVE_DEBOUNCE_MS = 400

export function useConsole() {
  const [state, setState] = useState<ConsoleState>(() => loadState())
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null)
  const [quotaWarning, setQuotaWarning] = useState(false)
  const [activity, setActivity] = useState<string[]>([])
  const [banner, setBanner] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const stateRef = useRef(state)
  const quotaRef = useRef(quota)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSavedForWarning = useRef(false)
  const prevStageRef = useRef<StageId | null>(state.task?.stage ?? null)
  const ctxApiRef = useRef({
    applyTaskPatch: (_patch: Partial<ProjectTask>) => {},
    flushPersist: (_incoming?: ConsoleState, _opts?: { auto?: boolean }) =>
      stateRef.current,
    pushLog: (_message: string, _detail?: unknown) => {},
  })

  stateRef.current = state
  quotaRef.current = quota

  const pushLog = useCallback((message: string, detail?: unknown) => {
    const line =
      detail === undefined
        ? message
        : `${message} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
    setActivity((prev) => [line, ...prev].slice(0, 40))
  }, [])

  const getContext = useCallback((): ExtensionContext => {
    return {
      getTask: () => stateRef.current.task,
      setTask: (patch) => ctxApiRef.current.applyTaskPatch(patch),
      persist: () => {
        ctxApiRef.current.flushPersist(stateRef.current)
      },
      getQuota: () => ({
        remaining: quotaRef.current?.remaining ?? 0,
        limit: quotaRef.current?.limit ?? 1,
      }),
      getState: () => stateRef.current,
      log: (message, detail) => ctxApiRef.current.pushLog(message, detail),
    }
  }, [])

  const flushPersist = useCallback(
    (incoming?: ConsoleState, opts?: { auto?: boolean }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      let snapshot = incoming ?? stateRef.current
      runExtensions((ext) => {
        if (ext.onBeforePersist) {
          snapshot = ext.onBeforePersist(snapshot, getContext())
        }
      })
      let saved = saveState(snapshot)
      if (opts?.auto) {
        saved = saveState({
          ...saved,
          lastAutoSavedAt: new Date().toISOString(),
        })
        setBanner('Low quota — state auto-saved')
      }
      setState(saved)
      stateRef.current = saved
      const stamp = new Date(saved.lastSavedAt ?? Date.now())
      setSavedFlash(
        `Saved · ${stamp.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}`,
      )
      runExtensions((ext) => ext.onAfterPersist?.(getContext()))
      return saved
    },
    [getContext],
  )

  const schedulePersist = useCallback(
    (next: ConsoleState) => {
      setState(next)
      stateRef.current = next
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        flushPersist(stateRef.current)
      }, SAVE_DEBOUNCE_MS)
    },
    [flushPersist],
  )

  const applyTaskPatch = useCallback(
    (patch: Partial<ProjectTask>) => {
      const current = stateRef.current
      if (!current.task) return
      const task = { ...current.task, ...patch }
      schedulePersist({ ...current, task })
    },
    [schedulePersist],
  )

  ctxApiRef.current = { applyTaskPatch, flushPersist, pushLog }

  useEffect(() => {
    bindExtensionContext(getContext)
  }, [getContext])

  useEffect(() => {
    const provider = createQuotaProvider()
    setQuota(provider.getSnapshot())
    const unsub = provider.subscribe?.((snap) => setQuota(snap))
    return () => unsub?.()
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        flushPersist(stateRef.current)
      }
    }
    const onUnload = () => {
      flushPersist(stateRef.current)
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [flushPersist])

  useEffect(() => {
    if (!quota) return
    const low = quota.remainingRatio <= state.quotaThreshold
    setQuotaWarning(low)
    if (low && !autoSavedForWarning.current) {
      autoSavedForWarning.current = true
      flushPersist(stateRef.current, { auto: true })
      runExtensions((ext) => ext.onQuotaLow?.(quota, getContext()))
    }
    if (!low) autoSavedForWarning.current = false
  }, [quota, state.quotaThreshold, flushPersist, getContext])

  useEffect(() => {
    const stage = state.task?.stage ?? null
    if (stage && prevStageRef.current && prevStageRef.current !== stage) {
      const left = prevStageRef.current
      runExtensions((ext) => ext.onStageLeave?.(left, getContext()))
      runExtensions((ext) => ext.onStageEnter?.(stage, getContext()))
    } else if (stage && !prevStageRef.current) {
      runExtensions((ext) => ext.onStageEnter?.(stage, getContext()))
    }
    prevStageRef.current = stage
  }, [state.task?.stage, getContext])

  const startTask = useCallback(() => {
    const task = createEmptyTask()
    flushPersist({ ...stateRef.current, task })
    setBanner(null)
  }, [flushPersist])

  const clearTask = useCallback(() => {
    flushPersist({
      ...stateRef.current,
      task: null,
      lastAutoSavedAt: null,
    })
    setBanner(null)
  }, [flushPersist])

  const goStage = useCallback(
    (stage: StageId) => {
      applyTaskPatch({ stage })
    },
    [applyTaskPatch],
  )

  const advance = useCallback(() => {
    const task = stateRef.current.task
    if (!task || !canAdvanceFrom(task)) return
    if (task.stage === 'review') {
      const closedTask = { ...task, closed: true }
      flushPersist({
        ...stateRef.current,
        task: closedTask,
      })
      setBanner('Task marked closed.')
      return
    }
    const i = WORKFLOW_STAGES.indexOf(task.stage)
    const next = WORKFLOW_STAGES[i + 1]
    if (next) goStage(next)
  }, [flushPersist, goStage])

  const retreat = useCallback(() => {
    const task = stateRef.current.task
    if (!task) return
    const i = WORKFLOW_STAGES.indexOf(task.stage)
    if (i > 0) goStage(WORKFLOW_STAGES[i - 1])
  }, [goStage])

  const addRole = useCallback(
    (role: Omit<AgentRole, 'id'>) => {
      const task = stateRef.current.task
      if (!task) return
      applyTaskPatch({
        roles: [...task.roles, { ...role, id: crypto.randomUUID() }],
      })
    },
    [applyTaskPatch],
  )

  const removeRole = useCallback(
    (id: string) => {
      const task = stateRef.current.task
      if (!task) return
      applyTaskPatch({ roles: task.roles.filter((r) => r.id !== id) })
    },
    [applyTaskPatch],
  )

  const setThreshold = useCallback(
    (quotaThreshold: number) => {
      schedulePersist({ ...stateRef.current, quotaThreshold })
    },
    [schedulePersist],
  )

  const burnQuota = useCallback((units = 3) => {
    const provider = createQuotaProvider()
    const snap = provider.consume?.(units)
    if (snap) setQuota(snap)
  }, [])

  const resetQuota = useCallback(() => {
    const provider = createQuotaProvider()
    autoSavedForWarning.current = false
    const snap = provider.reset?.()
    if (snap) setQuota(snap)
    setBanner(null)
    setQuotaWarning(false)
  }, [])

  const exportJson = useCallback(() => {
    flushPersist(stateRef.current)
    downloadJson(
      `agent-console-${new Date().toISOString().slice(0, 10)}.json`,
      exportStateJson(stateRef.current),
    )
  }, [flushPersist])

  const importJson = useCallback(async (file: File) => {
    const text = await file.text()
    const next = importStateJson(text)
    setState(next)
    stateRef.current = next
    setBanner('Imported project state.')
  }, [])

  const manualSave = useCallback(() => {
    flushPersist(stateRef.current)
  }, [flushPersist])

  return {
    state,
    quota,
    quotaWarning,
    activity,
    banner,
    setBanner,
    savedFlash,
    startTask,
    clearTask,
    applyTaskPatch,
    advance,
    retreat,
    goStage,
    addRole,
    removeRole,
    setThreshold,
    burnQuota,
    resetQuota,
    exportJson,
    importJson,
    manualSave,
    extensions: listExtensions(),
  }
}
