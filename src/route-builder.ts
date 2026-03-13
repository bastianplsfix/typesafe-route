/**
 * route-builder
 *
 * A tiny URL builder & matcher powered by the URLPattern API.
 * Resolves base URLs automatically from the environment so you
 * never have to interpolate template strings into fetch() calls.
 *
 * @example
 * ```ts
 * // In your queryFn — just works
 * useSuspenseQuery({
 *   queryKey: ["bookmarks", id],
 *   queryFn: () => fetch(route("/api/bookmarks/:id", { path: { id } })).then(r => r.json()),
 * });
 *
 * // With search params
 * route("/api/bookmarks", { search: { page: "2", sort: "name" } });
 * // → "http://localhost:3000/api/bookmarks?page=2&sort=name"
 *
 * // Match direction
 * matchRoute("/api/bookmarks/:id", "http://localhost:3000/api/bookmarks/42");
 * // → { path: { id: "42" }, search: {} }
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A path parameter value — strings or numbers are accepted. */
export type ParamValue = string | number;

/** Strip modifier suffixes (`?`, `*`, `+`) from a param name. */
export type StripModifier<T extends string> =
  T extends `${infer Name}${"?" | "*" | "+"}` ? Name : T;

/**
 * Extract raw `:param` tokens (including modifiers) from a pattern string literal.
 * @internal
 */
type RawParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | RawParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

/**
 * Extract `:param` names from a pattern string literal, stripping modifiers.
 *
 * @example
 * ExtractParams<"/api/:org/bookmarks/:id"> → "org" | "id"
 * ExtractParams<"/api/bookmarks/:id?">     → "id"
 * ExtractParams<"/api/bookmarks">           → never
 */
export type ExtractParams<T extends string> = StripModifier<RawParams<T>>;

/** Extract only required param names (no `?` or `*` modifier — these are optional). */
type RequiredParams<T extends string> =
  StripModifier<Exclude<RawParams<T>, `${string}?` | `${string}*`>>;

/** Extract only optional param names (with `?` or `*` modifier). */
type OptionalParams<T extends string> =
  StripModifier<Extract<RawParams<T>, `${string}?` | `${string}*`>>;

/** Extra options available in the explicit `{ path, ... }` form. */
export interface RouteBuildExtras {
  search?: Record<string, string | string[]>;
  /** URL fragment (without the `#`). */
  hash?: string;
  /** Return only the pathname + search + hash, without the base URL. */
  relative?: boolean;
  /** Override the base URL for this call only. */
  base?: string;
}

/**
 * Explicit options object for route building.
 *
 * - Patterns with required params require `path`.
 * - Patterns with only optional params allow omitting `path` (or options entirely).
 * - Patterns with no params accept `RouteBuildExtras` (or no options).
 */
export type RouteOptions<K extends string = string, T extends string = string> =
  [K] extends [never]
    ? RouteBuildExtras | undefined
    : [RequiredParams<T>] extends [never]
      ? ({ path?: Partial<Record<K, ParamValue>> } & RouteBuildExtras) | undefined
      : ({ path: Record<RequiredParams<T>, ParamValue> & Partial<Record<OptionalParams<T>, ParamValue>> } & RouteBuildExtras);

/** Result of matching a URL against a pattern via {@linkcode matchRoute}. */
export interface MatchResult<K extends string = string> {
  /** Extracted path parameters. */
  path: Record<K, string>;
  /** Extracted search (query) parameters. */
  search: Record<string, string | string[]>;
}

export interface RouteConfig {
  /**
   * Explicit base URL. Skips all env/runtime detection.
   */
  base?: string;

  /**
   * Env variable name to check for the base URL.
   * Checked as: import.meta.env[key], import.meta.env[`VITE_${key}`], Deno.env, Bun.env, process.env[key].
   * @default "API_BASE"
   */
  envKey?: string;

  /**
   * Dev fallback when nothing else resolves.
   * @default "http://localhost:3000"
   */
  fallback?: string;

  /**
   * Trailing slash behavior for built URLs.
   * - "strip": remove trailing slashes
   * - "preserve": leave as-is (default)
   * @default "preserve"
   */
  trailingSlash?: "strip" | "preserve";

