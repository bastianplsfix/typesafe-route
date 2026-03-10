# @bastianplsfix/typed-route

A tiny, type-safe URL builder and matcher powered by the [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern). Resolves base URLs automatically from your environment so you never have to interpolate template strings into `fetch()` calls.

- **Zero dependencies** — single file, ~470 lines
- **Type-safe path params** — extracted from string literals at compile time
- **Runtime guards** — throws on unreplaced params even when types are bypassed
- **Environment-aware** — auto-detects base URL from Vite, Deno, Bun, Node, or browser
- **URLPattern matching** — parse URLs back into typed params
- **TanStack Query friendly** — just functions, no factories or classes

## Install

```ts
// Deno / JSR
import { route } from "jsr:@bastianplsfix/typed-route";

// Or add to your import map
// deno add jsr:@bastianplsfix/typed-route
```

> **URLPattern support:** Native in Chromium, Node ≥ 23, Deno, and Bun. Firefox requires a [polyfill](https://github.com/kenchris/urlpattern-polyfill). Note: only `matchRoute` needs URLPattern — `route()` works everywhere.

## Quick start

```ts
import { route } from "@bastianplsfix/typed-route";

// In a TanStack Query hook
useSuspenseQuery({
  queryKey: ["bookmarks", id],
  queryFn: () => fetch(route("/api/bookmarks/:id", { id })).then(r => r.json()),
});
```

The base URL is resolved automatically:

1. `import.meta.env.VITE_API_BASE` / `import.meta.env.API_BASE`
2. `Deno.env.get("API_BASE")`
3. `Bun.env.API_BASE`
4. `process.env.API_BASE`
5. `window.location.origin`
6. `http://localhost:3000` (fallback)

## API

### `route(pattern, options?)`

Build a full URL from a pattern and params.

```ts
// Flat shorthand — all values are path params
route("/api/bookmarks/:id", { id: "42" });
// → "http://localhost:3000/api/bookmarks/42"

// Explicit path + search
route("/api/bookmarks/:id", {
  path: { id: "42" },
  search: { fields: "title,url" },
});
// → "http://localhost:3000/api/bookmarks/42?fields=title%2Curl"

// Search only (no path params in pattern)
route("/api/bookmarks", { search: { page: "2", sort: "name" } });
// → "http://localhost:3000/api/bookmarks?page=2&sort=name"

// Array search params
route("/api/bookmarks", { search: { tag: ["a", "b"] } });
// → "http://localhost:3000/api/bookmarks?tag=a&tag=b"

// No params
route("/api/health");
// → "http://localhost:3000/api/health"

// Hash fragment
route("/docs/:section", {
  path: { section: "api" },
  hash: "route",
});
// → "http://localhost:3000/docs/api#route"

// Relative (pathname only, no base URL)
route("/api/bookmarks/:id", {
  path: { id: "42" },
  relative: true,
});
// → "/api/bookmarks/42"

// Per-call base URL override
route("/api/users/:id", {
  path: { id: "42" },
  base: "https://users.internal",
});
// → "https://users.internal/api/users/42"

// Optional param — omit or provide
route("/api/bookmarks/:id?", {});           // → ".../api/bookmarks"
route("/api/bookmarks/:id?", { id: "42" }); // → ".../api/bookmarks/42"

// Wildcard — zero-or-more segments (slashes preserved)
route("/files/:path*", { path: "docs/readme.md" }); // → ".../files/docs/readme.md"
route("/files/:path*");                              // → ".../files"

// Wildcard — one-or-more segments (required)
route("/files/:path+", { path: "docs/readme.md" }); // → ".../files/docs/readme.md"
```

### `matchRoute(pattern, url)`

Match a URL against a pattern and extract params. Returns `null` on mismatch.

```ts
matchRoute("/api/bookmarks/:id", "http://localhost:3000/api/bookmarks/42");
// → { path: { id: "42" }, search: {} }

// Array search params are preserved
matchRoute("/api/bookmarks", "http://localhost:3000/api/bookmarks?tag=a&tag=b");
// → { path: {}, search: { tag: ["a", "b"] } }
```

Both `route()` and `matchRoute()` infer param names from the pattern literal:

```ts
const result = matchRoute("/api/:org/items/:id", url);
result?.path.org; // ✅ typed as string
result?.path.id;  // ✅ typed as string
result?.path.foo; // ❌ type error
```

### `routePattern(pattern)`

Bind a pattern for reuse. Returns a callable with `.pattern` and `.match()`.

```ts
const bookmarks = routePattern("/api/bookmarks/:id");

// Use .pattern for query keys
useSuspenseQuery({
  queryKey: [bookmarks.pattern, id],
  queryFn: () => fetch(bookmarks({ id })).then(r => r.json()),
});

// Match incoming URLs
bookmarks.match("http://localhost:3000/api/bookmarks/42");
// → { path: { id: "42" }, search: {} }

// Access the raw pattern
bookmarks.pattern;
// → "/api/bookmarks/:id"
```

### `configureRoute(config)`

Optional one-time setup. Call at app startup.

```ts
configureRoute({
  base: "https://api.example.com",     // explicit base (skips env detection)
  envKey: "BACKEND_URL",               // custom env variable name
  fallback: "http://localhost:8080",    // dev fallback
  trailingSlash: "strip",              // "strip" | "add" | "preserve"
});
```

## Type safety

Param names are extracted from the pattern string literal at compile time:

```ts
route("/api/bookmarks/:id", { id: "42" });          // ✅
route("/api/bookmarks/:id", { name: "oops" });       // ❌ type error
route("/api/:org/bookmarks/:id", { org: "acme" });   // ❌ missing `id`
route("/api/bookmarks");                              // ✅ no params required
route("/api/bookmarks/:id?");                         // ✅ optional — args can be omitted
route("/api/:org/bookmarks/:id?", { org: "acme" });  // ✅ only required params needed
```

### Optional and wildcard modifiers

Modifiers follow the [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) syntax:

| Modifier | Meaning | Type behavior |
|----------|---------|---------------|
| `:id` | Required, single segment | Required key |
| `:id?` | Optional, single segment | Optional key |
| `:path*` | Zero-or-more segments | Optional key, `/` preserved |
| `:path+` | One-or-more segments | Required key, `/` preserved |

When all params are optional (`?` or `*`), the options argument can be omitted entirely.

At runtime, if a `:param` survives replacement (e.g. the pattern was typed as `string`), `route()` throws:

```
Error: Unreplaced params in "/api/bookmarks/:id": :id. Received: {}
```

## Encoding

Path params are always encoded via `encodeURIComponent` — pass raw values, not pre-encoded ones (e.g. `"hello world"` not `"hello%20world"`). `matchRoute` decodes them back, so round-trips are lossless. Search params are handled by `URLSearchParams` which encodes them natively.

## Trailing slashes

Controlled via `configureRoute({ trailingSlash })`:

| Mode         | `/api/bookmarks/` | `/api/bookmarks` |
| ------------ | ------------------ | ----------------- |
| `"strip"`    | `/api/bookmarks`   | `/api/bookmarks`  |
| `"add"`      | `/api/bookmarks/`  | `/api/bookmarks/` |
| `"preserve"` | `/api/bookmarks/`  | `/api/bookmarks`  |

Default is `"strip"`.

## Development

```sh
deno test          # run test suite
deno publish       # publish to JSR
```

## Exported types

```ts
import type {
  ParamValue,        // string | number
  StripModifier,     // strips ?, *, + suffixes from param names
  ExtractParams,     // template literal type — extracts ":param" names
  RouteExtra,        // extra options (search, hash, relative, base)
  RouteOptions,      // options union for route()
  MatchResult,       // return type of matchRoute()
  BoundRoute,        // return type of routePattern()
  RouteConfig,       // config for configureRoute()
} from "@bastianplsfix/typed-route";
```

## License

MIT
