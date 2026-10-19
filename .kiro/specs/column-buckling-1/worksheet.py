"""Column Buckling I — independent calculation worksheet (task 68, CBK-17).

Standalone script written from the equations in design.md, without reading or importing any
application code. Plain Python 3 double precision; no third-party packages. It prints the
worksheet table, the derived targets, the D-47 exhaustive baseline search over the configured
step grid and the alternative-method checks. Run from any directory:

    python3 -I .kiro/specs/column-buckling-1/worksheet.py

The numbers it prints are copied into design.md and into the application test fixtures
(test/fixtures/column.ts). It is a separate numeric source, not engineering review.
"""

import math

# ---------------------------------------------------------------------------------------------
# Challenge constants (design.md, configuration sketch). SI units.
E = 69e9            # Pa, aluminium (educational nominal)
RHO = 2700.0        # kg/m^3
S_ALLOW = 120e6     # Pa, allowable axial (compressive) stress
S_Y = 240e6         # Pa, yield stress (applicability screen only)
L = 2.0             # m, column length between the pins
K = 1.0             # effective-length factor, pinned-pinned
P = 10e3            # N, axial load
N_REQ = 2.0         # required safety factor against buckling
M_MAX = 2.5         # kg

EULER_WARN, EULER_NA = 0.4, 0.5     # Euler stress / yield stress
WALL_WARN, WALL_NA = 40.0, 100.0    # D / t
REL_TOL = 1e-9


def section(kind, D, t=None):
    """Area, second moment, radius of gyration and D/t for a solid bar or a circular tube."""
    d = 0.0 if kind == 'solid' else D - 2 * t
    A = math.pi * (D * D - d * d) / 4
    I = math.pi * (D ** 4 - d ** 4) / 64
    r = math.sqrt(I / A)
    wall = D / 2 if kind == 'solid' else t
    return A, I, r, D / wall


def analyze(kind, D, t=None, length=L, load=P, e=E):
    A, I, r, dt = section(kind, D, t)
    KL = K * length
    lam = KL / r
    lam_c = math.pi * math.sqrt(2 * e / S_Y)
    pcr = math.pi ** 2 * e * I / KL ** 2
    sig_e = pcr / A
    m = RHO * A * length
    return dict(A=A, I=I, r=r, KL=KL, lam=lam, lam_c=lam_c, Pcr=pcr, SF=pcr / load, sigE=sig_e,
                sig=load / A, m=m, perKg=pcr / m, Dt=dt, euler=sig_e / S_Y)


def within(value, limit):
    return math.isfinite(value) and value <= limit + abs(limit) * REL_TOL


def evaluate(x):
    failed = []
    if not within(N_REQ * P, x['Pcr']):
        failed.append('buckling')
    if not within(x['sig'], S_ALLOW):
        failed.append('axialStress')
    if not within(x['m'], M_MAX):
        failed.append('mass')
    warnings, na = [], []
    for code, v, w, n in (('EULER_RANGE', x['euler'], EULER_WARN, EULER_NA), ('WALL_SLENDERNESS', x['Dt'], WALL_WARN, WALL_NA)):
        if not within(v, n):
            na.append(code)
        elif not within(v, w):
            warnings.append(code)
    status = 'modelNotApplicable' if na else ('accepted' if not failed else 'notAccepted')
    return failed, warnings, na, status


FIXTURES = [
    ('baseline', 'solid', 0.0245, None),
    ('reference', 'tube', 0.060, 0.002),
    ('solid30', 'solid', 0.030, None),
    ('tubeEqualMass', 'tube', 0.0545, 0.0045),
    ('solid40', 'solid', 0.040, None),
    ('thinSmallTube', 'tube', 0.015, 0.001),
    ('eulerWarning', 'tube', 0.070, 0.002),
    ('eulerNotApplicable', 'tube', 0.080, 0.002),
    ('wallWarning', 'tube', 0.060, 0.001),
]


def grid(lo, hi, step):
    n = round((hi - lo) / step)
    return [round(lo + i * step, 9) for i in range(n + 1)]


