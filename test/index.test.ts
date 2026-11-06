import { describe, expect, it } from "vitest";
import * as lib from "../src/index.js";

const { Money, MoneyError, MAX_AMOUNT_CHARS, MAX_ALLOCATION_RATIOS, getCurrency, listCurrencies } =
  lib;

type Currency = lib.Currency;
type RoundingMode = lib.RoundingMode;

function errorOf(fn: () => unknown): lib.MoneyError {
  try {
    fn();
  } catch (error) {
    if (error instanceof MoneyError) {
      return error;
    }
    throw error;
  }
  throw new Error("expected a MoneyError");
}

function codeOf(fn: () => unknown): string {
  return errorOf(fn).code;
}

function jpyMinor(value: string, rounding: RoundingMode): bigint {
  return Money.of(value, "JPY", { rounding }).toMinor();
}

const BAD_MODE = "nope" as unknown as RoundingMode;

const JPY_VALUES = ["1.5", "2.5", "-1.5", "-2.5", "1.4", "1.6", "-1.4", "-1.6"];

const ROUNDING_CASES: [RoundingMode, bigint[]][] = [
  ["half-even", [2n, 2n, -2n, -2n, 1n, 2n, -1n, -2n]],
  ["half-up", [2n, 3n, -2n, -3n, 1n, 2n, -1n, -2n]],
  ["half-down", [1n, 2n, -1n, -2n, 1n, 2n, -1n, -2n]],
  ["up", [2n, 3n, -2n, -3n, 2n, 2n, -2n, -2n]],
  ["down", [1n, 2n, -1n, -2n, 1n, 1n, -1n, -1n]],
  ["ceiling", [2n, 3n, -1n, -2n, 2n, 2n, -1n, -1n]],
  ["floor", [1n, 2n, -2n, -3n, 1n, 1n, -2n, -2n]],
];

describe("addition, zero and comparison", () => {
  it("adds without float drift", () => {
    const sum = Money.of("0.10", "USD").add(Money.of("0.20", "USD"));
    expect(sum.equals(Money.of("0.30", "USD"))).toBe(true);
    expect(sum.toMinor()).toBe(30n);
  });

  it("treats -0 as zero", () => {
    const zero = Money.of("-0", "USD");
    expect(zero.equals(Money.zero("USD"))).toBe(true);
    expect(zero.toDecimalString()).toBe("0.00");
    expect(Money.of("-0.00", "USD").toMinor()).toBe(0n);
  });

  it("subtracts, negates and compares", () => {
    const one = Money.of("1.00", "USD");
    const small = Money.of("0.30", "USD");
    expect(one.subtract(small).toDecimalString()).toBe("0.70");
    expect(small.subtract(one).toDecimalString()).toBe("-0.70");
    expect(one.negate().toDecimalString()).toBe("-1.00");
    expect(Money.zero("USD").negate().toMinor()).toBe(0n);
    expect(one.compare(small)).toBe(1);
    expect(small.compare(one)).toBe(-1);
    expect(one.compare(Money.of("1", "USD"))).toBe(0);
    expect(one.equals(Money.of("1", "USD"))).toBe(true);
    expect(one.equals(small)).toBe(false);
  });

  it("stays exact beyond 2^53", () => {
    const big = Money.of("99999999999999999999999999999999.99", "USD");
    const sum = big.add(Money.of("0.01", "USD"));
    expect(sum.toDecimalString()).toBe("100000000000000000000000000000000.00");
  });
});

