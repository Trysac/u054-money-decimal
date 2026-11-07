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
export type RoundingMode = "half-even" | "half-up" | "half-down" | "up" | "down" | "ceiling" | "floor";
/** A currency: its ISO 4217 style code and its number of minor-unit digits. */
export type Currency = {
    readonly code: string;
    readonly minorUnits: number;
};
/** Stable machine-readable error codes of {@link MoneyError}. */
export type MoneyErrorCode = "currency_mismatch" | "unknown_currency" | "invalid_amount" | "rounding_required" | "number_not_allowed" | "invalid_ratio" | "invalid_currency";
/** JSON shape produced by {@link Money.toJSON}. */
export type MoneyJSON = {
    readonly amount: string;
    readonly currency: string;
};
/** Maximum length of an amount or factor string, and maximum digits of a bigint input. */
export declare const MAX_AMOUNT_CHARS = 40;
/** Maximum number of entries accepted by {@link Money.allocate}. */
export declare const MAX_ALLOCATION_RATIOS = 1000;
/** The single error type of this library. `code` is stable and machine-readable. */
export declare class MoneyError extends Error {
    /** Machine-readable error code. */
    readonly code: MoneyErrorCode;
    /**
     * @param code - Stable error code.
     * @param message - Human-readable message; never contains more than 40 characters of input.
     */
    constructor(code: MoneyErrorCode, message: string);
}
/**
 * Returns the bundled currency for an uppercase three-letter code.
 *
 * @param code - Code such as `"USD"`. Lowercase codes are rejected.
 * @returns The frozen currency record.
 * @throws {MoneyError} `unknown_currency` when the code is not in the table.
 */
export declare function getCurrency(code: string): Currency;
/**
 * Lists the bundled currencies.
 *
 * @returns A new array of the 44 bundled currencies, sorted by code.
 */
export declare function listCurrencies(): Currency[];
/**
 * An immutable amount of money stored as a bigint count of minor units.
 *
 * All arithmetic is exact. Instances are frozen and are created through the
 * static factories {@link Money.of}, {@link Money.fromMinor} and {@link Money.zero}.
 */
export declare class Money {
    #private;
    /** The currency of this amount. */
    readonly currency: Currency;
    private constructor();
    /**
     * Parses a decimal string such as `"-12.30"`.
     *
     * @param amount - String matching `^-?\d+(\.\d+)?$`, at most {@link MAX_AMOUNT_CHARS} characters.
     * @param currency - A bundled currency code or a validated {@link Currency} object.
     * @param options - `rounding` is required when `amount` has more fraction digits than the currency has minor units.
     * @returns The parsed amount. `"-0"` parses to zero.
     * @throws {MoneyError} `number_not_allowed`, `invalid_amount`, `rounding_required`, `unknown_currency` or `invalid_currency`.
     */
    static of(amount: string, currency: string | Currency, options?: {
        readonly rounding?: RoundingMode;
    }): Money;
    /**
     * Creates an amount from a count of minor units (for example cents).
     *
     * @param minor - Minor units, at most {@link MAX_AMOUNT_CHARS} digits.
     * @param currency - A bundled currency code or a validated {@link Currency} object.
     * @throws {MoneyError} `number_not_allowed` for a number, `invalid_amount` for other non-bigints or oversized values.
     */
    static fromMinor(minor: bigint, currency: string | Currency): Money;
    /**
     * Creates a zero amount.
     *
     * @param currency - A bundled currency code or a validated {@link Currency} object.
     */
    static zero(currency: string | Currency): Money;
    /**
     * Adds an amount of the same currency.
     *
     * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
     */
    add(other: Money): Money;
    /**
     * Subtracts an amount of the same currency.
     *
     * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
     */
    subtract(other: Money): Money;
    /**
     * Multiplies by an exact decimal factor and rounds to minor units.
     *
     * @param factor - Decimal string (at most {@link MAX_AMOUNT_CHARS} characters) or bigint.
     * @param rounding - Rounding mode, `"half-even"` by default.
     * @throws {MoneyError} `number_not_allowed`, `invalid_amount` or `rounding_required` (unknown mode).
     */
    multiply(factor: string | bigint, rounding?: RoundingMode): Money;
    /**
     * Splits the amount by largest remainder so the parts always sum to the original.
     *
     * Leftover minor units go to the largest remainders, ties to the lower index.
     * Negative amounts mirror positive ones.
     *
     * @param ratios - 1 to {@link MAX_ALLOCATION_RATIOS} non-negative safe integers, at least one positive.
     * @throws {MoneyError} `invalid_ratio` for invalid ratios.
     */
    allocate(ratios: readonly number[]): Money[];
    /** Returns the amount with the opposite sign. */
    negate(): Money;
    /**
     * Compares two amounts of the same currency.
     *
     * @returns -1, 0 or 1.
     * @throws {MoneyError} `currency_mismatch` when code or minorUnits differ.
     */
    compare(other: Money): -1 | 0 | 1;
    /**
     * Value equality: same code, same minorUnits and same amount.
     * Returns false (never throws) for a different currency or a non-Money value.
     */
    equals(other: Money): boolean;
    /** Returns the amount in minor units. */
    toMinor(): bigint;
    /** Returns the amount as a decimal string with exactly `minorUnits` decimals. */
    toDecimalString(): string;
    /** JSON form: `{ amount, currency }` with the currency code. */
    toJSON(): MoneyJSON;
}
