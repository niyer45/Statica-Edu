# Fatigue Analysis I: independent calculation worksheet (task 70).
# Run: python3 -I worksheet.py   (from this folder; Python 3 standard library only)
# Prints every worksheet row at 15 significant figures plus the alternative-method checks.
# The numbers in design.md and test/fixtures/fatigue.ts are transcribed from this output.
import math
import sys

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from fatigue_model import (KPSI_MPA, analyze, fatigue_fraction, neuber_sqrt_a_mm, notch_sensitivity,
                           roark_kt_bending)

CH = dict(
    sut=630e6, sy=530e6, rho=7850.0,
    Fm=3000.0, Fa=2000.0, arm=0.05,
    kc=1.0, kd=1.0, ke=0.897,
    Nt=2e5, nf_req=1.3, ny_req=1.5, mmax=0.52, hmin=0.0025,
    LD=0.04, Ld=0.06,
    finishes={
        'ground': (1.38, -0.067),
        'machined': (3.04, -0.217),
        'asForged': (12.7 * KPSI_MPA ** 0.758, -0.758),
    },
)

ROWS = [
    ('baseline', 0.022, 0.045, 0.001, 'asForged'),
    ('reference', 0.0245, 0.034, 0.002, 'machined'),
    ('filletOnly', 0.022, 0.045, 0.005, 'asForged'),
    ('finishOnly', 0.022, 0.045, 0.001, 'ground'),
    ('neckOnly', 0.03, 0.045, 0.001, 'asForged'),
    ('collarOnly', 0.022, 0.034, 0.001, 'asForged'),
    ('referenceGround', 0.0245, 0.034, 0.002, 'ground'),
    ('referenceForged', 0.0245, 0.034, 0.002, 'asForged'),
    ('referenceSharp', 0.0245, 0.034, 0.0005, 'machined'),
    ('crowdedShoulder', 0.0245, 0.034, 0.004, 'machined'),
    ('allMax', 0.04, 0.06, 0.005, 'ground'),
    ('fitRangeNA', 0.02, 0.06, 0.0005, 'machined'),
    ('localYieldNA', 0.02, 0.04, 0.0005, 'machined'),
]

FIELDS = ['kt', 'q', 'kf', 'sa_nom', 'sm_nom', 'sa', 'sm', 'se_prime', 'ka', 'kb', 'se', 'f', 'a', 'b',
          'sf', 'nf', 'ny', 'srev', 'life', 'face', 'mass', 'hr']


def g(x):
    if isinstance(x, float) and math.isinf(x):
        return 'inf'
    return '%.15g' % x


def main():
    ch = CH
    sut = ch['sut'] / 1e6
    print('# constants: Sut', sut, 'MPa; f =', g(fatigue_fraction(sut)), '; sqrt(a) =', g(neuber_sqrt_a_mm(sut)), 'sqrt(mm)')
    print('# as-forged a (MPa form) =', g(12.7 * KPSI_MPA ** 0.758))
    for name, d, D, r, fin in ROWS:
        a = analyze(dict(d=d, D=D, r=r, finish=fin), ch)
        fails = [k for k, v in a['checks'].items() if not v]
        print('\n[%s] d=%g D=%g r=%g finish=%s' % (name, d, D, r, fin))
        print('  ' + ', '.join('%s=%s' % (k, g(a[k])) for k in FIELDS))
        print('  screens: ' + ', '.join('%s=%s' % (k, g(v)) for k, v in a['screens'].items()))
        print('  notApplicable=%s fails=%s' % (a['na'], fails))

    print('\n# Alternative and limiting checks')
    # 1. Shigley worked-example notch sensitivity (Sut 470 MPa, r 3 mm): sqrt(a) 0.4933, q 0.78.
    print('q(470 MPa, r 3 mm) =', g(notch_sensitivity(470, 0.003)), 'sqrt(a) =', g(neuber_sqrt_a_mm(470)))
    # 2. Fit vs a chart reading (Shigley solution reads Kt = 1.7 for D/d = 50/35, r/d = 3/35).
    print('Kt fit D50 d35 r3 =', g(roark_kt_bending(0.05, 0.035, 0.003)))
    # 3. Continuity of the two Roark ranges at h/r = 2.
    # The configured ranges keep 2h/D = 1 - d/D <= 1 - 20/60 = 2/3.
    worst = 0.0
    worst_x = 0.0
    for i in range(1, 668):
        x = i / 1000
        D = 1.0
        h = x * D / 2
        lo = roark_kt_bending(D, D - 2 * h, h / (2 - 1e-12))
        hi = roark_kt_bending(D, D - 2 * h, h / (2 + 1e-12))
        if abs(hi - lo) / lo > worst:
            worst, worst_x = abs(hi - lo) / lo, x
    print('max relative jump at h/r = 2 for 2h/D in (0, 2/3]:', g(worst), 'at 2h/D =', g(worst_x))
    # 4. Basquin end points and the Goodman/life identity on the reference row.
    ref = analyze(dict(d=0.0245, D=0.034, r=0.002, finish='machined'), CH)
    print('Sf(1e3)/(f Sut) =', g(ref['a'] * 1e3 ** ref['b'] / (ref['f'] * sut)), ' Sf(1e6)/Se =', g(ref['a'] * 1e6 ** ref['b'] / ref['se']))
    base = analyze(dict(d=0.022, D=0.045, r=0.001, finish='asForged'), CH)
    n = base['life']
    sfn = base['a'] * n ** base['b']
    print('baseline: Sf(N_life)/srev =', g(sfn / base['srev']), ' Goodman factor at N_life =', g(1 / (base['sa'] / sfn + base['sm'] / sut)))
    # 5. Nominal stress by quadrature of the bending second moment: I = integral of y^2 w(y) dy
    #    with y = R sin(t), w = 2 R cos(t) (composite Simpson in t, smooth integrand).
    d = 0.022
    R = d / 2
    m = 200
    hstep = math.pi / m
    I = 0.0
    for k in range(m + 1):
        t = -math.pi / 2 + k * hstep
        val = (R * math.sin(t)) ** 2 * (2 * R * math.cos(t)) * (R * math.cos(t))
        c = 1 if k in (0, m) else (4 if k % 2 else 2)
        I += c * val
    I *= hstep / 3
    s_quad = CH['Fa'] * CH['arm'] * (d / 2) / I / 1e6
    print('sa_nom by quadrature / closed form - 1 =', g(s_quad / base['sa_nom'] - 1))


if __name__ == '__main__':
    main()