describe("rounding", () => {
  it("requires a rounding mode for extra decimals", () => {
    expect(codeOf(() => Money.of("1.235", "USD"))).toBe("rounding_required");
    expect(codeOf(() => Money.of("1.230", "USD"))).toBe("rounding_required");
    expect(codeOf(() => Money.of("5.0", "JPY"))).toBe("rounding_required");
    expect(codeOf(() => Money.of("1.5", "JPY", {}))).toBe("rounding_required");
  });

  it("applies half-even and half-up on USD", () => {
    const he = { rounding: "half-even" } as const;
    expect(Money.of("1.235", "USD", he).toDecimalString()).toBe("1.24");
    expect(Money.of("1.225", "USD", he).toDecimalString()).toBe("1.22");
    expect(Money.of("-1.225", "USD", he).toDecimalString()).toBe("-1.22");
    const hu = { rounding: "half-up" } as const;
    expect(Money.of("-1.225", "USD", hu).toDecimalString()).toBe("-1.23");
    expect(Money.of("1.230", "USD", he).toDecimalString()).toBe("1.23");
    expect(Money.of("-0.004", "USD", he).toDecimalString()).toBe("0.00");
  });

  it.each(ROUNDING_CASES)("%s on ties and non-ties", (mode, expected) => {
    const actual = JPY_VALUES.map((value) => jpyMinor(value, mode));
    expect(actual).toEqual(expected);
  });

  it("rounds values beyond Number.MAX_SAFE_INTEGER", () => {
    const big = "9007199254740993.5";
    expect(BigInt(Number.MAX_SAFE_INTEGER)).toBe(9007199254740991n);
    expect(jpyMinor(big, "half-even")).toBe(9007199254740994n);
    expect(jpyMinor(big, "half-down")).toBe(9007199254740993n);
    expect(jpyMinor(big, "ceiling")).toBe(9007199254740994n);
    expect(jpyMinor(`-${big}`, "floor")).toBe(-9007199254740994n);
    expect(jpyMinor(`-${big}`, "ceiling")).toBe(-9007199254740993n);
  });

  it("rounds zero and tiny values", () => {
    expect(jpyMinor("0.0", "up")).toBe(0n);
    expect(jpyMinor("0.1", "up")).toBe(1n);
    expect(jpyMinor("-0.1", "down")).toBe(0n);
    expect(jpyMinor("-0.0", "floor")).toBe(0n);
  });

  it("rounds on three and four decimal currencies", () => {
    const he = { rounding: "half-even" } as const;
    const hu = { rounding: "half-up" } as const;
    expect(Money.of("1.2345", "KWD", he).toDecimalString()).toBe("1.234");
    expect(Money.of("1.2345", "KWD", hu).toDecimalString()).toBe("1.235");
    expect(Money.of("1.23445", "CLF", he).toDecimalString()).toBe("1.2344");
    expect(Money.of("1.23445", "CLF", hu).toDecimalString()).toBe("1.2345");
    expect(codeOf(() => Money.of("1.2345", "KWD"))).toBe("rounding_required");
  });

  it("rejects an unknown rounding mode", () => {
    const options = { rounding: BAD_MODE };
    expect(codeOf(() => Money.of("1.5", "JPY", options))).toBe("rounding_required");
    expect(codeOf(() => Money.zero("JPY").multiply("2", BAD_MODE))).toBe("rounding_required");
  });
});

describe("currencies", () => {
  it("returns the minor units of bundled currencies", () => {
    expect(getCurrency("JPY").minorUnits).toBe(0);
    expect(getCurrency("USD").minorUnits).toBe(2);
    expect(getCurrency("KWD").minorUnits).toBe(3);
    expect(getCurrency("CLF").minorUnits).toBe(4);
    expect(getCurrency("EUR")).toEqual({ code: "EUR", minorUnits: 2 });
  });

  it("rejects unknown codes", () => {
    for (const bad of ["usd", "XXQ", "XXX", "XAU", "XDR", "US", "USDX", ""]) {
      expect(codeOf(() => getCurrency(bad))).toBe("unknown_currency");
    }
    expect(codeOf(() => getCurrency(5 as unknown as string))).toBe("unknown_currency");
    expect(codeOf(() => Money.of("1", "ABC"))).toBe("unknown_currency");
  });

  it("accepts a valid custom currency object", () => {
    const custom: Currency = { code: "ABC", minorUnits: 3 };
    expect(Money.fromMinor(1234n, custom).toDecimalString()).toBe("1.234");
    const six = { code: "ABC", minorUnits: 6 };
    expect(Money.fromMinor(7n, six).toDecimalString()).toBe("0.000007");
    expect(Money.of("1.5", { code: "ABC", minorUnits: 0 }, { rounding: "up" }).toMinor()).toBe(2n);
  });

  it("rejects invalid custom currency objects", () => {
    const bad: unknown[] = [
      { code: "abc", minorUnits: 3 },
      { code: "ABC", minorUnits: 7 },
      { code: "ABC", minorUnits: 1.5 },
      { code: "ABC", minorUnits: -1 },
      { code: "AB", minorUnits: 2 },
      { code: 5, minorUnits: 2 },
      { code: "ABC", minorUnits: "2" },
      { code: "ABC" },
      null,
      42,
    ];
    for (const currency of bad) {
      const run = () => Money.zero(currency as Currency);
      expect(codeOf(run)).toBe("invalid_currency");
    }
  });

  it("lists 44 currencies sorted by code", () => {
    const all = listCurrencies();
    const codes = all.map((currency) => currency.code);
    expect(all).toHaveLength(44);
    expect(codes).toEqual([...codes].sort());
    expect(all.filter((c) => c.minorUnits === 0)).toHaveLength(9);
    expect(all.filter((c) => c.minorUnits === 2)).toHaveLength(26);
    expect(all.filter((c) => c.minorUnits === 3)).toHaveLength(7);
    expect(all.filter((c) => c.minorUnits === 4)).toHaveLength(2);
    all.pop();
    expect(listCurrencies()).toHaveLength(44);
  });
});

