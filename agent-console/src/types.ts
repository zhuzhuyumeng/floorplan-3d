export type StageId = 'intake' | 'assign' | 'complete' | 'review'

export const WORKFLOW_STAGES: StageId[] = [
  'intake',
  'assign',
  'complete',
  'review',
]

export const STAGE_LABELS: Record<StageId, string> = {
  intake: 'Intake',
  assign: 'Assign',
  complete: 'Complete',
  review: 'Review',
}

export interface AgentRole {
  id: string
  name: string
  focus: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface ArtifactItem {
  id: string
  note: string
}

export interface ProjectTask {
  id: string
  title: string
  brief: string
  /** Acceptance lines captured at intake */
  acceptance: string[]
  stage: StageId
  roles: AgentRole[]
  modelNote: string
  status: 'working' | 'done'
  artifacts: ArtifactItem[]
  noArtifact: boolean
  checklist: ChecklistItem[]
  retrospectiveNotes: string
  closed: boolean
  updatedAt: string
  createdAt: string
}

export interface ConsoleState {
  version: 1
  task: ProjectTask | null
  /** Fraction remaining that triggers auto-save (default 0.10 = 10%) */
  quotaThreshold: number
  lastSavedAt: string | null
  lastAutoSavedAt: string | null
}

export interface QuotaSnapshot {
  remaining: number
  limit: number
  remainingRatio: number
  source: string
  updatedAt: string
}
