# Project record: money-decimal

## Objective

Provide exact money arithmetic for JavaScript and TypeScript on bigint minor units, with a bundled ISO 4217 currency table, seven named rounding modes including banker's rounding, and lossless allocation by largest remainder. The package runs unchanged in Node.js 20+ and in the browser.

It is for developers who need price, tax and split calculations that do not drift by cents and that respect each currency's minor units.

## Scope

In scope:

- The public API documented in the README: the `Money` class, `getCurrency`, `listCurrencies`, `MoneyError`, the `RoundingMode` type and the size-limit constants.
- Bundled currencies: the 44 ISO 4217 List One codes with a minor unit (source SIX, six-group.com list-one.xml, published 2026-09-17, checked 2026-11-05).
- Custom currencies supplied as validated `{ code, minorUnits }` objects.

Out of scope:

- Division.
- Locale-aware formatting and localised parsing.
- Exchange rates and currency conversion.
- Persistence, networking and authentication.
- Funds codes and codes without a minor unit (for example XXX, XAU and XDR).

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Measured values only. Leave "pending measurement" until a real figure is recorded; never estimate here.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 327775 / 68162 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 0.5261 | factory ledger |

## Factory run u054 (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | claude-sonnet-5-5 | yes | 2703 | 55014 | 0 | 4473 | 0.2782 |
| fix-1 | claude-sonnet-5-5 | no | 6 | 852 | 8427 | 43790 | 0.0340 |
| fix-2 | claude-sonnet-5-5 | no | 8 | 748 | 7333 | 58393 | 0.0317 |
| fix-3 | claude-sonnet-5-5 | no | 8 | 692 | 7223 | 56808 | 0.0307 |
| audit | claude-sonnet-5-5 | no | 10 | 2290 | 27906 | 95020 | 0.1022 |
| fix-4 | claude-sonnet-5-5 | no | 6 | 1832 | 8393 | 41302 | 0.0434 |
| docs | claude-haiku-5-5 | no | 25248 | 6734 | 0 | 0 | 0.0059 |

Total: $0.5261. Prices: Anthropic list prices.