  /**
   * Enable verbose logging for debugging.
   * - `undefined`: auto-enabled in dev (import.meta.env.DEV or NODE_ENV=development), off in production
   * - `true`: explicitly enable (works in all environments)
   * - `false`: explicitly disable (even in dev)
   * - `{ base, build, match }`: granular control over what gets logged
   * @default undefined (auto-detect based on environment)
   */
  verbose?:
    | boolean
    | {
        base?: boolean;
        build?: boolean;
        match?: boolean;
      };
}

/** Base URL source literals exposed for diagnostics and testing. */
export type BaseSource =
  | "config.base"
  | `env.${string}`
  | "window.location.origin"
  | "config.fallback"
  | "fallback";

/** Debug info about the resolved base URL source. */
export interface BaseInfo {
  base: string;
  source: BaseSource;
}

// ---------------------------------------------------------------------------
// Global config
// ---------------------------------------------------------------------------

let _config: RouteConfig = {};
let _resolvedBase: string | undefined;
let _resolvedSource: BaseSource | undefined;
let _baseLogged = false;

/**
 * Optionally configure the base URL resolution once at app startup.
 *
 * @example
 * ```ts
 * // main.ts
 * configureRoute({ envKey: "BACKEND_URL", fallback: "http://localhost:8080" });
 * ```
 */
export function configureRoute(config: RouteConfig): void {
  _config = config;
  _resolvedBase = undefined; // reset cache
  _resolvedSource = undefined; // reset source cache
  _baseLogged = false; // reset logging state
}

/**
 * Reset all route configuration and cached resolution state.
 * Useful for tests or hot-reload flows.
 */
export function resetRouteConfig(): void {
  _config = {};
  _resolvedBase = undefined;
  _resolvedSource = undefined;
  _baseLogged = false;
}

/**
 * Get the current base URL being used by the library.
 * Useful for debugging, displaying in UI, or conditional logic.
 *
 * @example
 * ```ts
 * const base = getBaseURL();
 * console.log("API Base:", base); // "http://localhost:3000"
 * ```
 */
export function getBaseURL(): string {
  return getBase();
}

/**
 * Get the current configuration (read-only).
 * Useful for testing, debugging, or introspection.
 *
 * @example
 * ```ts
 * const config = getConfig();
 * console.log("Verbose mode:", config.verbose);
 * ```
 */
export function getConfig(): Readonly<RouteConfig> {
  return { ..._config };
}

/**
 * Get the currently resolved base URL and where it came from.
 */
export function getBaseInfo(): BaseInfo {
  const base = getBase();
  const source = _resolvedSource ?? "fallback";
  return { base, source };
}

/**
 * Check whether URLPattern is available in the current runtime.
 */
export function isURLPatternSupported(): boolean {
  return typeof URLPattern !== "undefined";
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Validate pattern syntax and throw if invalid.
 * @internal
 */
function validatePattern(pattern: string): void {
  // Must start with "/"
  if (!pattern || !pattern.startsWith("/")) {
    throw new Error(`Pattern must start with "/": "${pattern}"`);
  }

  // Adjacent params - params cannot be next to each other without separator
  if (/:([a-zA-Z_]\w*)[?*+]?:/.test(pattern)) {
    throw new Error(
      `Invalid pattern syntax: "${pattern}". Params cannot be adjacent (e.g., ":id:name"). ` +
      `Use a separator like "/:id/:name".`
    );
  }

  // Empty or invalid param names - must start with letter or underscore
  if (/:[^a-zA-Z_]/.test(pattern)) {
    throw new Error(
      `Invalid pattern: "${pattern}". Param names must start with a letter or underscore.`
    );
  }

  // Multiple modifiers on same param
  if (/:([a-zA-Z_]\w*)[?*+]{2,}/.test(pattern)) {
    throw new Error(
      `Invalid pattern: "${pattern}". Params can only have one modifier (?, *, or +).`
    );
  }

  // Space after colon (common typo)
  if (/:\s/.test(pattern)) {
    throw new Error(
      `Invalid pattern: "${pattern}". Space after ":" is not allowed. ` +
      `Did you mean "/:param" instead of ": param"?`
    );
  }
}

/**
 * Reject regex patterns in route-building contexts (route/routePattern).
 * matchRoute supports full URLPattern regex — this check only applies to builders.
 * @internal
 */
function rejectRegexPattern(pattern: string): void {
  if (/:([a-zA-Z_]\w*)\([^)]+\)/.test(pattern)) {
    throw new Error(
      `Pattern "${pattern}" contains regex syntax (e.g., ":id(\\\\d+)"). ` +
      `Regex patterns are only supported in matchRoute(). ` +
      `For route(), use basic syntax or pass pattern "as any" to bypass this check.`
    );
  }
}

