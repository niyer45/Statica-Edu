#!/usr/bin/env python3
"""Stress and Strain I (task 72) independent calculation worksheet.

Standalone: written from the equations in design.md, with no application code imported. Uses
40-digit decimal arithmetic so the fixtures are an independent numeric source for the
TypeScript implementation (asserted at 1e-9 relative). Run: python3 worksheet.py

Model axialTieRod v1: a straight, prismatic, solid circular rod in pure axial tension, load
through the centroid, linear elastic.
    A = pi d^2 / 4,  sigma = P / A,  eps = sigma / E,  delta = P L / (A E) = eps L,
    m = rho A L,  k = E A / L,  sigma_allow = sigma_y / n,  yield ratio = sigma / sigma_y
"""
from decimal import Decimal as D, getcontext

getcontext().prec = 40

# pi to 50 digits (constant, not computed by application code).
PI = D("3.14159265358979323846264338327950288419716939937510")

P = D(20000)        # N, tensile load
L = D(2)            # m, rod length
N = D(2)            # design factor on yield
DELTA_MAX = D("0.002")  # m
MASS_MAX = D(2)     # kg
WARN, NA = D("0.8"), D(1)

# Typical textbook values (stated as such in the challenge).
MATERIALS = {
    "steel": dict(E=D("200e9"), sy=D("250e6"), rho=D(7850)),
    "aluminium": dict(E=D("69e9"), sy=D("276e6"), rho=D(2700)),
    "titanium": dict(E=D("114e9"), sy=D("830e6"), rho=D(4430)),
}


def analyze(material, d):
    m = MATERIALS[material]
    d = D(d)
    A = PI * d * d / 4
    sigma = P / A
    eps = sigma / m["E"]
    delta = P * L / (A * m["E"])
    mass = m["rho"] * A * L
    k = m["E"] * A / L
    allow = m["sy"] / N
    ratio = sigma / m["sy"]
    fails = []
    if sigma > allow:
        fails.append("stress")
    if delta > DELTA_MAX:
        fails.append("elongation")
    if mass > MASS_MAX:
        fails.append("mass")
    warn = WARN < ratio <= NA
    na = ratio > NA
    status = "modelNotApplicable" if na else ("accepted" if not fails else "notAccepted")
    return dict(A=A, sigma=sigma, eps=eps, delta=delta, mass=mass, k=k, allow=allow, ratio=ratio,
                fails=fails, warn=warn, na=na, status=status)


def g(x):
    """15 significant digits, like the other worksheets."""
    return format(+x.normalize(), ".15g") if isinstance(x, D) else str(x)


ROWS = [
    ("baseline", "steel", "0.013"),
    ("reference", "aluminium", "0.02"),
    ("titaniumSlim", "titanium", "0.015"),
    ("titaniumMargin", "titanium", "0.0155"),
    ("steelStrong", "steel", "0.0145"),
    ("aluminiumSameDiameter", "aluminium", "0.0145"),
    ("titaniumSameDiameter", "titanium", "0.0145"),
    ("aluminiumThin", "aluminium", "0.011"),
    ("titaniumThin", "titanium", "0.0065"),
    ("aluminiumHeavy", "aluminium", "0.022"),
    ("steelMax", "steel", "0.03"),
    ("warningAluminium", "aluminium", "0.0105"),
    ("tinySteel", "steel", "0.006"),
]

print("| Fixture | Material, d (m) | A (m²) | σ (Pa) | ε | δ (m) | m (kg) | EA/L (N/m) | σ_allow (Pa) | σ/σ_y | Expected |")
print("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
for name, mat, d in ROWS:
    r = analyze(mat, d)
    note = r["status"]
    if r["fails"]:
        note += ": " + ", ".join(r["fails"])
    if r["warn"]:
        note += "; PLASTICITY warning"
    if r["na"]:
        note += "; PLASTICITY not applicable"
    print(f"| `{name}` | {mat}, {d} | {g(r['A'])} | {g(r['sigma'])} | {g(r['eps'])} | {g(r['delta'])} | {g(r['mass'])} | {g(r['k'])} | {g(r['allow'])} | {g(r['ratio'])} | {note} |")

print()
print("Derived limits per material (minimum diameter for each check, maximum for mass):")
for mat, m in MATERIALS.items():
    a_stress = N * P / m["sy"]
    a_stiff = P * L / (m["E"] * DELTA_MAX)
    a_mass = MASS_MAX / (m["rho"] * L)
    a_warn = P / (WARN * m["sy"])
    dia = lambda a: (4 * a / PI).sqrt()
    need = max(a_stress, a_stiff)
    print(f"  {mat}: d_stress >= {g(dia(a_stress))} m, d_stiff >= {g(dia(a_stiff))} m, "
          f"d_mass <= {g(dia(a_mass))} m, no-warning d >= {g(dia(a_warn))} m; "
          f"lightest passing-stress-and-stretch mass = {g(m['rho'] * need * L)} kg; "
          f"stiffness-only mass rho P L^2/(E delta) = {g(m['rho'] * a_stiff * L)} kg; E/rho = {g(m['E'] / m['rho'])}")

print()
# Exhaustive grid: 6..30 mm step 0.5 mm, three materials.
grid = [(D(12) + i) / D(2000) for i in range(49)]  # 6.0 .. 30.0 mm
best = {}
clean_max = 0
count = 0
accepted = []
for mat in MATERIALS:
    for d in grid:
        count += 1
        r = analyze(mat, d)
        if r["na"]:
            continue
        if not r["warn"]:
            clean_max = max(clean_max, len(r["fails"]))
            best.setdefault(len(r["fails"]), []).append((mat, format(d * 1000, 'f')))
        if r["status"] == "accepted":
            accepted.append((mat, format(d * 1000, 'f')))
print(f"Grid designs: {count}; most checks failed by an applicable design without warnings: {clean_max}")
print(f"  designs failing {clean_max}: {best[clean_max]}")
print(f"  accepted designs (mm): {accepted}")

print()
# Alternative routes.
r = analyze("steel", "0.013")
# 1. Castigliano: delta = dU/dP with U = P^2 L / (2 A E), by central difference in decimal.
m = MATERIALS["steel"]
A = PI * D("0.013") ** 2 / 4
U = lambda p: p * p * L / (2 * A * m["E"])
h = D("1e-6")
cast = (U(P + h) - U(P - h)) / (2 * h)
print(f"Castigliano check (baseline): dU/dP = {g(cast)} m vs delta = {g(r['delta'])} m")
# 2. Strain energy equals work: U = P delta / 2 = sigma^2/(2E) * A L.
print(f"Energy check (baseline): P delta/2 = {g(P * r['delta'] / 2)} J, sigma^2 A L/(2E) = {g(r['sigma'] ** 2 * A * L / (2 * m['E']))} J")
# 3. Area by the shoelace formula of an inscribed regular 4096-gon (test-code style check).
import math
nside = 4096
poly = D(nside) / 2 * (D("0.0065") ** 2) * D(repr(math.sin(2 * math.pi / nside)))
print(f"Polygon area (4096 sides, baseline d): {g(poly)} m² vs πd²/4 = {g(A)} m²")
# Prediction fixture: baseline -> reference elongation ratio.
ref = analyze("aluminium", "0.02")
print(f"Prediction fixture: baseline -> reference elongation ratio = {g(ref['delta'] / r['delta'])}")
