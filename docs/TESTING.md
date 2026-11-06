# Testing

## Tools

- [Vitest](https://vitest.dev/) runs the suite in `test/`.
- Coverage is collected with V8 (`@vitest/coverage-v8`) over `src/`.

## Commands

```sh
npm test            # vitest run --coverage
npx vitest          # watch mode while developing
npm run check       # every gate, including tests
```

## Test file

The only test file is `test/index.test.ts`. It imports the public entry point `../src/index.js` and covers:

- Addition, subtraction, negation, comparison and equality, including `-0` parsing to zero and exactness beyond 2^53.
- Rounding: the rounding_required error, half-even and half-up on USD, a table-driven test of all seven modes on positive and negative JPY ties and non-ties, values beyond `Number.MAX_SAFE_INTEGER`, zero, and three and four decimal currencies (KWD, CLF).
- Currency lookup and listing: minor units of bundled codes, rejection of unknown codes, validation of custom currency objects, and the 44-currency list with counts per minor-unit group.
- `allocate`: largest-remainder results, tie-breaking, zero ratios, the 1000-entry maximum, a seeded randomized check that parts always sum to the original, and invalid ratios.
- Currency mismatch on add, subtract and compare; `equals` returning false; non-Money operands.
- Amount validation: malformed strings, numbers, other non-strings, the 40-character limit, and error message length and content.
- `multiply` with decimal and bigint factors, and `fromMinor`, `toDecimalString` and `toJSON` output.
- Immutability: frozen instances and currencies, and operands that are never mutated.

## Rules

- Test through the public entry point (`src/index.ts`) and assert observable behavior: return values, thrown errors and their codes or messages.
- Tests are deterministic. The randomized allocation test uses a fixed seed.
- Coverage thresholds are set in `vitest.config.ts`; lowering them is not allowed.

## Reports

Coverage reports are written to `coverage/` (text summary and `lcov`). The folder is ignored by git.