/**
 * Build a full URL from a path pattern and params.
 *
 * @example
 * ```ts
 * // Path params
 * route("/api/bookmarks/:id", { path: { id: "42" } });
 *
 * // Path + search
 * route("/api/bookmarks/:id", {
 *   path: { id: "42" },
 *   search: { fields: "title,url" },
 * });
 *
 * // No params
 * route("/api/bookmarks");
 * ```
 *
 * @throws {Error} If pattern doesn't start with "/"
 * @throws {Error} If pattern has invalid syntax (adjacent params, empty names, etc.)
 * @throws {Error} If required params are not provided
 */
export function route<T extends string>(
  pattern: T,
  ...[options]: [ExtractParams<T>] extends [never]
    ? [options?: RouteBuildExtras]
    : [RequiredParams<T>] extends [never]
      ? [options?: RouteOptions<ExtractParams<T>, T>]
      : [options: RouteOptions<ExtractParams<T>, T>]
): string {
  validatePattern(pattern as string);
  rejectRegexPattern(pattern as string);

  const normalized = normalizeOptions(options);
  const base = normalized.base ? strip(normalized.base) : getBase();

  let pathname = replaceParams(pattern as string, normalized.path);

  // Runtime safety net — catches untyped patterns (e.g. `string` variables)
  const unreplaced = pathname.match(/:([a-zA-Z_]\w*)[?*+]?/g);
  if (unreplaced) {
    throw new Error(
      `Unreplaced params in "${pattern}": ${unreplaced.join(", ")}. Received: ${JSON.stringify(normalized.path)}`
    );
  }

  const url = new URL(pathname, base);

  for (const [key, value] of Object.entries(normalized.search)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  if (normalized.hash) {
    url.hash = normalized.hash;
  }

  const full = normalizeTrailingSlash(url.toString());

  // Verbose logging
  if (shouldLog("build") && typeof console !== "undefined") {
    console.log(`[typed-route] ${pattern} → ${full}`);
  }

  if (normalized.relative) {
    const parsed = new URL(full);
    return parsed.pathname + parsed.search + parsed.hash;
  }

  return full;
}

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * Match a URL against a pattern using URLPattern.
 * Returns extracted path and search params, or `null`.
 *
 * @example
 * ```ts
 * matchRoute("/api/bookmarks/:id", request.url);
 * // → { path: { id: "42" }, search: { fields: "title" } }
 *
 * // Array search params preserved
 * matchRoute("/api/bookmarks", "http://localhost:3000/api/bookmarks?tag=a&tag=b");
 * // → { path: {}, search: { tag: ["a", "b"] } }
 * ```
 *
 * @throws {Error} If pattern doesn't start with "/"
 * @throws {Error} If pattern has invalid syntax (adjacent params, empty names, etc.)
 */
export function matchRoute<T extends string>(
  pattern: T,
  url: string,
): MatchResult<ExtractParams<T>> | null {
  validatePattern(pattern as string);

  const base = getBase();

  if (!isURLPatternSupported()) {
    throw new Error(
      "URLPattern is not available in this runtime. " +
      "Use a URLPattern polyfill or avoid matchRoute() in this environment.",
    );
  }

  const urlPattern = new URLPattern({ pathname: pattern, baseURL: base });
  const result = urlPattern.exec(url);

  if (!result) {
    // Verbose logging for failed matches
    if (shouldLog("match") && typeof console !== "undefined") {
      console.log(`[typed-route] ✗ ${pattern} did not match ${url}`);
    }
    return null;
  }

  // Decode path params for consistency with search params (which URLSearchParams
  // auto-decodes). Without this, a round-trip route()→matchRoute() returns
  // "%20" instead of " ".
  const path = Object.fromEntries(
    Object.entries(result.pathname.groups ?? {}).map(([k, v]) => {
      if (!v) return [k, v];
      try {
        return [k, decodeURIComponent(v)];
      } catch {
        // Malformed percent sequence (e.g. "%ZZ") — return raw value
        return [k, v];
      }
    }),
  ) as Record<ExtractParams<T>, string>;

  const search: Record<string, string | string[]> = {};
  const parsed = new URL(url, base);
  for (const key of new Set(parsed.searchParams.keys())) {
    const values = parsed.searchParams.getAll(key);
    search[key] = values.length === 1 ? values[0] : values;
  }

  const matchResult = { path, search };

  // Verbose logging for successful matches
  if (shouldLog("match") && typeof console !== "undefined") {
    console.log(`[typed-route] ✓ ${pattern} matched ${url}`);
    console.log(`  → ${JSON.stringify(matchResult)}`);
  }

  return matchResult;
}

// ---------------------------------------------------------------------------
// Pattern helper
// ---------------------------------------------------------------------------

export interface BoundRoute<T extends string> {
  /** The raw pattern string, useful for queryKeys or debugging. */
  readonly pattern: T;

  /** Build a URL from this pattern. Same args as `route()` minus the pattern. */
  (
    ...args: [ExtractParams<T>] extends [never]
      ? [options?: RouteBuildExtras]
      : [RequiredParams<T>] extends [never]
        ? [options?: RouteOptions<ExtractParams<T>, T>]
        : [options: RouteOptions<ExtractParams<T>, T>]
  ): string;

  /** Match a URL against this pattern. */
  match(url: string): MatchResult<ExtractParams<T>> | null;
}

/**
 * Bind a pattern for reuse across queryKey, queryFn, etc.
 *
 * @example
 * ```ts
 * const bookmarks = routePattern("/api/bookmarks/:id");
 *
 * useSuspenseQuery({
 *   queryKey: [bookmarks.pattern, id],
 *   queryFn: () => fetch(bookmarks({ path: { id } })).then(r => r.json()),
 * });
 *
 * // Also works for matching
 * bookmarks.match("http://localhost:3000/api/bookmarks/42");
 * // → { path: { id: "42" }, search: {} }
 * ```
 *
 * @throws {Error} If pattern doesn't start with "/"
 */
export function routePattern<T extends string>(pattern: T): BoundRoute<T> {
  // Validate pattern upfront when binding, not later when calling
  validatePattern(pattern as string);
  rejectRegexPattern(pattern as string);

  // Use `any` internally to delegate type checking to the bound route's call signature.
  // The returned BoundRoute<T> preserves full type safety for callers.
  // deno-lint-ignore no-explicit-any
  const fn = ((...args: [any?]) => {
    // deno-lint-ignore no-explicit-any
    return (route as any)(pattern, ...args);
  }) as unknown as BoundRoute<T>;

  Object.defineProperty(fn, "pattern", { value: pattern, writable: false });

  fn.match = (url: string) => matchRoute(pattern, url);

  return fn;
}

/**
 * Alias for {@linkcode routePattern}. More intuitive name following
 * common patterns like `createContext`, `createSlice`, etc.
 */
export const createRoute = routePattern;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Helper to check if verbose logging is enabled for a specific category.
 * @internal
 */
function shouldLog(category: "base" | "build" | "match"): boolean {
  // Auto-enable verbose in dev unless explicitly disabled
  const isDev =
    !!importMetaEnv("DEV") ||
    processEnv("NODE_ENV") === "development";

  const verboseConfig = _config.verbose ?? (isDev ? true : false);

  if (!verboseConfig) return false;
  if (verboseConfig === true) {
    // true = log base + build, but not match (too noisy by default)
    return category === "base" || category === "build";
  }
  return verboseConfig[category] ?? false;
}

function getBase(): string {
  if (_resolvedBase === undefined) {
    const resolved = resolveBase(_config);
    _resolvedBase = resolved.base;
    _resolvedSource = resolved.source;
  }
  return _resolvedBase;
}

function resolveBase(config: RouteConfig): BaseInfo {
  let source: BaseSource;
  let raw: string;
  let env: string | undefined;

  if (config.base) {
    raw = config.base;
    source = "config.base";
  } else if ((env = envLookup(config.envKey ?? "API_BASE"))) {
    raw = env;
    source = `env.${config.envKey ?? "API_BASE"}`;
  } else if ((env = windowOrigin())) {
    raw = env;
    source = "window.location.origin";
  } else if (config.fallback) {
    raw = config.fallback;
    source = "config.fallback";
  } else {
    raw = "http://localhost:3000";
    source = "fallback";
  }

  const base = strip(raw);

  // Validate that the resolved base is a usable URL origin
  try {
    new URL("/", base);
  } catch {
    throw new Error(
      `Invalid base URL: "${raw}" (resolved to "${base}"). Provide a full URL like "http://localhost:3000".`
    );
  }

  // Verbose logging - only log once when base is first resolved
  if (shouldLog("base") && !_baseLogged && typeof console !== "undefined") {
    console.log(`[typed-route] Base URL: ${base} (source: ${source})`);
    _baseLogged = true;
  }

  // Warn in dev when localhost base is active (common misconfiguration).
  if (base === "http://localhost:3000" && shouldLog("base") && typeof console !== "undefined") {
    console.warn(
      "[typed-route] Using localhost base: http://localhost:3000. " +
      "Set API_BASE env var or call configureRoute({ base: '...' }) if unintended."
    );
  }

  // In production, localhost is likely wrong — warn to prevent silent bugs
  const isProduction =
    processEnv("NODE_ENV") === "production" ||
    !!importMetaEnv("PROD") ||
    importMetaEnv("MODE") === "production";

  if (isProduction && (base.includes("localhost") || base.includes("127.0.0.1"))) {
    console.warn(
      "[typed-route] Warning: using localhost/127.0.0.1 in production. " +
      "Set API_BASE environment variable or call configureRoute({ base: '...' })"
    );
  }

  return { base, source };
}

function envLookup(key: string): string | undefined {
  return (
    importMetaEnv(key) ??
    importMetaEnv(`VITE_${key}`) ??
    denoEnv(key) ??
    bunEnv(key) ??
    processEnv(key)
  );
}

interface NormalizedOptions {
  path: Record<string, ParamValue>;
  search: Record<string, string | string[]>;
  hash?: string;
  relative?: boolean;
  base?: string;
}

const EXTRA_KEYS = new Set(["path", "search", "hash", "relative", "base"]);

function normalizeOptions(
  options?: RouteOptions<string> | RouteBuildExtras,
): NormalizedOptions {
  if (!options) return { path: {}, search: {} };

  const obj = options as Record<string, unknown>;
  const keys = Object.keys(obj);

  const hasNonExtraKey = keys.some((k) => !EXTRA_KEYS.has(k));
  if (hasNonExtraKey) {
    throw new Error(
      'Invalid route options: top-level params are no longer supported. ' +
      'Use explicit form: { path: {...}, search?, hash?, relative?, base? }.',
    );
  }

  const explicit = options as {
    path?: Record<string, ParamValue>;
    search?: Record<string, string | string[]>;
    hash?: string;
    relative?: boolean;
    base?: string;
  };

  return {
    path: explicit.path ?? {},
    search: explicit.search ?? {},
    hash: explicit.hash,
    relative: explicit.relative,
    base: explicit.base,
  };
}


/**
 * Replace `:param`, `:param?`, `:param*`, `:param+` tokens in a pathname.
 *
 * - Required params (`:name`) are replaced with the encoded value.
 * - Optional params (`:name?`) are removed (including surrounding `/`) when missing.
 * - Wildcard params (`:name*`, `:name+`) insert the value without encoding `/` separators.
 * - Zero-or-more wildcards (`:name*`) are removed when missing.
 * - One-or-more wildcards (`:name+`) are treated as required.
 */
function replaceParams(
  pathname: string,
  params: Record<string, ParamValue>,
): string {
  // Handle optional params — remove segment when value is absent
  pathname = pathname.replace(
    /\/:([a-zA-Z_]\w*)\?/g,
    (_, name) => {
      if (name in params && params[name] !== undefined) {
        return `/${encodeURIComponent(String(params[name]))}`;
      }
      return "";
    },
  );

  // Handle wildcard params (*, +) — don't encode `/` separators
  pathname = pathname.replace(
    /:([a-zA-Z_]\w*)([*+])/g,
    (match, name, modifier) => {
      if (name in params && params[name] !== undefined) {
        // Encode each segment individually, preserving `/`
        return String(params[name])
          .split("/")
          .map((seg) => encodeURIComponent(seg))
          .join("/");
      }
      if (modifier === "*") return "";
      // `+` is required — leave the token for the unreplaced check
      return match;
    },
  );

  // Handle regular required params — use a regex with word boundary to avoid
  // replacing inside already-substituted values or partial matches.
  for (const [key, value] of Object.entries(params)) {
    const encoded = encodeURIComponent(String(value));
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    pathname = pathname.replace(
      new RegExp(`:${escapedKey}(?=[\\/?#]|$)(?![?*+])`, "g"),
      encoded,
    );
  }

  // Clean up double slashes left by removed optional segments
  // Use negative lookbehind to avoid breaking protocol schemes (e.g., http://)
  pathname = pathname.replace(/([^:])\/\/+/g, "$1/");

  return pathname;
}

function strip(s: string): string {
  return s.replace(/\/+$/, "");
}

function normalizeTrailingSlash(url: string): string {
  // Guard against edge cases: empty strings or URLs without slashes
  if (!url || !url.includes("/")) return url;

  const mode = _config.trailingSlash ?? "preserve";
  if (mode === "preserve") return url;

  // Split into pathname vs. the rest (query + hash), preserving both.
  // We need to handle: path, path?query, path#hash, path?query#hash
  const qIdx = url.indexOf("?");
  const hIdx = url.indexOf("#");

  // Find where the pathname ends (first of `?` or `#`, whichever comes first)
  let splitIdx: number;
  if (qIdx === -1 && hIdx === -1) {
    splitIdx = url.length;
  } else if (qIdx === -1) {
    splitIdx = hIdx;
  } else if (hIdx === -1) {
    splitIdx = qIdx;
  } else {
    splitIdx = Math.min(qIdx, hIdx);
  }

  const pathname = url.slice(0, splitIdx);
  const suffix = url.slice(splitIdx); // includes `?query#hash` or `#hash` etc.

  // Strip mode: remove trailing slashes
  // Preserve mode: already returned early
  const normalized = pathname.replace(/\/+$/, "");

  return normalized + suffix;
}

function windowOrigin(): string | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const origin = window.location?.origin;
    // Some runtimes expose "null" for opaque origins (e.g. file://); treat as unresolved.
    return origin && origin !== "null" ? origin : undefined;
  } catch {
    return undefined;
  }
}

function importMetaEnv(key: string): string | undefined {
  try {
    // @ts-expect-error — import.meta.env may not exist in all runtimes
    return import.meta?.env?.[key] as string | undefined;
  } catch {
    return undefined;
  }
}

function denoEnv(key: string): string | undefined {
  try {
    // @ts-ignore — Deno global may not exist in non-Deno runtimes
    return typeof Deno !== "undefined" ? Deno.env.get(key) : undefined;
  } catch {
    return undefined;
  }
}

function bunEnv(key: string): string | undefined {
  try {
    // @ts-expect-error — Bun global may not exist
    return typeof Bun !== "undefined" ? Bun.env[key] : undefined;
  } catch {
    return undefined;
  }
}

function processEnv(key: string): string | undefined {
  try {
    return typeof process !== "undefined" ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
}
