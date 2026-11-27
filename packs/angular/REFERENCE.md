# angular pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## angular/components

Manifest version: `1.2.0`. Status: **preview**.

### angular/ANG-IO-001

Check: [`angular/components/no-io-alias@1.0.0`](checks/components/no-io-alias/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.io-alias`. Minimum severity: `none`.

An alias renames the binding at every use site, so a search for the property name misses the template that binds it.

Default parameters: `{}`.

**Repair:** Drop the string argument: @Input() label. Rename the property itself when the public name must change.

**Scope and limits:** The options-object form @Input({ alias }) is the same rename behind a key and is still banned.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular style guide",
  "locator": "inputs and outputs naming",
  "paraphrase": "Name component inputs and outputs without string aliases, so the property name is the binding name."
}
```

### angular/ANG-GUARD-001

Check: [`angular/guards/no-canactivate-interface@1.0.0`](checks/guards/no-canactivate-interface/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.canactivate-interface`. Minimum severity: `none`.

A class guard needs an injectable, a provider entry, and a canActivate method for one boolean. A function guard is the value the router calls.

Default parameters: `{}`.

**Repair:** Export a const typed CanActivateFn: export const authGuard: CanActivateFn = () => true.

**Scope and limits:** CanActivateChild is the same legacy shape for child routes, not a functional guard.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular router guide",
  "locator": "functional guards",
  "paraphrase": "Write route guards as functions returning CanActivateFn, not as classes implementing the CanActivate interface."
}
```

### angular/ANG-STYLE-001

Check: [`angular/components/no-styleurls-plural@1.0.0`](checks/components/no-styleurls-plural/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.styleurls-plural`. Minimum severity: `none`.

The plural key is the legacy API. One stylesheet per component keeps the metadata a single string the tooling reads directly.

Default parameters: `{}`.

**Repair:** Replace styleUrls: ['./a.css'] with styleUrl: './a.css'.

**Scope and limits:** A single-entry array is still the plural key. The key, not the length, is what the rule bans.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular v17 component API",
  "locator": "styleUrl versus styleUrls",
  "paraphrase": "Standalone-era components declare one styleUrl string instead of the legacy styleUrls array."
}
```

### angular/ANG-SVC-001

Check: [`angular/services/no-fetch-in-service@1.0.0`](checks/services/no-fetch-in-service/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.fetch-in-service`. Minimum severity: `none`.

Global fetch bypasses interceptors for auth headers and error handling, and its responses stay untyped.

Default parameters: `{}`.

**Repair:** Inject HttpClient and call this.http.get<T>(url). Keep fetch, if ever needed, outside *.service.ts files.

**Scope and limits:** globalThis.fetch is still global fetch. The receiver prefix does not route through HttpClient.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular HttpClient guide",
  "locator": "services and data access",
  "paraphrase": "Services fetch data through HttpClient, not the global fetch, so interceptors, typing, and tests cover every request."
}
```

### angular/ANG-INJECT-001

Check: [`angular/components/no-inject-outside-context@1.0.0`](checks/components/no-inject-outside-context/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.inject-outside-context`. Minimum severity: `none`.

Lifecycle hooks run after construction, so inject(), effect() and argument-less takeUntilDestroyed() throw NG0203 at runtime instead of resolving a dependency.

Default parameters: `{}`.

**Repair:** Inject into a field (private readonly service = inject(Service)) or create the effect in the constructor; inside a hook, pass takeUntilDestroyed(this.destroyRef) or effect(fn, { injector: this.injector }).

**Scope and limits:** A callback created inside the hook, such as a subscribe handler, runs even later and is still outside the context. runInInjectionContext and injector.runInContext wrappers are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular dependency injection guide, injection context (https://angular.dev/guide/di/dependency-injection-context)",
  "locator": "Injection context; NG0203",
  "paraphrase": "inject() works only in an injection context: field initializers, the constructor, factory functions and runInInjectionContext. Called elsewhere, such as in a lifecycle hook, it throws NG0203. effect() and takeUntilDestroyed() need the same context unless given an Injector or DestroyRef."
}
```

### angular/ANG-HTTPMOD-001

Check: [`angular/http/no-http-client-module@1.0.0`](checks/http/no-http-client-module/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.http-client-module`. Minimum severity: `none`.

The NgModule wrappers are deprecated and slated for removal, and they keep the app on the module-based setup instead of the provider functions that standalone bootstrap uses.

Default parameters: `{}`.

**Repair:** Replace the module with provideHttpClient(withInterceptorsFromDi()) in providers, or provideHttpClient() plus provideHttpClientTesting() in TestBed.

**Scope and limits:** An import alias or a re-export from a shared file is still the deprecated module. Imports of provideHttpClient and HttpTestingController are not matched.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular API reference, HttpClientModule (https://angular.dev/api/common/http/HttpClientModule)",
  "locator": "Deprecation notice",
  "paraphrase": "HttpClientModule is deprecated; use provideHttpClient(withInterceptorsFromDi()) as providers instead. HttpClientTestingModule, HttpClientXsrfModule and HttpClientJsonpModule are deprecated in favor of provideHttpClientTesting() and the withXsrfConfiguration / withJsonpSupport features."
}
```

### angular/ANG-SIGNAL-002

Check: [`angular/signals/no-effect-signal-write@1.0.0`](checks/signals/no-effect-signal-write/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.effect-signal-write`. Minimum severity: `none`.

Writing to signals inside an effect() callback cascades reactive updates after change detection, risking circular loops and out-of-order state synchronization.

Default parameters: `{}`.

**Repair:** Express derived state with computed(() => ...) or writable dependent state with linkedSignal(() => ...). Move imperative writes to event handlers.

**Scope and limits:** Single-argument .set(...) and .update(...) calls inside an effect(...) callback are flagged as advisory warnings; multi-argument calls such as Map.prototype.set(k, v) and signal writes in event handlers outside effect() pass.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular documentation, Signals guide (https://angular.dev/guide/signals#when-not-to-use-effects)",
  "locator": "When not to use effects",
  "paraphrase": "Avoid using effects for propagation of state changes (writing to signals). This can result in ExpressionChangedAfterItHasBeenChecked errors, infinite circular updates, or unnecessary change detection cycles; use computed or linkedSignal instead."
}
```

## angular/rxjs

Manifest version: `1.0.0`. Status: **preview**.

### angular/ANG-SUB-001

Check: [`angular/rxjs/no-nested-subscribe@1.0.0`](checks/rxjs/no-nested-subscribe/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.nested-subscribe`. Minimum severity: `none`.

A nested subscribe hides the inner subscription: it is never piped, never cancelled with the outer one, and leaks on every emission.

Default parameters: `{}`.

**Repair:** Pipe the outer stream: users$.pipe(switchMap((u) => ordersFor(u))).subscribe(show).

**Scope and limits:** Extracting the inner subscribe into a helper called from the callback is still a subscribe inside a subscribe.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "RxJS documentation",
  "locator": "higher-order mapping operators",
  "paraphrase": "Flatten dependent streams with switchMap or mergeMap instead of subscribing inside a subscribe callback."
}
```

### angular/ANG-PROMISE-001

Check: [`angular/rxjs/no-topromise@1.0.0`](checks/rxjs/no-topromise/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.topromise`. Minimum severity: `none`.

toPromise no longer exists on current RxJS. Code that calls it fails against the installed version.

Default parameters: `{}`.

**Repair:** Return firstValueFrom(orders$) for one emission, or lastValueFrom(orders$) for completion.

**Scope and limits:** Awaiting the call does not modernize it. await obs.toPromise() is still the deprecated conversion.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "RxJS v7 deprecation guide",
  "locator": "toPromise removal",
  "paraphrase": "toPromise is deprecated and removed. Convert a finite stream with firstValueFrom or lastValueFrom."
}
```

### angular/ANG-SIGNAL-001

Check: [`angular/signals/no-signal-write-in-computed@1.0.0`](checks/signals/no-signal-write-in-computed/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.signal-write-in-computed`. Minimum severity: `none`.

Writing inside computed creates a feedback loop: the write invalidates the computation that just ran, and the graph can cycle.

Default parameters: `{}`.

**Repair:** Return the derived value only. Use linkedSignal(() => ...) for writable state derived from signals, or move the write into an event handler or the code that owns the source signal.

**Scope and limits:** update is a write like set. Rewriting the same value through update is still a write inside computed.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular signals guide",
  "locator": "computed purity",
  "paraphrase": "A computed derives its value from the signals it reads. It never writes a signal with set or update."
}
```

### angular/ANG-HTTP-001

Check: [`angular/http/no-untyped-http-call@1.0.0`](checks/http/no-untyped-http-call/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `angular.untyped-http-call`. Minimum severity: `none`.

An untyped get returns any. Every field access on the response compiles, and a renamed backend field surfaces at runtime.

Default parameters: `{}`.

**Repair:** Add the type argument: this.http.get<User[]>(url). Name the domain type next to the service that fetches it.

**Scope and limits:** Typing only the get while leaving post, put, patch, or delete bare keeps an untyped reference on the same service.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Angular HttpClient guide",
  "locator": "typed responses",
  "paraphrase": "Every HttpClient call names its response type, so the untyped reference never flows into components as any."
}
```
