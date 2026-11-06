# Represent money as immutable bigint minor units with exact rational rounding

Status: accepted (generated, pending human review)

## Context

JavaScript numbers cannot represent values like 0.1 exactly, so price, tax and split calculations drift by cents. Currencies also differ in minor units (JPY 0, USD 2, KWD 3, CLF 4). The library must run unchanged in browsers, so it cannot depend on node: modules or on a big-number package.

## Decision

Money stores a bigint count of minor units plus a frozen Currency. Decimal strings are parsed into an integer numerator and a power-of-ten scale, and multiplication and rounding are done as exact integer division with one divRound routine implementing the seven Java RoundingMode semantics. Numbers are rejected as inputs; amounts, factors and bigint inputs have a named size limit (MAX_AMOUNT_CHARS = 40) and allocation has a ratio-count limit (1000). Allocation uses largest remainder with ties to the lower index and mirrors negative amounts. The ISO 4217 List One table is bundled as 44 rows and other currencies are accepted only as validated objects. A single MoneyError class with a stable code is used for all failures, and the module has no imports.

## Consequences

Results are exact and deterministic with no dependencies, and the code runs in any JavaScript runtime with bigint. Callers must pass strings or bigints rather than numbers, and results of arithmetic are not size-capped. The bundled table must be refreshed by hand when ISO 4217 changes, and unlisted currencies need an explicit Currency object. An unknown rounding mode at runtime is reported as rounding_required because the error code set is fixed. equals returns false for different currencies while add, subtract and compare throw currency_mismatch.
