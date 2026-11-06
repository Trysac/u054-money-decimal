# Security practices

How this repository keeps the package and its users safe. The disclosure policy is in
[../SECURITY.md](../SECURITY.md).

## Threat model

The library processes money amounts supplied by its caller. The threats below are the ones the code addresses and the ones it does not.

Defended:

- Silent precision loss: amounts are bigint minor units, so addition, subtraction and multiplication are exact. Floating-point numbers are rejected as inputs with `number_not_allowed`.
- Mixing currencies: add, subtract and compare throw `currency_mismatch` when code or minor units differ.
- Hidden rounding: an amount with more fraction digits than its currency allows is rejected with `rounding_required` unless a rounding mode is given.
- Malformed or oversized input: amount and factor strings must match `^-?\d+(\.\d+)?$` and be at most 40 characters; bigint inputs are limited to 40 digits; allocation accepts at most 1000 ratios, each a non-negative safe integer with at least one positive.
- Invalid custom currencies: the code must match `^[A-Z]{3}$` and minorUnits must be an integer from 0 to 6.
- Error message leakage: messages quote at most 40 characters of input, with non-printable characters replaced by `?`.
- Mutation of shared values: instances and currency records are frozen; operations return new values.
- Code execution: the library uses no `eval`, dynamic `Function` construction, I/O or dependencies.

Not defended:

- Arithmetic results are not capped. Repeated `add` or `multiply` can produce values larger than the 40-digit input limit.
- The bundled currency table is a snapshot of ISO 4217 List One (published 2026-09-17). Changes after that date are not reflected.
- Custom currency objects are validated only for shape. The library does not check that a custom code exists in ISO 4217.
- Input authenticity, authorization and persistence are outside the library. It does not sign, encrypt or store values.
- Side-channel timing is not considered.

## Secrets

- No secrets, tokens or credentials in the repository, commit history, logs or prompts.
- `gitleaks` runs as the last step of `npm run check` and as a dedicated CI job. Its configuration is `.gitleaks.toml`.
- Publishing credentials live only in the CI secret store or the maintainer's local npm configuration.

## Dependencies

- The library has no runtime dependencies. Development dependencies are limited to the toolchain listed in [STACK.md](STACK.md).
- Dependabot opens weekly updates for npm packages and GitHub Actions.
- Commit the generated `package-lock.json` so installs are reproducible.

## Publishing

- Packages are published from a clean checkout after `npm run check` passes.
- Only `dist/` is included in the published tarball.
