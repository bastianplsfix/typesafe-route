import { assertEquals, assertThrows } from "@std/assert";
import {
  route,
  matchRoute,
  routePattern,
  createRoute,
  configureRoute,
  getBaseURL,
  getConfig,
  getBaseInfo,
  isURLPatternSupported,
} from "../mod.ts";

function setup() {
  configureRoute({ base: "http://localhost:3000" });
}

// ---------------------------------------------------------------------------
// route() — building URLs
// ---------------------------------------------------------------------------

Deno.test("route: no params", () => {
  setup();
  assertEquals(route("/api/bookmarks"), "http://localhost:3000/api/bookmarks");
});

Deno.test("route: single path param (explicit path)", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id", { path: { id: "42" } }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("route: multiple path params", () => {
  setup();
  assertEquals(
    route("/api/:org/bookmarks/:id", { path: { org: "acme", id: "42" } }),
    "http://localhost:3000/api/acme/bookmarks/42",
  );
});

Deno.test("route: explicit path + search", () => {
  setup();
  const url = route("/api/bookmarks/:id", {
    path: { id: "42" },
    search: { fields: "title,url" },
  });
  assertEquals(url, "http://localhost:3000/api/bookmarks/42?fields=title%2Curl");
});

Deno.test("route: search-only (no path params in pattern)", () => {
  setup();
  const url = route("/api/bookmarks", {
    search: { page: "2", sort: "name" },
  });
  assertEquals(url, "http://localhost:3000/api/bookmarks?page=2&sort=name");
});

Deno.test("route: array search params", () => {
  setup();
  const url = route("/api/bookmarks", {
    search: { tag: ["a", "b", "c"] },
  });
  assertEquals(url, "http://localhost:3000/api/bookmarks?tag=a&tag=b&tag=c");
});

Deno.test("route: numeric path param", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id", { path: { id: 42 } }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("route: encodes path params", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { path: { query: "hello world" } }),
    "http://localhost:3000/api/search/hello%20world",
  );
});

Deno.test("route: always encodes params (no pre-encoded pass-through)", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { path: { query: "hello%20world" } }),
    "http://localhost:3000/api/search/hello%2520world",
  );
});

Deno.test("route: throws on unreplaced params", () => {
  setup();
  const pattern = "/api/bookmarks/:id" as string;
  assertThrows(
    () => (route as any)(pattern, {}),
    Error,
    'Unreplaced params in "/api/bookmarks/:id": :id',
  );
});

Deno.test("route: throws listing all unreplaced params", () => {
  setup();
  const pattern = "/api/:org/bookmarks/:id" as string;
  assertThrows(() => (route as any)(pattern, {}), Error, ":org, :id");
});

// ---------------------------------------------------------------------------
// Trailing slash
// ---------------------------------------------------------------------------

Deno.test("trailing slash: preserves by default", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/"),
    "http://localhost:3000/api/bookmarks/",
  );
  assertEquals(
    route("/api/bookmarks"),
    "http://localhost:3000/api/bookmarks",
  );
});

Deno.test("trailing slash: strips when configured", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "strip" });
  assertEquals(
    route("/api/bookmarks/"),
    "http://localhost:3000/api/bookmarks",
  );
});

// ---------------------------------------------------------------------------
// matchRoute()
// ---------------------------------------------------------------------------

Deno.test("matchRoute: extracts path params", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id",
    "http://localhost:3000/api/bookmarks/42",
  );
  assertEquals(result, { path: { id: "42" }, search: {} });
});

Deno.test("matchRoute: extracts multiple path params", () => {
  setup();
  const result = matchRoute(
    "/api/:org/bookmarks/:id",
    "http://localhost:3000/api/acme/bookmarks/42",
  );
  assertEquals(result, { path: { org: "acme", id: "42" }, search: {} });
});

Deno.test("matchRoute: extracts search params", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks",
    "http://localhost:3000/api/bookmarks?page=2&sort=name",
  );
  assertEquals(result, { path: {}, search: { page: "2", sort: "name" } });
});

Deno.test("matchRoute: preserves array search params", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks",
    "http://localhost:3000/api/bookmarks?tag=a&tag=b",
  );
  assertEquals(result, { path: {}, search: { tag: ["a", "b"] } });
});

