/**
 * @module
 *
 * A tiny, type-safe URL builder and matcher powered by the URLPattern API.
 * Resolves base URLs automatically from your environment so you never have
 * to interpolate template strings into fetch() calls.
 *
 * @example
 * ```ts
 * import { route, matchRoute, routePattern, configureRoute } from "@bastianplsfix/typed-route";
 *
 * // Build a URL
 * route("/api/bookmarks/:id", { path: { id: "42" } });
 * // → "http://localhost:3000/api/bookmarks/42"
 *
 * // Match a URL
 * matchRoute("/api/bookmarks/:id", "http://localhost:3000/api/bookmarks/42");
 * // → { path: { id: "42" }, search: {} }
 *
 * // Bind a pattern for reuse
 * const bookmarks = routePattern("/api/bookmarks/:id");
 * bookmarks({ path: { id: "42" } });
 * ```
 */

export {
  route,
  matchRoute,
  routePattern,
  createRoute,
  configureRoute,
  getBaseURL,
  getBaseInfo,
  isURLPatternSupported,
  getConfig,
} from "./src/route-builder.ts";

export type {
  ParamValue,
  StripModifier,
  ExtractParams,
  RouteBuildExtras,
  RouteOptions,
  MatchResult,
  BoundRoute,
  RouteConfig,
  BaseInfo,
} from "./src/route-builder.ts";
