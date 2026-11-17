import type { QuotaSnapshot } from '../types'

/**
 * Pluggable AI usage quota. Mock ships by default; swap the factory for Cursor/API.
 */
export interface QuotaProvider {
  readonly id: string
  getRemaining(): number
  getLimit(): number
  getSnapshot(): QuotaSnapshot
  /** Optional live updates */
  subscribe?(cb: (snapshot: QuotaSnapshot) => void): () => void
  /** Demo helpers */
  consume?(units: number): QuotaSnapshot
  reset?(): QuotaSnapshot
}

export function toSnapshot(
  remaining: number,
  limit: number,
  source: string,
): QuotaSnapshot {
  const safeLimit = Math.max(limit, 1)
  const safeRemaining = Math.max(0, Math.min(remaining, safeLimit))
  return {
    remaining: safeRemaining,
    limit: safeLimit,
    remainingRatio: safeRemaining / safeLimit,
    source,
    updatedAt: new Date().toISOString(),
  }
}

export type QuotaProviderFactory = () => QuotaProvider

let activeFactory: QuotaProviderFactory | null = null

export function setQuotaProviderFactory(factory: QuotaProviderFactory) {
  activeFactory = factory
}

export function createQuotaProvider(): QuotaProvider {
  if (!activeFactory) {
    throw new Error('Quota provider factory not registered')
  }
  return activeFactory()
}
