"""Pressure Vessel I independent calculation worksheet (task 69, D-59).

Standalone hand-calculation script written from the equations in design.md, without importing
or reading the application code. Its printed values are the numeric fixtures transcribed into
`Educational Tool UI Design/test/fixtures/vessel.ts`. It is a separate numeric source, not human
engineering review.

Run: python3 -I worksheet.py
"""
import math

# Challenge constants (design.md, "Configuration").
P = 4.0e6          # internal (gauge) pressure, Pa
SY = 250e6         # yield stress, educational nominal steel, Pa
N = 2.0            # design factor on yield
SA = SY / N        # allowable membrane stress, Pa
RHO = 7850.0       # density, kg/m^3
V_MIN = 0.100      # required internal volume, m^3
LO_MAX = 1.0       # maximum overall length, m
M_MAX = 55.0       # maximum mass, kg
REL_TOL = 1e-9

# Model screens (inclusive on the safe side).
THIN_WARN, THIN_NA = 0.05, 0.10      # t / r
PLAS_WARN, PLAS_NA = 0.8, 1.0        # max membrane stress / yield


def within(value, limit):
    return value <= limit + abs(limit) * REL_TOL


def analyze(d_i, l_s, t_s, t_h):
    r = d_i / 2
    hoop = P * r / t_s
    longit = P * r / (2 * t_s)
    head = P * r / (2 * t_h)
    vol = math.pi * r ** 2 * l_s + 4.0 / 3.0 * math.pi * r ** 3
    overall = l_s + 2 * (r + t_h)
    m_shell = RHO * math.pi * ((r + t_s) ** 2 - r ** 2) * l_s
    m_heads = RHO * 4.0 / 3.0 * math.pi * ((r + t_h) ** 3 - r ** 3)
    mass = m_shell + m_heads
    plas = max(hoop, head) / SY
    tw_s = t_s / r
    tw_h = t_h / r
    metrics = {
        'THIN_WALL_SHELL': (tw_s, THIN_WARN, THIN_NA),
        'THIN_WALL_HEAD': (tw_h, THIN_WARN, THIN_NA),
        'PLASTICITY': (plas, PLAS_WARN, PLAS_NA),
    }
    na = [c for c, (v, w, x) in metrics.items() if not within(v, x)]
    warn = [c for c, (v, w, x) in metrics.items() if within(v, x) and not within(v, w)]
    fails = []
    if not within(hoop, SA):
        fails.append('hoopStress')
    if not within(longit, SA):
        fails.append('longitudinalStress')
    if not within(head, SA):
        fails.append('headStress')
    if not within(V_MIN, vol):
        fails.append('volume')
    if not within(overall, LO_MAX):
        fails.append('overallLength')
    if not within(mass, M_MAX):
        fails.append('mass')
    if na:
        fails.append('applicability')
    status = 'modelNotApplicable' if na else ('accepted' if not fails else 'notAccepted')
    return dict(r=r, hoop=hoop, longit=longit, head=head, vol=vol, overall=overall, m_shell=m_shell,
                m_heads=m_heads, mass=mass, plas=plas, tw_s=tw_s, tw_h=tw_h, warn=warn, na=na,
                fails=fails, status=status)


ROWS = [
    # name, inner diameter, shell length, shell thickness, head thickness (m)
    ('baseline', 0.240, 1.200, 0.0025, 0.0015),
    ('reference', 0.400, 0.530, 0.0065, 0.0035),
    ('equalHeads', 0.400, 0.530, 0.0065, 0.0065),
    ('thinHeads', 0.400, 0.530, 0.0065, 0.0030),
    ('wide', 0.500, 0.180, 0.0080, 0.0040),
    ('narrowAtAllowable', 0.300, 1.200, 0.0050, 0.0025),
    ('thickShellWarning', 0.200, 1.200, 0.0060, 0.0030),
    ('thickWallNotApplicable', 0.200, 0.600, 0.0120, 0.0120),
    ('plasticityWarning', 0.240, 1.200, 0.0020, 0.0015),
    ('plasticityNotApplicable', 0.300, 0.800, 0.0010, 0.0010),
    ('oversize', 0.500, 1.200, 0.0120, 0.0120),
]

