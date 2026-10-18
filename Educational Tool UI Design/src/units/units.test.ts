import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assertProperty } from "../../test/pbt";
import {
  UNAVAILABLE_PLACEHOLDER,
  formatFixed,
  formatHz,
  formatKnPerM,
  formatMm,
  formatPercent,
  formatSignificant,
  knPerMToNPerM,
  kelvinToCelsius,
  kgToG,
  m2ToCm2,
  m2ToMm2,
  m4ToMm4,
  mToMm,
  mmToM,
  nPerMToKnPerM,
  paToMpa,
  parseDecimalInput,
  parseMmInput,
} from "./units";

describe("vibration display helpers (task 50.3)", () => {
  it("convert stiffness between N/m and kN/m by exact powers of ten", () => {
    expect(nPerMToKnPerM(85000)).toBe(85);
    expect(knPerMToNPerM(61.5)).toBe(61500);
    for (const v of [0.5, 1800, 2000.5, 123.456]) {
      expect(nPerMToKnPerM(v)).toBe(v / 1e3);
      expect(knPerMToNPerM(v)).toBe(v * 1e3);
    }
  });

  it("parse plain decimals with the millimetre grammar", () => {
    expect(parseDecimalInput(" 85.5 ")).toBe(85.5);
    for (const bad of ["", "1e3", "85kN", "1,200", "NaN"]) expect(parseDecimalInput(bad)).toBeNull();
  });

  it("format fixed decimals, frequencies and stiffness without negative zero or exponents", () => {
    expect(formatFixed(1.005, 1)).toBe("1.0");
    expect(formatFixed(-0.0001, 2)).toBe("0.00");
    expect(formatHz(30.1975272626922)).toBe("30.20");
    expect(formatHz(6.56212641207052)).toBe("6.56");
    expect(formatKnPerM(1800000)).toBe("1800.0");
    expect(formatKnPerM(61500, 2)).toBe("61.50");
    expect(formatPercent(0.9071185299163516)).toBe("90.7");
    expect(formatPercent(0.5, 0)).toBe("50");
    for (const v of NON_FINITE) {
      expect(formatFixed(v)).toBe(UNAVAILABLE_PLACEHOLDER);
      expect(formatHz(v)).toBe(UNAVAILABLE_PLACEHOLDER);
      expect(formatSignificant(v)).toBe(UNAVAILABLE_PLACEHOLDER);
    }
  });

  it("format ratios to three significant figures in plain notation", () => {
    expect(formatSignificant(10.0622137253413)).toBe("10.1");
    expect(formatSignificant(0.0928814700836484)).toBe("0.0929");
    expect(formatSignificant(0.12)).toBe("0.120");
    expect(formatSignificant(6)).toBe("6.00");
    expect(formatSignificant(25.0249815288429)).toBe("25.0");
    expect(formatSignificant(9.996)).toBe("10.0");
    expect(formatSignificant(1234.5)).toBe("1230");
    expect(formatSignificant(0)).toBe("0.00");
    expect(formatSignificant(-0.5, 2)).toBe("-0.50");
    expect(formatSignificant(0.123456, 99)).toBe("0.123456");
  });
});

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const PRECISIONS = [0, 1, 2, 3, 4, 5, 6] as const;