Deno.test("matchRoute: single search param stays as string", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks",
    "http://localhost:3000/api/bookmarks?tag=a",
  );
  assertEquals(result, { path: {}, search: { tag: "a" } });
});

Deno.test("matchRoute: returns null on mismatch", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id",
    "http://localhost:3000/api/users/42",
  );
  assertEquals(result, null);
});

Deno.test("matchRoute: supports relative URLs", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id",
    "/api/bookmarks/42",
  );
  assertEquals(result, { path: { id: "42" }, search: {} });
});

Deno.test("matchRoute: supports relative URLs with search params", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id",
    "/api/bookmarks/42?fields=title",
  );
  assertEquals(result, { path: { id: "42" }, search: { fields: "title" } });
});

Deno.test("matchRoute: extracts both path and search", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id",
    "http://localhost:3000/api/bookmarks/42?fields=title",
  );
  assertEquals(result, { path: { id: "42" }, search: { fields: "title" } });
});

// ---------------------------------------------------------------------------
// routePattern()
// ---------------------------------------------------------------------------

Deno.test("routePattern: exposes .pattern", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks/:id");
  assertEquals(bookmarks.pattern, "/api/bookmarks/:id");
});

Deno.test("routePattern: builds URLs when called", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks/:id");
  assertEquals(
    bookmarks({ path: { id: "42" } }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("routePattern: builds with search params", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks");
  assertEquals(
    bookmarks({ search: { page: "1" } }),
    "http://localhost:3000/api/bookmarks?page=1",
  );
});

Deno.test("routePattern: no-param pattern callable without args", () => {
  setup();
  const health = routePattern("/api/health");
  assertEquals(health(), "http://localhost:3000/api/health");
});

Deno.test("routePattern: .match() delegates to matchRoute", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks/:id");
  const result = bookmarks.match("http://localhost:3000/api/bookmarks/42");
  assertEquals(result, { path: { id: "42" }, search: {} });
});

Deno.test("routePattern: .match() returns null on mismatch", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks/:id");
  assertEquals(
    bookmarks.match("http://localhost:3000/api/users/42"),
    null,
  );
});

Deno.test("routePattern: pattern is read-only", () => {
  setup();
  const bookmarks = routePattern("/api/bookmarks/:id");
  assertThrows(() => {
    (bookmarks as any).pattern = "/something/else";
  });
});

// ---------------------------------------------------------------------------
// Round-trip: route() → matchRoute()
// ---------------------------------------------------------------------------

Deno.test("round-trip: path params survive build → match", () => {
  setup();
  const url = route("/api/:org/bookmarks/:id", { path: { org: "acme", id: "42" } });
  const result = matchRoute("/api/:org/bookmarks/:id", url);
  assertEquals(result?.path, { org: "acme", id: "42" });
});

Deno.test("round-trip: search params survive build → match", () => {
  setup();
  const url = route("/api/bookmarks", {
    search: { tag: ["a", "b"], sort: "name" },
  });
  const result = matchRoute("/api/bookmarks", url);
  assertEquals(result?.search, { tag: ["a", "b"], sort: "name" });
});

Deno.test("round-trip: encoded path params round-trip correctly", () => {
  setup();
  const url = route("/api/search/:query", { path: { query: "hello world" } });
  const result = matchRoute("/api/search/:query", url);
  assertEquals(result?.path, { query: "hello world" });
});

// ---------------------------------------------------------------------------
// configureRoute()
// ---------------------------------------------------------------------------

Deno.test("configureRoute: custom base", () => {
  configureRoute({ base: "https://api.example.com" });
  assertEquals(route("/bookmarks"), "https://api.example.com/bookmarks");
});

Deno.test("configureRoute: custom fallback", () => {
  configureRoute({ fallback: "http://localhost:8080" });
  assertEquals(route("/bookmarks"), "http://localhost:8080/bookmarks");
});

Deno.test("configureRoute: strips trailing slash from base", () => {
  configureRoute({ base: "https://api.example.com/" });
  assertEquals(route("/bookmarks"), "https://api.example.com/bookmarks");
});

