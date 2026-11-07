# python pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.4.0`. Category: **language**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## python/architecture

Manifest version: `1.0.0`. Status: **complete**.

### python/PY-LAYER-001

Check: [`python/dependencies/layer-direction@1.0.0`](checks/dependencies/layer-direction/check.json). Default severity: **deny**.

Implementation: `layer-edge`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.deps.layers`. Minimum severity: `none`.

The import reaches a layer this core is not allowed to depend on.

Default parameters: `{"paths":["@layers:core"]}`.

**Repair:** Depend on a declared port and wire the adapter at the application boundary.

**Scope and limits:** Do not hide an adapter behind a package initializer, alias or local module replacement.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python deps.layers, revision 1",
  "paraphrase": "The import reaches a layer this core is not allowed to depend on."
}
```

## python/effects

Manifest version: `1.0.0`. Status: **complete**.

### python/PY-IO-001

Check: [`python/dependencies/no-core-io-imports@1.0.0`](checks/dependencies/no-core-io-imports/check.json). Default severity: **deny**.

Implementation: `banned-import`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `multi`. Dimension: `python.deps.packages`. Minimum severity: `none`.

The core imports a selected I/O package.

Default parameters: `{"paths":["@layers:core"],"packages":["sqlite3","subprocess","socket","requests"]}`.

**Repair:** Move this effect behind an injected port and implement the operation in an adapter.

**Scope and limits:** This checks literal imports, not all runtime effects; do not rename the package or obscure the loading call.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "packages": {
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python deps.packages, revision 1",
  "paraphrase": "The core imports a selected I/O package."
}
```

## python/legacy

Manifest version: `1.0.0`. Status: **complete**.

### python/PY-315-NT-001

Check: [`python/legacy/no-namedtuple-keywords@1.0.0`](checks/legacy/no-namedtuple-keywords/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.namedtuple`. Minimum severity: `none`.

That keyword form no longer exists on Python 3.15. A project whose oldest supported Python is 3.15 or newer fails when the line runs.

Default parameters: `{"api":"namedtuple-keywords"}`.

**Repair:** Use class Point(NamedTuple): x: int, or NamedTuple("Point", [("x", int)]).

**Scope and limits:** Do not keep field names as keywords. A project that still supports a Python older than 3.15, or that declares no Python version, is not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "namedtuple-keywords"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (typing.NamedTuple keyword syntax)",
  "paraphrase": "The keyword form NamedTuple(\"Point\", x=int, y=int) was removed in Python 3.15. Use a class or the fields list."
}
```

### python/PY-315-TD-001

Check: [`python/legacy/no-typeddict-empty@1.0.0`](checks/legacy/no-typeddict-empty/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.typeddict`. Minimum severity: `none`.

A TypedDict with no fields must say so explicitly. The omitted form and None were removed in Python 3.15.

Default parameters: `{"api":"typeddict-empty"}`.

**Repair:** Write class TD(TypedDict): pass, or TypedDict("TD", {}).

**Scope and limits:** Do not omit the fields argument or pass None. This stays silent when the oldest supported Python is older than 3.15.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "typeddict-empty"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (TypedDict zero-field form)",
  "paraphrase": "TypedDict(\"TD\") and TypedDict(\"TD\", None) were removed in Python 3.15. Pass {} or use a class."
}
```

### python/PY-315-SRE-001

Check: [`python/legacy/no-sre-modules@1.0.0`](checks/legacy/no-sre-modules/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.sre`. Minimum severity: `none`.

Those three internal modules are gone in Python 3.15, so importing them raises ImportError on every interpreter this project still supports.

Default parameters: `{"api":"sre-modules"}`.

**Repair:** Import re and call re.compile, re.escape, or the other public re functions.

**Scope and limits:** Do not import sre_compile, sre_constants, or sre_parse, including through an alias or __import__. A project module of the same name is not the stdlib module. Older or undeclared targets are not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "sre-modules"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (sre_compile, sre_constants, sre_parse)",
  "paraphrase": "The sre_compile, sre_constants, and sre_parse modules were removed in Python 3.15. Use re."
}
```

### python/PY-315-CGI-001

Check: [`python/legacy/no-cgi-handler@1.0.0`](checks/legacy/no-cgi-handler/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.cgi`. Minimum severity: `none`.

