import type { ProjectTask, StageId } from '../types'
import { WORKFLOW_STAGES } from '../types'

export function canAdvanceFrom(task: ProjectTask): boolean {
  switch (task.stage) {
    case 'intake':
      return (
        task.title.trim().length > 0 &&
        task.acceptance.some((line) => line.trim().length > 0)
      )
    case 'assign':
      return task.roles.length >= 1
    case 'complete':
      return task.artifacts.length >= 1 || task.noArtifact
    case 'review':
      return task.checklist.some((item) => item.done)
    default:
      return false
  }
}

/** Previous stages stay editable; future stages unlock only when every earlier gate passes. */
export function stageUnlocked(task: ProjectTask, target: StageId): boolean {
  const targetIndex = WORKFLOW_STAGES.indexOf(target)
  const currentIndex = WORKFLOW_STAGES.indexOf(task.stage)
  if (targetIndex <= currentIndex) return true

  for (let i = 0; i < targetIndex; i++) {
    const check = { ...task, stage: WORKFLOW_STAGES[i] }
    if (!canAdvanceFrom(check)) return false
  }
  return true
}

export function advanceGateHint(task: ProjectTask): string {
  switch (task.stage) {
    case 'intake':
      return 'Add a title and at least one acceptance line to advance.'
    case 'assign':
      return 'Assign at least one role or sub-agent.'
    case 'complete':
      return 'Add an artifact note, or check “no artifact”.'
    case 'review':
      return 'Check at least one retrospective item to close.'
    default:
      return ''
  }
}
