// Floating-point helpers for heat sink lower-bound tests (task 48.2). Test code only. The upper-
// bound helpers (nextUp, toleranceEdge) live in test/torsionNumeric.ts and are reused as is.

/** The next representable double below a finite positive `x`. */
export function nextDown(x: number): number {
  if (!(Number.isFinite(x) && x > 0)) throw new Error(`nextDown expects a finite positive number, got ${x}`)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  view.setBigUint64(0, view.getBigUint64(0) - 1n)
  return view.getFloat64(0)
}

/** The smallest value `withinLowerLimit(value, limit)` accepts for a positive limit (same arithmetic). */
export function lowerToleranceEdge(limit: number, relTol: number): number {
  return limit - Math.abs(limit) * relTol
}