def main():
    print('Fixture table (repr = full double precision)')
    for name, kind, D, t in FIXTURES:
        x = analyze(kind, D, t)
        failed, warnings, na, status = evaluate(x)
        print(f'\n{name}: {kind} D={D}' + ('' if t is None else f' t={t}'))
        for k in ('A', 'I', 'r', 'lam', 'Pcr', 'SF', 'sigE', 'euler', 'sig', 'm', 'perKg', 'Dt'):
            print(f'  {k:6s} {x[k]!r}')
        print(f'  status {status}; failed {failed}; warnings {warnings}; notApplicable {na}')

    x = analyze('solid', 0.03)
    print(f'\nTransition slenderness lambda_c = {x["lam_c"]!r}')
    i_req = N_REQ * P * (K * L) ** 2 / (math.pi ** 2 * E)
    d_req = (64 * i_req / math.pi) ** 0.25
    m_req = RHO * math.pi * d_req ** 2 / 4 * L
    print(f'Required I = {i_req!r} m^4; solid needs d >= {d_req!r} m, mass {m_req!r} kg')
    print(f'Smallest area at the Euler limit (2 n P / S_y) = {2 * N_REQ * P / S_Y!r} m^2, '
          f'axial stress there = {S_Y / (2 * N_REQ)!r} Pa')
    print(f'Stress and mass cannot fail together: stress fails below A = {P / S_ALLOW!r} m^2, '
          f'mass fails above A = {M_MAX / (RHO * L)!r} m^2')
    b = analyze('solid', 0.0245)
    r = analyze('tube', 0.06, 0.002)
    print(f'Prediction fixture baseline -> reference: Pcr ratio {r["Pcr"] / b["Pcr"]!r} (increase)')
    s30 = analyze('solid', 0.03)
    te = analyze('tube', 0.0545, 0.0045)
    print(f'Equal mass: solid30 m={s30["m"]!r}, tubeEqualMass m={te["m"]!r}, '
          f'Pcr ratio {te["Pcr"] / s30["Pcr"]!r}')

    # D-47 exhaustive search over the step grid.
    rows = []
    for d in grid(0.010, 0.060, 0.0005):
        rows.append(('solid', d, None))
    for D in grid(0.015, 0.080, 0.0005):
        for t in grid(0.001, 0.006, 0.0005):
            rows.append(('tube', D, t))
    best, clean, accepted, accepted_clean = 0, 0, 0, 0
    ties = []
    for kind, D, t in rows:
        x = analyze(kind, D, t)
        failed, warnings, na, status = evaluate(x)
        if status == 'accepted':
            accepted += 1
            accepted_clean += 0 if warnings else 1
        if na or warnings:
            continue
        clean += 1
        if len(failed) > best:
            best, ties = len(failed), []
        if len(failed) == best:
            ties.append((kind, D, t, tuple(failed), x['Pcr']))
    print(f'\nGrid: {len(rows)} designs ({len(grid(0.010, 0.060, 0.0005))} solid), {clean} applicable without warnings, '
          f'{accepted} accepted ({accepted_clean} without warnings)')
    print(f'Most design checks failed without a warning: {best}; ties {len(ties)}')
    solid_ties = [x for x in ties if x[0] == 'solid' and x[3] == ('buckling', 'mass')]
    print(f'Solid ties failing buckling and mass: {solid_ties[0][1]!r} .. {solid_ties[-1][1]!r} m ({len(solid_ties)})')
    print(f'Lowest critical load among all ties: {min(ties, key=lambda x: x[4])[:4]}')

    # Alternative methods.
    print('\nAlternative-method checks')
    for name, kind, D, t in FIXTURES:
        ro = D / 2
        ri = 0.0 if kind == 'solid' else ro - t
        n = 2000  # composite Simpson on I = integral of pi r^3 dr from ri to ro
        h = (ro - ri) / n
        s = sum((1 if i in (0, n) else (4 if i % 2 else 2)) * math.pi * (ri + i * h) ** 3 for i in range(n + 1))
        i_q = s * h / 3
        x = analyze(kind, D, t)
        # Finite-difference buckling load: E I w'' + P w = 0, w(0) = w(L) = 0, inverse iteration.
        N = 400
        hh = L / (N + 1)
        lam_min = inverse_iteration_tridiagonal(N) / hh ** 2
        pcr_fd = E * x['I'] * lam_min
        print(f'  {name:18s} quadrature I rel err {abs(i_q / x["I"] - 1):.2e}; '
              f'FD Pcr rel err {abs(pcr_fd / x["Pcr"] - 1):.3e}')
    # Rayleigh quotient with the trial shape w = x (L - x): EI * int w''^2 / int w'^2 = 12 EI / L^2.
    print(f'  Rayleigh polynomial / Euler = {12 / math.pi ** 2!r} (upper bound)')
    # Thin-wall limit: I ~ pi R_m^3 t.
    for t in (0.004, 0.002, 0.001, 0.0005):
        A, I, _, _ = section('tube', 0.06, t)
        rm = (0.06 - t) / 2
        print(f'  thin-wall D 60 mm t {t * 1e3} mm: pi Rm^3 t / I - 1 = {math.pi * rm ** 3 * t / I - 1:.3e}')
    x1 = analyze('tube', 0.06, 0.002)
    x2 = analyze('tube', 0.06, 0.002, length=2 * L)
    print(f'  doubling the length: Pcr ratio {x2["Pcr"] / x1["Pcr"]!r}')


def inverse_iteration_tridiagonal(n, iterations=200):
    """Smallest eigenvalue of the n x n matrix tridiag(-1, 2, -1), by inverse iteration (Thomas solve)."""
    v = [math.sin(math.pi * (i + 1) / (n + 1)) + 0.1 * ((i * 7919) % 13) / 13 for i in range(n)]
    lam = 0.0
    for _ in range(iterations):
        # Solve T w = v with the Thomas algorithm.
        c = [0.0] * n
        d = [0.0] * n
        c[0] = -1 / 2
        d[0] = v[0] / 2
        for i in range(1, n):
            m = 2 + c[i - 1]
            c[i] = -1 / m
            d[i] = (v[i] + d[i - 1]) / m
        w = [0.0] * n
        w[-1] = d[-1]
        for i in range(n - 2, -1, -1):
            w[i] = d[i] - c[i] * w[i + 1]
        norm = math.sqrt(sum(x * x for x in w))
        lam = math.sqrt(sum(x * x for x in v)) / norm
        v = [x / norm for x in w]
    return lam


if __name__ == '__main__':
    main()
