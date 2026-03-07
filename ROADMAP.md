# Roadmap

## Done

### Optional and wildcard params

URLPattern supports `:id?` (optional), `:path*` (zero-or-more), and `:path+` (one-or-more). These are now fully supported in both the type system and the replacement logic.

**Usage:**

```ts
// Optional param — omit or provide
route("/api/bookmarks/:id?", {});                    // → "/api/bookmarks"
route("/api/bookmarks/:id?", { id: "42" });           // → "/api/bookmarks/42"

// Zero-or-more wildcard — slashes preserved
route("/files/:path*", { path: "docs/readme.md" });   // → "/files/docs/readme.md"
route("/files/:path*");                                // → "/files"

// One-or-more wildcard
route("/files/:path+", { path: "docs/readme.md" });   // → "/files/docs/readme.md"
```

**Type behavior:**

- `?` and `*` params are optional keys in the type
- `+` params are required (like regular params)
- When all params are optional, the options argument can be omitted entirely
- `StripModifier<T>` utility type is exported for downstream use
