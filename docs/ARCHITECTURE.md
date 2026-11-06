# Architecture

## Overview

`@trysac/money-decimal` is a small, dependency-free TypeScript library published to npm as ES modules with type declarations. It provides exact money arithmetic on bigint minor units, a bundled ISO 4217 table of 44 currencies, seven rounding modes, and allocation by largest remainder.

## Modules

| Module | Responsibility |
|---|---|
| `src/index.ts` | Public API: the `Money` class, currency lookup, rounding and error types, and the size-limit constants. Everything consumers import is exported from here. |
| `test/index.test.ts` | Vitest suite that exercises the public API only. |

`src/index.ts` is the only source module. Internal helpers (decimal parsing, rounding, currency validation) are not exported.

## Boundaries

- No runtime dependencies. The module has no imports, so it also runs in a browser.
- No I/O at import time. All functions are pure.
- Errors are thrown as `MoneyError`, which carries a stable `code` field.
- `Money` instances and currency records are frozen. Operations return new instances and never mutate operands.

## Build and distribution

`npm run build` compiles `src/` to `dist/` with `tsconfig.build.json`. Only `dist/` is published (`files` in `package.json`).

## Decisions

Architectural decisions are recorded in [decisions/](decisions/), starting with
[0001](decisions/0001-record-architecture-decisions.md).
