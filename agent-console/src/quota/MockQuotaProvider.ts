import type { QuotaProvider } from './QuotaProvider'
import { toSnapshot } from './QuotaProvider'

const STORAGE_KEY = 'agent-console:mock-quota:v1'

interface StoredMeter {
  remaining: number
  limit: number
}

function readMeter(): StoredMeter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StoredMeter
  } catch {
    /* ignore */
  }
  // Start just above default 10% threshold so demos can burn into warning.
  return { remaining: 12, limit: 100 }
}

function writeMeter(meter: StoredMeter) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meter))
}

export function createMockQuotaProvider(): QuotaProvider {
  const listeners = new Set<(s: ReturnType<typeof toSnapshot>) => void>()

  const emit = () => {
    const { remaining, limit } = readMeter()
    const snap = toSnapshot(remaining, limit, 'mock')
    listeners.forEach((cb) => cb(snap))
    return snap
  }

  return {
    id: 'mock',
    getRemaining() {
      return readMeter().remaining
    },
    getLimit() {
      return readMeter().limit
    },
    getSnapshot() {
      const { remaining, limit } = readMeter()
      return toSnapshot(remaining, limit, 'mock')
    },
    subscribe(cb) {
      listeners.add(cb)
      cb(this.getSnapshot())
      return () => listeners.delete(cb)
    },
    consume(units: number) {
      const meter = readMeter()
      meter.remaining = Math.max(0, meter.remaining - Math.max(0, units))
      writeMeter(meter)
      return emit()
    },
    reset() {
      writeMeter({ remaining: 100, limit: 100 })
      return emit()
    },
  }
}
