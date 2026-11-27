# angular

Angular invariants that the TypeScript syntax tree can decide. The stance of this pack is: flatten streams with operators instead of nesting subscribes, convert with firstValueFrom instead of toPromise, keep computeds pure, name inputs and outputs without aliases, guard routes with functions instead of classes, declare one styleUrl, fetch through HttpClient, and type every HttpClient call.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `angular/ANG-SUB-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

Ready-made combinations live in `packs/presets/`.

## Rules

| ID | Forbids | Why | Default severity |
| --- | --- | --- | --- |
| `ANG-SUB-001` | A `.subscribe(` call inside another `.subscribe(` callback. | The inner subscription is never piped or cancelled with the outer one, and leaks on every emission. | deny |
| `ANG-PROMISE-001` | Calling deprecated `.toPromise(`, awaited or not. | toPromise no longer exists on current RxJS; the call fails against the installed version. | deny |
| `ANG-IO-001` | `@Input('alias')`, `@Output('alias')`, and `@Input({ alias })`. | An alias renames the binding at every use site, so search misses the templates that bind it. | deny |
| `ANG-SVC-001` | Global `fetch(` (including `globalThis.fetch(`) inside `*.service.ts`. | Global fetch bypasses interceptors for auth and errors, and its responses stay untyped. | deny |
| `ANG-SIGNAL-001` | `.set(` / `.update(` inside `computed(`. | A write inside computed invalidates the computation that just ran, and the graph can cycle. | deny |
| `ANG-GUARD-001` | The `CanActivate` / `CanActivateChild` interface names. | Class guards need an injectable and a provider entry for one boolean; a function guard is the value the router calls. | deny |
| `ANG-STYLE-001` | The legacy `styleUrls` key, even with a single entry. | The plural key is the legacy API; v17+ metadata holds one `styleUrl` string. | deny |
| `ANG-HTTP-001` | An `HttpClient` get/post/put/patch/delete call without a type argument. | An untyped call returns any, so every field access on the response compiles. | deny |
| `ANG-INJECT-001` | `inject()`, `effect()` without an `injector`, or argument-less `takeUntilDestroyed()` inside a lifecycle hook (`ngOnInit`, `ngAfterViewInit`, …), outside `runInInjectionContext`. | Hooks run outside the injection context, so the call throws NG0203. | deny |
| `ANG-HTTPMOD-001` | Importing or re-exporting `HttpClientModule`, `HttpClientTestingModule`, `HttpClientXsrfModule`, or `HttpClientJsonpModule`. | The NgModules are deprecated; `provideHttpClient()` and `provideHttpClientTesting()` replace them. | warn |
| `ANG-SIGNAL-002` | Single-argument `.set(` or `.update(` signal writes inside `effect(`. | Writing to signals inside `effect()` risks circular updates and extra change-detection cycles; use `computed()` or `linkedSignal()`. | warn |

## Methodologies

- `angular/components` — ANG-IO-001, ANG-GUARD-001, ANG-STYLE-001, ANG-SVC-001, ANG-INJECT-001, ANG-HTTPMOD-001, ANG-SIGNAL-002
- `angular/rxjs` — ANG-SUB-001, ANG-PROMISE-001, ANG-SIGNAL-001, ANG-HTTP-001

Non-decidable practices from the same sources are in `BACKLOG.md`.

## Fixture coverage and limits

`pregate rules test packs/angular` runs **56** real fixtures. Every check has a failing trap with exact lines: triple-nested subscribes; awaited toPromise; the `@Input({ alias })` options form; `globalThis.fetch`; `.update` inside computed; `CanActivateChild`; single-entry `styleUrls`; an untyped `post` with a body; `inject()` inside a subscribe callback in `ngOnInit`; aliased or re-exported HttpClient modules; and `.update()` inside `effect()`. Pass guards cover the nearby safe shapes: lone subscribes, `firstValueFrom`/`lastValueFrom`, plain `@Input()`/`@Output()`, typed HttpClient calls, pure computeds, functional guards, singular `styleUrl`, field and constructor injection, explicit `DestroyRef`/`Injector` arguments, `provideHttpClient()`, and non-signal effects.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 11 distinct check IDs.

Methodologies: `angular/components` (preview), `angular/rxjs` (preview).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
