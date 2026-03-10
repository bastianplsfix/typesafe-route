import { assertEquals, assertThrows } from "@std/assert";
import {
  route,
  matchRoute,
  routePattern,
  configureRoute,
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

Deno.test("route: single path param (flat shorthand)", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/:id", { id: "42" }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("route: multiple path params", () => {
  setup();
  assertEquals(
    route("/api/:org/bookmarks/:id", { org: "acme", id: "42" }),
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
    route("/api/bookmarks/:id", { id: 42 }),
    "http://localhost:3000/api/bookmarks/42",
  );
});

Deno.test("route: encodes path params", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { query: "hello world" }),
    "http://localhost:3000/api/search/hello%20world",
  );
});

Deno.test("route: skips encoding for already-encoded params", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { query: "hello%20world" }),
    "http://localhost:3000/api/search/hello%20world",
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

Deno.test("trailing slash: strips by default", () => {
  setup();
  assertEquals(
    route("/api/bookmarks/"),
    "http://localhost:3000/api/bookmarks",
  );
});

Deno.test("trailing slash: adds when configured", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "add" });
  assertEquals(
    route("/api/bookmarks"),
    "http://localhost:3000/api/bookmarks/",
  );
});

Deno.test("trailing slash: preserves when configured", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "preserve" });
  assertEquals(
    route("/api/bookmarks/"),
    "http://localhost:3000/api/bookmarks/",
  );
  assertEquals(
    route("/api/bookmarks"),
    "http://localhost:3000/api/bookmarks",
  );
});

Deno.test("trailing slash: with search params", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "add" });
  const url = route("/api/bookmarks", { search: { page: "1" } });
  assertEquals(url, "http://localhost:3000/api/bookmarks/?page=1");
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
    bookmarks({ id: "42" }),
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
  const url = route("/api/:org/bookmarks/:id", { org: "acme", id: "42" });
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
  const url = route("/api/search/:query", { query: "hello world" });
  const result = matchRoute("/api/search/:query", url);
  assertEquals(result?.path, { query: "hello%20world" });
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
    route("/api/bookmarks/:id?", { id: "42" }),
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
    route("/api/:org/bookmarks/:id?", { org: "acme" }),
    "http://localhost:3000/api/acme/bookmarks",
  );
});

Deno.test("optional param: mixed required and optional, both provided", () => {
  setup();
  assertEquals(
    route("/api/:org/bookmarks/:id?", { org: "acme", id: "42" }),
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
    route("/files/:path*", { path: "docs/readme.md" }),
    "http://localhost:3000/files/docs/readme.md",
  );
});

Deno.test("wildcard *: omitted (zero-or-more)", () => {
  setup();
  assertEquals(
    route("/files/:path*"),
    "http://localhost:3000/files",
  );
});

Deno.test("wildcard *: single segment", () => {
  setup();
  assertEquals(
    route("/files/:path*", { path: "readme.md" }),
    "http://localhost:3000/files/readme.md",
  );
});

Deno.test("wildcard +: with value", () => {
  setup();
  assertEquals(
    route("/files/:path+", { path: "docs/readme.md" }),
    "http://localhost:3000/files/docs/readme.md",
  );
});

Deno.test("wildcard: encodes segments individually", () => {
  setup();
  assertEquals(
    route("/files/:path*", { path: "my docs/hello world.md" }),
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
  const url = route("/api/bookmarks/:id?", { id: "42" });
  const result = matchRoute("/api/bookmarks/:id?", url);
  assertEquals(result?.path.id, "42");
});

Deno.test("round-trip: wildcard param", () => {
  setup();
  const url = route("/files/:path*", { path: "docs/readme.md" });
  const result = matchRoute("/files/:path*", url);
  assertEquals(result?.path.path, "docs/readme.md");
});

// ---------------------------------------------------------------------------
// Edge cases: isEncoded safety
// ---------------------------------------------------------------------------

Deno.test("encoding: handles invalid percent sequences without throwing", () => {
  setup();
  // "100%natural" contains an invalid percent sequence — should not throw
  assertEquals(
    route("/api/search/:query", { query: "100%natural" }),
    "http://localhost:3000/api/search/100%25natural",
  );
});

Deno.test("encoding: plain string without percent is not treated as encoded", () => {
  setup();
  assertEquals(
    route("/api/search/:query", { query: "hello world" }),
    "http://localhost:3000/api/search/hello%20world",
  );
});

// ---------------------------------------------------------------------------
// Edge cases: trailing slash with hash (no query)
// ---------------------------------------------------------------------------

Deno.test("trailing slash: strip mode with hash and no query", () => {
  setup();
  assertEquals(
    route("/docs/", { hash: "section" }),
    "http://localhost:3000/docs#section",
  );
});

Deno.test("trailing slash: add mode with hash and no query", () => {
  configureRoute({ base: "http://localhost:3000", trailingSlash: "add" });
  assertEquals(
    route("/docs", { hash: "section" }),
    "http://localhost:3000/docs/#section",
  );
});

Deno.test("trailing slash: strip mode with hash and query", () => {
  setup();
  assertEquals(
    route("/docs/", { search: { v: "2" }, hash: "section" }),
    "http://localhost:3000/docs?v=2#section",
  );
});

// ---------------------------------------------------------------------------
// Edge cases: flat params named like extra keys
// ---------------------------------------------------------------------------

Deno.test("flat params: param named 'search' treated as flat path param", () => {
  setup();
  assertEquals(
    route("/api/:search/:id", { search: "users", id: "42" } as any),
    "http://localhost:3000/api/users/42",
  );
});

Deno.test("flat params: param named 'relative' treated as flat path param", () => {
  setup();
  assertEquals(
    route("/api/:relative/:id", { relative: "yes", id: "42" } as any),
    "http://localhost:3000/api/yes/42",
  );
});
