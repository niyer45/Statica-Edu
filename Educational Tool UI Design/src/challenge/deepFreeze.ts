/**
 * Recursively freezes `x` and every object or array reachable from it, then returns it.
 *
 * - Primitives are returned unchanged.
 * - Already-frozen objects are still walked, so unfrozen children of a shallow-frozen
 *   parent get frozen too.
 * - Cycles and shared references are visited once.
 * - ArrayBuffer views (typed arrays, DataView) are skipped: freezing a non-empty one throws.
 */
export function deepFreeze<T>(x: T): Readonly<T> {
  freezeInto(x, new WeakSet<object>())
  return x
}

function freezeInto(value: unknown, seen: WeakSet<object>): void {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return
  const obj = value as object
  if (seen.has(obj) || ArrayBuffer.isView(obj)) return
  seen.add(obj)
  Object.freeze(obj)
  for (const key of Reflect.ownKeys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key)
    // Accessor properties are not invoked; only data values are walked.
    if (desc && 'value' in desc) freezeInto(desc.value, seen)
  }
}