describe("conversions (Req 2.2)", () => {
  it("scale by exact powers of ten", () => {
    expect(mToMm(1)).toBe(1000);
    expect(mmToM(1000)).toBe(1);
    expect(paToMpa(120e6)).toBe(120);
    expect(m4ToMm4(1)).toBe(1e12);
    expect(m2ToMm2(1)).toBe(1e6);
    // Same as multiplying/dividing by the literal power of ten, bit for bit.
    for (const v of [0.06, -3.7e-5, 123.456, 2.5e9, Number.MIN_VALUE]) {
      expect(mToMm(v)).toBe(v * 1e3);
      expect(mmToM(v)).toBe(v / 1e3);
      expect(paToMpa(v)).toBe(v / 1e6);
      expect(m4ToMm4(v)).toBe(v * 1e12);
      expect(m2ToMm2(v)).toBe(v * 1e6);
    }
  });

  it("converts heat sink display units (task 48.3): K -> °C, kg -> g, m² -> cm²", () => {
    expect(kelvinToCelsius(298.15)).toBe(25);
    expect(kelvinToCelsius(328.15)).toBe(55);
    expect(kelvinToCelsius(273.15)).toBe(0);
    for (const v of [0.13, 0.0456, -2.5, 1e-9]) {
      expect(kgToG(v)).toBe(v * 1e3);
      expect(m2ToCm2(v)).toBe(v * 1e4);
      expect(kelvinToCelsius(v)).toBe(v - 273.15);
    }
  });

  it("m -> mm -> m returns x within 1e-12 relative error", () => {
    for (const x of [0, 1, -1, 0.06, 1 / 3, -987.654321, 1e-300, 1e300, 6.02e23]) {
      const back = mmToM(mToMm(x));
      expect(Math.abs(back - x)).toBeLessThanOrEqual(Math.abs(x) * 1e-12);
    }
    assertProperty(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e300, max: 1e300 }), (x) => {
        expect(Math.abs(mmToM(mToMm(x)) - x)).toBeLessThanOrEqual(Math.abs(x) * 1e-12);
      }),
    );
  });
});

describe("parseMmInput (Req 2.3, 2.4)", () => {
  it.each([
    ["12", 12],
    ["-3.5", -3.5],
    ["+7", 7],
    ["  42.125\t\n", 42.125],
    [".5", 0.5],
    ["5.", 5],
    ["0", 0],
    ["007.50", 7.5],
  ])("accepts %j as %d mm", (text, mm) => {
    expect(parseMmInput(text)).toBe(mm);
  });

  it.each([
    "",
    "   ",
    "12abc",
    "12mm",
    "12 mm",
    "1,200",
    "1 200",
    "NaN",
    "Infinity",
    "-Infinity",
    "1e3",
    "0x10",
    ".",
    "-",
    "+-1",
    "1.2.3",
    "--1",
    "١٢", // non-ASCII digits
  ])("rejects %j with null", (text) => {
    expect(parseMmInput(text)).toBeNull();
  });

  it("returns null without throwing for a digit string that overflows to Infinity", () => {
    expect(parseMmInput("9".repeat(400))).toBeNull();
  });

  it("returns null without throwing for non-string input from untyped callers", () => {
    for (const bad of [undefined, null, 12, {}, []]) {
      expect(() => parseMmInput(bad as unknown as string)).not.toThrow();
      expect(parseMmInput(bad as unknown as string)).toBeNull();
    }
  });
});

describe("formatMm (Req 2.5, 2.6)", () => {
  it("defaults to 2 digits", () => {
    expect(formatMm(0.0123)).toBe("12.30");
    expect(formatMm(0.06)).toBe("60.00");
  });

  it.each([
    [0.0123456789, 0, "12"],
    [0.0123456789, 1, "12.3"],
    [0.0123456789, 3, "12.346"],
    [0.0123456789, 6, "12.345679"],
    [-0.25, 2, "-250.00"],
  ])("formatMm(%d, %d) === %j", (m, d, expected) => {
    expect(formatMm(m, d)).toBe(expected);
  });

  it("uses '.' and no grouping separators for large values", () => {
    expect(formatMm(1000, 0)).toBe("1000000");
    expect(formatMm(1e6, 2)).toBe("1000000000.00");
    expect(formatMm(-1234.5678, 3)).toBe("-1234567.800");
  });

  it("emits exactly D decimals for every D in 0..6 and a wide value range", () => {
    const values = [0, 1e-9, -1e-6, 0.06, -12.5, 1e6, 1e17, -1e18, 1e300, Number.MAX_VALUE];
    for (const m of values) {
      for (const d of PRECISIONS) {
        const text = formatMm(m, d);
        const pattern = d === 0 ? /^-?\d+$/ : new RegExp(`^-?\\d+\\.\\d{${d}}$`);
        expect(text, `formatMm(${m}, ${d})`).toMatch(pattern);
      }
    }
  });

  it("formats values whose mm exceed 1e21 or overflow as plain digits (regression)", () => {
    // toFixed returns "1e+21" here, and m * 1e3 overflows to Infinity above ~1.8e305 m.
    expect(formatMm(1e18, 1)).toBe("1000000000000000000000.0");
    expect(formatMm(-1e18, 0)).toBe("-1000000000000000000000");
    const huge = formatMm(Number.MAX_VALUE, 2);
    expect(huge).toBe(`${BigInt(Number.MAX_VALUE) * 1000n}.00`);
  });

  it("never shows a negative zero", () => {
    expect(formatMm(-0)).toBe("0.00");
    expect(formatMm(-0.000001)).toBe("0.00");
    expect(formatMm(-0.0004, 0)).toBe("0");
    expect(formatMm(-0.0005, 0)).not.toMatch(/^-0$/);
  });

  it("returns the placeholder for non-finite input without throwing", () => {
    for (const v of NON_FINITE) {
      for (const d of [undefined, ...PRECISIONS]) {
        expect(() => formatMm(v, d)).not.toThrow();
        expect(formatMm(v, d)).toBe(UNAVAILABLE_PLACEHOLDER);
      }
    }
    expect(UNAVAILABLE_PLACEHOLDER).not.toMatch(/\d/);
  });

  it("does not throw for out-of-contract precision", () => {
    for (const d of [-1, 7, 100, 2.7, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatMm(0.01, d)).not.toThrow();
    }
    expect(formatMm(0.01, 2.7)).toBe("10.00");
    expect(formatMm(0.01, 100)).toBe("10.000000");
    expect(formatMm(0.01, -1)).toBe("10");
  });
});

