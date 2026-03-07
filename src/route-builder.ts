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
 *   queryFn: () => fetch(route("/api/bookmarks/:id", { id })).then(r => r.json()),
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

export type ParamValue = string | number;

/**
 * Extract `:param` names from a pattern string literal.
 *
 * @example
 * ExtractParams<"/api/:org/bookmarks/:id"> → "org" | "id"
 * ExtractParams<"/api/bookmarks">           → never
 */
export type ExtractParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never;

/**
 * When the pattern has no params, options are optional (search-only or omitted).
 * When it has params, you must provide them — either as a flat object or via `{ path }`.
 */
export type RouteOptions<K extends string = string> =
  [K] extends [never]
    ? { search?: Record<string, string | string[]> } | undefined
    : | Record<K, ParamValue>
      | {
          path: Record<K, ParamValue>;
          search?: Record<string, string | string[]>;
        };

export interface MatchResult<K extends string = string> {
  path: Record<K, string>;
  search: Record<string, string | string[]>;
}

export interface RouteConfig {
  /**
   * Explicit base URL. Skips all env/runtime detection.
   */
  base?: string;

  /**
   * Env variable name to check for the base URL.
   * Checked as: import.meta.env[key], import.meta.env[`VITE_${key}`], process.env[key].
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
   * - "strip": remove trailing slashes (default)
   * - "add": ensure a trailing slash
   * - "preserve": leave as-is
   * @default "strip"
   */
  trailingSlash?: "strip" | "add" | "preserve";
}

// ---------------------------------------------------------------------------
// Global config
// ---------------------------------------------------------------------------

let _config: RouteConfig = {};
let _resolvedBase: string | undefined;

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
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build a full URL from a path pattern and params.
 *
 * @example
 * ```ts
 * // Shorthand — flat object = path params
 * route("/api/bookmarks/:id", { id: "42" });
 *
 * // Explicit path + search
 * route("/api/bookmarks/:id", {
 *   path: { id: "42" },
 *   search: { fields: "title,url" },
 * });
 *
 * // No params
 * route("/api/bookmarks");
 * ```
 */
export function route<T extends string>(
  pattern: T,
  ...[options]: [ExtractParams<T>] extends [never]
    ? [options?: { search?: Record<string, string | string[]> }]
    : [options: RouteOptions<ExtractParams<T>>]
): string {
  const base = getBase();
  const { path, search } = normalizeOptions(options);

  let pathname = pattern as string;
  for (const [key, value] of Object.entries(path)) {
    const encoded = isEncoded(String(value))
      ? String(value)
      : encodeURIComponent(String(value));
    pathname = pathname.replace(`:${key}`, encoded);
  }

  // Runtime safety net — catches untyped patterns (e.g. `string` variables)
  const unreplaced = pathname.match(/:([a-zA-Z_]\w*)/g);
  if (unreplaced) {
    throw new Error(
      `Unreplaced params in "${pattern}": ${unreplaced.join(", ")}`
    );
  }

  const url = new URL(pathname, base);

  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  return normalizeTrailingSlash(url.toString());
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
 */
export function matchRoute<T extends string>(
  pattern: T,
  url: string,
): MatchResult<ExtractParams<T>> | null {
  const base = getBase();
  const urlPattern = new URLPattern({ pathname: pattern, baseURL: base });
  const result = urlPattern.exec(url);

  if (!result) return null;

  const path = { ...result.pathname.groups } as Record<ExtractParams<T>, string>;

  const search: Record<string, string | string[]> = {};
  const parsed = new URL(url);
  for (const key of new Set(parsed.searchParams.keys())) {
    const values = parsed.searchParams.getAll(key);
    search[key] = values.length === 1 ? values[0] : values;
  }

  return { path, search };
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
      ? [options?: { search?: Record<string, string | string[]> }]
      : [options: RouteOptions<ExtractParams<T>>]
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
 *   queryFn: () => fetch(bookmarks({ id })).then(r => r.json()),
 * });
 *
 * // Also works for matching
 * bookmarks.match("http://localhost:3000/api/bookmarks/42");
 * // → { path: { id: "42" }, search: {} }
 * ```
 */
export function routePattern<T extends string>(pattern: T): BoundRoute<T> {
  // deno-lint-ignore no-explicit-any
  const fn = ((...args: [any?]) => {
    // deno-lint-ignore no-explicit-any
    return (route as any)(pattern, ...args);
  }) as unknown as BoundRoute<T>;

  Object.defineProperty(fn, "pattern", { value: pattern, writable: false });

  fn.match = (url: string) => matchRoute(pattern, url);

  return fn;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getBase(): string {
  if (!_resolvedBase) _resolvedBase = resolveBase(_config);
  return _resolvedBase;
}

function resolveBase(config: RouteConfig): string {
  if (config.base) return strip(config.base);

  const key = config.envKey ?? "API_BASE";

  // Vite / modern bundlers
  const meta = importMetaEnv(key) ?? importMetaEnv(`VITE_${key}`);
  if (meta) return strip(meta);

  // Deno
  const deno = denoEnv(key);
  if (deno) return strip(deno);

  // Bun
  const bun = bunEnv(key);
  if (bun) return strip(bun);

  // Node (also works as fallback for Bun/Deno compat layers)
  const proc = processEnv(key);
  if (proc) return strip(proc);

  // Browser
  if (typeof globalThis.window !== "undefined" && globalThis.window.location?.origin) {
    return strip(globalThis.window.location.origin);
  }

  return strip(config.fallback ?? "http://localhost:3000");
}

function normalizeOptions(options?: RouteOptions<string> | { search?: Record<string, string | string[]> }): {
  path: Record<string, ParamValue>;
  search: Record<string, string | string[]>;
} {
  if (!options) return { path: {}, search: {} };

  // Explicit shape: has `path` or `search` key
  if ("path" in options || "search" in options) {
    const explicit = options as {
      path?: Record<string, ParamValue>;
      search?: Record<string, string | string[]>;
    };
    return { path: explicit.path ?? {}, search: explicit.search ?? {} };
  }

  // Flat object → all path params
  return { path: options as Record<string, ParamValue>, search: {} };
}

function strip(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function normalizeTrailingSlash(url: string): string {
  const mode = _config.trailingSlash ?? "strip";
  if (mode === "preserve") return url;

  const [base, query] = url.split("?");
  const normalized =
    mode === "strip"
      ? base.replace(/\/+$/, "")
      : base.endsWith("/")
        ? base
        : base + "/";

  return query ? `${normalized}?${query}` : normalized;
}

/**
 * Check if a value is already percent-encoded to avoid double-encoding.
 * e.g. "hello%20world" → true, "hello world" → false
 */
function isEncoded(value: string): boolean {
  return value !== decodeURIComponent(value);
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