CGIHTTPRequestHandler and the http.server CGI mode were removed in Python 3.15. The process raises AttributeError or ImportError as soon as it reaches that name.

Default parameters: `{"api":"cgi-handler"}`.

**Repair:** Subclass BaseHTTPRequestHandler, or run the application on a WSGI or ASGI server.

**Scope and limits:** Do not import or subclass CGIHTTPRequestHandler. The command-line --cgi flag is not visible in a Python file. Older or undeclared targets are not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "cgi-handler"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (http.server.CGIHTTPRequestHandler)",
  "paraphrase": "CGIHTTPRequestHandler was removed from http.server in Python 3.15. Use another request handler or an application server."
}
```

### python/PY-315-DECOR-001

Check: [`python/legacy/no-type-check-decorator@1.0.0`](checks/legacy/no-type-check-decorator/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.no-type-check-decorator`. Minimum severity: `none`.

no_type_check_decorator was removed in Python 3.15 after years with no type-checker support. Importing it raises ImportError.

Default parameters: `{"api":"no-type-check-decorator"}`.

**Repair:** Delete the decorator. To skip one function, write typing.no_type_check(fn).

**Scope and limits:** Do not import no_type_check_decorator under another name. typing.no_type_check on a single function is the supported call. Older or undeclared targets are not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "no-type-check-decorator"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (typing.no_type_check_decorator)",
  "paraphrase": "typing.no_type_check_decorator was removed in Python 3.15. Use typing.no_type_check on one function instead."
}
```

### python/PY-315-RES-001

Check: [`python/legacy/no-resources-package-arg@1.0.0`](checks/legacy/no-resources-package-arg/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.resources-package`. Minimum severity: `none`.

files() no longer accepts package=. Python 3.15 raises TypeError for that keyword.

Default parameters: `{"api":"resources-package"}`.

**Repair:** Write files(anchor) or files(anchor=package).

**Scope and limits:** Do not pass package=. A different function named files is not importlib.resources.files. Older or undeclared targets are not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "resources-package"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (importlib.resources.files package parameter)",
  "paraphrase": "The package parameter of importlib.resources.files was removed in Python 3.15. Use the anchor argument."
}
```

### python/PY-315-LNO-001

Check: [`python/legacy/no-co-lnotab@1.0.0`](checks/legacy/no-co-lnotab/check.json). Default severity: **deny**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.co-lnotab`. Minimum severity: `none`.

co_lnotab was removed from code objects in Python 3.15. Reading it raises AttributeError.

Default parameters: `{"api":"co-lnotab"}`.

**Repair:** Call code.co_lines() instead of reading co_lnotab.

**Scope and limits:** Do not read co_lnotab through parentheses or another attribute chain. A string that mentions the name is not a read. Older or undeclared targets are not denied.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "co-lnotab"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#removed (codeobject.co_lnotab)",
  "paraphrase": "code.co_lnotab was removed in Python 3.15. Use code.co_lines()."
}
```

### python/PY-316-ASYNC-001

Check: [`python/legacy/no-asyncio-iscoroutinefunction@1.0.0`](checks/legacy/no-asyncio-iscoroutinefunction/check.json). Default severity: **warn**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.asyncio-iscoroutinefunction`. Minimum severity: `none`.

asyncio.iscoroutinefunction is scheduled for removal in Python 3.16. inspect.iscoroutinefunction is the replacement and already exists.

Default parameters: `{"api":"asyncio-iscoroutinefunction"}`.

**Repair:** Import inspect and call inspect.iscoroutinefunction.