/*
 * Requirement 2.7 round-trip.
 *
 * REQUIREMENT CONFLICT: 2.7 as written (error <= 0.5e-D mm + 1e-9 mm) cannot hold
 * for every |x| <= 1e6 m with IEEE-754 doubles. toFixed rounds the exact double
 * mm = mToMm(x) to D decimals (error <= 0.5e-D), but parsing that string rounds
 * again to the nearest double, adding up to half an ulp of |mm|. Above
 * |mm| = 2^24 mm (~16.8 km) half an ulp exceeds 1e-9 mm, and at 1e9 mm it is
 * ~6e-8 mm. Concrete counterexample (pinned below): x = -187477.49638185 m, D = 4
 * gives error 5.00083e-5 mm > 5.0001e-5 mm.
 *
 * Achievable bound: 0.5e-D + 0.5 * ulp(|mm|) <= 0.5e-D + |mm| * 2^-53.
 * The tests below therefore (a) check 2.7 exactly as written for |x| < 2^24 mm,
 * where it does hold, and (b) check the full range against the requirement
 * tolerance plus a relative floor of |mm| * 2^-52 (k = 2 of slack over the bound).
 */
const STRICT_LIMIT_MM = 2 ** 24;

const strictTolerance = (d: number): number => 0.5 * 10 ** -d + 1e-9;
const achievableTolerance = (mm: number, d: number): number =>
  strictTolerance(d) + Math.abs(mm) * 2 ** -52;

function roundTripError(x: number, d: number): number {
  const parsed = parseMmInput(formatMm(x, d));
  expect(parsed, `parse(format(${x}, ${d}))`).not.toBeNull();
  return Math.abs((parsed as number) - mToMm(x));
}

/** Deterministic samples: both signs, magnitudes 1e-9..1e6 m, awkward mantissas, ties. */
const SAMPLES: readonly number[] = (() => {
  const mantissas = [1, 1.234567891, 2.5, 3.3333333333, 4.99999995, 5.0000005, 7.77777777, 9.87654321];
  const out = [0, -0, 1e6, -1e6, 5e-4, -5e-4, 1.5e-3, 2.5e-7, 0.1, 0.06, 16777.215, 999999.9999995];
  for (let e = -9; e <= 5; e++) {
    for (const m of mantissas) {
      out.push(m * 10 ** e, -m * 10 ** e);
    }
  }
  return out.filter((x) => Math.abs(x) <= 1e6);
})();

