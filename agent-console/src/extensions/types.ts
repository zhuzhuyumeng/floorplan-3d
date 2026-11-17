import type { ReactNode } from 'react'
import type { ConsoleState, ProjectTask, QuotaSnapshot, StageId } from '../types'

export type { StageId }

export interface ExtensionContext {
  getTask: () => ProjectTask | null
  setTask: (patch: Partial<ProjectTask>) => void
  persist: () => void
  getQuota: () => { remaining: number; limit: number }
  getState: () => ConsoleState
  log: (message: string, detail?: unknown) => void
}

export interface Extension {
  id: string
  label: string
  onRegister?: (ctx: ExtensionContext) => void | (() => void)
  onStageEnter?: (stage: StageId, ctx: ExtensionContext) => void
  onStageLeave?: (stage: StageId, ctx: ExtensionContext) => void
  onBeforePersist?: (snapshot: ConsoleState, ctx: ExtensionContext) => ConsoleState
  onAfterPersist?: (ctx: ExtensionContext) => void
  onQuotaLow?: (snapshot: QuotaSnapshot, ctx: ExtensionContext) => void
  /** Optional panel slot in a stage */
  renderPanel?: (stage: StageId) => ReactNode | null
}