**Scope and limits:** Do not import asyncio.iscoroutinefunction under another name. A function you define yourself with that name is not the asyncio function. This denies only when the oldest supported Python is 3.16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "asyncio-iscoroutinefunction"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#pending-removal-in-python-3-16 (asyncio.iscoroutinefunction)",
  "paraphrase": "asyncio.iscoroutinefunction is removed in Python 3.16. Use inspect.iscoroutinefunction."
}
```

### python/PY-316-POLICY-001

Check: [`python/legacy/no-asyncio-policy@1.0.0`](checks/legacy/no-asyncio-policy/check.json). Default severity: **warn**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.asyncio-policy`. Minimum severity: `none`.

get_event_loop_policy, set_event_loop_policy, and the policy classes are scheduled for removal in Python 3.16.

Default parameters: `{"api":"asyncio-policy"}`.

**Repair:** Call asyncio.run(main(), loop_factory=asyncio.SelectorEventLoop), or construct asyncio.Runner.

**Scope and limits:** Do not call get_event_loop_policy or set_event_loop_policy, and do not name AbstractEventLoopPolicy, DefaultEventLoopPolicy, WindowsSelectorEventLoopPolicy, or WindowsProactorEventLoopPolicy. This denies only when the oldest supported Python is 3.16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "asyncio-policy"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#pending-removal-in-python-3-16 (asyncio event-loop policy)",
  "paraphrase": "The asyncio event-loop policy classes and get/set_event_loop_policy are removed in Python 3.16. Use asyncio.run or asyncio.Runner."
}
```

### python/PY-316-INVERT-001

Check: [`python/legacy/no-bool-invert@1.0.0`](checks/legacy/no-bool-invert/check.json). Default severity: **warn**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.bool-invert`. Minimum severity: `none`.

Bitwise inversion of a bool is scheduled for removal in Python 3.16 because the result is an implementation surprise, not a logical not.

Default parameters: `{"api":"bool-invert"}`.

**Repair:** Write not flag. For the integer bits, write ~int(flag).

**Scope and limits:** Do not invert True or False, including inside parentheses. ~1 and ~int(flag) stay valid. This denies only when the oldest supported Python is 3.16 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "bool-invert"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#pending-removal-in-python-3-16 (bitwise inversion of bool)",
  "paraphrase": "~True and ~False are removed in Python 3.16. Use not value, or ~int(value) for the integer bits."
}
```

### python/PY-317-BYTE-001

Check: [`python/legacy/no-bytestring@1.0.0`](checks/legacy/no-bytestring/check.json). Default severity: **warn**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.bytestring`. Minimum severity: `none`.

ByteString has no methods and does not include memoryview. It is scheduled for removal in Python 3.17.

Default parameters: `{"api":"bytestring"}`.

**Repair:** Annotate with collections.abc.Buffer, or with bytes | bytearray | memoryview.

**Scope and limits:** Do not import ByteString from typing or collections.abc. A name you bind yourself is not that alias. This denies only when the oldest supported Python is 3.17 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "bytestring"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#pending-removal-in-python-3-17 (typing.ByteString and collections.abc.ByteString)",
  "paraphrase": "typing.ByteString and collections.abc.ByteString are removed in Python 3.17. Use Buffer or an explicit bytes union."
}
```

### python/PY-317-PROF-001

Check: [`python/legacy/no-profile-module@1.0.0`](checks/legacy/no-profile-module/check.json). Default severity: **warn**.

Implementation: `python-legacy`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.legacy.profile`. Minimum severity: `none`.

The profile module is scheduled for removal in Python 3.17. profiling.tracing is the replacement.

Default parameters: `{"api":"profile-module"}`.

**Repair:** Import profiling.tracing instead of profile.

**Scope and limits:** Do not import profile, including through an alias or importlib.import_module. cProfile and a project file named profile.py are not this module. This denies only when the oldest supported Python is 3.17 or newer.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "api": {
    "type": "string",
    "enum": [
      "profile-module"
    ]
  }
}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New in Python 3.15",
  "locator": "https://docs.python.org/3/whatsnew/3.15.html#pending-removal-in-python-3-17 (profile module)",
  "paraphrase": "The profile module is removed in Python 3.17. Use profiling.tracing."
}
```

## python/quality

Manifest version: `1.3.0`. Status: **complete**.

### python/PY-FN-001

Check: [`python/complexity/fn-max-lines@1.0.0`](checks/complexity/fn-max-lines/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.fn.lines`. Minimum severity: `none`.

