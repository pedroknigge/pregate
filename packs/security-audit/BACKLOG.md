# security-audit coverage backlog

This document explains which parts of the [upstream skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8) are not checks in this pack and what each one needs before admission. The [pack README](README.md) describes the admitted rules.

## Request sinks (not in 0.0.4)

Open redirects, path traversal and server-side request forgery all depend on whether a request value reaches the sink. A name-only pattern on `redirect(req.query.x)` or `fetch(url)` either misses the common one-hop alias or flags every internal call. Admit them after a pilot measures false positives in advisor mode, and after one-hop alias taint exists (see [engine requests](../ENGINE-REQUESTS.md)).

## Template injection, ReDoS and XXE (not in 0.0.4)

Server-side template injection needs to know that a template string, not a context value, is user-controlled. ReDoS needs a regex complexity analysis, not a syntax match on `new RegExp`. XML external entity options differ per parser and per version, so each parser needs its own reviewed option table and fixtures.

## Electron (not in 0.0.4)

`webPreferences` with `nodeIntegration: true`, `contextIsolation: false` or `sandbox: false` are exact forms, but their risk depends on whether the window loads remote content. Calibrate on a real Electron project before choosing defaults.

## Trust-boundary evidence (not in 0.0.4)

A future `security-audit/trust-boundaries` methodology would hold project-evidence requirements, each bound to a reviewed assertion rather than a syntax match:

- server-side requests restrict egress, including after redirects;
- CI jobs on untrusted triggers get no secrets or write tokens;
- agent and MCP actions are bound to the requesting principal and resource;
- tokens are bound to issuer, audience, algorithm and expiry;
- webhook signatures cover the raw body and reject replays;
- export and restore authorize each item;
- deletion reaches derived copies;
- unauthenticated work and decompression are capped;
- workload identities have least privilege.

Tenant isolation is not repeated here; it relates to `consumer-saas/CONSUMER-022`.

## Audit discipline (not in this release)

The upstream workflow's discipline (a coverage ledger with disclosed partial coverage, a validator independent of the finder, severity only on confirmed findings, severity from demonstrated impact, re-validation of prior findings after source changes, machine-readable findings from which the report is derived) is process evidence. It could become an opt-in fitness methodology that is never auto-recommended, with relations to `agent-practices` PRACTICE-007, PRACTICE-009 and PRACTICE-012. The owner deferred it.

## Pilot follow-ups (not admitted)

- **`verify=False` parameter defaults.** The pilot found HTTP helpers declared as `def request(url, verify=False)`. That is a weaker signal than a call: it changes only callers that omit the argument. It needs a `warn` rule of its own, limited to modules that import requests, httpx, ssl or urllib3; `SA-PY-TLS-001` is `deny` and cannot carry it.
- **Linking a Python comparison operand to its assignment.** `SA-COMPARE-001` links a TypeScript operand to a `process.env` secret by name binding. Python patterns have no metavariables in the engine, so the Python form only requires secret-like names on both sides (see [engine requests](../ENGINE-REQUESTS.md)).

## Out of scope

- The six-phase workflow, profiles, sub-agent prompts, write isolation and the upstream validators.
- Memory safety, binary analysis, desktop and mobile IPC, RPC protocols, cache and desync attacks, XS-Leaks and business logic.
- Supply-chain and infrastructure files (GitHub Actions, Dockerfiles, Terraform), which need grammars the engine does not have.

## Conditions for future admission

Admit a precise violation with a pinned upstream locator, paraphrased provenance, documented exceptions, at least two passing, one failing and one trap fixture, and a false-positive measurement on a consuming project. A heuristic stays `warn` until that measurement exists.