// ---------------------------------------------------------------------------
// hash
// ---------------------------------------------------------------------------

Deno.test("hash: appends fragment to URL", () => {
  setup();
  assertEquals(
    route("/docs", { hash: "installation" }),
    "http://localhost:3000/docs#installation",
  );
});

Deno.test("hash: with path params", () => {
  setup();
  assertEquals(
    route("/docs/:section", {
      path: { section: "api" },
      hash: "route",
    }),
    "http://localhost:3000/docs/api#route",
  );
});

Deno.test("hash: with search and path params", () => {
  setup();
  assertEquals(
    route("/docs/:section", {
      path: { section: "api" },
      search: { v: "2" },
      hash: "route",
    }),
    "http://localhost:3000/docs/api?v=2#route",
  );
});

// ---------------------------------------------------------------------------
// relative
// ---------------------------------------------------------------------------

Deno.test("relative: returns pathname only", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id", {
      path: { id: "42" },
      relative: true,
    }),
    "/api/bookmarks/42",
  );
});

Deno.test("relative: includes search params", () => {
  setup();
  assertEquals(
    route("/api/bookmarks", {
      search: { page: "1" },
      relative: true,
    }),
    "/api/bookmarks?page=1",
  );
});

Deno.test("relative: includes hash", () => {
  setup();
  assertEquals(
    route("/docs/:section", {
      path: { section: "api" },
      hash: "top",
      relative: true,
    }),
    "/docs/api#top",
  );
});

Deno.test("relative: includes search and hash", () => {
  setup();
  assertEquals(
    route("/docs", {
      search: { v: "2" },
      hash: "install",
      relative: true,
    }),
    "/docs?v=2#install",
  );
});

Deno.test("relative: no params pattern", () => {
  setup();
  assertEquals(
    route("/api/health", { relative: true }),
    "/api/health",
  );
});

// ---------------------------------------------------------------------------
// per-call base
// ---------------------------------------------------------------------------

Deno.test("base: overrides global config", () => {
  setup();
  assertEquals(
    route("/api/users/:id", {
      path: { id: "42" },
      base: "https://users.internal",
    }),
    "https://users.internal/api/users/42",
  );
});

Deno.test("base: strips trailing slash", () => {
  setup();
  assertEquals(
    route("/api/users", { base: "https://users.internal/" }),
    "https://users.internal/api/users",
  );
});

Deno.test("base: no params pattern", () => {
  setup();
  assertEquals(
    route("/health", { base: "https://other.service" }),
    "https://other.service/health",
  );
});

Deno.test("base: combined with search and hash", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id", {
      path: { id: "42" },
      search: { fields: "title" },
      hash: "details",
      base: "https://api.prod.com",
    }),
    "https://api.prod.com/api/bookmarks/42?fields=title#details",
  );
});

// ---------------------------------------------------------------------------
// Optional params (:param?)
// ---------------------------------------------------------------------------

Deno.test("optional param: omitted", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id?", {}),
    "http://localhost:3000/api/bookmarks",
  );
});

Deno.test("optional param: provided", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id?", { path: { id: "42" } }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("optional param: no args when all optional", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id?"),
    "http://localhost:3000/api/bookmarks",
  );
});

Deno.test("optional param: mixed required and optional", () => {
  setup();
  assertEquals(
    route("/api/:org/bookmarks/:id?", { path: { org: "acme" } }),
    "http://localhost:3000/api/acme/bookmarks",
  );
});

Deno.test("optional param: mixed required and optional, both provided", () => {
  setup();
  assertEquals(
    route("/api/:org/bookmarks/:id?", { path: { org: "acme", id: "42" } }),
    "http://localhost:3000/api/acme/bookmarks/42",
  );
});

Deno.test("optional param: with search params", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id?", {
      path: { id: "42" },
      search: { fields: "title" },
    }),
    "http://localhost:3000/api/bookmarks/42?fields=title",
  );
});

Deno.test("optional param: omitted with search params", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id?", {
      search: { page: "1" },
    }),
    "http://localhost:3000/api/bookmarks?page=1",
  );
});

// ---------------------------------------------------------------------------
// Wildcard params (:param* and :param+)
// ---------------------------------------------------------------------------

