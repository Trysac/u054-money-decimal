/**
 * Exact money arithmetic on bigint minor units.
 *
 * The bundled currency table is ISO 4217 List One (source: SIX,
 * six-group.com list-one.xml, published 2026-09-17, checked 2026-11-05).
 * Funds codes and codes without a minor unit (N.A., such as XXX, XAU and
 * XDR) are excluded, which leaves 44 currencies. Any other currency can be
 * supplied as a validated {@link Currency} object.
 *
 * The module has no imports, so it also runs unchanged in a browser.
 *
 * @packageDocumentation
 */

/** Rounding modes, with the semantics of Java's `java.math.RoundingMode`. */
export type RoundingMode =
  | "half-even"
  | "half-up"
  | "half-down"
  | "up"
  | "down"
  | "ceiling"
  | "floor";

/** A currency: its ISO 4217 style code and its number of minor-unit digits. */
export type Currency = {
  readonly code: string;
  readonly minorUnits: number;
};

/** Stable machine-readable error codes of {@link MoneyError}. */
export type MoneyErrorCode =
  | "currency_mismatch"
  | "unknown_currency"
  | "invalid_amount"
  | "rounding_required"
  | "number_not_allowed"
  | "invalid_ratio"
  | "invalid_currency";

/** JSON shape produced by {@link Money.toJSON}. */
export type MoneyJSON = {
  readonly amount: string;
  readonly currency: string;
};

/** Maximum length of an amount or factor string, and maximum digits of a bigint input. */
export const MAX_AMOUNT_CHARS = 40;

/** Maximum number of entries accepted by {@link Money.allocate}. */
export const MAX_ALLOCATION_RATIOS = 1000;

const MAX_MINOR_UNITS = 6;
const MAX_QUOTED_CHARS = 40;
const AMOUNT_RE = /^(-?)(\d+)(?:\.(\d+))?$/;
const CODE_RE = /^[A-Z]{3}$/;
const BIGINT_LIMIT = 10n ** BigInt(MAX_AMOUNT_CHARS);

const ROUNDING_MODES: readonly RoundingMode[] = [
  "half-even",
  "half-up",
  "half-down",
  "up",
  "down",
  "ceiling",
  "floor",
];
const MODE_SET: ReadonlySet<string> = new Set(ROUNDING_MODES);

/** The single error type of this library. `code` is stable and machine-readable. */
export class MoneyError extends Error {
  /** Machine-readable error code. */
  readonly code: MoneyErrorCode;

  /**
   * @param code - Stable error code.
   * @param message - Human-readable message; never contains more than 40 characters of input.
   */
  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = "MoneyError";
    this.code = code;
  }
}

const MINOR_0 = "CLP ISK JPY KRW PYG UGX VND XAF XOF";
const MINOR_2_A = "AED AUD BRL CAD CHF CNY COP CZK DKK EUR GBP HKD HUF";
const MINOR_2_B = "IDR ILS INR MXN NOK NZD PLN SAR SEK SGD TRY USD ZAR";
const MINOR_3 = "BHD IQD JOD KWD LYD OMR TND";
const MINOR_4 = "CLF UYW";

const GROUPS: ReadonlyArray<readonly [number, string]> = [
  [0, MINOR_0],
  [2, MINOR_2_A],
  [2, MINOR_2_B],
  [3, MINOR_3],
  [4, MINOR_4],
];

const TABLE = new Map<string, Currency>();
for (const [minorUnits, codes] of GROUPS) {
  for (const code of codes.split(" ")) {
    TABLE.set(code, Object.freeze({ code, minorUnits }));
  }
}

function fail(code: MoneyErrorCode, message: string): never {
  throw new MoneyError(code, message);
}

