# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `tryMatchRoute(pattern, url)` non-throwing matcher helper.
- `resetRouteConfig()` helper to clear config/cache state.
- `getBaseInfo()` and `BaseSource` diagnostics for base-resolution source visibility.

### Changed
- `route()` path params now use explicit `{ path: {...} }` options.
- `RouteExtra` renamed to `RouteBuildExtras`.

### Notes
- Add a new version section here for each release with migration notes for breaking changes.