Deno.test("wildcard *: with value", () => {
  setup();
  assertEquals(
    route("/files/:path*", { path: { path: "docs/readme.md" } }),
    "http://localhost:3000/files/docs/readme.md",
  );
});

Deno.test("wildcard *: omitted (zero-or-more)", () => {
  setup();
  assertEquals(
    route("/files/:path*"),
    "http://localhost:3000/files/",
  );
});

Deno.test("wildcard *: single segment", () => {
  setup();
  assertEquals(
    route("/files/:path*", { path: { path: "readme.md" } }),
    "http://localhost:3000/files/readme.md",
  );
});

Deno.test("wildcard +: with value", () => {
  setup();
  assertEquals(
    route("/files/:path+", { path: { path: "docs/readme.md" } }),
    "http://localhost:3000/files/docs/readme.md",
  );
});

Deno.test("wildcard: encodes segments individually", () => {
  setup();
  assertEquals(
    route("/files/:path*", { path: { path: "my docs/hello world.md" } }),
    "http://localhost:3000/files/my%20docs/hello%20world.md",
  );
});

// ---------------------------------------------------------------------------
// matchRoute with optional/wildcard params
// ---------------------------------------------------------------------------

Deno.test("matchRoute: optional param present", () => {
  setup();
  const result = matchRoute(
    "/api/bookmarks/:id?",
    "http://localhost:3000/api/bookmarks/42",
  );
  assertEquals(result?.path.id, "42");
});

Deno.test("matchRoute: wildcard param", () => {
  setup();
  const result = matchRoute(
    "/files/:path*",
    "http://localhost:3000/files/docs/readme.md",
  );
  assertEquals(result?.path.path, "docs/readme.md");
});

// ---------------------------------------------------------------------------
// Round-trip: optional/wildcard
// ---------------------------------------------------------------------------

Deno.test("round-trip: optional param provided", () => {
  setup();
  const url = route("/api/bookmarks/:id?", { path: { id: "42" } });
  const result = matchRoute("/api/bookmarks/:id?", url);
  assertEquals(result?.path.id, "42");
});

Deno.test("round-trip: wildcard param", () => {
  setup();
  const url = route("/files/:path*", { path: { path: "docs/readme.md" } });
  const result = matchRoute("/files/:path*", url);
  assertEquals(result?.path.path, "docs/readme.md");
});

// ---------------------------------------------------------------------------
// Edge cases: encoding always applied
// ---------------------------------------------------------------------------

Deno.test("encoding: percent signs are always encoded", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { path: { query: "100%natural" } }),
    "http://localhost:3000/api/search/100%25natural",
  );
});

Deno.test("encoding: spaces are always encoded", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { path: { query: "hello world" } }),
    "http://localhost:3000/api/search/hello%20world",
  );
});

Deno.test("encoding: literal %20 round-trips correctly", () => {
  setup();
  const url = route("/api/search/:query", { path: { query: "%20" } });
  assertEquals(url, "http://localhost:3000/api/search/%2520");
  const result = matchRoute("/api/search/:query", url);
  assertEquals(result?.path, { query: "%20" });
});

// ---------------------------------------------------------------------------
// Edge cases: trailing slash with hash (no query)
// ---------------------------------------------------------------------------

Deno.test("trailing slash: strip mode with hash and no query", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "strip" });
  assertEquals(
    route("/docs/", { hash: "section" }),
    "http://localhost:3000/docs#section",
  );
});

Deno.test("trailing slash: strip mode with hash and query", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "strip" });
  assertEquals(
    route("/docs/", { search: { v: "2" }, hash: "section" }),
    "http://localhost:3000/docs?v=2#section",
  );
});

// ---------------------------------------------------------------------------
// Edge cases: top-level params are rejected
// ---------------------------------------------------------------------------

Deno.test("options: throws when using top-level path params", () => {
  setup();
  assertThrows(
    () => (route as any)("/api/:id", { id: "42" }),
    Error,
    "Invalid route options",
  );
});

Deno.test("options: throws when using multiple top-level params", () => {
  setup();
  assertThrows(
    () => (route as any)("/api/:org/:id", { org: "acme", id: "42" }),
    Error,
    "Invalid route options",
  );
});