function quote(input: string): string {
  const head = input.slice(0, MAX_QUOTED_CHARS).replace(/[^ -~]/g, "?");
  return `"${head}"`;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

interface Rational {
  readonly num: bigint;
  readonly scale: number;
}

interface Part {
  readonly index: number;
  readonly share: bigint;
  readonly rem: bigint;
}

function parseDecimal(input: unknown, what: string): Rational {
  if (typeof input === "number") {
    return fail("number_not_allowed", `${what} must not be a number`);
  }
  if (typeof input !== "string") {
    return fail("invalid_amount", `${what} must be a string`);
  }
  if (input.length > MAX_AMOUNT_CHARS) {
    return fail("invalid_amount", `${what} exceeds ${MAX_AMOUNT_CHARS} characters`);
  }
  const match = AMOUNT_RE.exec(input);
  if (match === null) {
    return fail("invalid_amount", `invalid decimal ${quote(input)}`);
  }
  const [, sign = "", whole = "", fraction = ""] = match;
  const digits = BigInt(whole + fraction);
  return { num: sign === "-" ? -digits : digits, scale: fraction.length };
}

function checkBigint(value: unknown, what: string): bigint {
  if (typeof value === "number") {
    return fail("number_not_allowed", `${what} must not be a number`);
  }
  if (typeof value !== "bigint") {
    return fail("invalid_amount", `${what} must be a bigint`);
  }
  if (value >= BIGINT_LIMIT || value <= -BIGINT_LIMIT) {
    return fail("invalid_amount", `${what} exceeds ${MAX_AMOUNT_CHARS} digits`);
  }
  return value;
}

function parseFactor(factor: unknown): Rational {
  if (typeof factor === "bigint") {
    return { num: checkBigint(factor, "factor"), scale: 0 };
  }
  return parseDecimal(factor, "factor");
}

function checkMode(mode: unknown): RoundingMode {
  if (typeof mode !== "string" || !MODE_SET.has(mode)) {
    return fail("rounding_required", "unknown rounding mode");
  }
  return mode as RoundingMode;
}

/** Divides `n` by the positive `d`, rounding the quotient with `mode`. */
function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  const q = n / d;
  const r = n % d;
  if (r === 0n) {
    return q;
  }
  const away = n < 0n ? q - 1n : q + 1n;
  if (mode === "up") {
    return away;
  }
  if (mode === "down") {
    return q;
  }
  if (mode === "ceiling") {
    return n > 0n ? away : q;
  }
  if (mode === "floor") {
    return n < 0n ? away : q;
  }
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice > d) {
    return away;
  }
  if (twice < d) {
    return q;
  }
  if (mode === "half-up") {
    return away;
  }
  if (mode === "half-down") {
    return q;
  }
  return q % 2n === 0n ? q : away;
}

