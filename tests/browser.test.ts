// @vitest-environment happy-dom
import { expect, test } from "vite-plus/test";
import {
  configureRoute,
  getBaseInfo,
  getBaseURL,
  matchRoute,
  resetRouteConfig,
  route,
  routePattern,
  tryMatchRoute,
} from "../src/index.ts";

// happy-dom provides window.location with origin "http://localhost:3000"
// by default. The library should detect this via globalThis.location.origin.

// ---------------------------------------------------------------------------
// Browser environment: window.location.origin detection
// ---------------------------------------------------------------------------

test("browser: detects window.location.origin as base", () => {
  resetRouteConfig();
  configureRoute({});
  const info = getBaseInfo();
  expect(info.source).toBe("window.location.origin");
  expect(info.base).toMatch(/^https?:\/\//);
});

test("browser: route() uses browser origin when no config", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/bookmarks");
  expect(url).toBe(`${globalThis.location.origin}/api/bookmarks`);
});

test("browser: route() with path params uses browser origin", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/users/:id", { path: { id: "42" } });
  expect(url).toBe(`${globalThis.location.origin}/api/users/42`);
});

test("browser: getBaseURL() returns browser origin", () => {
  resetRouteConfig();
  configureRoute({});
  expect(getBaseURL()).toBe(globalThis.location.origin);
});

// ---------------------------------------------------------------------------
// Browser: config.base overrides window.location.origin
// ---------------------------------------------------------------------------

test("browser: config.base overrides window.location.origin", () => {
  configureRoute({ base: "https://api.example.com" });
  expect(getBaseURL()).toBe("https://api.example.com");
  expect(getBaseInfo().source).toBe("config.base");
});

test("browser: resetRouteConfig restores window.location.origin", () => {
  configureRoute({ base: "https://api.example.com" });
  expect(getBaseURL()).toBe("https://api.example.com");

  resetRouteConfig();
  configureRoute({});
  expect(getBaseURL()).toBe(globalThis.location.origin);
  expect(getBaseInfo().source).toBe("window.location.origin");
});

// ---------------------------------------------------------------------------
// Browser: route() builds correct URLs
// ---------------------------------------------------------------------------

test("browser: route() with search params", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/bookmarks", { search: { page: "1", sort: "name" } });
  expect(url).toBe(`${globalThis.location.origin}/api/bookmarks?page=1&sort=name`);
});

test("browser: route() with hash", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/docs/:section", {
    path: { section: "api" },
    hash: "route",
  });
  expect(url).toBe(`${globalThis.location.origin}/docs/api#route`);
});

test("browser: route() relative mode ignores origin", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/users/:id", {
    path: { id: "42" },
    relative: true,
  });
  expect(url).toBe("/api/users/42");
});

test("browser: route() per-call base overrides origin", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/users/:id", {
    path: { id: "42" },
    base: "https://users.internal",
  });
  expect(url).toBe("https://users.internal/api/users/42");
});

// ---------------------------------------------------------------------------
// Browser: matchRoute() works in browser
// ---------------------------------------------------------------------------

test("browser: matchRoute() extracts params", () => {
  resetRouteConfig();
  configureRoute({});
  const result = matchRoute(
    "/api/users/:id",
    `${globalThis.location.origin}/api/users/42`,
  );
  expect(result).toEqual({ path: { id: "42" }, search: {} });
});

test("browser: matchRoute() with relative URL uses browser origin", () => {
  resetRouteConfig();
  configureRoute({});
  const result = matchRoute("/api/users/:id", "/api/users/42");
  expect(result).toEqual({ path: { id: "42" }, search: {} });
});

test("browser: tryMatchRoute() works in browser", () => {
  resetRouteConfig();
  configureRoute({});
  const result = tryMatchRoute(
    "/api/users/:id",
    `${globalThis.location.origin}/api/users/42`,
  );
  expect(result).toEqual({ path: { id: "42" }, search: {} });
});

// ---------------------------------------------------------------------------
// Browser: round-trip route() → matchRoute()
// ---------------------------------------------------------------------------

test("browser: round-trip with browser origin", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/:org/items/:id", {
    path: { org: "acme", id: "42" },
  });
  const result = matchRoute("/api/:org/items/:id", url);
  expect(result?.path).toEqual({ org: "acme", id: "42" });
});

test("browser: round-trip with encoded params", () => {
  resetRouteConfig();
  configureRoute({});
  const url = route("/api/search/:query", {
    path: { query: "hello world" },
  });
  const result = matchRoute("/api/search/:query", url);
  expect(result?.path).toEqual({ query: "hello world" });
});

// ---------------------------------------------------------------------------
// Browser: routePattern works in browser
// ---------------------------------------------------------------------------

test("browser: routePattern builds and matches with browser origin", () => {
  resetRouteConfig();
  configureRoute({});
  const users = routePattern("/api/users/:id");
  const url = users({ path: { id: "42" } });
  expect(url).toBe(`${globalThis.location.origin}/api/users/42`);

  const match = users.match(url);
  expect(match?.path).toEqual({ id: "42" });
});
