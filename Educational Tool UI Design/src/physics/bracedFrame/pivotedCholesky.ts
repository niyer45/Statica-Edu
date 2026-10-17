// Cholesky factorization with diagonal pivoting for small dense symmetric matrices (task 49.2;
// braced-frame-1 BFR-11, design "Solver and mechanism detection"). Pure, dependency-free and
// deterministic: only +, −, ×, ÷ and √ in a fixed order, so results are reproducible.
//
// At step k the largest remaining diagonal entry of the Schur complement is swapped into
// position k (complete diagonal pivoting). For a symmetric positive semidefinite matrix this is
// rank-revealing: the pivots are non-increasing in exact arithmetic, and once the largest
// remaining diagonal entry is ≤ τ · max_i A_ii every remaining one is too. A pivot at or below
// that threshold (or a NaN) stops the factorization and reports the numerical rank; the
// remaining n − rank dimensions form the numerical null space (mechanism modes of a stiffness
// matrix). Relative thresholds use the largest diagonal entry of the ORIGINAL matrix.
// References: Higham, Accuracy and Stability of Numerical Algorithms, Cholesky with complete
// pivoting for semidefinite matrices; Golub & Van Loan, Matrix Computations, pivoted Cholesky.
// Edition and section numbers are pending owner engineering review (29.2).

export type DenseMatrix = readonly (readonly number[])[]

/** P^T A P = L L^T with L lower triangular in pivoted order and P given by `permutation`. */
export interface CholeskyFactor {
  /** Lower-triangular factor; row/column k corresponds to original index permutation[k]. */
  lower: number[][]
  permutation: number[]
}

export type PivotedCholeskyResult =
  | ({ ok: true; minPivotRatio: number } & CholeskyFactor)
  | {
      ok: false
      /** Number of pivots accepted before the first pivot at or below the threshold. */
      rank: number
      /** Ratio (pivot / max original diagonal) of the rejected pivot; may be ≤ 0 or NaN. */
      minPivotRatio: number
    }

/**
 * Factorizes the symmetric matrix `a` (only its values are read; it is never mutated).
 * A pivot p is accepted iff p > pivotRelTol · max_i a_ii. If the largest diagonal entry is not
 * finite and positive, the matrix is reported with rank 0. An empty matrix factorizes trivially.
 */
export function pivotedCholesky(a: DenseMatrix, pivotRelTol: number): PivotedCholeskyResult {
  const n = a.length
  const work = a.map((row) => [...row])
  const permutation = Array.from({ length: n }, (_, i) => i)
  const lower: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  let maxDiag = 0
  for (let i = 0; i < n; i++) maxDiag = Math.max(maxDiag, work[i][i])
  if (n > 0 && !(Number.isFinite(maxDiag) && maxDiag > 0)) return { ok: false, rank: 0, minPivotRatio: Number.NaN }

  let minPivotRatio = Number.POSITIVE_INFINITY
  for (let k = 0; k < n; k++) {
    let p = k
    for (let i = k + 1; i < n; i++) if (work[i][i] > work[p][p]) p = i
    if (p !== k) {
      swapSymmetric(work, k, p)
      ;[permutation[k], permutation[p]] = [permutation[p], permutation[k]]
      // Already-computed columns of L follow the row swap.
      for (let j = 0; j < k; j++) [lower[k][j], lower[p][j]] = [lower[p][j], lower[k][j]]
    }
    const pivot = work[k][k]
    const ratio = pivot / maxDiag
    if (!(pivot > pivotRelTol * maxDiag)) return { ok: false, rank: k, minPivotRatio: ratio }
    minPivotRatio = Math.min(minPivotRatio, ratio)
    const lkk = Math.sqrt(pivot)
    lower[k][k] = lkk
    for (let i = k + 1; i < n; i++) lower[i][k] = work[i][k] / lkk
    // Schur complement update of the trailing block (kept symmetric).
    for (let i = k + 1; i < n; i++) {
      for (let j = k + 1; j <= i; j++) {
        const v = work[i][j] - lower[i][k] * lower[j][k]
        work[i][j] = v
        work[j][i] = v
      }
    }
  }
  return { ok: true, lower, permutation, minPivotRatio }
}

/** Swaps rows and columns k and p of a symmetric matrix in place. */
function swapSymmetric(m: number[][], k: number, p: number): void {
  ;[m[k], m[p]] = [m[p], m[k]]
  for (const row of m) [row[k], row[p]] = [row[p], row[k]]
}

/** Solves A x = b given P^T A P = L L^T (forward then back substitution). */
export function choleskySolve(f: CholeskyFactor, b: readonly number[]): number[] {
  const { lower, permutation } = f
  const n = lower.length
  const z = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = b[permutation[i]]
    for (let j = 0; j < i; j++) s -= lower[i][j] * z[j]
    z[i] = s / lower[i][i]
  }
  const w = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i]
    for (let j = i + 1; j < n; j++) s -= lower[j][i] * w[j]
    w[i] = s / lower[i][i]
  }
  const x = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) x[permutation[i]] = w[i]
  return x
}

/** y = A x. */
export function matVec(a: DenseMatrix, x: readonly number[]): number[] {
  return a.map((row) => row.reduce((s, v, j) => s + v * x[j], 0))
}

/** Euclidean norm, scaled by the largest magnitude so squares cannot overflow or underflow. */
export function norm2(x: readonly number[]): number {
  const scale = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  if (!(scale > 0) || !Number.isFinite(scale)) return scale
  return scale * Math.sqrt(x.reduce((s, v) => s + (v / scale) * (v / scale), 0))
}
