# firebase pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## firebase/auth

Manifest version: `1.2.0`. Status: **preview**.

### firebase/FB-ADMIN-001

Check: [`firebase/auth/no-admin-in-client@1.0.0`](checks/auth/no-admin-in-client/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.auth.admin-in-client`. Minimum severity: `none`.

firebase-admin in client code ships service-account privilege to the browser. That is a full project breach, not a scoped leak.

Default parameters: `{}`.

**Repair:** Use firebase/auth on the client. Keep firebase-admin behind server files outside app, components, pages and their src mirrors.

**Scope and limits:** require() loads the same SDK as import. Renaming the import does not change the module specifier.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Admin SDK documentation, client versus server setup",
  "locator": "Admin SDK privilege",
  "paraphrase": "The Admin SDK runs with full service-account privilege and belongs in server code only, never in shipped client bundles."
}
```

### firebase/FB-AUTH-001

Check: [`firebase/auth/no-currentuser-without-nullcheck@1.0.0`](checks/auth/no-currentuser-without-nullcheck/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.auth.currentuser-nullcheck`. Minimum severity: `none`.

Chaining off currentUser throws the moment a signed-out user reaches the code, usually on the exact screen that should invite sign-in.

Default parameters: `{}`.

**Repair:** Assign currentUser first and return early on null, or subscribe with onAuthStateChanged and render from the callback value.

**Scope and limits:** getAuth().currentUser is still nullable. Optional chaining passes this rule but still needs a fallback for the signed-out case.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Authentication documentation, manage users",
  "locator": "currentUser nullability",
  "paraphrase": "currentUser is null when nobody is signed in. Read it into a variable and handle null before touching its fields."
}
```

### firebase/FB-FUNCTION-001

Check: [`firebase/functions/no-onrequest-without-cors@1.0.0`](checks/functions/no-onrequest-without-cors/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.functions.onrequest-cors`. Minimum severity: `none`.

The syntax cannot tell whether the caller is a browser on another origin or whether a wrapper sets CORS headers.

Default parameters: `{}`.

**Repair:** Wrap the body with cors(req, res, () => ...) in the same onRequest statement so the middleware cannot be dropped.

**Scope and limits:** An async handler still answers without CORS headers. A bare named function reference carries no middleware with it.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Cloud Functions documentation, HTTP triggers and CORS",
  "locator": "onRequest middleware",
  "paraphrase": "Browser-callable cross-origin handlers need appropriate CORS handling; same-origin and server-to-server handlers may not."
}
```

### firebase/FB-STORAGE-001

Check: [`firebase/storage/no-unbounded-listall@1.0.0`](checks/storage/no-unbounded-listall/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.storage.listall-bound`. Minimum severity: `none`.

listAll on a growing prefix gets slower and pricier with every upload. One prefix with user content can stall the caller.

Default parameters: `{}`.

**Repair:** Call list(ref, { maxResults: n }) and follow page tokens. Choose n from what the UI renders.

**Scope and limits:** A narrow user-scoped prefix is still unbounded. Counting items still downloads every item first.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Storage documentation, list files",
  "locator": "list() with maxResults",
  "paraphrase": "listAll pages through everything under a ref. Page with list() and maxResults instead."
}
```

### firebase/FB-COMPAT-001

Check: [`firebase/auth/no-compat-import@1.0.0`](checks/auth/no-compat-import/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.compat-sdk`. Minimum severity: `none`.

Compat code breaks when a future major SDK removes the compat libraries, and it ships the whole namespaced SDK instead of only the functions the app imports.

Default parameters: `{}`.

**Repair:** Import functions from the modular entry points (firebase/app, firebase/auth, firebase/firestore, ...) and call them with the instance, for example getDoc(doc(db, "orders", id)).

**Scope and limits:** A side-effect import such as import "firebase/compat/firestore" still loads compat, even when the visible calls are modular. Remove it rather than keep it next to modular code.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase documentation, Upgrade from the namespaced API to the modular API",
  "locator": "About the namespaced (compat) libraries; https://firebase.google.com/docs/web/modular-upgrade",
  "paraphrase": "The firebase/compat libraries keep the namespaced API working during migration. They are a temporary solution that will be removed completely in a future major SDK version, and they do not get the size benefits of the modular API."
}
```

### firebase/FB-INIT-001

Check: [`firebase/auth/no-unguarded-initialize-app@1.0.0`](checks/auth/no-unguarded-initialize-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.unguarded-init`. Minimum severity: `none`.

When initializeApp() lives inside a helper or request handler without a getApps().length check, the second invocation crashes with FirebaseError: Firebase App named '[DEFAULT]' already exists.

Default parameters: `{}`.

**Repair:** Initialize Firebase once at module scope, or guard with getApps().length ? getApp() : initializeApp(config).

**Scope and limits:** Module-top-level initializeApp(config) calls are allowed. Guards placed in a caller function outside the helper are not visible.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase documentation, Add Firebase to your JavaScript project (firebase.google.com)",
  "locator": "https://firebase.google.com/docs/web/setup#initialize-firebase",
  "paraphrase": "initializeApp creates the default Firebase app instance; calling it more than once without checking existing apps via getApps() throws a duplicate app error."
}
```

## firebase/firestore

Manifest version: `1.1.0`. Status: **preview**.

### firebase/FB-READ-001

Check: [`firebase/firestore/no-getdocs-without-limit@1.0.0`](checks/firestore/no-getdocs-without-limit/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.firestore.getdocs-limit`. Minimum severity: `none`.

An unbounded getDocs scales cost and latency with the collection, not the screen. One careless call on a large collection bills thousands of reads.

Default parameters: `{}`.

**Repair:** Wrap the source in query() with limit(n) or where(field, op, value). Pick the page size the caller chose.

**Scope and limits:** query(col) with no constraint still reads everything. A limit applied in a different statement does not bound this call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Firestore documentation, order and limit data",
  "locator": "query cursors and limit()",
  "paraphrase": "Bound every read with limit() or a where() filter so one call cannot download the whole collection."
}
```

### firebase/FB-WRITE-001

Check: [`firebase/firestore/no-unsafe-setdoc-merge@1.0.0`](checks/firestore/no-unsafe-setdoc-merge/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.firestore.setdoc-merge`. Minimum severity: `none`.

A partial overwrite can remove fields, but replacing an entire document is also a documented operation. The syntax cannot distinguish intent.

Default parameters: `{}`.

**Repair:** Pass { merge: true } as the third argument, or use updateDoc for a partial write to an existing document.

**Scope and limits:** An empty options object carries no merge flag. A data field named merge does not count as the option.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Firestore documentation, set a document",
  "locator": "SetOptions merge",
  "paraphrase": "setDoc without merge intentionally creates or replaces a document. Pass merge only when the write is partial."
}
```

### firebase/FB-QUERY-001

Check: [`firebase/firestore/no-collection-string-concat@1.0.0`](checks/firestore/no-collection-string-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.firestore.collection-concat`. Minimum severity: `none`.

A concatenated path is opaque text at review time. Rules match on segments, so a joined string can slip past the rule the author intended.

Default parameters: `{}`.

**Repair:** Pass each segment as its own argument: doc(db, "orders", id) instead of doc(db, "orders/" + id).

**Scope and limits:** Template literals are the same concatenation in backticks. Joining segments in a helper still hides the shape.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Firestore documentation, document and collection references",
  "locator": "path segments as arguments",
  "paraphrase": "Build references from separate path segments. Concatenated strings defeat Security Rules path matching."
}
```

### firebase/FB-BATCH-001

Check: [`firebase/firestore/no-writebatch-without-commit@1.0.0`](checks/firestore/no-writebatch-without-commit/check.json). Default severity: **off**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.firestore.writebatch-commit`. Minimum severity: `none`.

A batch needs a commit before its lifecycle ends. A per-statement pattern cannot prove whether a later statement commits it.

Default parameters: `{}`.

**Repair:** Chain commit onto the writeBatch statement so the batch cannot be created without being sent.

**Scope and limits:** commit in a later statement is invisible to this rule and to hurried readers. Awaiting the batch object itself commits nothing.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Firebase Firestore documentation, batched writes",
  "locator": "commit()",
  "paraphrase": "A write batch does nothing until commit() runs. Never leave a batch uncommitted."
}
```

### firebase/FB-TX-ORDER-001

Check: [`firebase/firestore/no-tx-read-after-write@1.0.0`](checks/firestore/no-tx-read-after-write/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `firebase.tx-read-after-write`. Minimum severity: `none`.

Firestore rejects any transaction.get() executed after a transaction write with 'Firestore transactions require all reads to be executed before all writes'.

Default parameters: `{}`.

**Repair:** Move all transaction.get() calls to the top of the runTransaction callback before any transaction.set, transaction.update, or transaction.delete calls.

**Scope and limits:** Matches transaction callbacks where the parameter is named tx, transaction, or t and a get() statement follows a set/update/delete statement in the same block.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Cloud Firestore documentation, Transactions and batched writes (firebase.google.com)",
  "locator": "https://firebase.google.com/docs/firestore/manage-data/transactions#transaction_limitations",
  "paraphrase": "In a Firestore transaction, all read operations must come before any write operations; calling transaction.get() after set, update, or delete fails at runtime."
}
```