if __name__ == '__main__':
    print(f'allowable stress {SA!r} Pa')
    for name, d_i, l_s, t_s, t_h in ROWS:
        a = analyze(d_i, l_s, t_s, t_h)
        print(name, (d_i, l_s, t_s, t_h))
        for k in ('hoop', 'longit', 'head', 'vol', 'overall', 'm_shell', 'm_heads', 'mass', 'plas', 'tw_s', 'tw_h'):
            print(f'  {k} = {a[k]!r}')
        print(f"  status={a['status']} failures={a['fails']} warnings={a['warn']} notApplicable={a['na']}")

    # Alternative-method and limiting checks.
    print('--- Lame thick-wall cylinder: max hoop / thin-wall hoop (inner radius) at t/r = k')
    for k in (0.01, 0.025, 0.05, 0.1):
        r, t = 1.0, k
        ro = r + t
        lame = (ro ** 2 + r ** 2) / (ro ** 2 - r ** 2)
        print(f'  k={k}: {lame / (r / t)!r}')
    print('--- Lame thick-wall sphere: max tangential / thin-wall pr/(2t) at t/r = k')
    for k in (0.01, 0.025, 0.05, 0.1):
        r, t = 1.0, k
        ro = r + t
        lame = (ro ** 3 + 2 * r ** 3) / (2 * (ro ** 3 - r ** 3))
        print(f'  k={k}: {lame / (r / (2 * t))!r}')
    print('--- exact axial equilibrium p*pi*r^2 = sigma*pi*((r+t)^2-r^2) vs pr/(2t): thin/exact = 1 + t/(2r)')
    for name, d_i, l_s, t_s, t_h in ROWS[:2]:
        r = d_i / 2
        exact = P * r ** 2 / ((r + t_s) ** 2 - r ** 2)
        print(f'  {name}: exact={exact!r} thin/exact={(P * r / (2 * t_s)) / exact!r}')
    print('--- derived targets')
    for d_i in (0.24, 0.30, 0.40, 0.50):
        r = d_i / 2
        print(f'  D={d_i}: t_s,min={P * r / SA!r} t_h,min={P * r / (2 * SA)!r} '
              f'L for V_min={(V_MIN - 4 / 3 * math.pi * r ** 3) / (math.pi * r ** 2)!r}')
    print('--- prediction fixture: baseline -> reference hoop ratio')
    b = analyze(*ROWS[0][1:])
    ref = analyze(*ROWS[1][1:])
    print(f'  r = {ref["hoop"] / b["hoop"]!r}')

    # Exhaustive search of the configured step grid (D-47): the most design checks any valid,
    # applicable, warning-free design fails, and how many designs are Accepted.
    def grid(a, b, s):
        k = round((b - a) / s)
        return [round(a + i * s, 9) for i in range(k + 1)]
    best, accepted, best_sets = 0, 0, {}
    for d_i in grid(0.2, 0.5, 0.01):
        for l_s in grid(0.1, 1.2, 0.01):
            for t_s in grid(0.001, 0.012, 0.0005):
                for t_h in grid(0.001, 0.012, 0.0005):
                    a = analyze(d_i, l_s, t_s, t_h)
                    if a['na'] or a['warn']:
                        continue
                    k = len(a['fails'])
                    if k == 0:
                        accepted += 1
                    best = max(best, k)
                    if k >= 4:
                        best_sets[tuple(a['fails'])] = best_sets.get(tuple(a['fails']), 0) + 1
    print(f'--- grid: most checks failed without a warning = {best}; accepted designs = {accepted}')
    for s, c in sorted(best_sets.items(), key=lambda x: -x[1]):
        print(f'  {s}: {c}')