function isRatio(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function checkRatios(ratios: unknown): bigint[] {
  if (!Array.isArray(ratios)) {
    return fail("invalid_ratio", "ratios must be an array");
  }
  if (ratios.length < 1 || ratios.length > MAX_ALLOCATION_RATIOS) {
    return fail("invalid_ratio", `ratios needs 1 to ${MAX_ALLOCATION_RATIOS} entries`);
  }
  const weights: bigint[] = [];
  for (const ratio of ratios as unknown[]) {
    if (!isRatio(ratio)) {
      return fail("invalid_ratio", "ratios must be safe integers >= 0");
    }
    weights.push(BigInt(ratio));
  }
  if (!weights.some((weight) => weight > 0n)) {
    return fail("invalid_ratio", "at least one ratio must be positive");
  }
  return weights;
}

function byRemainder(a: Part, b: Part): number {
  if (a.rem !== b.rem) {
    return a.rem > b.rem ? -1 : 1;
  }
  return a.index - b.index;
}

/**
 * Returns the bundled currency for an uppercase three-letter code.
 *
 * @param code - Code such as `"USD"`. Lowercase codes are rejected.
 * @returns The frozen currency record.
 * @throws {MoneyError} `unknown_currency` when the code is not in the table.
 */
export function getCurrency(code: string): Currency {
  const found = typeof code === "string" ? TABLE.get(code) : undefined;
  if (found === undefined) {
    const shown = quote(String(code));
    return fail("unknown_currency", `unknown currency ${shown}`);
  }
  return found;
}

/**
 * Lists the bundled currencies.
 *
 * @returns A new array of the 44 bundled currencies, sorted by code.
 */
export function listCurrencies(): Currency[] {
  return [...TABLE.keys()].sort().map((code) => getCurrency(code));
}

function resolveCurrency(currency: unknown): Currency {
  if (typeof currency === "string") {
    return getCurrency(currency);
  }
  if (typeof currency !== "object" || currency === null) {
    return fail("invalid_currency", "currency must be a code or an object");
  }
  const { code, minorUnits } = currency as Partial<Currency>;
  if (typeof code !== "string" || !CODE_RE.test(code)) {
    return fail("invalid_currency", "currency code must match ^[A-Z]{3}$");
  }
  if (
    typeof minorUnits !== "number" ||
    !Number.isInteger(minorUnits) ||
    minorUnits < 0 ||
    minorUnits > MAX_MINOR_UNITS
  ) {
    return fail("invalid_currency", "minorUnits must be an integer 0-6");
  }
  return Object.freeze({ code, minorUnits });
}

/**
 * An immutable amount of money stored as a bigint count of minor units.
 *
 * All arithmetic is exact. Instances are frozen and are created through the
 * static factories {@link Money.of}, {@link Money.fromMinor} and {@link Money.zero}.
 */
export class Money {
  /** The currency of this amount. */
  readonly currency: Currency;
  readonly #minor: bigint;

  private constructor(minor: bigint, currency: Currency) {
    this.#minor = minor;
    this.currency = currency;
    Object.freeze(this);
  }

  /**
   * Parses a decimal string such as `"-12.30"`.
   *
   * @param amount - String matching `^-?\d+(\.\d+)?$`, at most {@link MAX_AMOUNT_CHARS} characters.
   * @param currency - A bundled currency code or a validated {@link Currency} object.
   * @param options - `rounding` is required when `amount` has more fraction digits than the currency has minor units.
   * @returns The parsed amount. `"-0"` parses to zero.
   * @throws {MoneyError} `number_not_allowed`, `invalid_amount`, `rounding_required`, `unknown_currency` or `invalid_currency`.
   */
  static of(
    amount: string,
    currency: string | Currency,
    options?: { readonly rounding?: RoundingMode },
  ): Money {
    const cur = resolveCurrency(currency);
    const { num, scale } = parseDecimal(amount, "amount");
    const rounding = options?.rounding === undefined ? undefined : checkMode(options.rounding);
    if (scale <= cur.minorUnits) {
      return new Money(num * pow10(cur.minorUnits - scale), cur);
    }
    if (rounding === undefined) {
      return fail("rounding_required", `${quote(amount)} has more than ${cur.minorUnits} decimals`);
    }
    const divisor = pow10(scale - cur.minorUnits);
    return new Money(divRound(num, divisor, rounding), cur);
  }

  /**
   * Creates an amount from a count of minor units (for example cents).
   *
   * @param minor - Minor units, at most {@link MAX_AMOUNT_CHARS} digits.
   * @param currency - A bundled currency code or a validated {@link Currency} object.
   * @throws {MoneyError} `number_not_allowed` for a number, `invalid_amount` for other non-bigints or oversized values.
   */
  static fromMinor(minor: bigint, currency: string | Currency): Money {
    const cur = resolveCurrency(currency);
    return new Money(checkBigint(minor, "minor"), cur);
  }

  /**
   * Creates a zero amount.
   *
   * @param currency - A bundled currency code or a validated {@link Currency} object.
   */
  static zero(currency: string | Currency): Money {
    return new Money(0n, resolveCurrency(currency));
  }

  /**
   * Adds an amount of the same currency.
   *
   * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
   */
  add(other: Money): Money {
    this.#assertSame(other);
    return new Money(this.#minor + other.#minor, this.currency);
  }

  /**
   * Subtracts an amount of the same currency.
   *
   * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
   */
  subtract(other: Money): Money {
    this.#assertSame(other);
    return new Money(this.#minor - other.#minor, this.currency);
  }

  /**
   * Multiplies by an exact decimal factor and rounds to minor units.
   *
   * @param factor - Decimal string (at most {@link MAX_AMOUNT_CHARS} characters) or bigint.
   * @param rounding - Rounding mode, `"half-even"` by default.
   * @throws {MoneyError} `number_not_allowed`, `invalid_amount` or `rounding_required` (unknown mode).
   */
  multiply(factor: string | bigint, rounding: RoundingMode = "half-even"): Money {
    const mode = checkMode(rounding);
    const { num, scale } = parseFactor(factor);
    const product = this.#minor * num;
    return new Money(divRound(product, pow10(scale), mode), this.currency);
  }

  /**
   * Splits the amount by largest remainder so the parts always sum to the original.
   *
   * Leftover minor units go to the largest remainders, ties to the lower index.
   * Negative amounts mirror positive ones.
   *
   * @param ratios - 1 to {@link MAX_ALLOCATION_RATIOS} non-negative safe integers, at least one positive.
   * @throws {MoneyError} `invalid_ratio` for invalid ratios.
   */
  allocate(ratios: readonly number[]): Money[] {
    const weights = checkRatios(ratios);
    const total = weights.reduce((sum, weight) => sum + weight, 0n);
    const negative = this.#minor < 0n;
    const magnitude = negative ? -this.#minor : this.#minor;
    const parts: Part[] = weights.map((weight, index) => ({
      index,
      share: (magnitude * weight) / total,
      rem: (magnitude * weight) % total,
    }));
    const assigned = parts.reduce((sum, part) => sum + part.share, 0n);
    const leftover = Number(magnitude - assigned);
    const ranked = [...parts].sort(byRemainder);
    const winners = ranked.slice(0, leftover).map((part) => part.index);
    const bonus = new Set(winners);
    return parts.map((part) => {
      const units = part.share + (bonus.has(part.index) ? 1n : 0n);
      return new Money(negative ? -units : units, this.currency);
    });
  }

  /** Returns the amount with the opposite sign. */
  negate(): Money {
    return new Money(-this.#minor, this.currency);
  }

  /**
   * Compares two amounts of the same currency.
   *
   * @returns -1, 0 or 1.
   * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
   */
  compare(other: Money): -1 | 0 | 1 {
    this.#assertSame(other);
    const diff = this.#minor - other.#minor;
    if (diff < 0n) {
      return -1;
    }
    return diff > 0n ? 1 : 0;
  }

  /**
   * Value equality: same code, same minorUnits and same amount.
   * Returns false (never throws) for a different currency or a non-Money value.
   */
  equals(other: Money): boolean {
    return (
      other instanceof Money &&
      this.currency.code === other.currency.code &&
      this.currency.minorUnits === other.currency.minorUnits &&
      this.#minor === other.#minor
    );
  }

  /** Returns the amount in minor units. */
  toMinor(): bigint {
    return this.#minor;
  }

  /** Returns the amount as a decimal string with exactly `minorUnits` decimals. */
  toDecimalString(): string {
    const places = this.currency.minorUnits;
    const negative = this.#minor < 0n;
    const digits = (negative ? -this.#minor : this.#minor).toString();
    const padded = digits.padStart(places + 1, "0");
    const cut = padded.length - places;
    const head = padded.slice(0, cut);
    const tail = padded.slice(cut);
    const body = places === 0 ? head : `${head}.${tail}`;
    return negative ? `-${body}` : body;
  }

  /** JSON form: `{ amount, currency }` with the currency code. */
  toJSON(): MoneyJSON {
    return { amount: this.toDecimalString(), currency: this.currency.code };
  }

  #assertSame(other: Money): void {
    if (!(other instanceof Money)) {
      fail("invalid_amount", "other must be a Money instance");
    }
    const a = this.currency;
    const b = other.currency;
    if (a.code !== b.code || a.minorUnits !== b.minorUnits) {
      fail(
        "currency_mismatch",
        `cannot combine ${a.code}/${a.minorUnits} with ${b.code}/${b.minorUnits}`,
      );
    }
  }
}