describe("format/parse round-trip (Req 2.7)", () => {
  it("meets 2.7 exactly as written for |x| below 2^24 mm (table)", () => {
    const strict = SAMPLES.filter((x) => Math.abs(mToMm(x)) < STRICT_LIMIT_MM);
    expect(strict.length).toBeGreaterThan(100);
    for (const x of strict) {
      for (const d of PRECISIONS) {
        expect(roundTripError(x, d), `x=${x}, D=${d}`).toBeLessThanOrEqual(strictTolerance(d));
      }
    }
  });

  it("stays within the achievable bound over |x| <= 1e6 m (table)", () => {
    for (const x of SAMPLES) {
      for (const d of PRECISIONS) {
        expect(roundTripError(x, d), `x=${x}, D=${d}`).toBeLessThanOrEqual(
          achievableTolerance(mToMm(x), d),
        );
      }
    }
  });

  it("meets 2.7 exactly as written for |x| below 2^24 mm (property)", () => {
    const limitM = STRICT_LIMIT_MM / 1e3;
    assertProperty(
      fc.property(
        fc.double({ min: -limitM, max: limitM, noNaN: true }),
        fc.integer({ min: 0, max: 6 }),
        (x, d) => {
          fc.pre(Math.abs(mToMm(x)) < STRICT_LIMIT_MM);
          expect(roundTripError(x, d)).toBeLessThanOrEqual(strictTolerance(d));
        },
      ),
    );
  });

  it("stays within the achievable bound over |x| <= 1e6 m (property)", () => {
    assertProperty(
      fc.property(
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        fc.integer({ min: 0, max: 6 }),
        (x, d) => {
          expect(roundTripError(x, d)).toBeLessThanOrEqual(achievableTolerance(mToMm(x), d));
        },
      ),
    );
  });

  it("documents the counterexample where 2.7 as written is unachievable", () => {
    const x = -187477.49638185;
    const d = 4;
    expect(formatMm(x, d)).toBe("-187477496.3819");
    const err = roundTripError(x, d);
    expect(err).toBeGreaterThan(strictTolerance(d));
    expect(err).toBeLessThanOrEqual(achievableTolerance(mToMm(x), d));
  });
});

/*
 * Locale independence (Req 2.5). toFixed is locale-independent by spec, so swapping
 * a locale inside this process proves nothing. Instead we start a fresh Node process
 * with LANG/LC_ALL=de_DE.UTF-8, which makes ICU's default locale German (verified in
 * the child: toLocaleString gives "1.234,5"), and compare its formatMm output with
 * this process's output.
 */
describe("locale independence (Req 2.5)", () => {
  const cases: [number, number | undefined][] = [
    [1234.5678, 3],
    [0.0123, undefined],
    [-1e6, 6],
    [1e18, 1],
    [Number.NaN, 2],
  ];

  it("formats identically under a German default locale", () => {
    // In-process sanity: the de-DE locale really does use "," and "." grouping.
    expect(new Intl.NumberFormat("de-DE").format(1234.5)).toBe("1.234,5");

    const unitsUrl = pathToFileURL(fileURLToPath(new URL("./units.ts", import.meta.url))).href;
    const script = [
      `const u = await import(${JSON.stringify(unitsUrl)});`,
      `const cases = ${JSON.stringify(cases.map(([m, d]) => [String(m), d ?? null]))};`,
      "const out = cases.map(([m, d]) => d === null ? u.formatMm(Number(m)) : u.formatMm(Number(m), d));",
      "console.log(JSON.stringify({ locale: Intl.NumberFormat().resolvedOptions().locale, sample: (1234.5).toLocaleString(), out }));",
    ].join("\n");
    const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
    const stdout = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      cwd: projectRoot,
      env: { ...process.env, LANG: "de_DE.UTF-8", LC_ALL: "de_DE.UTF-8", LC_NUMERIC: "de_DE.UTF-8" },
      encoding: "utf8",
    });
    const child = JSON.parse(stdout.trim().split("\n").at(-1) as string) as {
      locale: string;
      sample: string;
      out: string[];
    };

    expect(child.locale).toMatch(/^de\b/);
    expect(child.sample).toBe("1.234,5");
    expect(child.out).toEqual(cases.map(([m, d]) => formatMm(m, d)));
    expect(child.out).toEqual(["1234567.800", "12.30", "-1000000000.000000", "1000000000000000000000.0", "—"]);
  }, 30_000);
});
