// Floating-point helpers for torsion boundary tests (task 47.2). Test code only.

/** The next representable double above a finite positive `x`. */
export function nextUp(x: number): number {
  if (!(Number.isFinite(x) && x > 0)) throw new Error(`nextUp expects a finite positive number, got ${x}`)
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, x)
  view.setBigUint64(0, view.getBigUint64(0) + 1n)
  return view.getFloat64(0)
}

/** The largest value `withinLimit(value, limit)` accepts for a positive limit (same arithmetic). */
export function toleranceEdge(limit: number, relTol: number): number {
  return limit + Math.abs(limit) * relTol
}
