# PREGATE: arquitectura del MVP

> *A gate for explicit, executable code and architecture constraints.*

**Current source: published engine 0.2.12, core 0.3.1:** 68 default rules (64 project fitness requirements and four
general change guards); language/practice/pattern policies are optional packs.
Human-reviewed off overrides are supported. The pure evidence gate is
[fitness.ts](../src/fitness.ts); execution and file fingerprints live in
[fitness-command.ts](../src/fitness-command.ts). [Project fitness](features/project-fitness.md)
defines its approval, staleness, scope and semantic limits. Earlier core names,
non-disableable integrity claims and default rule counts below are historical.

**Current status (2026-10-07):** 0.2.12 is published to the private macOS pilot
and globally installed. It adds
Python/Go/Rust demos, bounded Rust source analysis and public-ready HTTPS downloads
with private fallback. Core is unchanged. See
[alcance pre-public](releases/pre-public-readiness.md) y
[límites del análisis de lenguajes](features/language-analysis.md).
[PRODUCT-WORK.md](PRODUCT-WORK.md) registra requisitos pendientes y evidencia;
[ROADMAP.md](ROADMAP.md) reemplaza las fases históricas de SPEC §18.
[MULTI-HARNESS.md](MULTI-HARNESS.md) describe los cinco adaptadores. Las entradas
O1–O73 y las mediciones originales de este documento son un registro histórico;
no demuestran por sí solas garantías, rendimiento o compatibilidad actuales.
La [referencia de comandos](CLI.md), el [inventario de packs](packs.md) y las
[guías de funciones](README.md) describen el contrato del código actual.

**Límites actuales:** la evaluación previa depende de reconstruir una escritura
de un tool soportado. El guard de shell es heurístico; escrituras dinámicas pueden
llegar al chequeo Stop, y algunos harnesses no muestran todas sus advertencias.
La auditoría enumera deuda estática y cobertura pendiente; no certifica calidad
total ni comportamiento runtime. Los catálogos de invariantes en prosa no son
checks ejecutables. La validación automatizada de protocolos no sustituye pruebas
de interacción humana en cada harness o ejecución nativa de cada plataforma.

