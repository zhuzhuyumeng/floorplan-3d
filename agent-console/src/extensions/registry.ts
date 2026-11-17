import type { Extension, ExtensionContext } from './types'

const extensions: Extension[] = []
const cleanups = new Map<string, () => void>()
const pendingRegister = new Set<string>()

let contextFactory: (() => ExtensionContext) | null = null

export function bindExtensionContext(factory: () => ExtensionContext) {
  contextFactory = factory
  // Flush onRegister for anything that registered before context existed.
  for (const ext of extensions) {
    if (!pendingRegister.has(ext.id)) continue
    pendingRegister.delete(ext.id)
    try {
      const cleanup = ext.onRegister?.(factory())
      if (typeof cleanup === 'function') cleanups.set(ext.id, cleanup)
    } catch (err) {
      console.error(`[extension:${ext.id}] onRegister failed`, err)
    }
  }
}

function ctx(): ExtensionContext {
  if (!contextFactory) {
    throw new Error('Extension context not bound')
  }
  return contextFactory()
}

/** Register a plugin. Returns unregister. Core must not import feature plugins. */
export function registerExtension(ext: Extension): () => void {
  if (!ext.id) throw new Error('Extension id is required')
  if (extensions.some((e) => e.id === ext.id)) {
    unregisterExtension(ext.id)
  }
  extensions.push(ext)
  if (!contextFactory) {
    pendingRegister.add(ext.id)
  } else {
    try {
      const cleanup = ext.onRegister?.(ctx())
      if (typeof cleanup === 'function') cleanups.set(ext.id, cleanup)
    } catch (err) {
      console.error(`[extension:${ext.id}] onRegister failed`, err)
    }
  }
  return () => unregisterExtension(ext.id)
}

export function unregisterExtension(id: string) {
  pendingRegister.delete(id)
  const cleanup = cleanups.get(id)
  if (cleanup) {
    try {
      cleanup()
    } catch (err) {
      console.error(`[extension:${id}] cleanup failed`, err)
    }
    cleanups.delete(id)
  }
  const i = extensions.findIndex((e) => e.id === id)
  if (i >= 0) extensions.splice(i, 1)
}

export function listExtensions(): readonly Extension[] {
  return extensions
}

export function runExtensions(invoke: (ext: Extension) => void) {
  for (const ext of extensions) {
    try {
      invoke(ext)
    } catch (err) {
      console.error(`[extension:${ext.id}] hook failed`, err)
    }
  }
}
