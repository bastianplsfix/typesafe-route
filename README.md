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
5. `http://localhost:3000` (fallback)

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

**Advanced URLPattern syntax:** `matchRoute()` supports the full URLPattern API, including regex constraints and custom patterns:

```ts
// Regex constraint - only digits
matchRoute("/api/:id(\\d+)", "http://localhost:3000/api/123");
// → { path: { id: "123" }, search: {} }

matchRoute("/api/:id(\\d+)", "http://localhost:3000/api/abc");
// → null (doesn't match)

// Enum pattern
matchRoute("/blog/:lang(en|no|de)/:slug", url);

// Named groups
matchRoute("/files/:filename.:ext", "http://localhost:3000/files/doc.pdf");
// → { path: { filename: "doc", ext: "pdf" }, search: {} }
```

**Note:** `route()` only supports basic syntax (`:param`, `:param?`, `:param*`, `:param+`) for type inference. For advanced patterns in `route()`, use type assertion: `route("/api/:id(\\d+)" as any, { id: "123" } as any)`

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
  fallback: "http://localhost:8080",   // dev fallback
  trailingSlash: "strip",              // "strip" | "preserve"
  verbose: true,                       // enable debug logging
});
```

**Verbose logging:**

By default, verbose logging is **automatically enabled in development** (when `import.meta.env.DEV` or `NODE_ENV=development`) and **disabled in production**.

```ts
// Auto-enabled in dev, off in prod (default behavior)
configureRoute({}); // or just don't call configureRoute at all

// Explicitly enable (even in production)
configureRoute({ verbose: true });

// Explicitly disable (even in dev)
configureRoute({ verbose: false });

// Granular control
configureRoute({
  verbose: {
    base: true,   // Log base URL resolution (once)
    build: true,  // Log each route() call
    match: false, // Don't log matchRoute() (can be very noisy)
  }
});
```

Example output (automatically shown in dev):
```
[typed-route] Base URL: http://localhost:3000 (source: fallback)
[typed-route] /api/users/:id → http://localhost:3000/api/users/42
[typed-route] /api/posts/:slug → http://localhost:3000/api/posts/hello-world
```

### `getBaseURL()`

Get the current base URL being used by the library.

```ts
const base = getBaseURL();
console.log("API Base:", base); // "http://localhost:3000"

// Useful for conditional logic
if (getBaseURL().includes("localhost")) {
  console.log("Running in dev mode");
}
```

### `getConfig()`

Get the current configuration (read-only copy).

```ts
const config = getConfig();
console.log("Verbose:", config.verbose);
console.log("Trailing slash:", config.trailingSlash);
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

**Why does my param need `?` to be optional?**

The pattern declares your URL's contract. If you have a value that might be `undefined`, you have three options:

```ts
const userId: string | undefined = session?.userId;

// ❌ Type error - pattern says :id is required, but userId might be undefined
route("/api/users/:id", { id: userId });

// ✅ Option 1: Make the pattern match reality
route("/api/users/:id?", { id: userId });

// ✅ Option 2: Guard it explicitly
if (userId) {
  route("/api/users/:id", { id: userId });
}

// ✅ Option 3: Provide a fallback
route("/api/users/:id", { id: userId || "me" });
```

This is intentional — the pattern syntax should match your data's optionality. It prevents bugs where you forget to handle missing params.

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
| `"preserve"` | `/api/bookmarks/`  | `/api/bookmarks`  |

Default is `"preserve"` (URLs are not modified).

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