El audit incremental es opt-in: `audit-command.ts` conserva la validación completa
del contrato, cobertura y fitness; `audit-cache.ts` guarda resultados estáticos
por archivo y checkpoints atómicos. El fingerprint del evaluador se fija al
compilar, con fuentes, schemas, parsers ejecutables y versión de Bun. Para
reutilizar se verifican contenido e inputs de dependencias/configuración, incluso
archivos ausentes. Hooks y `check` no leen esa caché. Ver
[presupuestos, invalidación y recuperación](features/whole-project-audit.md#incremental-audits-and-checkpoint-resume).

Al alcanzar el límite de Stop o reingresar con una causa que requiere reparación
humana, el turno puede terminar sin aprobar el cumplimiento. El evento conserva
`stopIncomplete`, causa, aviso y findings de la raíz seleccionada. `pregate report`
destaca esas terminaciones; su JSON conserva todas las ubicaciones registradas
aunque el harness descarte el aviso. Son observaciones históricas: después de
reparar, ejecutar `pregate check --all` y consultar la cobertura de `audit`. Ver la
[matriz de canales y límites de shell](features/harness-and-shell-guarantees.md).

El feedback humano local etiqueta observaciones individuales y requiere revisión
con digest. El reporte distingue casos juzgados, inciertos y sin etiqueta; su
precisión revisada describe sólo esa muestra seleccionada, no calidad general,
recall ni reparaciones ejecutadas. Ver [human feedback](features/human-feedback.md).

La [retención local](features/local-storage.md) permite inspeccionar sesiones y
preparar una limpieza de copias antiguas con revisión por digest. Conserva todos
los snapshots, eventos y contadores, y las referencias de código compartidas o
más recientes. Leases de escritores y marcadores exclusivos coordinan la
publicación de blobs y la limpieza. La recuperación por digest retira sólo
marcadores con dueño único registrados en esta máquina cuyo PID el sistema
confirma ausente; conserva casos vivos, ambiguos, inaccesibles o sin un host
coincidente y no toca snapshots ni contadores. El almacenamiento compartido entre
máquinas no está certificado. No hay
expiración automática de sesiones.

**Fuentes de verdad.** `docs/SPEC.md` v2.1 (§4, 5, 6, 8, 9, 10, 11, 13, 14, 18, Apéndice B) y `docs/inputs/decisiones-usuario.md` (D1–D17). Si este documento contradice la SPEC, lo marca con **[Δ]** y lo lista en §7.2 para tu OK.

**Mediciones.**
- Las cifras del parser, del arranque y de git vienen de las propuestas: macOS arm64, Bun 1.3.14, Node 26.8, p50 de 25 arranques en frío de `bun build --compile --minify --bytecode`.
- El prototipo del launcher con watchdog (captura con `$(...)` y `wait`) se midió en bash 3.2 (`/bin/sh` de macOS) y dash, 60 corridas, con payload de 20 KB.
  - Agrega entre +0,8 y +1,3 ms de p50 respecto de un `exec` directo.
  - Un motor colgado se corta a los 2,03 s.
  - SIGKILL y exit 1 se convierten en deny con exit 2.
  - W0 le aplica los cambios de §4.0 (plazo con `trap … USR1`, stdout a archivo, `$# = 0`); e2e vuelve a medirlo.
- Un error no atrapado en un binario Bun sale con código 1 (comprobado con `throw`, promesa rechazada y error async). El launcher lo convierte en deny (A6).

---

## Decisiones de arquitectura

| # | Decisión | Alternativa descartada | Por qué |
|---|---|---|---|
| A1 | **One `bun build --compile --bytecode` binary per platform, plus a global POSIX launcher** (MH-18/28) | Node + bundle; Rust | Zero runtime dependencies (D17); Rust remains conditional on latency (D15.7, §13.3) |
| A2 | **Parser: web-tree-sitter (WASM) + gramáticas TS/TSX vendorizadas** (3,2 MB embebidos; la gramática lleva el parche de O18, registrado en ORIGIN y limitado a lo que el piloto necesitó) | API de TypeScript 6.0.3 (+32 MB, congelada); Babel; escáner propio; `.node` nativos | Es la única opción que cumple a la vez U6/§13.3 (tree-sitter), D17 (cero dependencias, sin nativos) y el formato de reglas del pack piloto. Su modo de falla conocido es un falso **deny**, la dirección segura (§5.3) |
| A3 | **Motor de patrones propio** (subconjunto de reglas de ast-grep sobre nodos tree-sitter) con **oráculo diferencial** contra `@ast-grep/napi`, solo en dev | `@ast-grep/napi` en runtime | Un `.node` embebido cuesta 295 ms por llamada; puesto al lado del binario rompe "binario único". El oráculo vigila la deriva semántica, que es el riesgo principal |
| A4 | **Reglas en el dialecto ast-grep sobre los *kinds* de tree-sitter** | Dialecto sobre `ts.SyntaxKind`; sin patrones | El pack `amarilla/` corre como datos sin portarlo, las reglas sobreviven a la migración a `ast-grep-core` (§13.3) y §18.1 exige patrones en las fuentes `path` |
| A5 | **Watchdog duro en el launcher** (proceso padre: al vencer, `kill -9` al motor y la salida fail-closed del evento, aunque el motor no haya muerto) | Worker con `terminate()`; watchdog cooperativo (`expired()`, `progressCallback`); fuel por regla | Lo cooperativo no corta un regex catastrófico ni un bucle síncrono, y Claude Code falla abierto al llegar a su timeout. El padre responde ante cualquier cosa (CPU, syscall bloqueada, fs colgado en estado D), cuesta ~1 ms (medido) y elimina `expired()` y el fuel de todas las firmas del núcleo. El Worker requería un segundo entrypoint y reinicializar el WASM |
| A6 | **El launcher supervisa sin `exec`**: si el motor falta o termina con un `rc ∉ {0,2}`, el launcher emite la salida fail-closed del evento. Es la **única** implementación del fail-closed ante fallas no previstas: el motor no atrapa excepciones, sale con 1 | `exec` del motor; además `uncaughtException` → `failClosed` en TS | Cierra el riesgo residual de §13.6 (abort, OOM, SIGKILL, crash), que con `exec` terminaba en fail-open. Un segundo texto fail-closed en TS sería un contrato duplicado que puede divergir |
| A9 | **A stale or altered hook lock denies and halts. Admission recompiles policy in memory and compares the complete lock bytes after CRLF normalization.** | Trusting only the lock's metadata hashes; silently replacing the disk lock | `gate.lockOf` uses the same compiler as CLI/commit/CI, without running fixtures or writing a replacement. Hashes alone do not bind effective rules, scope, enforcement or failure policies. Explicit contract activation still requires human approval. This supersedes the earlier hash-only hot-path design; its compilation cost is part of the hook latency budget. |
| A10 | **Pre-commit y CI recompilan desde cero y comparan el lock byte a byte** | Confiar en los hashes del lock | Detecta un lock editado a mano o corrupto, no solo uno viejo |
| A11 | **Estado append-only: un archivo inmutable por llamada, con las claves de filtrado en el nombre** | Archivo de contadores (read-modify-write); leer todos los eventos | Los PreToolUse corren en paralelo (§11.3). El tope por turno sale de un `readdir`, sin leer contenidos, y solo se leen los eventos del mismo (agente, archivo) |
| A12 | **El análisis del "antes" se recalcula en cada llamada; solo su texto se guarda** (una vez por sesión y archivo, con `link`) | Caché del análisis por `sha(rel, sha(texto), lockHash)` | `analyze` lee otros archivos (barrels, tsconfig) que no entran en esa clave: un barrel que cambia deja el "antes" viejo y el conteo puede compensar una violación nueva (falso allow, y veredicto dependiente del orden). Recalcular cuesta ~4 ms en 300 líneas y ~25 ms en 2.000, dentro del p95. Lo caro es el spawn de git (~20 ms), y eso sí se evita guardando el texto. Se reevalúa solo si `bench.ts` mide un p95 > 150 ms en la máquina de referencia (O31) |
| A13 | **JSON Schema (6 archivos) como fuente de la validación + intérprete del subconjunto (~90 líneas)** | ajv; combinadores que infieren tipos y emiten schemas | Los schemas son datos del producto que el editor consume con `$schema` (§6.1). El intérprete es más chico que un generador. `schema.test.ts` falla ante una keyword no soportada |
| A14 | **`Decision.verdict: "none" \| "deny" \| "ask"` y `Emission.exit: 0 \| 2`** | `verdict: "allow"`; exit libre | "allow" y exit 1 son irrepresentables. `claude.test.ts` verifica que la cadena `"allow"` nunca sale |
| A15 | **`Cause` cerrada + `FIXABLE_BY: Record<Cause, "agent" \| "human">`** | Causa como string libre | Decide de forma total si un deny es de forma (no consume el contador de (archivo, regla), pero cuenta para el tope por turno, §4.1 paso 14) o necesita al humano (deny + halt) |
| A16 | **`pre-edit.changes[]`**, each `{session, callId, tool, path, edit, from}`; `gate.onPreEdit(changes)` evaluates the whole call | Speculative batch metadata or before/after on the wire | MH-07–13: full, append, ranged old/new, exact Codex hunks, delete and move. Other files in the call overlay `Read`; one deny blocks the call |
| A17 | **Pure adapters in `src/harness/`**, constants per module; `HARNESSES` and `profile` in `harness/profile.ts` | `profile.json` + interpreter | MH-01/03: Grok needs `GROK_HOOK_EVENT` plus top-level `hookEventName`; Cursor needs top-level `cursor_version`; otherwise use the registration flag. `main` and `doctor` share the map |
| A18 | **D23: English first** for all product text, code and catalog metadata | Optional future localization | Humans and agents receive English with standard technical terms. Historical inputs and long design docs are translated separately before publication. |
| A19 | **Ventana de error contra el "antes" de cada cara** y nodos ERROR que *intersecan* la ventana ⇒ deny de forma | Denegar cualquier error de sintaxis del archivo | La SPEC pide "en el rango cambiado" (§4.4). Lo que queda fuera de la ventana es byte a byte igual a un estado ya evaluado o a la base, así que no puede esconder nada introducido (§4.1, nota) |
| A20 | **Accept a root tracked in HEAD, registered by SessionStart, or whose preset ctime predates the session's first snapshot** | Requiring SessionStart for every uncommitted preset | MH-33: agy and new subagent sessions have no SessionStart. A nested preset created after first contact stays unaccepted |
| A21 | **Macro `@layers[:kind]` en `params.paths`** **[Δ, agregado al formato]**. `@layers` sin capas declaradas ⇒ `[]` (la regla no aplica a nada); `@layers:<kind>` sin capas de ese tipo ⇒ error de compilación | Duplicar globs de capas en cada preset | EVA-DYN-001 ("en una capa") es de integridad y siempre está activa. Sin el macro, sus `paths` por defecto quedarían vacíos y habría un agujero de integridad. Si `@layers` vacío fuera error, ningún preset sin capas (`legacy-safe`) compilaría |
| A22 | **Sin `enforcement: "advise"` ni `loop.escalate: "ask"`** | Implementarlos | §18.1 pide `shadow` explícito y escalamiento `stop` (D15.5). `ask` existe solo como severidad (TDD-DEL-001) |
| A23 | **`Bun.Transpiler.scanImports` no se usa** | Usarlo para imports | Omite en silencio `import(m)`, `require(m)` no literal e `import type` (verificado), lo que sería un falso allow. Además serían dos parsers que pueden discrepar |
| A24 | **Un solo `git cat-file --batch`** para todos los blobs en pre-commit, Stop y CI | Un `git show` por archivo | Un spawn de 17–24 ms por archivo no escala |
| A25 | **vendor/ = artefactos tomados sin modificar (salvo `grammar.patch`, O18), con LICENSE, ORIGIN (paquete@versión, URL, sha256) y THIRD_PARTY_NOTICES**; `vendor.test.ts` verifica todo | Dependencia npm en `dependencies` | D17: no se acopla al paquete y se conserva la atribución. Es lo más parecido a un cherry-pick que admite un runtime WASM |
| A26 | **Comparación de rutas sin distinguir mayúsculas en todas partes**: protegidas, scope, capas y `paths`/`exclude` de reglas, en hook, pre-commit y CI, con una sola función (`paths.matches`) | Case-fold solo para protegidas y solo en volúmenes que no distinguen (sondeo del volumen) | Es un superconjunto de "donde corresponde" (SPEC §6.7), elimina el sondeo y el parámetro `caseFold`, y da el mismo veredicto en macOS y en CI Linux. `Bun.Glob` distingue mayúsculas (verificado), así que se pasan glob y ruta a minúsculas |
| A27 | **Git es requisito**: sin repo git, deny + halt `git-failed` "PREGATE requires git" **[Δ §9]** | "Primer contacto" sin git, con aviso | Pre-commit y CI exigen git igual; un segundo camino sin git sería código para un caso que la garantía (U10) no cubre |

A7 (fuel por regla) y A8 (un proceso hijo por check en `rules test`) se eliminaron: repetían lo que ya hace el watchdog (A5), agregaban falsos deny y su "determinismo" no existía (el plazo del hook igual depende de la máquina). Los números no se reutilizan.

---

## 1. Principios

1. **El veredicto es una función pura:** `(lock, antes, después) → violaciones introducidas`. Hook, pre-check, pre-commit, CI y `rules test` llaman a la misma `analyze` + `introduced`. Solo cambia de dónde sale el "antes": la snapshot de sesión, HEAD o la base.
2. **Lo que no se puede establecer se deniega, y la garantía vive fuera del código que puede fallar.**
   - Dentro del motor, toda causa conocida es una `Cause` que pasa por `decide → encode`. No hay `try/catch` de último recurso: lo imprevisto sale con exit 1.
   - Fuera del motor, el launcher padre convierte cualquier muerte, cuelgue o exit ∉ {0,2} en el deny del evento (A6).
3. **El lock es el único contrato al evaluar.** El hook no compila. Verifica hashes y versiones, y evalúa. Compilar y probar fuentes es un acto humano por CLI (U4, U10).
4. **Las reglas son datos sobre un vocabulario cerrado:** cinco primitivas y un lenguaje de patrones (el subconjunto de ast-grep sobre los *kinds* de tree-sitter). Una clave, un `kind`, un `field` o un regex desconocido es error de compilación, nunca "no matchea".
5. **Un parser, un árbol.** tree-sitter sirve para el archivo, los patrones, los imports y la detección de errores. No hay un segundo oráculo que pueda discrepar en runtime.
6. **Núcleo funcional, cáscara imperativa.**
   - Los módulos puros no importan `fs` ni procesos, y no leen reloj ni entorno. Reciben `Read` o `Files`.
   - Harness signals: `CLAUDE_CODE_REMOTE` controls Claude interactivity; only `GROK_HOOK_EVENT` plus the payload selects Grok. The shell reads `HOME`, `XDG_STATE_HOME`, `CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR` and project-directory hints for state and machine protection. `XDG_DATA_HOME` is used by machine setup, never to locate a running engine: `<DATA>` comes from `process.execPath` (MH-18).
   - El pack opcional Functional Core comprueba `FCIS-DEP-001` (dirección declarada), `FCIS-IO-001` (imports de I/O) y `FCIS-IO-002` (reloj/entorno/azar). La verificación del propio repositorio está en [repository-dependency-verification](research/repository-dependency-verification.md). El preset actual no activa `CA-DEP-001`. Shell obtiene la versión desde `package.json` en `versions.ts`; core no depende del archivo de build.
   - `assets.setUpGrammars` carga e inicializa el runtime vendorizado en shell. `ts.setGrammars` recibe solo `Parser`, `Language` y el loader de bytes; la caché de cada gramática se construye al primer uso y se invalida al reemplazar el colaborador. El loader suministrado por shell es una dependencia explícita, no una garantía de pureza de cualquier callback.
7. **Cero dependencias de runtime, y se paga solo por lo que la llamada necesita.**
   - El WASM se inicializa solo si hay que parsear, y solo con la gramática del archivo.
   - El texto del "antes" se pide a git una sola vez por sesión y archivo (A12).
   - Fuera de scope y shell no cargan el parser.
8. **Una abstracción existe solo si tiene dos usos reales en el MVP** (D16). Por eso existe `Files` (disco y fixtures en memoria) y no existen `LanguagePack` ni `profile.json`. El mapa `HARNESSES` de `src/harness/profile.ts` existe porque tiene dos usos: `main` (qué adaptador decodifica) y `doctor` (cada `VERIFIED`).

---

## 2. Árbol de archivos completo del MVP

```
pregate/
├─ package.json                 versión (= ENGINE); scripts build/test/typecheck/bench; "dependencies": {} ;
│                               devDependencies exactas: typescript (typecheck), @types/bun, @ast-grep/napi (oráculo)
├─ bun.lock                     integridad de las devDependencies
├─ .bun-version                 1.3.14
├─ tsconfig.json                strict, noUncheckedIndexedAccess, noEmit
├─ bunfig.toml                  [test] root = "test": `bun test` no entra en las fixtures `*.test.ts` del piloto
├─ LICENSE                    **[Δ ola 3] pendiente (decisión del usuario, SPEC P19)**: sin él `build.ts` avisa y el tar sale sin él (O28)
├─ THIRD_PARTY_NOTICES          web-tree-sitter, tree-sitter-typescript, runtime de Bun (MIT) + nota LGPL de
│                               JavaScriptCore (a verificar antes del primer release); va en cada tar de release
├─ README.md                    instalación, contrato y límites honestos (hook + pre-commit + CI)
├─ .github/workflows/ci.yml     typecheck · bun test · build 2 targets · e2e · dogfooding;
│                               job aparte: bench (no rompe la suite por ruido)
├─ .gitignore                   node_modules · dist · `*.bun-build` (bun 1.3.14 deja una copia de ~63 MB por `--compile`)
├─ .claude/settings.json        dogfooding: hooks escritos por `pregate install` **[Δ ola 3] pendiente (requiere el visto del usuario)**
├─ .pregate/                     dogfooding: preset.json (fijado en W0), pregate.lock.json (ola 3); bin/pregate y git-hooks/pre-commit pendientes
├─ vendor/
│  ├─ web-tree-sitter/          web-tree-sitter.js, web-tree-sitter.wasm, LICENSE, ORIGIN
│  └─ tree-sitter-typescript/   tree-sitter-typescript.wasm, tree-sitter-tsx.wasm (parcheadas, O18), grammar.patch,
│                               LICENSE, ORIGIN (base, cada cambio con su fuente, toolchain, sha256 reproducible)
├─ schema/                      preset.v1 · check.v1 · methodology.v1 · fixture.v1 · source.v1 · request.v1 (.json)
├─ catalog/                     fuente `core`, embebida por macro (las fixtures no van al binario)
│  ├─ source.json
│  ├─ checks/<área>/<check>/check.json + fixtures/{pass,fail,trap}/<caso>/{fixture.json, files/, before/}  (17)
│  ├─ methodologies/            clean-code · clean-architecture · ddd-tactical · functional-core-imperative-shell
│  │                            · tdd · pregate-integrity (.json)
│  └─ presets/                  backend-clean-ddd · functional-ts · legacy-safe (.json)
├─ assets/                      embebidos; `install` los escribe en el repo
│  ├─ launcher.sh               supervisa el motor: plazo duro, exit 3 ⇒ motor fijado, rc ∉ {0,2} ⇒ salida fail-closed del evento
│  ├─ pre-commit.sh             global pregate check --staged --ratchet
│  └─ ci-github.yml             timeout-minutes; descarga el motor fijado (verifica sha256);
│                               pregate rules test (fuentes path) + pregate check --ratchet --base <sha>
├─ src/
│  ├─ main.ts        cáscara · argv → hook <evento> | hook auto | CLI (sin try/catch de último recurso: A6)
│  ├─ types.ts       puro    · vocabulario compartido (datos planos) + FIXABLE_BY
│  ├─ harness/       puro    · [MH-W0] un adaptador por harness (claude, codex, cursor, grok, agy): payload → HookEvent | Rejected; Decision → Emission
│  │                         · wire.ts (parse, claves cerradas, rutas absolutas) y profile.ts (HARNESSES, profile: MH-03)
│  ├─ gate.ts        cáscara · orquesta session-start / pre-edit / pre-command / stop y `check`
│  ├─ reconstruct.ts puro    · Write/Edit + disco → after + reconstruction; BOM/CRLF; ventana cambiada
│  ├─ paths.ts       puro    · protecciones fijas + fuentes path, scope, capa, lenguaje; una comparación sin mayúsculas (A26)
│  ├─ ts.ts          puro    · tree-sitter: parse, errorIn(ventana), hechos (funciones, clases, imports), símbolo, astHash
│  ├─ match.ts       puro    · motor de patrones (subconjunto ast-grep)
│  ├─ resolve.ts     puro    · imports: relativos, tsconfig paths/baseUrl/extends, re-exports ≤ 3 saltos (más ⇒ "too-deep")
│  ├─ evaluate.ts    puro    · analyze(): reglas del lock sobre un estado de archivo; placement() sin parsear
│  ├─ ratchet.ts     puro    · introduced(): no-new (símbolos nuevos + conteo) y diff
│  ├─ decide.ts      puro    · severidad × enforcement × contadores × sin-progreso × ask → Decision; blocking() para check
│  ├─ message.ts     puro    · línea ≤ 256, detalle ≤ 4.000, sanitización, textos al humano (es); único que renderiza
│  ├─ shell.ts       puro    · guard de shell: lexer permisivo POSIX/PowerShell + reglas de §10.2.3
│  ├─ schema.ts      puro    · intérprete del subconjunto de JSON Schema
│  ├─ compile.ts     puro    · preset + fuentes → Lock; frescura (versiones, preset, catálogo builtin); sourcesHash; fixtureLock; JSON-patch de solicitudes
│  ├─ fixtures.ts    puro    · rules test de un check: pass/fail/trap, determinismo, mínimos, IDs
│  ├─ assets.ts      cáscara · bytes embebidos: catalog/ (BUILTIN) y assets/* (ASSETS) por macro (vía embedded.ts), WASM (with {type:"file"})
│  ├─ embedded.ts    cáscara · catálogo, assets, demo y huella del evaluador por macro; como library-assets.ts, se carga con `require` porque Bun 1.4 omite la macro si un grafo estático alcanza el módulo dos veces
│  ├─ wasm.d.ts      tipos de los imports `.wasm` (O13; evita una supresión)
│  ├─ disk.ts        cáscara · canonical (lstat + realpath del ancestro), raíz, readTree, escritura atómica (tmp+rename, link)
│  ├─ state.ts       cáscara · directorio de datos: snapshot, texto del "antes", eventos, blobs, raíces de la sesión
│  ├─ git.ts         cáscara · spawn de git: HEAD, status -z, cat-file --batch, diff --name-only, ls-files, índice
│  ├─ cli.ts         cáscara · check · explain · preset show|compile|apply · rules test · install
│  └─ install.ts     cáscara · motor versionado, launcher, fusión idempotente de .claude/settings.json, pre-commit, CI
├─ scripts/
│  ├─ build.ts       rules test catalog (aborta si falla) → bun build --compile por target → tar + sha256
│  ├─ bench.ts       p50/p95 por ruta sobre test/demo-repo con el binario de release (compileBinary de build.ts)
│  └─ demo.sh        UC1/UC2 de punta a punta: dos presets, mismos Write, veredictos opuestos (POSIX; sh y dash)
├─ eval/                        evaluación del MVP (W10, fuera del binario): tareas, brazos A/B/D/E, métricas desde state/
└─ test/
   ├─ reconstruct · paths · shell · resolve · match · decide · message · schema · compile · state · ts · ratchet (.test.ts)
   ├─ catalog.test.ts   claude.test.ts   e2e.test.ts   vendor.test.ts
   ├─ payloads/         payloads reales de Claude Code + salida esperada (contrato; cierra cada "a verificar")
   ├─ presets/          presets inválidos con su error exacto
   └─ demo-repo/        repo fixture: src/{domain,application,infra}, presets backend-clean-ddd y functional-ts
```

Son **23 módulos** en `src` (más `wasm.d.ts`). Estimado: ~3.000 líneas. **Medido tras la ola 3: 4.718**; los más largos son `shell.ts` (603), `gate.ts` (546), `match.ts` (494, paridad con ast-grep) y `compile.ts` (465).

**Dogfooding.** Puros (capa `core`): `types`, `claude`, `reconstruct`, `paths`, `ts`, `match`, `resolve`, `evaluate`, `ratchet`, `decide`, `message`, `shell`, `schema`, `compile` y `fixtures`. Cáscara: `main`, `gate`, `assets`, `disk`, `state`, `git`, `cli` e `install`. La cáscara importa al núcleo y nunca al revés.

---

## 3. Tipos centrales (`src/types.ts`)

```ts
export type Severity = "deny" | "ask" | "warn";
export type Phase = "pre" | "stop" | "commit" | "ci";
export type Grammar = "typescript" | "tsx";       // .ts .mts .cts → typescript; .tsx .js .mjs .cjs .jsx → tsx [Δ]
export type Read = (rel: string) => string | null;              // relativa a la raíz; null = no existe
export type Files = Record<string, string>;                     // fuentes y fixtures en memoria
export type Reconstruction = "exact" | "tool-will-fail" | "unknown";
export type Clock = () => number;                               // ms monotónicos; lo inyecta la cáscara (O27)
export interface Host { read: Read; now: Clock }                // lo que analyze consulta además del archivo que juzga (O29)

// ── Causas de un deny que no es por violación de regla (lista cerrada) ─────────
export type Cause =
  // el agente puede corregirlo ⇒ deny de forma: no consume el contador de (archivo, regla)
  | "protected-path" | "request-invalid" | "tool-will-fail" | "cannot-reconstruct"
  | "syntax" | "unresolvable-import" | "shell-write" | "shell-admin" | "hook-switch"   // hook-switch: MH-17
  // solo el humano puede corregirlo ⇒ deny + halt + notice
  | "payload-unrecognized" | "lock-stale" | "version-mismatch"
  | "snapshot-missing" | "state-io" | "git-failed" | "regex-limit";
export const FIXABLE_BY = {
  "protected-path": "agent", "request-invalid": "agent", "tool-will-fail": "agent",
  "cannot-reconstruct": "agent", "syntax": "agent", "unresolvable-import": "agent",
  "shell-write": "agent", "shell-admin": "agent", "hook-switch": "agent",
  "payload-unrecognized": "human", "lock-stale": "human", "version-mismatch": "human",
  "snapshot-missing": "human", "state-io": "human", "git-failed": "human", "regex-limit": "human",
} as const satisfies Record<Cause, "agent" | "human">;
// "lock-stale" cubre lock ausente, inválido o viejo, fuentes que no verifican y preset desaparecido: mismo remedio.
// "regex-limit": el regex de una regla pudo abandonar sobre este archivo; su "no coincide" no es respuesta (O27).
// "timeout" y "engine-crash" no son Cause: los emite el launcher (texto literal en launcher.sh, A6).

// ── Entrada normalizada (agnóstica de harness) ─────────────────────────────────
// [MULTI-HARNESS MH-W0] A16 extendido por MH-07: varios cambios por llamada, Move, formas de agy y Codex.
export type HarnessId = "claude-code" | "codex" | "cursor" | "grok" | "agy";
export type HookKind = "pre" | "stop" | "session-start";       // lo que nombra un registro: hook <kind> --harness <id>
export interface HookEnv { grokEvent: string | null; projectDir: string | null; remote: boolean }
export interface Session {
  id: string;                      // el id propio del harness; el estado lo indexa junto con `harness` (MH-05)
  harness: HarnessId;
  agentId: string | null;
  turnId: string | null;           // si falta, el turno se deriva del último Stop registrado
  interactive: boolean;            // solo Claude Code: modo ∈ {default, acceptEdits, auto, plan}
}                                  //   ∧ sin agentId ∧ CLAUDE_CODE_REMOTE ≠ "true"; si no se sabe ⇒ false
export interface ProposedChange {  // lo produce un adaptador y lo consume gate.onPreEdit (A16, MH-07)
  session: Session; callId: string; tool: string;
  path: string;                    // absoluto, sin segmentos . .. ni // (si no, el adaptador rechaza la llamada)
  edit: Edit;
  from: string | null;             // origen de un Move, que lleva su propio cambio { form: "delete" }
}
export interface ProposedCommand { session: Session; callId: string; tool: string; command: string; cwd: string }
export type HookEvent =
  | { kind: "session-start"; session: Session; cwd: string }
  | { kind: "pre-edit"; changes: ProposedChange[] }           // ≥ 1, de una sola llamada
  | { kind: "pre-command"; command: ProposedCommand }
  | { kind: "stop"; session: Session; cwd: string; reentry: boolean };
export interface Rejected { cause: Cause; kind: HookEvent["kind"]; reentry: boolean; session: Session | null; dirs: string[] }   // MH-06
export type Edit =
  | { form: "full"; content: string }
  | { form: "append"; text: string }
  | { form: "oldnew"; old: string; neu: string; all: boolean; lines: [number, number] | null }   // lines: 1-based, inclusivo
  | { form: "hunks"; hunks: Hunk[] }
  | { form: "delete" }
  | { form: "unknown"; cause: string };
export interface Hunk { anchor: string | null; old: string[]; neu: string[]; eof: boolean }

// ── Salida ───────────────────────────────────────────────────────────────────────
export interface Violation {       // solo datos: el texto lo arma message.ts desde lock.rules[].text
  rule: string;                    // FQN del alias ganador, p. ej. "core/CC-FN-001"
  path: string; line: number;      // relativa a la raíz; 1-based
  symbol: string;                  // "Invoice.calculateTotals" | "<module>" (sin sanitizar; lo sanitiza message.ts)
  measured: number | null; limit: number | null; atSessionStart: number | null;
  severity: Severity;
}
export interface Decision {
  verdict: "none" | "deny" | "ask"; // "none" = sin objeción; no existe "allow"
  halt: boolean;
  cause: Cause | null;             // null ⇔ el deny/ask es por violaciones
  violations: Violation[];         // introducidas y que causan el veredicto
  warnings: Violation[];           // warn introducidos → additionalContext
  attempt: number;                 // intento n sobre (agente, archivo, regla)
  compact: string; full: string;   // ≤ 256 / ≤ 4.000
  notice: string | null;           // al humano: systemMessage / stopReason
  lockHash: string | null;
}
export interface Emission { stdout: string; stderr: string; exit: 0 | 2 }   // exit 1 irrepresentable
export interface DecideInput {
  lock: Lock | null;               // null solo con una causa human
  session: Session; event: HookEvent["kind"]; path: string | null;
  introduced: Violation[]; form: Form | null; protectedPath: boolean;
  history: CallEvent[];            // del mismo (agente, archivo), ordenado por `at`
  turnDenials: number;             // del mismo agente en el turno, incluidos los deny de forma
  astHash: string | null;
  stop: { blocks: number; reentry: boolean; approved: Violation[] } | null;   // approved: ask ya aprobados (§4.3)
}

// ── Lenguaje de patrones: subconjunto cerrado de reglas de ast-grep ─────────────────
export interface MatchRule {
  pattern?: string; kind?: string; regex?: string; matches?: string;
  nthChild?: number | { position: number; reverse?: boolean; ofRule?: MatchRule };
  has?: Relation; inside?: Relation; follows?: Relation; precedes?: Relation;
  all?: MatchRule[]; any?: MatchRule[]; not?: MatchRule;
}
export interface Relation extends MatchRule { field?: string; stopBy?: "neighbor" | "end" | MatchRule }
export interface PatternConfig {   // claves "x-*" se ignoran (notas); cualquier otra desconocida ⇒ error
  id: string; rule: MatchRule;
  constraints?: Record<string, MatchRule>; utils?: Record<string, MatchRule>;
  files?: string[]; ignores?: string[];  // aceptados en el formato; compile los vuelca a params.paths/exclude
}

export type Placement = "new-in-exclude" | "edit-generated-or-excluded" | "no-language-pack-in-layer";
export type Impl =
  | { kind: "pattern"; patterns: { typescript: PatternConfig[] } }
  | { kind: "primitive"; primitive: "metric"; metric: "fn.lines" | "fn.params" | "class.publicMethods" }
  | { kind: "primitive"; primitive: "banned-import" }                       // params.packages
  | { kind: "primitive"; primitive: "layer-edge" }                          // lock.layers
  | { kind: "primitive"; primitive: "diff"; op: "no-decrease" | "no-increase";
      count: "markers" | { pattern: PatternConfig } }                       // params.markers por substring, o conteo AST
  | { kind: "primitive"; primitive: "placement"; cases: Placement[] };

// ── Formatos de disco (los valida schema/*.json; el motor lee estos campos) ─────────
export interface Check {
  id: string; version: string; area: string;
  cardinality: "singleton" | "multi"; dimension: string; minSeverity: Severity | null;
  params: Record<string, unknown>;             // JSON Schema de parámetros
  impl: Impl; phase: Phase[]; feedback: { message: string };
}                                               // claves v1 (ir, measures, fingerprint…) aceptadas e ignoradas
export interface Alias {
  id: string; check: string; defaults: Record<string, unknown>; severity: Severity | "off";
  source: { work: string; locator: string; paraphrase: string };
  why: string; fixHint: string; avoid: string; examples?: { pass: string; fail: string };
}
export interface Manifest {
  id: string; version: string; status: "complete" | "preview";
  conflicts: { with: string; dimension: string; suggest: { use: string }; why: string }[];
  invariants: Alias[];
}
export interface Fixture {
  language: "typescript"; params: Record<string, unknown>;
  context?: { layers?: Record<string, Layer>; scope?: { include?: string[]; exclude?: string[] };
              generatedMarkers?: string[] };
  target: string; before: string | null;       // "before/" para diff y ratchet
  expect: { verdict: "pass" | "fail"; violations?: { line: number; measured?: number }[] };
  trap?: { family: string; origin: "real" | "corpus" | "forge"; discovered: string; note: string };
}

// ── Preset (subconjunto MVP de §8.3) y lock ────────────────────────────────────────
export interface Layer { paths: string[]; mayImport: string[]; kind: "core" | "port" | "adapter" | "main" }
export interface Loop {
  maxDenialsPerFileRule: number; maxDenialsPerTurn: number; noProgressLimit: number;
  maxStopBlocks: number; allowAsk: boolean; maxDetailedViolations: number;
}
export interface Preset {
  name: string; version: string; engine: string;
  sources: ({ ns: "core"; kind: "builtin"; version: string } | { ns: string; kind: "path"; path: string })[];
  methodologies: string[];
  scope?: { include?: string[]; exclude?: string[] }; generatedMarkers?: string[];
  enforcement?: "enforce" | "shadow";
  layers?: Record<string, Layer>;
  resolve?: Record<string, { use: string; params?: Record<string, unknown>; severity?: Severity; note?: string }>;
  overrides?: Record<string, Severity | "off" | { severity?: Severity | "off"; params?: Record<string, unknown>; note?: string }>;
  ratchet?: { mode: "strict" | "no-new" };
  loop?: Partial<Loop> & { escalate?: "stop" };   // D15.5: solo stop
  failMode?: "closed";                            // D15.6: solo closed (aceptado por compatibilidad)
  coexist?: { arkgate?: { ownedByArkgate: string[]; config?: string; note?: string } };
}
export interface LockRule {
  id: string;                      // FQN del alias ganador
  aliases: string[];               // todos los aliases que comparten la regla efectiva
  check: string;                   // "core/complexity/fn-max-lines@1.0.0"
  impl: Impl;
  params: Record<string, unknown>; // resueltos; `paths`/`exclude` con @layers expandido y files/ignores volcados
  severity: Severity; phases: Phase[];
  integrity: boolean;              // inmune a shadow; no admite off
  origin: Record<string, string>;  // "params.max" → "resolve.fn.size" | "overrides.CC-FN-001" | "alias"
  text: { message: string; why: string; fix: string; avoid: string | null; source: string };
}
export interface Lock {            // lockHash = sha256 de los bytes del archivo (el texto ya es JSON canónico)
  lockVersion: 1; engine: string; core: string;
  coreHash: string;                // Δ O41: sourcesHash del catálogo builtin con el que se compiló
  presetHash: string; sourcesHash: string;
  preset: { name: string; version: string; methodologies: string[] };
  enforcement: "enforce" | "shadow";
  scope: { include: string[]; exclude: string[] }; generatedMarkers: string[];
  layers: Record<string, Layer>;
  sourceDirs: string[];            // carpetas de fuentes path (se protegen además de las fijas, §4.1 paso 5)
  ratchet: "strict" | "no-new"; loop: Loop;
  ownedByArkgate: string[];        // listadas, nunca evaluadas
  rules: LockRule[];               // orden canónico por id
}

// ── Análisis y estado ───────────────────────────────────────────────────────────
export interface Analysis {        // un archivo en un estado
  symbols: string[]; violations: Violation[];
  counts: Record<string, number>;  // reglas diff: regla → conteo
  astHash: string | null;          // árbol normalizado sin comentarios ni trivia (sin progreso)
}
export type Form = { cause: Cause; line: number | null };   // análisis imposible ⇒ deny
export interface Snapshot {        // sessions/<sid>/<rootHash>/snapshot.json
  root: string;                    // ruta absoluta de la raíz (Stop la necesita)
  head: string | null;             // null = repo sin commits ⇒ todo archivo es nuevo
  start: boolean;                  // la creó SessionStart (acepta la raíz, A20)
  dirty: Record<string, string | null>;      // solo si start: rel → sha256 del blob | null (no existía);
}                                            //   si !start, {} ⇒ todo "antes" = HEAD (nunca blanquea)
export interface CallEvent {       // contenido del archivo de evento (para decide y para el etiquetado manual)
  at: number;                      // ms, lo pone la cáscara; history() ordena por at
  callId: string; turn: string; agentId: string | null; kind: HookEvent["kind"]; path: string | null;
  verdict: Decision["verdict"]; halted: boolean; form: Cause | null; shadowed: boolean;
  violations: Violation[];         // deny/ask introducidas (contadores, precisión, corrección en un intento)
  afterSha: string | null;         // con deny, ask o shadowed, `after` se copia a blobs/<afterSha>
  astHash: string | null;
}
// Nombre: <turnH>~<agentH>~<fileH>~<verdict>~<form:0|1>~<callIdH>.json   (H = sha256[:12]; agentH "-" = principal;
//         en Stop fileH = "stop" y callIdH = H(sid + at))
//   · tope por turno: readdir y conteo de <turnH>~<agentH>~*~deny~* (incluye los deny de forma)
//   · contadores, sin progreso y forma seguida: se leen solo los *~<agentH>~<fileH>~*
//   · bloqueos de Stop del turno: <turnH>~-~stop~deny~*
```

**Recortes respecto de §13.2:** sin `batchId`, `fromPath`, `change.kind: delete|move`, `tool.form` ni `before`/`after`/`reconstruction` en el tipo (A16), y sin `Violation.why/fix/text` (viven en el lock y los renderiza `message.ts`).

**Directorio de datos** (`${XDG_STATE_HOME:-$HOME/.local/state}/pregate/`, protegido):

```
sessions/<harness>:<sid>/
  events/<turnH>~<agentH>~<fileH>~<verdict>~<form>~<callIdH>.json    CallEvent (tmp + rename)
  blobs/<sha256>                    contenido: archivos sucios al iniciar y `after` de deny/ask/shadowed
  <rootHash>/snapshot.json          Snapshot. El directorio <rootHash>/ se crea completo en uno temporal y se
                                    mueve con rename (falla si ya existe): nunca hay <rootHash>/ sin snapshot
  <rootHash>/head/<H(rel)>.json     {text | null} de rel en snapshot.head; se escribe una vez con link (A12)
  <rootHash>/sources.json           {lockHash, ok}: verificación del sourcesHash (§4.1 paso 6)
```

Installation: `<DATA> = ${XDG_DATA_HOME:-$HOME/.local/share}/pregate` at setup. Engines: `<DATA>/<version>/pregate`; launcher: `<DATA>/bin/pregate`; CLI symlink: `~/.local/bin/pregate`. State: `<STATE> = ${XDG_STATE_HOME:-$HOME/.local/state}/pregate`, including `codex-trust.json`. Runtime derives `<DATA>` from its executable (MH-18).

---

## 4. Camino del hook paso a paso

### 4.0 El launcher (proceso padre)

`pregate setup` lo escribe desde `assets/launcher.sh` como `<DATA>/bin/pregate`, con la versión de su motor, y cada registro global hace `exec` de él a través del comando congelado de MULTI-HARNESS MH-22 (un guard inline que, con el launcher ausente o vacío, deniega Pre solo si hay un preset).

1. Resuelve el motor al lado de sí mismo: `<DATA>/<versión>/pregate`, con `<DATA>` = dos niveles arriba de `$0` (por el symlink `~/.local/bin/pregate`, uno de `readlink`). Nunca desde el entorno del momento (MH-18). Sus propios comandos corren con `PATH=/usr/bin:/bin`; el motor recibe el PATH original (MH-15).
2. Si hay argumentos y el primero no es `hook` (`check`, `explain`, `setup`, …), hace `exec` del motor, sin supervisión: `check` puede durar más de 5 s en pre-commit y su exit 1 es legítimo. Un motor ausente o vacío sale con 1 (vacío, correría como script vacío: exit 0).
3. Si es `hook <evento>`, o si no hay argumentos (`$# = 0` ⇒ `hook auto`, §13.7), supervisa:
   - Pre explícito lee stdin directamente. Solo si el motor devuelve exit 3 se extrae el replay que viene después de la línea de versión. Stop, SessionStart y auto conservan la copia inicial: Stop lee `stop_hook_active` y auto, `hook_event_name`. stdout y stderr siempre van a archivos (no a `$(...)`).
   - Plazo duro sin depender de `wait`: `trap … USR1`, y un temporizador en segundo plano hace `kill -USR1 $$` al vencer; el trap mata al motor con `kill -9` y emite la salida fail-closed. La señal atrapada interrumpe el `wait` del padre, así que la salida llega aunque el motor no muera (fs colgado en estado D). Plazos: Pre 5 s (O30), Stop 45 s, SessionStart 10 s. `TERM`/`HUP` (el harness canceló) también deniegan.
4. Protocolo (MULTI-HARNESS §10.1): `rc ∈ {0,2}` reenvía stdout y stderr y sale con `rc`, salvo un exit 2 con stderr en blanco, que Codex dejaría pasar. Exit 3 con primera línea `ENGINE_VERSION` en stdout corre `<DATA>/<v>/pregate` **una vez**, con el mismo stdin y dentro del mismo plazo (MH-19). Pre devuelve su stdin original después de esa línea; un replay ausente o sin comienzo de objeto JSON se rechaza. Una versión inválida, un motor ausente o un segundo exit 3 son fail-closed. Cualquier otra cosa (motor propio ausente o vacío, crash, SIGKILL/OOM, plazo vencido, exit 1) emite la **salida fail-closed del evento**, texto literal en el script:
   - **Pre**, igual en los cinco harnesses: exit 2, stdout vacío y una línea de stderr de ≤ 256 caracteres, "PREGATE could not evaluate: …; report it to the user" (MH-15).
   - **Stop**, solo en Claude Code (`--harness claude-code` sin `GROK_HOOK_EVENT` ni `CURSOR_VERSION`): `decision:"block"` + stderr, exit 2, si `stop_hook_active` no es `true`; si lo es, `systemMessage` y exit 0. En los demás, neutro.
   - **SessionStart**, solo en Claude Code: `systemMessage`, exit 0. En los demás, neutro.

**Verificado en esta síntesis** con el prototipo (bash 3.2 y dash): stdin de 400 KB pasa intacto, exit 0 y 2 se reenvían, SIGKILL y exit 1 dan deny con exit 2, y un bucle infinito se corta a los 2,03 s. Agrega entre 0,8 y 1,3 ms. El `trap … USR1` y el stdout a archivo se verifican el día 1 (§9.3 f).

**Riesgo residual que queda.** Que muera el propio `sh`, o que la máquina no tenga `/bin/sh`. Lo cubren Stop, pre-commit y CI (U10).

### 4.1 PreToolUse `Write | Edit`

Toda causa conocida pasa por `decide → encode`. Lo imprevisto sale con exit 1 y responde el launcher (A6).

| # | Paso | Presupuesto | Si falla |
|---|---|---|---|
| 0 | Launcher (§4.0) | ~1 ms (medido) | Salida fail-closed del evento |
| 1 | Arranque del motor (Bun + bytecode, sin WASM) | 14–16 ms (medido) | Crash ⇒ paso 0 |
| 2 | `profile(flag, raw, env)` → adapter `decode` → `HookEvent`, `Rejected` or `null`; edit keys are closed per adapter | < 1 ms | `Rejected` with no directories denies; otherwise neutral only when no directory or recorded session root reaches a preset (MH-06). `null` ignores Grok shutdown. Unknown reconstruction denies inside scope |
| 3 | Adapter tool dispatch constructs all `ProposedChange`s; unsupported edits become `unknown`. Empty old text creates a missing file (MH-13) | 0 | — |
| 4 | Canonicalize paths and locate the first accepted preset (A20/MH-33), including a move's origin | < 1 ms (+ git on first contact) | No root: machine protections only, no git, WASM or state. A recorded root whose preset disappeared gives `lock-stale`; an unaccepted nested root is skipped |
| 5 | `paths.protects`: machine configs, installation/state and `**/.pregate/**` always; `.git/**`, project harness configs and `path` rule sources inside a rooted session. Realpaths and case-insensitive matching (A26/MH-17/30). Valid `.pregate/requests/*.json` is the only rooted exception | < 0,5 ms | `protected-path` / `request-invalid` |
| 6 | Parse lock and check engine/core. Recompile the current preset with current builtin/path/library/cached Git sources and compare the complete compiler output with normalized disk lock bytes. No fixture execution or replacement write. Within a Pre edit call, each root's admitted lock is reused for its overlay and dependency reviews; the next hook admits it again. `state.sourcesOk` additionally checks source identity per lock/session. | Compilation and source reads are measured as part of the total hook budget; the earlier 1–2 ms hash-only estimate does not describe this implementation. | `lock-stale` or `version-mismatch` ⇒ deny + halt and request explicit `pregate preset compile` (A9). |
| 7 | `evaluate.placement(lock, phase, …)` sin parsear (solo reglas con esa fase): EVA-SCOPE-001 (archivo nuevo en `exclude`; lenguaje sin pack dentro de una capa) y EVA-GEN-002 (editar un archivo existente con marcador por substring o en `exclude`). Fuera de scope y sin placement ⇒ `none` | < 0,5 ms | Violación ⇒ deny por regla |
| 8 | `reconstruct.apply(current, edit)` | < 1 ms | `tool-will-fail` (deny de forma "re-read and resend"); `unknown` ⇒ `cannot-reconstruct` |
| 9 | Snapshot (sesión, raíz): existente, o creada en el primer contacto (`start: false`, `dirty: {}` ⇒ todo "antes" = HEAD). `before_sesión` = blob de `dirty`, o `head/<H(rel)>.json` (la primera vez, `git cat-file` de `snapshot.head`, guardado con `link`), o `null` si el archivo es nuevo en la sesión | 0 después del primer toque; ~20 ms en el primero | `<rootHash>/` sin `snapshot.json` ⇒ `snapshot-missing` (deny + halt). Git falla ⇒ `git-failed` |
| 10 | Init perezoso de WASM (solo la gramática del archivo) + `ts.parse(after)` + `ts.errorIn(parsed, ventana)`. **[Δ ola 3]** Ese `Parsed` es el que recibe `analyze(after)`: un solo parse del "después". La ventana se calcula por prefijo y sufijo comunes con `current`. Un nodo ERROR o MISSING que **interseca** la ventana ⇒ error | 7 ms + ~11 µs/línea | `syntax` con su línea (deny de forma) |
| 11 | `analyze(after)`: reglas con `phase ∋ pre`, filtradas por `paths`/`exclude`/lenguaje y sin `ownedByArkgate`. Patrones, métricas, imports + re-exports (≤ 3 saltos, ≤ 32 archivos leídos) | 1–10 ms | En una capa con `mayImport ≠ ["*"]`: import `unresolved`, re-exports `too-deep` o tsconfig `invalid` ⇒ `unresolvable-import` (deny de forma) **[Δ §4.4]** |
| 12 | `analyze(before_sesión)`, recalculado (A12), **[Δ ola 3]** bajo `comparedLock(lock, after)`: reglas diff, las que el "después" viola y las de imports; el resto no puede cambiar `introduced()` (`ratchet.test.ts` lo prueba sobre las fixtures del catálogo) | ~4 ms (300 líneas) / ~25 ms (2.000); menos con `comparedLock` | **[Δ ola 2]** Una forma en el "antes" cuenta como `before` ausente: todo `after` es nuevo (strict), que el agente puede corregir; un deny sobre texto que no puede cambiar no |
| 13 | `ratchet.introduced(lock, rel, before, after)` | < 1 ms | — |
| 14 | `decide()`: `readdir` de `events/` (tope por turno del agente, incluidos los deny de forma), lectura de los eventos del mismo (agente, archivo) ordenados por `at` para contadores, sin progreso (`astHash` repetido o conteo que no baja) y **3 deny de forma seguidos sobre el archivo ⇒ halt** **[Δ]**. `ask` solo si `session.interactive ∧ loop.allowAsk ∧ ruta no protegida`. En `shadow` se marca `shadowed` (`blocking`, §7.2 #3) | 1–3 ms | — |
| 15 | Escribir el `CallEvent` (tmp + rename; nombre con claves) y, con deny, ask o `shadowed`, `after` en `blobs/<afterSha>` | < 1 ms | `state-io` (deny + halt): sin estado no hay contadores |
| 16 | Selected adapter `encode`, one `writeSync` per channel. Five dialects: MULTI-HARNESS MH-14; no adapter emits `allow` | < 1 ms | — |

**Por qué un ERROR fuera de la ventana no puede esconder nada nuevo (A19).** Lo que está fuera de la ventana es byte a byte igual a `current`. `current` es, o bien el estado que dejó una llamada ya evaluada en esta sesión, o bien la base (snapshot o HEAD), o bien el resultado de un escape por shell, que Stop evalúa con la ventana contra `before_sesión`. Ese texto no aporta violaciones introducidas, y el ratchet lo descuenta. Si el texto nuevo queda dentro de un nodo ERROR que empieza afuera, ese nodo interseca la ventana y deniega.

**Totales medidos [Δ ola 3]** con `bun run bench` (30 corridas por ruta, binario de release detrás del launcher vía `sh -c`, sesión nueva por muestra; macOS arm64, carga ~2,2). Presupuestos: p95 ≤ 150 ms en toda ruta, p50 ≤ 25 ms en shell (§7.2 #5):

| Ruta | p50 | p95 |
|---|---|---|
| Fuera de scope | 22,2 ms | 23,7 ms |
| Shell | 22,3 ms | 24,0 ms |
| 300 líneas, primer toque | 60,5 ms | 63,9 ms |
| 300 líneas, segundo toque | 51,5 ms | 53,7 ms |
| 2.000 líneas, primer toque | 103,3 ms | 106,7 ms |
| 2.000 líneas, segundo toque | 93,9 ms | 96,0 ms |
| 2.000 líneas con deuda commiteada, primer toque | 117,8 ms | 123,9 ms |

El primer toque cuesta ~10 ms más que el segundo: el `git cat-file` de A12. Lo más caro que queda es `match.ts` (~24 ms en frío a 2.000 líneas: un recorrido del árbol por patrón).

**El presupuesto es de la máquina de referencia (O31).** Estos números y el p95 ≤ 150 ms son de la máquina de desarrollo de referencia (macOS arm64, M5 Pro, 18 núcleos). Una llamada usa unas 3,5 veces su tiempo real en CPU (la compilación JIT de JavaScriptCore corre en otros hilos y se repite en cada proceso), así que en una máquina con 2 núcleos el mismo binario tarda varias veces más: en `ubuntu-latest` (2 vCPU x64), 2.000 líneas con deuda da p95 469–844 ms según el runner. En CI el bench informa (§8). Esa cifra de 2 vCPU es anterior a la caché del lock compilado y no se volvió a medir en un runner de 2 núcleos.

**Caché del lock compilado.** El paso 6 recompila solo cuando no hay una entrada válida. La clave es el hash del lock normalizado, del preset, de cada pack que lee el compilador (builtin, library, `path` y git pinneado) y de esta build (`engine`, `core` y la huella del compilador). El archivo está en el directorio de estado, `locks/<sha256(raíz)>.json`. Si falta, está truncado o el digest no cierra, el hook recompila. El análisis de `before_sesión` se sigue recalculando en cada llamada (A12).

Medido con el binario real de `hook pre` sobre un fixture `backend-clean-ddd` más una regla `path`, sesión nueva por muestra, edición permitida de `src/domain/values/money.ts` (linux-x64, 4 vCPU, Bun 1.4.2). Antes de la caché, n=15: p50 72,6 ms, p95 100,9 ms. Con la caché, `bun test test/lock-cache.e2e.test.ts`, n=25:

| Pasada | p50 | p95 |
|---|---|---|
| Fría (la caché se borra; recompila) | 60,6 ms | 64,4 ms |
| Caliente (reutiliza el lock compilado) | 41,1 ms | 43,5 ms |

La decisión fría y la caliente son idénticas. Cambiar el lock o esa regla invalida la entrada y deniega `lock-stale`; una entrada corrupta se recompila y deja la misma decisión.

**Salida en Claude Code:**

| Veredicto | stdout / stderr / exit |
|---|---|
| `none` | vacío / — / 0 |
| `none` con `warnings` | `hookSpecificOutput.additionalContext` ("informational; no action required for this task") / — / 0 |
| `deny` | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":full}}` **[Δ ola 2: `full` entero; su primera línea es el compacto ≤ 256]**, más `"continue":false,"stopReason":notice` si hay `halt` / `full` / **2** |
| `ask` | `permissionDecision:"ask"`, `permissionDecisionReason` = notice (al humano), `additionalContext` = `full` / — / 0 |

`encode()` no tiene una rama "allow".

### 4.2 PreToolUse `Bash | PowerShell | Monitor`

Pasos 0–2 (en `tool_input` solo se lee `command`; las demás claves se ignoran, porque no cambian qué se ejecuta), la raíz desde `cwd` (4) y `state.ensureSnapshot(sid, raíz)`, para que Stop vea las raíces a las que se llega por `cd`. Las protecciones del paso 5 se aplican siempre; las carpetas de fuentes salen del lock o de `preset.json`, y sin lock válido todo lo que está bajo la raíz cuenta como en scope. Después corre `shell.guard(command, cwd, ctx)`. No carga el WASM.

**Lexer permisivo.** Lo que no reconoce (`$(…)`, `<(…)`, `[[ ]]`, bloques `{}` de PowerShell) queda como palabra opaca, y esa palabra igual se revisa contra rutas protegidas y patrones de escritura. Comillas sin cerrar no se deniegan: el shell falla y no escribe. `sh|bash -c '<literal>'` y `eval '<literal>'` se analizan de nuevo sobre el string interno; con un argumento no literal ⇒ `shell-write`. **[Δ olas 1–2] Pipe a intérprete:** un script que llega por pipe a un shell o intérprete (`… | bash`, `curl … | sh`, `cat s.py | python3`, `… | bash -s foo`) es texto desconocido ⇒ `shell-write`; un heredoc o here-string literal se re-analiza como un `-c` y uno no literal ⇒ `shell-write`; un script desde archivo (`bash f.sh`, `bash < f`) no se analiza (lo ve Stop). También cuentan como código inline `fish --command`, `npx -c`/`--call` y `pnpm -c`. Un solo parser de opciones GNU (`getopt`) sirve a todos los comandos (O21).

Outside every preset, only machine protections run: `hook-switch` blocks disabling PREGATE, editing global harness configs/installation/state, and setup/update/uninstall; no git, WASM or state writes. Other harness administration is restricted only inside a root. Codex relative shell write destinations and interactive shells are refused (MH-17/29).

**Deniega:**
- escritura a rutas en scope: redirecciones de salida (`>`, `>>`, `>|`, `&>`), `tee`, `sed -i`, `perl -pi`, el destino de `cp`/`mv`/`ln`/`install`, `dd of=`, `truncate`, `git apply|checkout --|restore`, `patch`, `curl -o`, `wget -O`, y `python|node|bun|perl -e/-c` que mencionen una ruta en scope;
- una escritura cuyo destino no es literal (`$VAR`, `$(…)`, comilla invertida, glob): no se puede establecer si está en scope ⇒ `shell-write`;
- cmdlets `Set-Content|Out-File|Add-Content|New-Item -Value|Copy-Item|Move-Item`;
- cualquier mención de una ruta protegida, salvo el pre-check permitido;
- subcomandos de `pregate` distintos de `check|explain|preset show|rules test`, por cualquier ruta;
- `--no-verify`, `core.hooksPath`, `disableAllHooks`, `claude plugin disable|uninstall` y `--settings`;
- binarios de otros harnesses;
- asignaciones de entorno inline (`VAR=… cmd`) que apagan hooks.

**Permite** reads and pre-check: `pregate` on PATH or `<DATA>/bin/pregate`, with `check --stdin`, `explain`, `preset show` or `rules test`. Input redirection and literal heredocs to these commands remain read-only (MH-29).

Los borrados (`rm`, `git reset --hard`, `git clean`, …) no se deniegan: la verdad es el árbol (SPEC §10.2.4) y los ve Stop. Un borrado de `.pregate/` lo atrapan el paso 4 (`lock-stale`) y pre-commit; uno de `sessions/<sid>/` hace que la snapshot nueva tome HEAD como base (paso 9).

**Costo:** ~20 ms de p50, contra el objetivo de ≤ 15 ms de §13.6 **[Δ: presupuesto de 25 ms]**. El piso de proceso de Bun medido es de 13,7 a 16 ms; si 15 ms es duro, es argumento para Rust en v1, no para un daemon.

### 4.3 Stop

El watchdog del launcher es de 45 s y el `timeout` del hook, de 60 s.

1. Por cada raíz de la sesión (`state.roots(sid)`: `snapshot.root` de cada `<rootHash>/`), los candidatos son `git diff --name-only <snapshot.head>`, más los no rastreados, más `snapshot.dirty`. Las raíces se juzgan de a una: primero las que tocaron eventos de este turno, después la del `cwd`, después el resto. La primera que bloquea decide y corta. Con un presupuesto de 30 s (`STOP_BUDGET_MS`, debajo del watchdog), las raíces no juzgadas se nombran en un Stop incompleto (`stopIncomplete.reason = "budget"`, `stopSkipped`); pre-commit y CI las siguen juzgando, y el próximo Stop las juzga antes que al resto, así ninguna raíz queda sin juzgar para siempre. El `stopFingerprint` tampoco pasa del presupuesto: si se agota, ese Stop sigue la regla por turno. Cada raíz emite `PREGATE-STOP-ROOT i/n <root>`, así un timeout nombra la raíz en curso.
2. Los "antes" se leen con **un solo** `git cat-file --batch` (o los blobs de la snapshot). Después corren `analyze` (fase `stop`) e `introduced`, con la ventana de error contra `before_sesión`.
3. **`ask` ya aprobado.** Si el sha del archivo en disco es igual al `afterSha` de un `CallEvent` con veredicto `ask`, esas violaciones `ask` pasan a `stop.approved`: se informan al humano por `systemMessage` y no bloquean. Si no, Stop empujaría al agente a revertir lo que el humano aceptó.
4. Si quedan deny o ask introducidos y `state.stopBlocks(sid, turnH)` es menor que `maxStopBlocks`: exit 2 + `{"decision":"block","reason":…}`. El reason incluye "Do not remove functionality or tests to comply; if the fix exceeds the task, stop and report it to the user".
5. Si se llegó al tope, o si `reentry` y algo falla: `systemMessage` al humano con lo pendiente y las solicitudes abiertas en `.pregate/requests/`.
6. Los warn salen por `additionalContext`.
7. Cada Stop registra su `CallEvent` con `fileH = "stop"`.

### 4.4 SessionStart

- **Fuera de git:** notice "PREGATE requires git"; los Pre aplicarán `git-failed` (A27).
- **Sin preset:** silent, with no session state (MH-17).
- **Lock inválido, viejo o de otra versión:** notice; los Pre aplicarán el paso 6.
- **Verificaciones y snapshot:** se verifica el `sourcesHash` completo (hash de los JSON evaluables de las fuentes `path`) y se escribe `<rootHash>/sources.json`. La snapshot (`start: true`) se arma con `git rev-parse HEAD` + `git status -z --untracked-files=all`, copia los archivos sucios en scope a `blobs/` y se crea con rename del directorio temporal.
- **Contexto para el agente:** Claude `additionalContext` includes the lock summary and `<DATA>/bin/pregate check --stdin --path <file> --format agent`. Other adapters have no verified SessionStart channel; agy registers none.
- **Without SessionStart:** first Pre snapshots HEAD; root acceptance also permits an uncommitted preset that predates first contact (MH-33).

### 4.5 `pregate check` (pre-check, pre-commit y CI)

| Modo | "Antes" | "Después" | Preset, fuentes y lock |
|---|---|---|---|
| `--stdin --path P --format agent` | HEAD **[Δ]** | stdin | Lock en disco. Solo lectura, sin estado |
| `--staged --ratchet` | HEAD | Índice | **Del índice** (`cat-file --batch`, un solo spawn para todo). Se recompila sin correr fixtures y se compara byte a byte con el lock del índice (A10) **[Δ §6.5]** |
| `--ratchet --base <sha>` (CI) | `merge-base` | Árbol | Del árbol. La plantilla de CI corre antes `pregate rules test` sobre cada fuente `path` (U2), después recompila y compara |

- **Enforcement:** `check` and `decide` share `blocking(lock, violations, cause)`. The preset selects a default; an active alias/check override can select `enforce` or `shadow` independently (O53). Integrity always enforces. Form causes still use the preset default, with human causes and protected-path guards always blocking.
- **Salida:** exit 1 si queda algo bloqueante (`deny` o `ask`), el lock no coincide o la versión es distinta. `warn` ⇒ exit 0 con el texto. En pre-commit y CI no hay estado ni contadores: cada violación introducida bloqueante falla.
- MH-19/20/28: pre-commit invokes global `pregate` on PATH. `check`, `explain` and `preset show` delegate to the lock's engine; `preset compile` uses the current engine. Pins below `FLOOR = "0.2.0"` deny as `lock-stale`; missing pinned engines request `pregate update --engine <v>`. `check --staged` reports registration/trust drift without changing its verdict.

---

## 5. Dependencias (lista cerrada)

### 5.1 Lo que viaja en el binario

| Ítem | Forma | Por qué es imprescindible | Licencia y atribución |
|---|---|---|---|
| `web-tree-sitter` 0.27.0: `web-tree-sitter.js` (156 KB) + `.wasm` (210 KB) | `vendor/`, sin modificar, embebido. **No figura en `package.json`** | Es el runtime del parser. No se puede extraer por funciones: el glue de emscripten y la API son una unidad | MIT. LICENSE + ORIGIN (paquete@versión, URL, sha256) en la carpeta y en THIRD_PARTY_NOTICES |
| `tree-sitter-typescript` 0.23.2: `tree-sitter-typescript.wasm` (1,42 MB) + `tree-sitter-tsx.wasm` (1,45 MB) | `vendor/`, embebido, **con `grammar.patch`** (O18) | Gramáticas TS y TSX/JS. Comparten *kinds* y *fields* con ast-grep, así que las reglas de patrón del pack piloto (~650 `kind`, 698 `has`, 422 `field`) corren como datos. Hacen falta las dos gramáticas: `<T>x` no es válido en TSX | MIT. Igual |
| Runtime de Bun | Lo embebe `--compile` | — | MIT. Bun enlaza JavaScriptCore (LGPL-2.x): las obligaciones de distribución se verifican antes del primer release |

**Dependencias de runtime para quien instala: cero.** Las herramientas del sistema son `git` (requisito, A27) y `/bin/sh` (el launcher).

### 5.2 Desarrollo y build (nunca se distribuyen)

| Ítem | Para qué |
|---|---|
| Bun 1.3.14 | Compilar a binario único, `bun test`, macros para embeber `catalog/` y los `.wasm` (verificado) |
| `typescript` + `@types/bun` | `tsc --noEmit` |
| `@ast-grep/napi` 0.45.3 | Oráculo diferencial de `match.ts` |
| `tree-sitter` CLI 0.24.4 + emsdk 3.1.64 (Docker) | Regenerar la gramática con `grammar.patch` (O18). Sin el parche reproduce el WASM publicado byte a byte; la receta está en ORIGIN |

**APIs nativas en uso:** `Bun.Glob` (verificado con rutas que empiezan con punto; distingue mayúsculas, por eso A26 pasa glob y ruta a minúsculas), `Bun.JSONC` (tsconfig), `Bun.spawnSync`, `Bun.file`/`Bun.write`, macros y `with {type:"file"}`, `node:fs` (realpath, rename, link, readdir), `node:crypto` (sha256) y `bun:test`.

**Escrito desde primeros principios** (más corto que importarlo):
- lexer permisivo de shell + reglas (estimado ~70 líneas; **medido 603** tras O21: no baja sin perder vectores probados);
- JSON-patch con `add`/`remove`/`replace`/`test` (~40);
- intérprete del subconjunto de JSON Schema: `type`, `properties`, `required`, `enum`, `const`, `items`, `pattern`, `additionalProperties`, `oneOf`, `minimum` (~90);
- JSON canónico (~15);
- comparación de versiones por igualdad exacta (el preset prohíbe rangos).

### 5.3 Parser de TS/JS: evaluación para un gate fail-closed

Arranque en frío del binario compilado más el parse de 2.000 líneas:

| Opción | Artefacto en runtime | Tiempo | Riesgo de falso deny | Riesgo de falso allow | Formato de reglas | Veredicto |
|---|---|---|---|---|---|---|
| **(a)** Escáner o parser propio del subconjunto | ninguno | ~16–20 ms | Medio: genéricos en parámetros, `<T,>` en tsx | **Alto.** Texto JSX, regex contra división y templates anidados desincronizan el tokenizer y ocultan código en silencio. No detecta errores de sintaxis, así que U10 ("parser falla ⇒ deny") es imposible | propio | Descartada: terminaría siendo un parser de TS peor |
| **(b)** Cherry-pick por funciones | — | — | — | — | — | No aplica. TS, Babel y acorn son máquinas de estado monolíticas: `scanner.ts` + `parser.ts` arrastran factory, utilities y diagnostics (30–40 mil líneas de fork) |
| **(c)** API de TypeScript 6.0.3 embebida | ninguno (+32 MB; binario de 96 MB) | 45–46 ms | ~0 hoy. Crece, porque la API JS está congelada (TS 7 es Go) | ~0 | `ts.SyntaxKind`: hay que portar el pack y se pierde §13.3 | Descartada: D17 admite una dependencia completa solo si su ausencia rompe el fail-closed, y no la rompe |
| (d1) `@babel/parser` 7.29.9 vendorizado (513 KB) | ninguno | 37 ms | Bajo, pero mezcla errores de scope con los de sintaxis (21 `VarRedeclaration` donde tsc da 0) | ~0 | AST de Babel | Descartada: AST incompatible con el dialecto de reglas (A4). Habría que reescribir `match.ts`, los 7 patrones del catálogo y el pack piloto entero |
| (d2) `oxc-parser` / (d3) `@ast-grep/napi` / (d4) tree-sitter nativo | `.node` por plataforma | Embebido: 290–520 ms. Al lado del binario: 16–22 ms | Bajo / como tree-sitter | ~0 / como tree-sitter | ESTree / **nativo del pack** | Descartadas: embebidos rompen el presupuesto y al lado rompen "binario único". (d3) queda como oráculo en los tests |
| `Bun.Transpiler.scanImports` | nativo | 17–19 ms | — | **Alto**: omite `import(m)`, `require(m)` no literal e `import type` (verificado) | — | Descartada (A23) |
| **(d5) web-tree-sitter WASM + gramáticas vendorizadas** | **ninguno** (+3,2 MB) | **43 ms** (21 ms en un archivo chico) | **Conocido y acotado.** `export type *` y la varianza `in/out` producen ERROR (`accessor` parsea en 0.23.2) ⇒ deny de forma (dirección segura), con un mensaje que nombra la línea | Bajo. La recuperación de errores marca ERROR/MISSING y cualquier ERROR que interseca la ventana deniega. Residual: un árbol mal interpretado sin ERROR (ambigüedad de genéricos en TSX) | **kinds y fields de ast-grep** | **Elegida** |

**Mitigaciones de (d5):**
1. **Día 1.** Un script descartable (no se commitea) parsea todos los `.ts/.tsx` del HEAD del piloto y cuenta los archivos con ERROR; la tasa se registra en este documento. Si hay archivos válidos que fallan, se parchea la gramática (que es dato) y el cambio se registra en ORIGIN y NOTICES. No hay plan B de parser. **Hecho (O18):** 8.621 archivos; **antes del parche 596 con ERROR (6,91 %), después 4 (0,05 %)**, los 4 con un NUL literal dentro de un string o comentario (el lexer de tree-sitter-cli 0.24.4 lo lee como fin de entrada; siguen dando deny de `syntax`). Ningún kind ni field cambió (fields 40/43, ABI 14); 102 árboles del piloto que ya parseaban cambiaron, todos correcciones (templates etiquetados genéricos que se leían como `<`/`>`). Residual sin ERROR: `await f<T>(x)` y `` await sql<T>`…` `` se arman como llamada de `await f`.
2. **En `rules test`** (que `preset compile` corre sobre cada fuente `path` y `build.ts` sobre `catalog/`), `kind`, `field` y regex se validan contra las dos gramáticas (`idForNodeType`, `fieldIdForName`). Un typo nunca "no matchea en silencio". **[Δ ola 2]** `compile` no llama a `compilePattern`.
3. **Cobertura semántica.** El oráculo diferencial compara contra ast-grep (gramática nativa sin parche): en las construcciones parcheadas los dos difieren, así que su corpus no las incluye.

### 5.4 Distribución

- `bun build --compile --minify --bytecode` para `darwin-arm64` y `linux-x64` ("macOS y Linux", §18.1; otro target se agrega cuando alguien lo pida): unos 66 MB cada uno. Sin top-level await, porque `--bytecode` lo exige; `main` es async por `Parser.init()`.
- Release assets: platform tar (binary, LICENSE, THIRD_PARTY_NOTICES), `install.sh`, and one `SHA256SUMS` covering all assets (MH-32); private downloads use `gh`.
- Con `--no-compile-autoload-bunfig --no-compile-autoload-dotenv` (O32): el binario no lee `bunfig.toml` ni `.env` del directorio en que corre, que es el repo que juzga.
- `setup` installs and warms the engine, then writes global launcher/registrations: Claude/Cursor/Grok share `~/.claude/settings.json`, Cursor additionally uses its native Stop dispatcher in `~/.cursor/hooks.json`, Codex uses trusted `~/.codex/hooks.json`, and agy uses the `pregate-global` plugin. Shared commands defer shell-local expansion for Grok; Cursor Stop followups share the cap across generation IDs (MULTI-HARNESS §6.4). `install` only manages repo pre-commit/CI and removes legacy 0.1.0 registrations/launcher. `update` retains pinned engines; `uninstall` removes owned entries and restores unchanged foreign configs' original bytes (MH-22–28).
- La plantilla de CI descarga la versión fijada, verifica el sha256 y fija `timeout-minutes` (un regex catastrófico en una fuente `path` termina ahí, §6.1).

---

## 6. Las 18 reglas: representación, ejecución y `rules test`

### 6.1 Vocabulario

| Tipo | Qué cubre | Dónde |
|---|---|---|
| `pattern` | Reglas de ast-grep:<br>· `pattern` con `$X`, `$$$X`, `$_`;<br>· `kind`;<br>· `regex`: un `(?i)`/`(?s)` inicial pasa a bandera y `.` excluye solo `\n`, como en Rust; lookaround, backreferences, `{` que no es repetición contada, clases anidadas y escapes con otro sentido en JS son error, por paridad con el regex lineal de Rust (residuo: `\w\d\s\b` son ASCII en JS);<br>· `has`/`inside`/`follows`/`precedes` con `field` y `stopBy`;<br>· `all`/`any`/`not`, `nthChild`, `matches` + `utils`, `constraints`; `files`/`ignores` los vuelca `compile` a `params.paths`/`exclude`.<br>Las metavariables se comparten a lo largo de `all`, en orden. Los comentarios son nodos `comment` | `match.ts` |
| `metric` | `fn.lines` = max(líneas sin blancos ni comentarios, sentencias), que cierra la trampa de comprimir líneas.<br>`fn.params` cuenta los miembros de un tipo objeto inline o desestructurado, que cierra `opts: {a;b;c;d}`.<br>`class.publicMethods` | `ts.ts` (hechos) + `evaluate.ts` |
| `banned-import` | `params.packages`, con `fs` ≡ `node:fs`, subrutas `pkg/x`, `import type`, `import()` y `require` literales y `export … from` (siguiendo re-exports); compara el nombre del paquete aunque un alias lo resuelva a un archivo local | `evaluate.ts` + `resolve.ts` |
| `layer-edge` | La capa del archivo (glob más específico; empate según el orden de declaración) contra la capa del destino resuelto **por ruta**, aunque el archivo no exista. Sigue re-exports hasta 3 saltos y 32 archivos; más allá, `too-deep`. `external` es solo un builtin de node o un nombre npm válido; `#x`, `~/x` o `@/x` sin alias que resuelva son `unresolved`, igual que **[Δ ola 2]** un especificador con `?`, `\`, o `#` fuera del primer carácter, un segmento `.`/`..` en un especificador bare (también tras expandir un alias) y un paquete que se importa a sí mismo por nombre; un barrel con error de parse cuenta como `too-deep`. Un archivo de una capa restringida que importa un módulo con error de sintaxis recibe entonces `unresolvable-import`. En una capa con `mayImport ≠ ["*"]`, `unresolved`, `too-deep` o un tsconfig `invalid` ⇒ `unresolvable-import` | Igual |
| `diff` | `no-decrease` / `no-increase` sobre un conteo: `count: "markers"` (substrings de `params.markers` en el texto) o `count: {pattern}` | `evaluate.ts` (conteo) + `ratchet.ts` |
| `placement` | Tipo de cambio, `scope`, marcadores de generado, capas y lenguajes con pack, sin parsear | `evaluate.placement` |

**Macro `@generatedMarkers`** en `params.markers` **[Δ O14]**: `compile` lo reemplaza por `preset.generatedMarkers` y `fixtureLock` por `context.generatedMarkers`; `evaluate` nunca lo ve.

**Macro `@layers` y `@layers:<kind>`** en `params.paths` **[Δ A21]**. `compile` lo expande a los globs de las capas del preset. `@layers` sin capas ⇒ `[]` (la regla no aplica a ningún archivo; `[]` nunca significa "todo"). `@layers:<kind>` sin capas de ese tipo es error de compilación.

**Regex catastrófico (O27).** El regex de JS hace backtracking y `(a+)+` pasa la compilación. No se rechaza por forma: el pack piloto usa cuantificadores anidados legítimos (`^((\w+|getKernel\(\))\.)*(emit|…)$`). JavaScriptCore no se cuelga con un **grupo repetido**: abandona y responde "no coincide", sin lanzar. `match.ts` no toma ese "no coincide" de un regex con grupo repetido si tardó más de 50 ms (reloj inyectado) o si el texto pasa de 64 KB: la búsqueda termina en `regex-limit` (deny + halt + aviso al humano, también en `shadow`). Un regex con grupo repetido y más de 16 grupos no compila: su memoria se agotaría antes de 64 KB. Un regex sin grupo repetido nunca abandona ni lee el reloj; si se cuelga, las tres caras bloquean igual: el hook deniega por watchdog, el pre-commit no termina y CI lo corta con `timeout-minutes`.

### 6.2 Mapa de las 18 invariantes

Son 17 checks, porque `banned-imports` es `multi`. La columna de trampas es la semilla de las fixtures `trap/`.

| Alias | Check `core/…` | impl | Parámetros | Trampas mínimas |
|---|---|---|---|---|
| CC-FN-001 | complexity/fn-max-lines | metric `fn.lines` | `max`, `paths` | Sentencias comprimidas en una línea; arrow anidada |
| CC-FN-002 | complexity/fn-max-params | metric `fn.params` | `max`, `countInlineObjectMembers`, `exempt` | `opts: {a;b;c;d}`; desestructurado sin tipo; rest con tupla |
| CC-ER-002 | errors/no-empty-catch | pattern: `catch_clause` cuyo cuerpo solo tiene comentarios, `console.$M(...)`, `$L.(log\|warn\|error\|info\|debug)(...)` o `void $X`; también `.catch(() => {})` | `loggers` | `catch (e) { void e }`, `catch {}`, solo-log |
| CA-DEP-001 | dependencies/layer-direction | layer-edge | (`lock.layers`) | Barrel que re-exporta infra, `import type`, `require('../infra')`, alias `@/infra`, `export * from` |
| CA-DEP-002 | dependencies/banned-imports | banned-import | `paths: ["@layers:core"]`, `packages` (ORM, frameworks) | `require`, `import()` literal, barrel, subruta `@prisma/client/runtime` |
| CA-UC-001 | api-surface/single-public-method | metric `class.publicMethods` | `paths`, `max: 1` | Propiedad arrow pública; método `static` |
| DDD-VO-001 | immutability/readonly-fields | pattern: campo sin `readonly`; `this.$F =`/`+=`/`++` o `Object.assign(this, …)` fuera del constructor | `paths` | Campo `private` mutable con getter |
| DDD-ENT-001 | immutability/no-public-setters | pattern: accessor `set` público; método público que asigna `this.$F` desde un parámetro (estructural, no por nombre) | `paths` | `set x()`, nombre computado |
| FCIS-IO-001 | dependencies/banned-imports (instancia 2) | banned-import | `paths: ["@layers:core"]`, `packages` (fs, child_process, net, http…) | `fs` contra `node:fs`, `fs/promises`, barrel |
| FCIS-IO-002 | effects/no-clock-random-env | pattern: toda referencia en **posición de valor** a `Date`, `process`, `performance`, `Math.random`, `crypto.randomUUID/getRandomValues`, o la misma propiedad sobre `globalThis`/`window`/`global`; un nombre que el archivo liga (parámetro, variable, import relativo) no es el global | `paths`, `allow` (nombres calificados puros, p. ej. `Bun.Glob`) | `const D = Date`, `Date['now']()`, `const {now} = Date`, `globalThis.Date.now`, `globalThis.window.x`, `new Date()`, un `window` ligado en otra función, `declare`/`import type`/namespace/`const enum` con el nombre del global |
| TDD-FOCUS-001 | testing/no-focused-tests | pattern: `(describe\|it\|test\|context\|suite)` seguido de `.only`/`.skip` o `["only"]`/`["skip"]` como referencia (no solo como llamada), en cualquier punto de la cadena; además toda referencia a `fit`, `fdescribe`, `xit`, `xdescribe`, `xtest`, salvo **[Δ O40]** donde el archivo liga ese nombre (el recorrido de ámbitos de FCIS-IO-002, pero un import nunca liga) y la lectura de esos nombres de `globalThis`/`window`/`global`/`self` o de `require()`/`import()` de un paquete | `paths` (globs de tests) | `it["only"]`, `const o = it.only`, `it.concurrent.only`, un `fit` global al lado de un `const fit` en otro test, `const fit = globalThis.fit` |
| TDD-DEL-001 | testing/assertions-no-decrease | diff `no-decrease` del patrón `expect(...)` / `assert*(...)` | severidad `ask` | Borrar el test por shell (lo ve Stop). Sin interactividad ⇒ deny + halt |
| EVA-GEN-001 | integrity/new-generated-marker | diff `no-increase` de `markers` (substring) | `markers` = `lock.generatedMarkers` | Marcador en un comentario, un string o texto JSX |
| EVA-GEN-002 | integrity/edit-generated-or-excluded | placement `edit-generated-or-excluded` | — | Archivo existente con marcador o en `exclude` |
| EVA-SUP-001 | integrity/new-inline-suppression | diff `no-increase` de `markers` | `pregate-disable`, `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `biome-ignore` | Bloque `/* eslint-disable */` |
| EVA-DYN-001 | integrity/no-dynamic-import-in-layer | pattern: `import($X)` / `require($X)` con argumento no literal; `createRequire`, `eval`, `new Function`. **[Δ O35]** `require` y `eval` como propiedad solo cuentan sobre `module`/`globalThis`/`global`/`window`/`self` (por miembro, corchete o desestructuración, también con cast o encadenado); un método de otro objeto llamado `require` o una clave `eval:` no son cargadores | `paths: ["@layers"]` | `require(name)` después de un deny; `module.require(x)` y `globalThis.eval(x)` al lado de `x.require()` |
| EVA-CAST-001 | integrity/double-type-assertion | pattern: `$X as unknown as $T`, `$X as any as $T`, `<$T><unknown>$X`, con o sin paréntesis | — | `(x as unknown) as T` |
| EVA-SCOPE-001 | integrity/out-of-scope-file | placement `new-in-exclude` + `no-language-pack-in-layer`, este solo para código **[Δ O34]** | `extensions`: lenguajes de programación sin pack, en minúsculas y comparadas sin mayúsculas; `""` es el archivo sin extensión. CSS, Markdown, JSON, SVG, HTML e imágenes no se deniegan | `.py`/`.sql` dentro de una capa; `.PY`; archivo sin extensión; archivo nuevo en `exclude` |

**Distribución:** 7 patrones, 3 métricas, 3 de imports, 3 diff y 2 placement. Todas son `deny` por defecto salvo TDD-DEL-001 (`ask`).

**Ampliaciones de la ola 1 (revisión de W7, cada una con su fixture; 112 fixtures en total, 117 tras la ola 4a, 122 tras O34/O35, 123 tras la revisión de O35 (1.1.1), 125 tras O40 y 126 tras su revisión (1.1.1)):** EVA-DYN-001 suma `require` con alias, `require.call`, `module.require` y `eval`/`Function` leídos de `globalThis` por miembro, corchete o desestructuración; DDD-VO-001, escrituras a través de casts sobre `this` y `Object`/`Reflect`; EVA-CAST-001, `never` y arrays de `unknown`/`any`/`never` como paso intermedio; DDD-ENT-001 liga el parámetro por asignación; CC-ER-002, bloques vacíos anidados y handlers `() => undefined`; TDD-FOCUS-001, `only`/`skip` desestructurados; FCIS-IO-002, `Temporal`, `random*` de `node:crypto`, `Bun`, `Deno`, `import.meta.env` y `fetch`; FCIS-IO-001, drivers de base de datos, clientes de red, `vm` y `bun:ffi`; EVA-SUP-001, `oxlint-disable` y `deno-lint-ignore`. EVA-GEN-001 usa `@generatedMarkers` (O14).

**Marcadores por substring (EVA-GEN-001/002 y EVA-SUP-001).** Es conservador a propósito: un marcador dentro de un string cuenta, y la falla va hacia el deny, de modo coherente entre las tres reglas. Si molesta en un repo de linters, ese falso deny se mide en el piloto.

### 6.3 Ejecución

`analyze(lock, phase, rel, text, host)` parsea una vez y recorre las reglas de `lock.rules` aplicables a la fase.
- `line` es la fila + 1.
- `symbol` es la cadena de declaraciones con nombre que contiene a la coincidencia (`Clase.método`, `fn`, `<module>`). Los callbacks anónimos se atribuyen al símbolo con nombre que los contiene.

`introduced(lock, rel, before, after)` (modo = `lock.ratchet`; `rel` porque `Analysis` no lleva ruta):
- **`strict`, o `before` nulo:** todo lo que hay en `after`.
- **`no-new`:**
  1. una violación sobre un símbolo que no está en `before.symbols` es nueva, sin compensación;
  2. entre los preexistentes, si el conteo por (regla, archivo) sube, se reportan los símbolos cuyo conteo creció.
- **`diff`:** el conteo de `after` comparado con el de `before`, según `op`. `measured` = después, `limit` = antes (0 si no hay), en la línea 1 con símbolo `<module>`.

Cada coincidencia cuenta (dos en la misma línea suben el conteo); la salida tiene una violación por (regla, línea, símbolo). Límites del MVP: en `no-new` una función con violación preexistente puede crecer ("no puede crecer" es v1), y las violaciones de imports se atribuyen a `<module>`.

### 6.4 `pregate rules test <dir>`

1. **Estructura.** `disk.readTree(dir, true)` carga `Files` (el binario no lleva fixtures; el catálogo se prueba desde el repo, en `catalog.test.ts` y en `build.ts`). Se validan:
   - schemas e IDs; namespace igual al de `source.json`; versiones; que el check exista;
   - `kind`, `field` y regex de los patrones contra la gramática;
   - `why`/`fixHint`/`avoid`/ejemplos para todo alias que pueda ser `deny`.

   Un `impl` desconocido es error de compilación, nunca se saltea en silencio. Por ejemplo `sql-normalized@1`, `principal-path` o `numericCheck` del pack piloto.
2. **Fixtures, en el mismo proceso.** Por cada fixture (`pass`, `fail`, `trap`; **[Δ ola 2]** las carpetas de alias no existen: un alias se prueba con las fixtures del check que nombran sus `examples`):
   1. arma el proyecto en memoria con `files/` (sin el sufijo `.fixture`) y `before/`;
   2. construye el lock con `compile.fixtureLock(check, fixture.params, fixture.context)` (`ratchet: "no-new"`; sin `before` equivale a `strict`);
   3. corre `placement` + `analyze` + `introduced`;
   4. exige: `pass` ⇒ 0 violaciones; `fail`/`trap` ⇒ exactamente las líneas declaradas (y `measured`, si se declara).
3. **Determinismo.** Una segunda corrida tiene que dar el mismo resultado: detecta estado que se filtra entre corridas. **[Δ ola 2]** El orden invertido y otra raíz virtual no pueden cambiar nada por construcción (`Read` es relativo y el núcleo nunca lista archivos), así que no se corren. Los patrones se compilan en las dos gramáticas.
4. **Mínimos.** Por check: 2 `pass`, 2 `fail` y 1 `trap`. Por alias: 1 `pass` y 1 `fail` con sus defaults (§5.4.1).

La salida es una línea por fixture (`ok   <check> <kind>/<caso> -> fail [línea(medido)]` o `FAIL … ` con lo esperado), con exit 1 ante cualquier falla. `rules test catalog` da hoy 126/126. `preset compile` corre `rules test` sobre cada fuente `path` (U2, DD-69), igual que la plantilla de CI; pre-commit recompila sin fixtures (§4.5). `scripts/build.ts` lo corre sobre `catalog/` y aborta si falla.

**El pack `amarilla/` (27 reglas) no compila tal cual contra el `Impl` cerrado.** 17 son reglas de patrón TS y corren como datos. Las otras 10 no:
- 7 primitivas con parámetros que el MVP no tiene: `banned-import` ×3 (`specifiers` como regex, `appliesWhen.directive: "use client"`, `follow: "values"`, `ignoreTypeOnly`, `clauses`), `placement` ×1 (`on`/`deny`), `diff` ×2 (`clauses` `unchanged-if-exists-at-ref`/`monotonic-name`, `identityKeys`/`numeric`) y `principal-path` ×1;
- 3 reglas solo SQL (`sql-normalized@1`); `events-append-only` pierde su patrón SQL y conserva el TS.

**Decisión propuesta [Δ, necesita tu OK]: (b)** esas 10 reglas quedan fuera del piloto de PREGATE y siguen en ArkGate (`coexist.arkgate.ownedByArkgate`), coherente con D15.1; el motor no crece. El piloto evalúa 17 reglas de patrón + las metodologías de core (D15.3). La alternativa **(a)** es extender `banned-import` (`specifiers` regex, `appliesWhen.directive`, `ignoreTypeOnly`, `follow: "values"` con profundidad 3), `placement` (`deny` globs + `on: create`) y `diff` (`unchanged-if-exists-at-ref`): ~150 líneas más en `evaluate.ts`/`resolve.ts` y schemas, sin requisito de §18.1 que las pida.

Trabajo de datos en los dos casos: renombrar `rule.json` a `check.json` y `pack.json` a `source.json`, quitar los patrones SQL, y completar los mínimos de fixtures.

---

## 7. Qué NO se construye en el MVP

### 7.1 Fuera por SPEC §18.1

Ver SPEC §18.1, "Fuera del MVP". Además: SQL (pack `amarilla/`, §6.4), NotebookEdit (da `unknown`) y SessionEnd. El perfil de Grok queda pendiente de la pregunta 9 (D15.9): hasta entonces, un payload ajeno ⇒ `payload-unrecognized`.

### 7.2 Desvíos de la SPEC y recortes que no tienen fila A#

Los marcados **[Δ]** contradicen la SPEC y **necesitan tu OK**.

| # | Decisión | Por qué | SPEC |
|---|---|---|---|
| 1 | **[Δ]** Motor de patrones propio sobre web-tree-sitter en lugar de `@ast-grep/napi` + tree-sitter nativo | A3. El nativo embebido cuesta 295 ms por llamada. El formato de reglas no cambia | §13.3 |
| 2 | **[Δ]** A stale hook lock denies and halts. In-memory recompilation validates complete bytes; it does not repair or replace the lock. | A9; supersedes the earlier metadata-only admission | §4.2, §4.5 |
| 3 | **[Δ]** En `shadow`, todo veredicto pasa a `none` salvo rutas protegidas, reglas de integridad y causas `human`; lo demás se registra como `shadowed`. `check` aplica la misma función (`blocking`), así que el pre-commit del piloto no bloquea reglas sin calibrar | Sirve para calibrar en el piloto: un deny de forma por un hueco de la gramática no debe frenar al equipo. Lo que no se pudo evaluar sigue denegando | §4.5, §8.5.7 |
| 4 | **[Δ]** Macro `@layers[:kind]`; `@layers` sin capas ⇒ `[]` | A21 | (agregado) |
| 5 | **[Δ]** Presupuesto del guard de shell: p50 ≤ 25 ms | Es el piso de proceso de Bun | §13.6 |
| 6 | **[Δ]** El pre-check `check --stdin` usa HEAD como "antes" | No conoce la sesión. Solo difiere si el archivo ya estaba sucio al empezar | §11.6 |
| 7 | **[Δ]** Plazo del launcher de 5 s para todo Pre (incluido shell) | El launcher no lee stdin en Pre. El plazo es tiempo real, y las llamadas en paralelo se reparten los núcleos: con 2 s, tres ediciones de 2.000 líneas a la vez en un runner de 2 vCPU ya se cortaban (O30). 5 s deja la mitad del timeout de 10 s | §13.6 (2 s edición, 1 s shell) |
| 8 | **[Δ]** Directorio de estado con la sesión primero: `…/pregate/sessions/<sid>/` (eventos por sesión; snapshot por raíz) | Stop enumera las raíces con un `readdir`; el tope por turno cruza raíces | §11.3 |
| 9 | **[Δ]** Git es requisito | A27 | §9 |
| 10 | **[Δ]** `**/.git/**` protegido desde el MVP | `.git/config` editable con Edit apaga el pre-commit (`hooksPath`) | §10.2.6 (v1: `.git/hooks/**`) |
| 11 | **[Δ]** Extensiones `.mts`, `.cts`, `.cjs`, `.jsx` en el pack TS/JS | Sin ellas, cambiar la extensión esquiva toda regla fuera de una capa. Es una línea en `grammarOf` | §18.1 (`.ts .tsx .js .mjs`) |
| 12 | **[Δ]** `unresolvable-import` en toda capa con `mayImport ≠ ["*"]` y en toda fase; `too-deep` y tsconfig inválido cuentan como no resueltos | Cortar en silencio al pasar el tope era un falso allow. La razón de la excepción (lotes paralelos) no aplica: las capas se resuelven por ruta, no por existencia | §4.4 (solo `core`/`port` en Pre) |
| 13 | **[Δ]** Rutas sin distinguir mayúsculas en todas partes | A26 | §6.7 ("donde corresponde") |
| 14 | **[Δ]** Los deny de forma cuentan para el tope por turno, y 3 seguidos sobre el mismo archivo ⇒ halt | Un hueco de la gramática o un CRLF mal reconstruido producía un lazo sin fin (go/no-go: lazos < 5 %) | §4.4, §11.3 |
| 15 | **[Δ]** Pre-commit recompila sin correr fixtures; CI sí corre `rules test` | El lock no depende de las fixtures; correrlas en cada commit cuesta segundos con el pack piloto | §6.5 ("rules test obligatorio al compilar") |
| 16 | **[Δ]** Pack `amarilla/`: 10 reglas fuera del piloto (§6.4, opción b) | El `Impl` cerrado no las expresa; extenderlo no lo pide §18.1 | §18.1 (evaluación) |
| 17 | **[Δ]** D17: "anónimo" = sin acoplarse al paquete, **con** atribución (LICENSE, ORIGIN, THIRD_PARTY_NOTICES) | MIT exige conservar el aviso; D17 lo dejó "(A confirmar)" | D17 |
| 18 | `install` no edita los excludes de tsconfig, ESLint ni del test runner (D15.4) | El sufijo `.fixture` ya vuelve inertes las fixtures (DD-72) | §6.2 |
| 19 | `install` fusiona `.claude/settings.json` y no toca `core.hooksPath` si el repo ya tiene un gestor de hooks (`core.hooksPath`, `.husky`, `.githooks`, lefthook): imprime la línea a agregar | Pisar el hook de ArkGate (D15.1) o los `.githooks` del piloto rompería el piloto | §13.7, §10.2.9 |
| 20 | `bench` es `scripts/bench.ts` (latencia), no un subcomando. El resumen para CLAUDE.md del brazo D es la salida de `pregate preset show` | Es interno y no va en el binario | §13.8, §16.2 |
| 21 | Stop no mantiene una cola de re-evaluación de `background_tasks` | Lo que escriban después lo ven el próximo Stop, pre-commit y CI | §4.2 |
| 22 | TDD-DEL-001 sin exención por haber borrado también el símbolo de producción | Exige un mapeo test → producción. Sin él, la regla es conservadora (ask o detención) | §11.3 |
| 23 | Rutas `file_path` con `.`, `..` o `//` ⇒ `payload-unrecognized` | Claude Code manda rutas absolutas normalizadas; un `..` en la parte inexistente podía cambiar de capa o salir de la raíz | §4.3 |

---

## 8. Estrategia de tests

Regla: se prueba con datos reales del dominio (fixtures, payloads, comandos de evasión), sin mocks ni flags de fault-injection. El núcleo recibe `Read`/`Files`, así que los tests usan mapas en memoria.

| Archivo | Qué prueba | Cómo |
|---|---|---|
| `catalog.test.ts` | Las 18 invariantes: pass/fail/trap, determinismo (segunda corrida), mínimos, casos de ratchet con `before/` y O14 | Salida golden de `rules test catalog` (126 fixtures) |
| `match.test.ts` | Semántica del motor de patrones | Una tabla por operador, más el **diferencial contra `@ast-grep/napi`**: todo patrón del catálogo y del pack piloto contra todo archivo de fixtures, en las dos gramáticas (~18.000 comparaciones, 0 diferencias), con el mismo nodo, las mismas metavariables y dónde se liga cada una |
| `reconstruct.test.ts` | Edit exacto, no encontrado o no único, `replace_all`, `old` vacío, BOM/CRLF, cálculo de la ventana | Tabla |
| `paths.test.ts` | Protegidas a cualquier profundidad y sin lock; `**/.git/**`; mayúsculas en protegidas, scope, capas y `paths` (A26); raíz anidada y raíz registrada solo por SessionStart; realpath de rutas inexistentes; symlink (también colgante) a una ruta protegida; extensiones de `grammarOf` | Repos temporales |
| `shell.test.ts` | Cada vector de §10.1; destino de escritura no literal; `sh -c`/`eval` con string literal y no literal; protecciones sin lock; lo permitido (`<raíz>/.pregate/bin/pregate check --stdin <<EOF`, lecturas); sintaxis desconocida y comillas sin cerrar **sin** deny | Tabla de ~400 comandos POSIX y PowerShell |
| `resolve.test.ts` | Relativos, `.js`→`.ts`, `index`, tsconfig `paths`/`baseUrl`/`extends`, re-exports de 3 saltos, `too-deep` al pasar 3 saltos o 32 archivos, tsconfig `invalid` (ilegible o `extends` ausente), `external` solo para builtins y nombres npm (`#x`, `~/x`, `@/x` ⇒ `unresolved`) | Árbol en memoria |
| `decide.test.ts` | Tabla de §11.3 (intentos, sin progreso, tope por turno del agente con los deny de forma, subagente con presupuesto propio, 3 forma seguidos ⇒ halt, `ask` según interactividad, shadow sin tocar integridad, `blocking` para `check`, Stop con `blocks`/`reentry`/`approved`) | Tabla de historiales |
| `message.test.ts` | Primera línea ≤ 256, total ≤ 4.000, sanitización (`[A-Za-z0-9@/._$-]`, ≤ 80), nunca strings ni comentarios del código, orden, "+N more", pre-check literal con la ruta del launcher | Propiedades |
| `schema.test.ts` | Los schemas usan solo keywords soportadas; todo JSON del catálogo, los presets y las fixtures valida | Recorrido |
| `compile.test.ts` | Los 3 presets compilan con lock estable byte a byte; `test/presets/*` fallan con el error exacto (conflicto sin resolver vía manifiesto local, override sobre inactivo, integridad `off`, ns distinto, engine distinto, fuente `path` con fixture roja, `@layers:<kind>` sin capas de ese tipo); `@layers` sin capas ⇒ `[]`; `files`/`ignores` volcados a `params` | Golden |
| `claude.test.ts` | Contrato: `test/payloads/*.json` (Write, Edit, MultiEdit, Bash, PowerShell, Monitor, Stop, SessionStart, payload estilo Grok) → stdout, stderr y exit exactos. **Cada "(a verificar)" se cierra con un caso:** `old_string: ""`, `continue:false` con exit 2, `additionalContext` junto a `ask`, Stop con exit 2, CRLF en Edit. Además, una tabla: cada campo requerido × {falta, tipo incorrecto} ⇒ exit 2 + `payload-unrecognized`; clave extra en Write/Edit ⇒ halt; clave extra en Bash (`dangerouslyDisableSandbox`) ignorada; `file_path` con `..` ⇒ `payload-unrecognized`; la cadena `"allow"` nunca sale | Golden |
| `e2e.test.ts` | Binario compilado + launcher sobre una copia git de `test/demo-repo`: SessionStart → deny → corrección → `none` → Stop (UC1, UC2: los dos presets deniegan cosas distintas y cada deny se corrige en un intento). Además:<br>· pre-commit con violación staged ⇒ exit 1; en `shadow`, solo integridad ⇒ exit 1;<br>· lock commiteado desactualizado ⇒ exit 1;<br>· motor ausente ⇒ exit 2 + deny; launcher ausente ⇒ el guard inline de `settings.json` deniega;<br>· `hook auto` sin argumentos ⇒ supervisado;<br>· motor que lanza ⇒ exit 1 ⇒ deny del launcher; SIGKILL al motor ⇒ deny;<br>· fuente `path` con un regex que abandona (`(a+)+b`) ⇒ `regex-limit` (deny + halt) antes de 2 s; con un regex polinomial sin grupos ⇒ watchdog a los 5 s ⇒ deny (O30);<br>· `snapshot.json` borrado ⇒ deny + halt; `sessions/<sid>/` borrado ⇒ el "antes" pasa a HEAD;<br>· `.pregate/` borrado a mitad de sesión ⇒ `lock-stale`; preset sin commitear + SessionStart ⇒ gate activo;<br>· `install` sobre un `settings.json` con otro hook y un repo con `.githooks` ⇒ ambos intactos;<br>· 20 Pre en paralelo sobre (archivo, regla) ⇒ contador = 20. Van por la ruta de placement (archivo nuevo en `exclude`, sin parsear): lo que se prueba es el contador, no la latencia (O30);<br>· `bunfig.toml` con `preload` y `.env` en el repo ⇒ el motor los ignora (O32).<br>**[Δ ola 3]** 34 tests: el binario se compila con `compileBinary` de `build.ts`; launcher y watchdog bajo sh, bash y dash; además raíz hermana y anidada, destinos de shell absolutos, Stop sin `prompt_id`, guard inline por stderr, pre-commit con imports de tsconfig desde el índice, ask aprobado | Procesos reales |
| `ratchet.test.ts` **[Δ ola 3]** | `comparedLock` y un `Parsed` entregado no cambian ningún resultado: cada archivo de código de las fixtures como "después" de sí mismo y de otro, bajo los 3 presets y `strict` (> 100 con violaciones); por el gate, deuda commiteada deja pasar una edición inocua y deniega una violación nueva | Fixtures reales y repo git temporal |
| `vendor.test.ts` | sha256 de `vendor/**` igual a ORIGIN; NOTICES lista cada componente, incluida la nota LGPL | Hash |

**Fuera de `bun test`:**
- `scripts/bench.ts` mide p50/p95 por ruta (§4.1) y sale con 1 si una ruta pasa p95 150 ms o shell pasa p50 25 ms. Ese presupuesto es de la máquina de desarrollo de referencia (O31). En CI corre en un job aparte (`continue-on-error`) con `--inform`: la tabla va al resumen del job, con la máquina en que corrió, y una ruta fuera de presupuesto es un warning; el paso solo falla si un hook objeta. Primero informa; en la evaluación, p95 > 150 ms en la máquina de referencia bloquea.
- `scripts/build.ts`: `rules test catalog` y luego darwin-arm64 y linux-x64 en `dist/` (tar con `pregate`, `THIRD_PARTY_NOTICES`, `LICENSE` si existe (O28), y `.sha256`). CI: typecheck → unit → e2e → build → dogfooding.
- **Dogfooding:** el `.pregate/` del repo tiene capas `core`/`shell` (§2) y las metodologías FCIS + clean-code + tdd + integrity, fijadas en W0 antes de escribir código. Con CC-FN-002 por defecto (max 3, contando miembros de objetos inline), firmas como `analyze` (5) o `placement` (4) son archivos nuevos en `strict` y el gate denegaría su propio código. Propuesta: override `CC-FN-002.params.max: 5` con nota ("núcleo puro con dependencias explícitas"); lo que necesita más entradas recibe un tipo con nombre de `types.ts` (`DecideInput`). Pre-commit y CI corren `pregate check --ratchet` sobre el propio código. **[Δ ola 3]** Lock commiteado; `check --ratchet --base 843d370` pasa. Contra el árbol entero el preset marcaba 75 violaciones preexistentes (67 CC-FN-001, 5 FCIS-IO-002, 2 CC-FN-002, 1 CC-ER-002). **[Δ O29]** Hoy da 0: `check --ratchet --base <primer commit>` pasa, con el umbral de CC-FN-001 fijado de forma explícita en el preset.

---

## 9. Plan de construcción y mapa spec→código

El plan de construcción inicial en unidades independientes (`W0`–`W10`), el orden de integración y el mapa completo requisito→archivo del MVP (`SPEC §18.1` y decisiones `D12`–`D17`) se conservan en [ARCHITECTURE-HISTORY.md](ARCHITECTURE-HISTORY.md).

---

## 10. Decisiones del orquestador durante la construcción

La bitácora histórica de decisiones tomadas durante la construcción y evolución del motor (`O1`–`O83`, incluyendo el parche de gramática `O18`, el límite de backtracking regex `O27`, los presupuestos del watchdog `O30` y de la máquina de referencia `O31`, la protección contra `bunfig.toml`/`.env` `O32`, y las entregas posteriores) se mantiene en [ARCHITECTURE-HISTORY.md](ARCHITECTURE-HISTORY.md).
