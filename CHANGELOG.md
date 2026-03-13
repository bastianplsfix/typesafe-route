# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-03-13

### Added
- npm publishing support via Vite+ / tsdown build pipeline.
- `isURLPatternSupported()` runtime check for URLPattern availability.
- `getConfig()` to read current configuration (read-only copy).
- `createRoute` alias for `routePattern`.
- Per-call `base` override option in `route()`.
- Auto-detected verbose logging in development environments.
- Granular verbose config (`{ base, build, match }`).
- `tryMatchRoute(pattern, url)` non-throwing matcher helper.
- `resetRouteConfig()` helper to clear config/cache state.
- `getBaseInfo()` and `BaseSource` diagnostics for base-resolution source visibility.

### Changed
- Migrated project from Deno-first to Vite+ (npm-first) structure.
- Library source moved from `src/route-builder.ts` to `src/index.ts`.
- Tests migrated from `Deno.test` to Vitest (via `vite-plus/test`).
- Import path changed from `@bastianplsfix/typed-route` to `typed-route` for npm.
- `route()` path params now use explicit `{ path: {...} }` options (breaking).
- `RouteExtra` renamed to `RouteBuildExtras`.

### Fixed
- `matchRoute` now prepends base URL for relative URL inputs.
- Base URL resolution properly checks `window.location.origin` in browsers.
