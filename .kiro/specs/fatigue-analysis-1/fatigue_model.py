# Fatigue Analysis I: standalone reference model for the worksheet (task 70).
# Written from the equations in design.md, without importing or reading application code.
# Pure Python 3 standard library. SI units in the public functions (m, N, Pa) unless noted;
# the textbook correlations are evaluated in the units they are published in (MPa, mm, kpsi).
import math

KPSI_MPA = 6.894757  # MPa per kpsi


def roark_kt_bending(D, d, r):
    """Kt for a shoulder fillet in a stepped round shaft in bending (Roark polynomial fit).

    h = (D - d)/2. Kt = C1 + C2 (2h/D) + C3 (2h/D)^2 + C4 (2h/D)^3, C_i = f(h/r), two ranges.
    Nominal stress 32 M / (pi d^3).
    """
    h = (D - d) / 2
    hr = h / r
    s = math.sqrt(hr)
    if hr <= 2.0:
        c1 = 0.947 + 1.206 * s - 0.131 * hr
        c2 = 0.022 - 3.405 * s + 0.915 * hr
        c3 = 0.869 + 1.777 * s - 0.555 * hr
        c4 = -0.810 + 0.422 * s - 0.260 * hr
    else:
        c1 = 1.232 + 0.832 * s - 0.008 * hr
        c2 = -3.813 + 0.968 * s - 0.260 * hr
        c3 = 7.423 - 4.868 * s + 0.869 * hr
        c4 = -3.839 + 3.070 * s - 0.600 * hr
    x = 2 * h / D
    return c1 + c2 * x + c3 * x * x + c4 * x * x * x


def neuber_sqrt_a_mm(sut_mpa):
    """Neuber characteristic length sqrt(a) in sqrt(mm), steels in bending, Sut in MPa (Shigley)."""
    s = sut_mpa
    return 1.24 - 2.25e-3 * s + 1.60e-6 * s * s - 4.11e-10 * s * s * s


def notch_sensitivity(sut_mpa, r_m):
    return 1 / (1 + neuber_sqrt_a_mm(sut_mpa) / math.sqrt(r_m * 1e3))


def surface_factor(a_mpa, b, sut_mpa):
    return a_mpa * sut_mpa ** b


def size_factor_nonrotating(d_m):
    """kb with the equivalent diameter d_e = 0.370 d of a non-rotating solid round in bending (mm)."""
    de = 0.370 * d_m * 1e3
    return 1.24 * de ** -0.107 if de <= 51 else 1.51 * de ** -0.157


def fatigue_fraction(sut_mpa):
    """Fraction f of Sut at 10^3 cycles (Shigley curve fit, Sut 70..200 kpsi)."""
    s = sut_mpa / KPSI_MPA
    return 1.06 - 2.8e-3 * s + 6.9e-6 * s * s


def analyze(design, ch):
    d, D, r = design['d'], design['D'], design['r']
    fin = ch['finishes'][design['finish']]
    sut = ch['sut'] / 1e6
    sy = ch['sy'] / 1e6
    kt = roark_kt_bending(D, d, r)
    q = notch_sensitivity(sut, r)
    kf = 1 + q * (kt - 1)
    ma = ch['Fa'] * ch['arm']
    mm = ch['Fm'] * ch['arm']
    z = math.pi * d ** 3 / 32
    sa_nom = ma / z / 1e6
    sm_nom = mm / z / 1e6
    sa = kf * sa_nom
    sm = kf * sm_nom
    se_prime = 0.5 * sut
    ka = surface_factor(fin[0], fin[1], sut)
    kb = size_factor_nonrotating(d)
    se = ka * kb * ch['kc'] * ch['kd'] * ch['ke'] * se_prime
    f = fatigue_fraction(sut)
    a = (f * sut) ** 2 / se
    b = -math.log10(f * sut / se) / 3
    nt = ch['Nt']
    sf = a * nt ** b
    nf = 1 / (sa / sf + sm / sut)
    ny = sy / (sa + sm)
    if sm < sut:
        srev = sa / (1 - sm / sut)
        life = math.inf if srev <= se else (srev / a) ** (1 / b)
    else:
        srev = math.inf
        life = 0.0
    h = (D - d) / 2
    face = h - r
    mass = ch['rho'] * math.pi / 4 * (D ** 2 * ch['LD'] + d ** 2 * ch['Ld'])
    hr = h / r
    screens = {
        # Stress-concentration fit range: Roark's 0.1 <= h/r <= 20 and the chart range
        # r/d <= 0.3, D/d <= 3; the metric is the largest of the four normalized ratios.
        'KT_FIT_RANGE': max(hr / 20, 0.1 / hr, (r / d) / 0.3, (D / d) / 3),
        'LOCAL_YIELD': 1 / ny,
        'LOW_CYCLE': sa / (f * sut) + sm / sut,
    }
    na = [k for k, v in screens.items() if not v <= 1 + 1e-9]
    checks = {
        'fatigue': nf >= ch['nf_req'] * (1 - 1e-9),
        'yield': ny >= ch['ny_req'] * (1 - 1e-9),
        'mass': mass <= ch['mmax'] * (1 + 1e-9),
        'face': face >= ch['hmin'] * (1 - 1e-9),
    }
    return dict(kt=kt, q=q, kf=kf, sa_nom=sa_nom, sm_nom=sm_nom, sa=sa, sm=sm, se_prime=se_prime,
                ka=ka, kb=kb, se=se, f=f, a=a, b=b, sf=sf, nf=nf, ny=ny, srev=srev, life=life,
                face=face, mass=mass, hr=hr, screens=screens, na=na, checks=checks)