describe("allocate", () => {
  const parts = (money: lib.Money, ratios: number[]): string[] =>
    money.allocate(ratios).map((part) => part.toDecimalString());

  it("splits by largest remainder", () => {
    const ten = Money.of("0.10", "USD");
    expect(parts(ten, [1, 1, 1])).toEqual(["0.04", "0.03", "0.03"]);
    const negative = Money.of("-0.10", "USD");
    expect(parts(negative, [1, 1, 1])).toEqual(["-0.04", "-0.03", "-0.03"]);
  });

  it("gives remainder ties to the lower index", () => {
    expect(parts(Money.of("0.05", "USD"), [1, 1])).toEqual(["0.03", "0.02"]);
  });

  it("handles zero ratios", () => {
    const one = Money.of("1.00", "USD");
    expect(parts(one, [0, 1, 1])).toEqual(["0.00", "0.50", "0.50"]);
    const ten = Money.of("0.10", "USD");
    expect(parts(ten, [1, 0, 2])).toEqual(["0.03", "0.00", "0.07"]);
    expect(parts(ten, [0, 5])).toEqual(["0.00", "0.10"]);
  });

  it("splits zero and single ratios", () => {
    expect(parts(Money.zero("USD"), [1, 2])).toEqual(["0.00", "0.00"]);
    expect(parts(Money.of("3", "JPY"), [7])).toEqual(["3"]);
  });

  it("accepts the maximum number of ratios", () => {
    const ratios = Array.from({ length: MAX_ALLOCATION_RATIOS }, () => 1);
    const result = Money.of("0.10", "USD").allocate(ratios);
    expect(result).toHaveLength(1000);
    const minors = result.map((part) => part.toMinor());
    expect(minors.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 1n));
    expect(minors.slice(10).every((minor) => minor === 0n)).toBe(true);
  });

  it("always sums to the original", () => {
    let seed = 12345;
    const next = (max: number): number => {
      seed = (seed * 48271) % 2147483647;
      return seed % max;
    };
    for (let round = 0; round < 300; round += 1) {
      const minor = BigInt(next(100000)) - 50000n;
      const ratios = Array.from({ length: 1 + next(6) }, () => next(5));
      ratios[0] = (ratios[0] ?? 0) + 1;
      const original = Money.fromMinor(minor, "USD");
      const result = original.allocate(ratios);
      const sum = result.reduce((acc, part) => acc.add(part), Money.zero("USD"));
      expect(sum.toMinor()).toBe(minor);
      for (const [index, part] of result.entries()) {
        if (ratios[index] === 0) {
          expect(part.toMinor()).toBe(0n);
        }
      }
    }
  });

  it("rejects invalid ratios", () => {
    const money = Money.of("1.00", "USD");
    const bad: unknown[] = [
      [],
      [0, 0],
      [-1, 1],
      [1.5],
      [Number.NaN, 1],
      [Number.MAX_SAFE_INTEGER + 1],
      ["1"],
      Array.from({ length: MAX_ALLOCATION_RATIOS + 1 }, () => 1),
      "1,1",
      null,
    ];
    for (const ratios of bad) {
      const run = () => money.allocate(ratios as number[]);
      expect(codeOf(run)).toBe("invalid_ratio");
    }
  });
});

