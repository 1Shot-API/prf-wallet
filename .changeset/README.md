# Changesets

OWS publishable packages (`@1shotapi/ows-*`) are versioned independently via [Changesets](https://github.com/changesets/changesets).

Example apps are excluded. Maintainers: `npm run changeset` → `npm run version-packages` → `npm run release`.

Internal `@1shotapi/*` deps use `workspace:^` (see [CONTRIBUTING.md](../CONTRIBUTING.md#versioning)). Do not use bare `"*"`.
