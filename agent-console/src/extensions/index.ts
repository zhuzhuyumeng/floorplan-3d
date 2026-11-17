/**
 * Extension surface. Feature plugins should import from here and call
 * `registerExtension` — core UI does not import feature plugins.
 */
export type { Extension, ExtensionContext, StageId } from './types'
export {
  bindExtensionContext,
  listExtensions,
  registerExtension,
  runExtensions,
  unregisterExtension,
} from './registry'

import { registerExtension } from './registry'
import type { Extension } from './types'

/** Built-in stub proving the registry; replace/extend later without rewriting core. */
const activityLogStub: Extension = {
  id: 'core.activity-log',
  label: 'Activity Log',
  onRegister(ctx) {
    ctx.log('Activity log extension registered')
  },
  onStageEnter(stage, ctx) {
    ctx.log(`Entered stage: ${stage}`)
  },
  onQuotaLow(snapshot, ctx) {
    ctx.log(
      `Quota low: ${(snapshot.remainingRatio * 100).toFixed(1)}% remaining`,
    )
  },
  onAfterPersist(ctx) {
    ctx.log('Persisted')
  },
}

registerExtension(activityLogStub)