Deno.test("options: reserved-name params work via explicit path", () => {
  setup();
  assertEquals(
    route("/api/:search/:relative", { path: { search: "users", relative: "yes" } } as any),
    "http://localhost:3000/api/users/yes",
  );
});

// ---------------------------------------------------------------------------
// Edge cases: pattern validation
// ---------------------------------------------------------------------------

Deno.test("route: throws on pattern without leading slash", () => {
  setup();
  assertThrows(
    () => (route as any)("api/bookmarks"),
    Error,
    'Pattern must start with "/"',
  );
});

Deno.test("matchRoute: throws on pattern without leading slash", () => {
  setup();
  assertThrows(
    () => matchRoute("api/bookmarks" as any, "http://localhost:3000/api/bookmarks"),
    Error,
    'Pattern must start with "/"',
  );
});

// ---------------------------------------------------------------------------
// Edge cases: strip() with multiple trailing slashes
// ---------------------------------------------------------------------------

Deno.test("configureRoute: strips multiple trailing slashes from base", () => {
  configureRoute({ base: "https://api.example.com///" });
  assertEquals(route("/bookmarks"), "https://api.example.com/bookmarks");
});

// ---------------------------------------------------------------------------
// Edge cases: matchRoute decodes path params
// ---------------------------------------------------------------------------

Deno.test("matchRoute: decodes percent-encoded path params", () => {
  setup();
  const result = matchRoute(
    "/api/search/:query",
    "http://localhost:3000/api/search/hello%20world",
  );
  assertEquals(result?.path, { query: "hello world" });
});

Deno.test("matchRoute: decodes special characters in path params", () => {
  setup();
  const result = matchRoute(
    "/api/files/:name",
    "http://localhost:3000/api/files/my%20file%26data.txt",
  );
  assertEquals(result?.path, { name: "my file&data.txt" });
});

// ---------------------------------------------------------------------------
// routePattern: optional params and eager validation
// ---------------------------------------------------------------------------

Deno.test("routePattern: optional-only pattern callable without args", () => {
  setup();
  const optRoute = routePattern("/api/bookmarks/:id?");
  assertEquals(optRoute(), "http://localhost:3000/api/bookmarks");
});

