# Python starter policies

Version 1.0.0. Data-only policies authored for PREGATE; no official language-provider endorsement.

- quality: function parameters/size and mixed-control nesting, declared public methods and bare-except warnings, plus mutable default arguments, `is` against a literal (deny) and wildcard imports outside package `__init__.py`.
- legacy: standard-library APIs removed in Python 3.15, and APIs scheduled for removal in 3.16 and 3.17. Optional. Init does not select it.
- architecture: layer edges in explicitly declared core layers.
- effects: selected literal I/O imports in those core layers.

Thresholds are configurable starter policies, not universal quality claims. Init selects quality in shadow; architecture/effects require reviewed layers and explicit selection. `python/legacy` is selected by `pack add` and by `pack enable python/legacy`. Each check has at least two pass, two fail and one alternate-syntax trap.

The legacy floor is the oldest Python the project still declares. `requires-python` in `pyproject.toml` wins, then `python_requires` in `setup.cfg` or `setup.py`, then a Pipfile `python_full_version` or `python_version`. A `.python-version` or `runtime.txt` pin is used only when none of those exist. The nearest file to the edited module wins over the repository root. A packaging floor beats a newer developer pin, so `requires-python = ">=3.12"` is not denied for a 3.15 removal even when `.python-version` says 3.15. An API removed in 3.15 is denied only when that floor is 3.15 or newer. It is silent for an older floor and when no version is declared. An API scheduled for 3.16 or 3.17 warns until the floor reaches that release, and then denies. Each finding names the replacement.

Self/cls and variadic arguments each count as a parameter. Public-method metrics count declared non-underscore names, including properties/decorators. Imports model regular root/src packages and bounded initializers; namespace/search-hook/value-flow semantics are outside coverage.

Source syntax metrics do not certify runtime/compiler correctness. See docs/features/language-analysis.md in the engine repository for exact limits. Run language-specific compiler/tests/linters alongside these checks.

Discover with pregate pack show --library python. Validate with pregate rules test --library python or pregate rules test packs/python from the engine checkout. Add the versioned source with pregate pack add --library python --preview, then select only desired methodologies or invariants. Adding a source does not activate its policy.

The legacy checks are the removals an agent is likely to write and that a syntax check can see without guessing. Everything else in the Python 3.15 removal and pending-removal sections is intentionally not a check:

- `ast` node constructors that omit a required field need every constructor's schema.
- `collections.abc.ByteString` and `typing.ByteString` were only dropped from `__all__` in 3.15. The names themselves are the 3.17 removal, which is checked.
- `ctypes.SetPointerType`, `glob.glob0`, `glob.glob1`, and `platform.java_ver` are undocumented or Jython-only names agents rarely emit.
- `datetime.strptime` formats that use `%d` or `%e` without a year are often built at runtime. A literal scan both misses those and flags a year that arrives from another value.
- The `http.server` `--cgi` flag is a command-line option, not a Python expression. `CGIHTTPRequestHandler` is checked.
- `importlib` `load_module` and `zipimporter.load_module` share a method name with project loaders.
- `pathlib.PurePath.is_reserved` is usually called on a variable. Matching every `.is_reserved()` flags unrelated types, and matching only a literal `PurePath` receiver misses the usual call.
- `sysconfig.is_python_build(check_home=...)` and `threading.RLock` arguments are rare call shapes. A project class named `RLock` may take arguments legally.
- `wave` `getmark`, `setmark`, and `getmarkers` are ordinary method names.
- Setting `__loader__` without `__spec__.loader` is a protocol, not one API call.
- The `array` `'u'` type code is a one-character string. Matching it flags data that is not a type code.
- `functools.reduce` keyword names, a logging handler's `strm` argument, and an undotted `mimetypes.add_type` extension need the value and the receiver, which are often variables.
- `shutil.ExecError`, `symtable.Class.get_methods`, `sys._enablelegacywindowsfsencoding`, and `sysconfig.expand_makefile_vars` are rarely written by agents.
- `TarFile.tarfile` and `tkinter` `trace()` collide with ordinary attribute and method names. `trace_variable`, `trace_vdelete`, and `trace_vinfo` still need a `tkinter.Variable` receiver.
- `encodings.normalize_encoding` of a non-ASCII name depends on the argument's characters. A variable hides them, and a literal scan misses the usual call.
- `typing._UnionGenericAlias` and `webbrowser.MacOSXOSAScript` are a private alias and a platform class agents rarely emit. `ByteString` and `profile` are the 3.17 names they do emit, and those are checked.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **language**. Version: `1.4.0`. 25 distinct check IDs.

Methodologies: `python/architecture` (complete), `python/effects` (complete), `python/legacy` (complete), `python/quality` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