describe("currency mismatch", () => {
  const dollars = Money.of("1.00", "USD");
  const euros = Money.of("1.00", "EUR");
  const dollars3 = Money.of("1.000", { code: "USD", minorUnits: 3 });

  it("rejects add, subtract and compare across currencies", () => {
    expect(codeOf(() => dollars.add(euros))).toBe("currency_mismatch");
    expect(codeOf(() => dollars.subtract(euros))).toBe("currency_mismatch");
    expect(codeOf(() => dollars.compare(euros))).toBe("currency_mismatch");
    expect(codeOf(() => dollars.add(dollars3))).toBe("currency_mismatch");
    expect(codeOf(() => dollars.compare(dollars3))).toBe("currency_mismatch");
  });

  it("reports equals as false instead of throwing", () => {
    expect(dollars.equals(euros)).toBe(false);
    expect(dollars.equals(dollars3)).toBe(false);
    expect(dollars.equals({} as unknown as lib.Money)).toBe(false);
  });

  it("rejects a non-Money operand", () => {
    const other = {} as unknown as lib.Money;
    expect(codeOf(() => dollars.add(other))).toBe("invalid_amount");
  });
});

describe("amount validation", () => {
  const BAD_AMOUNTS = [
    "1e3",
    "1,000",
    "",
    " 1.00",
    "+1",
    "1".repeat(41),
    "1.",
    ".5",
    "1.00\n",
    "\uFF11",
    "--1",
    "0x10",
    "NaN",
  ];

  it("rejects malformed amounts", () => {
    for (const bad of BAD_AMOUNTS) {
      expect(codeOf(() => Money.of(bad, "USD"))).toBe("invalid_amount");
    }
  });

  it("rejects ' and a 41-character string throw '", () => {
    expect(codeOf(() => Money.of("1".repeat(41), "USD"))).toBe("invalid_amount");
  });

  it("rejects numbers", () => {
    expect(codeOf(() => Money.of(0.1 as unknown as string, "USD"))).toBe("number_not_allowed");
    const other = 5 as unknown as string;
    expect(codeOf(() => Money.zero("USD").multiply(other))).toBe("number_not_allowed");
    expect(codeOf(() => Money.fromMinor(5 as unknown as bigint, "USD"))).toBe("number_not_allowed");
  });

  it("rejects other non-strings", () => {
    const flag = true as unknown as string;
    expect(codeOf(() => Money.of(flag, "USD"))).toBe("invalid_amount");
    expect(codeOf(() => Money.of(5n as unknown as string, "USD"))).toBe("invalid_amount");
    expect(codeOf(() => Money.fromMinor("5" as unknown as bigint, "USD"))).toBe("invalid_amount");
  });

  it("enforces the named size limit", () => {
    expect(MAX_AMOUNT_CHARS).toBe(40);
    expect(MAX_ALLOCATION_RATIOS).toBe(1000);
    const longest = "1".repeat(MAX_AMOUNT_CHARS);
    expect(Money.of(longest, "JPY").toDecimalString()).toBe(longest);
    const limit = 10n ** 40n;
    expect(Money.fromMinor(limit - 1n, "JPY").toMinor()).toBe(limit - 1n);
    expect(codeOf(() => Money.fromMinor(limit, "JPY"))).toBe("invalid_amount");
    expect(codeOf(() => Money.fromMinor(-limit, "JPY"))).toBe("invalid_amount");
    expect(codeOf(() => Money.zero("JPY").multiply(limit))).toBe("invalid_amount");
    expect(codeOf(() => Money.zero("JPY").multiply("1".repeat(41)))).toBe("invalid_amount");
  });

  it("keeps error messages short and free of control characters", () => {
    const huge = errorOf(() => Money.of("x".repeat(5000), "USD"));
    expect(huge.message.length).toBeLessThan(200);
    expect(huge.message).not.toContain("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    const forty = errorOf(() => Money.of("a".repeat(40), "USD"));
    expect(forty.message).toContain("a".repeat(40));
    expect(forty.message).not.toContain("a".repeat(41));
    const decimals = errorOf(() => Money.of(`0.${"1".repeat(38)}`, "USD"));
    expect(decimals.message).not.toContain("1".repeat(39));
    const control = errorOf(() => Money.of("1\u0000\u0001", "USD"));
    expect(control.message).not.toContain("\u0000");
    const code = errorOf(() => getCurrency("Q".repeat(300)));
    expect(code.message.length).toBeLessThan(200);
  });

  it("exposes a typed error", () => {
    const error = errorOf(() => Money.of("1e3", "USD"));
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MoneyError);
    expect(error.name).toBe("MoneyError");
    expect(error.code).toBe("invalid_amount");
  });
});

