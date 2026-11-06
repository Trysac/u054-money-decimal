# money-decimal

[![npm version](https://img.shields.io/npm/v/@trysac/money-decimal.svg)](https://www.npmjs.com/package/@trysac/money-decimal)
[![license: MIT](https://img.shields.io/npm/l/@trysac/money-decimal.svg)](LICENSE)
[![CI](https://github.com/Trysac/u054-money-decimal/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u054-money-decimal/actions/workflows/ci.yml)

Exact money arithmetic on bigint minor units with a bundled ISO 4217 table of 44 currencies, seven named rounding modes including banker's rounding, and lossless allocation by largest remainder.

## Problem

JavaScript numbers cannot represent 0.1 exactly, so price, tax and split calculations drift by cents and reconciliations fail. Currencies also differ in minor units (JPY 0, USD 2, KWD 3, CLF 4), which ad-hoc code often ignores. This package stores each amount as a bigint count of minor units, applies the currency's minor-unit count, and has no imports, so it runs unchanged in the browser.

## Install

```sh
npm install @trysac/money-decimal
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { Money, MoneyError } from "@trysac/money-decimal";

const total = Money.of("0.10", "USD").add(Money.of("0.20", "USD"));
console.log(total.toDecimalString()); // "0.30"
console.log(Money.of("1.235", "USD", { rounding: "half-even" }).toDecimalString()); // "1.24"
try {
  Money.of("1.235", "USD");
} catch (error) {
  console.error((error as MoneyError).code); // "rounding_required"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `Money` | immutable class | `of`, `fromMinor`, `zero`, `add`, `subtract`, `multiply(factor, rounding = "half-even")`, `allocate(ratios)`, `negate`, `compare`, `equals`, `toMinor`, `toDecimalString`, `toJSON`, `currency`. |
| `getCurrency` | `(code: string) => Currency` | Looks up an uppercase ISO 4217 code; throws `unknown_currency`. |
| `listCurrencies` | `() => Currency[]` | The 44 bundled currencies sorted by code. |
| `MoneyError` | `class extends Error` | Has a readonly `code`. |
| `RoundingMode` | type | `half-even`, `half-up`, `half-down`, `up`, `down`, `ceiling`, `floor`. |
| `MAX_AMOUNT_CHARS` | `40` | Maximum length of amount and factor strings. |
| `MAX_ALLOCATION_RATIOS` | `1000` | Maximum number of entries accepted by `allocate`. |

Rounding modes follow Java's `RoundingMode`: `up` and `half-up` round away from zero, `down` and `half-down` toward zero, `ceiling` toward positive infinity, `floor` toward negative infinity, and `half-even` is banker's rounding.

Amount and factor strings must match `^-?\d+(\.\d+)?$` and be at most 40 characters. More fraction digits than the currency's minor units require a `rounding` option. Operations on two amounts require the same currency code and minor units. `equals` returns `false` for a different currency; `add`, `subtract` and `compare` throw `currency_mismatch`. A currency that is not in the table can be passed as `{ code, minorUnits }`, where the code matches `^[A-Z]{3}$` and minorUnits is an integer from 0 to 6.

Error codes: `currency_mismatch`, `unknown_currency`, `invalid_amount`, `rounding_required`, `number_not_allowed`, `invalid_ratio`, `invalid_currency`.

Limits: the bundled table covers only ISO 4217 List One currencies with a minor unit (funds codes and codes such as XXX, XAU and XDR are excluded). Division, locale formatting, exchange rates and localised parsing are not provided.

## Why not dinero.js

dinero.js v2 stayed pre-release for years, and currency.js uses floating-point numbers. This package uses bigint minor units with no runtime dependencies.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model and the limits of this library.

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