Function size exceeds the selected limit.

Default parameters: `{"max":50}`.

**Repair:** Extract a cohesive operation and preserve behavior with relevant tests.

**Scope and limits:** Do not compress statements onto one line or split a single state machine into arbitrary fragments.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python fn.lines, revision 1",
  "paraphrase": "Function size exceeds the selected limit."
}
```

### python/PY-FN-002

Check: [`python/complexity/fn-max-params@1.0.0`](checks/complexity/fn-max-params/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.fn.params`. Minimum severity: `none`.

Function parameter count exceeds the selected limit.

Default parameters: `{"max":4}`.

**Repair:** Review whether the inputs describe a cohesive domain object.

**Scope and limits:** Do not hide unrelated inputs in a generic options map; Python self/cls and variadic parameters count, Go receivers do not.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python fn.params, revision 1",
  "paraphrase": "Function parameter count exceeds the selected limit."
}
```

### python/PY-NEST-001

Check: [`python/control/max-nesting@1.0.0`](checks/control/max-nesting/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.control.nesting`. Minimum severity: `none`.

Control-flow nesting exceeds the selected limit.

Default parameters: `{"max":2}`.

**Repair:** Use an early return or name a cohesive inner operation.

**Scope and limits:** Do not hide nesting in loops, switch/match branches or exception handlers.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python control.nesting, revision 1",
  "paraphrase": "Control-flow nesting exceeds the selected limit."
}
```

### python/PY-CLASS-001

Check: [`python/complexity/class-max-public-methods@1.0.0`](checks/complexity/class-max-public-methods/check.json). Default severity: **deny**.

Implementation: `metric`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.class.public-methods`. Minimum severity: `none`.

Declared public-method count exceeds the selected limit.

Default parameters: `{"max":10}`.

**Repair:** Separate cohesive responsibilities while preserving the public API.

**Scope and limits:** Do not rename public methods to private to hide the count; decorated definitions count as declarations.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{
  "max": {
    "type": "integer",
    "minimum": 0
  }
}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python class.publicMethods, revision 1",
  "paraphrase": "Declared public-method count exceeds the selected limit."
}
```

### python/PY-EXCEPT-001

Check: [`python/errors/no-bare-except@1.0.0`](checks/errors/no-bare-except/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.bare-except`. Minimum severity: `none`.

A bare except also catches process-control exceptions.

Default parameters: `{}`.

**Repair:** Name the intended exception classes or document a deliberately broad boundary.

**Scope and limits:** Do not swallow KeyboardInterrupt/SystemExit during ordinary error handling.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PREGATE language starter policies",
  "locator": "python errors.bare-except, revision 1",
  "paraphrase": "A bare except also catches process-control exceptions."
}
```

### python/PY-EXCEPT-002

Check: [`python/errors/no-swallowed-broad-except@1.0.0`](checks/errors/no-swallowed-broad-except/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.swallowed-broad-except`. Minimum severity: `none`.

Catching Exception or BaseException and doing nothing hides failures that a narrower handler or a deliberate boundary would surface.

Default parameters: `{}`.

**Repair:** Handle the error with a fallback, logging plus re-raise, or translation into a domain error; catch a specific type when the failure mode is known.

**Scope and limits:** Do not replace the body with a comment or treat binding the exception as handling. Log-only and continue is a separate smell.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Clean Code (R. C. Martin, 2008)",
  "locator": "ch. 7, Error Handling",
  "paraphrase": "Error handling is part of what a function does: a caught error is dealt with, or passed on with enough context to act on it, never silently dropped."
}
```

### python/PY-DEFAULT-001

Check: [`python/state/no-mutable-default@1.0.0`](checks/state/no-mutable-default/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.state.mutable-default`. Minimum severity: `none`.