describe("multiply", () => {
  it("multiplies by exact decimal factors", () => {
    const quarter = Money.of("0.25", "USD");
    expect(quarter.multiply("0.5").toDecimalString()).toBe("0.12");
    expect(quarter.multiply("0.5", "half-up").toDecimalString()).toBe("0.13");
    const price = Money.of("19.99", "USD");
    expect(price.multiply("1.075", "half-up").toDecimalString()).toBe("21.49");
  });

  it("mirrors negative amounts and supports bigint and signed factors", () => {
    const negative = Money.of("-0.25", "USD");
    expect(negative.multiply("0.5", "half-down").toDecimalString()).toBe("-0.12");
    const ten = Money.of("0.10", "USD");
    expect(ten.multiply(3n).toDecimalString()).toBe("0.30");
    expect(ten.multiply("-1.5").toDecimalString()).toBe("-0.15");
    expect(ten.multiply("-0").toMinor()).toBe(0n);
    expect(ten.multiply("0").toMinor()).toBe(0n);
  });
});

describe("minor units and formatting", () => {
  it("converts from minor units", () => {
    const big = Money.fromMinor(2n ** 64n + 1n, "USD");
    expect(big.toDecimalString()).toBe("184467440737095516.17");
    expect(Money.fromMinor(-5n, "USD").toDecimalString()).toBe("-0.05");
    expect(Money.fromMinor(5n, "KWD").toDecimalString()).toBe("0.005");
    expect(Money.fromMinor(1n, "CLF").toDecimalString()).toBe("0.0001");
    expect(Money.fromMinor(-7n, "JPY").toDecimalString()).toBe("-7");
    expect(Money.fromMinor(0n, "JPY").toDecimalString()).toBe("0");
    expect(Money.fromMinor(100n, "USD").toDecimalString()).toBe("1.00");
  });

  it("serialises to JSON", () => {
    const json = JSON.stringify(Money.of("-12.3", "USD"));
    expect(json).toBe('{"amount":"-12.30","currency":"USD"}');
    const yen = JSON.stringify(Money.of("5", "JPY"));
    expect(yen).toBe('{"amount":"5","currency":"JPY"}');
  });
});

describe("immutability", () => {
  it("freezes instances and currencies", () => {
    const money = Money.of("1.00", "USD");
    expect(Object.isFrozen(money)).toBe(true);
    expect(Object.isFrozen(money.currency)).toBe(true);
    expect(Object.isFrozen(getCurrency("EUR"))).toBe(true);
    const loose = money as unknown as {
      currency: { code: string; minorUnits: number };
    };
    expect(() => {
      loose.currency = getCurrency("EUR");
    }).toThrow(TypeError);
    expect(() => {
      loose.currency.minorUnits = 5;
    }).toThrow(TypeError);
    expect(money.toDecimalString()).toBe("1.00");
  });

  it("never mutates operands", () => {
    const left = Money.of("1.00", "USD");
    const right = Money.of("2.00", "USD");
    left.add(right);
    left.negate();
    left.multiply("3");
    left.allocate([1, 2]);
    expect(left.toMinor()).toBe(100n);
    expect(right.toMinor()).toBe(200n);
  });
});