Deno.test("routePattern: optional-only pattern callable with args", () => {
  setup();
  const optRoute = routePattern("/api/bookmarks/:id?");
  assertEquals(
    optRoute({ path: { id: "42" } }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("routePattern: wildcard+ pattern callable with args", () => {
  setup();
  const files = routePattern("/files/:p+");
  assertEquals(
    files({ path: { p: "docs/readme.md" } }),
    "http://localhost:3000/files/docs/readme.md",
  );
});

Deno.test("unreplaced check: catches single-char wildcard+ param", () => {
  setup();
  const pattern = "/files/:a+" as string;
  assertThrows(
    () => (route as any)(pattern, {}),
    Error,
    ":a+",
  );
});

Deno.test("routePattern: throws eagerly on pattern without leading slash", () => {
  setup();
  assertThrows(
    () => routePattern("api/bookmarks" as any),
    Error,
    'Pattern must start with "/"',
  );
});

// ---------------------------------------------------------------------------
// Bug fix: flat params named "hash" or "base" treated as path params
// ---------------------------------------------------------------------------

Deno.test("options: reserved-name params 'hash' and 'base' work via explicit path", () => {
  setup();
  assertEquals(
    route("/api/:hash/:base", { path: { hash: "abc", base: "main" } } as any),
    "http://localhost:3000/api/abc/main",
  );
});

Deno.test("options: hash+base top-level keys are treated as explicit extras", () => {
  setup();
  assertEquals(
    route("/api/bookmarks", { hash: "section", base: "http://other.com" }),
    "http://other.com/api/bookmarks#section",
  );
});

// ---------------------------------------------------------------------------
// Bug fix: duplicate required param replaced globally
// ---------------------------------------------------------------------------

Deno.test("replaceParams: duplicate param name replaced in all positions", () => {
  setup();
  assertEquals(
    (route as any)("/api/:id/copy/:id", { path: { id: "42" } }),
    "http://localhost:3000/api/42/copy/42",
  );
});

// ---------------------------------------------------------------------------
// Bug fix: matchRoute handles malformed percent sequences without crashing
// ---------------------------------------------------------------------------

Deno.test("matchRoute: handles malformed percent sequence without throwing", () => {
  setup();
  const result = matchRoute(
    "/api/:id",
    "http://localhost:3000/api/%ZZ",
  );
  assertEquals(result?.path, { id: "%ZZ" });
});

// ---------------------------------------------------------------------------
// URLPattern availability
// ---------------------------------------------------------------------------

Deno.test("isURLPatternSupported: reflects URLPattern availability", () => {
  const original = (globalThis as any).URLPattern;
  try {
    (globalThis as any).URLPattern = undefined;
    assertEquals(isURLPatternSupported(), false);
  } finally {
    (globalThis as any).URLPattern = original;
  }
  assertEquals(isURLPatternSupported(), typeof (globalThis as any).URLPattern !== "undefined");
});


Deno.test("matchRoute: throws clear error when URLPattern is unavailable", () => {
  setup();
  const original = (globalThis as any).URLPattern;
  try {
    (globalThis as any).URLPattern = undefined;
    assertThrows(
      () => matchRoute("/api/:id", "http://localhost:3000/api/42"),
      Error,
      "URLPattern is not available",
    );
  } finally {
    (globalThis as any).URLPattern = original;
  }
});

// ---------------------------------------------------------------------------
// matchRoute: advanced URLPattern regex syntax
// ---------------------------------------------------------------------------

Deno.test("matchRoute: regex constraint matches valid input", () => {
  setup();
  // Type inference doesn't strip regex groups — use `as any` for advanced patterns
  const result = matchRoute("/api/:id(\\d+)" as any, "http://localhost:3000/api/123");
  assertEquals(result?.path, { id: "123" });
});

Deno.test("matchRoute: regex constraint rejects invalid input", () => {
  setup();
  const result = matchRoute("/api/:id(\\d+)" as any, "http://localhost:3000/api/abc");
  assertEquals(result, null);
});

Deno.test("matchRoute: enum pattern", () => {
  setup();
  const result = matchRoute("/blog/:lang(en|no|de)/:slug" as any, "http://localhost:3000/blog/en/hello-world");
  assertEquals(result?.path, { lang: "en", slug: "hello-world" });
});

// ---------------------------------------------------------------------------
// createRoute (alias for routePattern)
// ---------------------------------------------------------------------------

Deno.test("createRoute: works as alias for routePattern", () => {
  setup();
  const users = createRoute("/api/users/:id");
  assertEquals(users.pattern, "/api/users/:id");
  assertEquals(users({ path: { id: "42" } }), "http://localhost:3000/api/users/42");
  assertEquals(
    users.match("http://localhost:3000/api/users/42")?.path,
    { id: "42" },
  );
});

// ---------------------------------------------------------------------------
// getBaseURL / getConfig
// ---------------------------------------------------------------------------

Deno.test("getBaseURL: returns resolved base", () => {
  configureRoute({ base: "https://api.example.com" });
  assertEquals(getBaseURL(), "https://api.example.com");
});

Deno.test("getConfig: returns config copy", () => {
  configureRoute({ base: "https://api.example.com", trailingSlash: "strip" });
  const config = getConfig();
  assertEquals(config.base, "https://api.example.com");
  assertEquals(config.trailingSlash, "strip");
});

Deno.test("getBaseInfo: returns resolved base and source", () => {
  configureRoute({ base: "https://api.example.com" });
  assertEquals(getBaseInfo(), {
    base: "https://api.example.com",
    source: "config.base",
  });
});

Deno.test("getBaseInfo: reports fallback source", () => {
  configureRoute({});
  const info = getBaseInfo();
  assertEquals(info.base, "http://localhost:3000");
  assertEquals(info.source, "fallback");
});

// ---------------------------------------------------------------------------
// route: rejects regex patterns (matchRoute does not)
// ---------------------------------------------------------------------------

Deno.test("route: throws on regex pattern syntax", () => {
  setup();
  assertThrows(
    () => (route as any)("/api/:id(\\d+)", { id: "123" }),
    Error,
    "regex syntax",
  );
});