Every call that relies on the default reads and changes the same list, dict or set, so state leaks from one call into the next.

Default parameters: `{}`.

**Repair:** Default to None and create the value in the body: items = [] if items is None else items. Use field(default_factory=list) in a dataclass.

**Scope and limits:** Do not hide the shared value behind list(), dict(), set() or a collections constructor. A deliberate shared cache keeps the FAQ's underscore name, such as _cache={}.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python documentation, The Python Tutorial and Programming FAQ",
  "locator": "https://docs.python.org/3/tutorial/controlflow.html#default-argument-values (Important warning); https://docs.python.org/3/faq/programming.html#why-are-default-values-shared-between-objects",
  "paraphrase": "A default value is evaluated only once, so a mutable default such as a list or dict is shared by every call. Use None and create the value inside the function."
}
```

### python/PY-IS-001

Check: [`python/comparison/no-is-literal@1.0.0`](checks/comparison/no-is-literal/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.comparison.is-literal`. Minimum severity: `none`.

is compares object identity. Whether two equal numbers or strings are the same object is an interpreter detail, so the check can flip between runs, versions or values.

Default parameters: `{}`.

**Repair:** Compare values with == or != . Keep is only for None, True, False and sentinel objects.

**Scope and limits:** Do not wrap the literal in parentheses, negate it or move it to the left side; those are still literals.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python documentation, What's New In Python 3.8",
  "locator": "https://docs.python.org/3/whatsnew/3.8.html#changes-in-python-behavior (SyntaxWarning for is with a literal)",
  "paraphrase": "Identity checks with is and is not against string or number literals can work by accident in CPython but are not guaranteed by the language; use == and != instead."
}
```

### python/PY-STAR-001

Check: [`python/dependencies/no-wildcard-import@1.0.0`](checks/dependencies/no-wildcard-import/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.deps.wildcard`. Minimum severity: `none`.

A wildcard import hides where a name comes from and lets a later change in the imported module silently shadow local names.

Default parameters: `{}`.

**Repair:** Import the names the module uses, or import the module and qualify its names.

**Scope and limits:** Package __init__.py files that republish submodules are not checked. An accelerator-module fallback elsewhere needs a reviewed exclusion, not a copied name list.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "PEP 8, Style Guide for Python Code",
  "locator": "https://peps.python.org/pep-0008/#imports (wildcard imports)",
  "paraphrase": "Wildcard imports should be avoided because they make it unclear which names are present in the namespace. Republishing an internal interface as a public API is the defensible exception."
}
```

### python/PY-ASSERT-001

Check: [`python/errors/no-assert-tuple@1.0.0`](checks/errors/no-assert-tuple/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.assert-tuple`. Minimum severity: `none`.

A non-empty tuple is always truthy in Python. assert (x > 0, 'must be positive') never fails, disabling the assertion completely.

Default parameters: `{}`.

**Repair:** Remove parentheses: write assert x > 0, 'must be positive'.

**Scope and limits:** Do not enclose assert condition and error message inside parentheses or leave a trailing comma in assert (x,).

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python Reference Manual & Flake8-Bugbear",
  "locator": "B011 / assert statement syntax",
  "paraphrase": "assert (a, b) is an assertion of a tuple, which always evaluates to True."
}
```

### python/PY-RAISE-001

Check: [`python/errors/no-raise-notimplemented@1.0.0`](checks/errors/no-raise-notimplemented/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `python`. Cardinality: `singleton`. Dimension: `python.errors.raise-notimplemented`. Minimum severity: `none`.

NotImplemented is not an Exception class. Raising it raises a TypeError at runtime when caught by an except clause expecting Exception.

Default parameters: `{}`.

**Repair:** Use raise NotImplementedError() instead of raise NotImplemented.

**Scope and limits:** Do not raise NotImplemented or NotImplemented() in abstract methods or stubs.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Python Reference Manual: Built-in Constants",
  "locator": "NotImplemented",
  "paraphrase": "NotImplemented is a constant returned by rich comparisons; it should never be raised."
}
```
