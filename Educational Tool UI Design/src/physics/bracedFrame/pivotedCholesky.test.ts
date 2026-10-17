import { describe, expect, it } from 'vitest'
import { choleskySolve, matVec, norm2, pivotedCholesky, type DenseMatrix } from './pivotedCholesky'

// Pivoted Cholesky (task 49.2; BFR-11). Small hand matrices with known factors, ranks and solutions.

const mul = (a: number[][], b: number[][]) => a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)))
const transpose = (a: number[][]) => a[0].map((_, j) => a.map((row) => row[j]))

describe('pivotedCholesky', () => {
  it('factorizes an SPD matrix with the largest diagonal pivoted first: P^T A P = L L^T', () => {
    const A = [
      [4, 2, 0],
      [2, 10, 3],
      [0, 3, 5],
    ]
    const f = pivotedCholesky(A, 1e-9)
    if (!f.ok) throw new Error('expected SPD')
    expect(f.permutation[0]).toBe(1)
    const PtAP = f.permutation.map((i) => f.permutation.map((j) => A[i][j]))
    const LLt = mul(f.lower, transpose(f.lower))
    PtAP.forEach((row, i) => row.forEach((v, j) => expect(LLt[i][j]).toBeCloseTo(v, 12)))
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(f.lower[i][j]).toBe(0)
    expect(f.minPivotRatio).toBeGreaterThan(0)
    expect(f.minPivotRatio).toBeLessThanOrEqual(1)
  })

  it('solves A x = b and leaves the input untouched', () => {
    const A = [
      [4, 2, 0],
      [2, 10, 3],
      [0, 3, 5],
    ]
    const copy = structuredClone(A)
    const x = [1, -2, 3]
    const b = matVec(A, x)
    const f = pivotedCholesky(A, 1e-9)
    if (!f.ok) throw new Error('expected SPD')
    choleskySolve(f, b).forEach((v, i) => expect(v).toBeCloseTo(x[i], 12))
    expect(A).toEqual(copy)
  })

  it('reports the numerical rank of a semidefinite matrix (one null direction)', () => {
    // k (1, −1)(1, −1)^T plus an independent third DOF: rank 2 of 3.
    const A = [
      [2, -2, 0],
      [-2, 2, 0],
      [0, 0, 1],
    ]
    const f = pivotedCholesky(A, 1e-9)
    expect(f).toMatchObject({ ok: false, rank: 2 })
    expect(Math.abs(f.minPivotRatio)).toBeLessThanOrEqual(1e-15)
  })

  it('treats a pivot exactly at the threshold as singular and one just above as regular', () => {
    expect(pivotedCholesky([[1, 0], [0, 1e-9]], 1e-9)).toMatchObject({ ok: false, rank: 1 })
    expect(pivotedCholesky([[1, 0], [0, 2e-9]], 1e-9).ok).toBe(true)
  })

  it('reports rank 0 for a zero, negative or non-finite diagonal', () => {
    expect(pivotedCholesky([[0, 0], [0, 0]], 1e-9)).toMatchObject({ ok: false, rank: 0 })
    expect(pivotedCholesky([[-1]], 1e-9)).toMatchObject({ ok: false, rank: 0 })
    expect(pivotedCholesky([[Number.NaN]], 1e-9)).toMatchObject({ ok: false, rank: 0 })
    expect(pivotedCholesky([[Infinity]], 1e-9)).toMatchObject({ ok: false, rank: 0 })
  })

  it('rejects a NaN pivot discovered later in the factorization', () => {
    // A NaN coupling term poisons the Schur complement after the first (finite) pivot.
    const A: DenseMatrix = [
      [4, Number.NaN],
      [Number.NaN, 1],
    ]
    expect(pivotedCholesky(A, 1e-9)).toMatchObject({ ok: false, rank: 1 })
  })

  it('factorizes the empty matrix trivially', () => {
    const f = pivotedCholesky([], 1e-9)
    expect(f.ok).toBe(true)
    if (f.ok) expect(choleskySolve(f, [])).toEqual([])
  })
})

describe('vector helpers', () => {
  it('matVec and norm2', () => {
    expect(matVec([[1, 2], [3, 4]], [1, 1])).toEqual([3, 7])
    expect(norm2([3, 4])).toBe(5)
    expect(norm2([])).toBe(0)
    expect(norm2([0, 0])).toBe(0)
    expect(norm2([3e300, 4e300])).toBeCloseTo(5e300, -288)
    expect(norm2([3e-300, 4e-300])).toBeCloseTo(5e-300, 310)
    expect(norm2([1, Infinity])).toBe(Infinity)
    expect(norm2([1, Number.NaN])).toBeNaN()
  })
})
