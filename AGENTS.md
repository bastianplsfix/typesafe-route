# AGENTS.md — @bastianplsfix/typed-route

## Project summary

A zero-dependency, single-file TypeScript library for building and matching URLs using path patterns (e.g. `/api/bookmarks/:id`). Uses the URLPattern API for matching and resolves base URLs automatically from the runtime environment (Vite, Deno, Bun, Node, browser).

Published to [JSR](https://jsr.io) as `@bastianplsfix/typed-route`. Built with Deno.

## File structure

```
typed-route/
├── mod.ts                        ← JSR entrypoint (re-exports from src/)
├── src/
│   ├── route-builder.ts          ← library source (~380 lines)
│   └── route-builder_test.ts     ← Deno test suite
├── deno.json                     ← package config, JSR metadata, tasks
├── README.md                     ← human documentation
├── AGENTS.md                     ← this file
└── LICENSE
```

## Public API (4 functions, 6 types)

| Export | Kind | Purpose |
| --- | --- | --- |
| `route(pattern, options?)` | function | Build a URL from a pattern + params |
| `matchRoute(pattern, url)` | function | Parse a URL against a pattern → extracted params |
| `routePattern(pattern)` | function | Bind a pattern into a reusable callable |
| `configureRoute(config)` | function | One-time setup for base URL, env key, trailing slash |
| `ExtractParams<T>` | type | Template literal type that extracts `:param` names |
| `RouteOptions<K>` | type | Options union for `route()` |
| `MatchResult<K>` | type | Return type of `matchRoute()` |
| `BoundRoute<T>` | type | Return type of `routePattern()` |
| `RouteConfig` | interface | Config shape for `configureRoute()` |
| `ParamValue` | type | `string \| number` |

## Key technical decisions

- **No factory, no class** — plain functions for TanStack Query ergonomics
- **Type safety from string literals** — `ExtractParams<T>` uses recursive template literal types; variadic tuple `...[options]` makes the second arg conditionally required
- **Runtime guards** — post-replacement regex catches `:param` segments that survived (bypassed types)
- **Flat vs explicit options** — `RouteOptions` union accepts `{ id: "42" }` (flat) or `{ path: {...}, search: {...} }` (explicit); discrimination via `"path" in options || "search" in options`
- **Environment detection** — `import.meta.env` → `Deno.env` → `Bun.env` → `process.env` → `window.location.origin` → fallback, each in try/catch. Result is cached.
- **URLPattern only for matching** — `route()` uses string replacement + `new URL()`, works everywhere without polyfills

## Development

```sh
deno test          # run all tests
deno publish       # publish to JSR (requires auth)
```

## Conventions

- **ESM only** — no CommonJS
- **No runtime dependencies** — ever
- **Single file** — if the library grows beyond ~500 lines, consider splitting
- **All types exported** — consumers should never need to re-derive types
- **JSDoc on all public exports** — JSR generates docs from these
- **Tests for every behavior** — if you add a feature, add a test

## Common tasks

### Add a new feature to route()

1. Read `src/route-builder.ts`, specifically the Types section and the `route()` function
2. If it affects the type signature, update `ExtractParams`, `RouteOptions`, or the variadic tuple
3. Add tests in `src/route-builder_test.ts`
4. Update `README.md` with usage example

### Fix a bug

1. Write a failing test first in `src/route-builder_test.ts`
2. Fix in `src/route-builder.ts`
3. Verify `deno test` passes

### Prepare a release

1. Update version in `deno.json`
2. Run `deno test`
3. Run `deno publish`
