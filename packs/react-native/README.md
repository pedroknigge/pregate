# react-native

Data-only PREGATE rule pack for React Native + Expo apps (TypeScript, `.ts`/`.tsx`). Source version **1.0.0**, for engine **0.0.10**. Nine checks across `platform`, `security`, and `navigation`: no DOM tags in render paths, text outside `<Text>`, FlatList keys, process lifetime, unencrypted storage, client-visible secrets, dev-channel links, computed route names, and secrets in navigation params.

## User control

The contract is the repository preset, not this pack. Take every pack, some packs, or some rules:

- Omit a pack by leaving it out of `sources`.
- Omit a methodology by leaving it out of `methodologies`.
- Turn one rule down or off with `overrides` (`off`, `warn`, `ask`, or `deny`). The key is `react-native/RN-PLAT-001`.
- When two methodologies disagree on one dimension, pick a side in `resolve`.
- `enforcement: "shadow"` sets the preset default. An override's `enforcement` selects `shadow` or `enforce` for one alias or check. Integrity always enforces. See [preset examples](../presets/README.md).

## Rules

| ID | Flags | Why | Default severity |
| --- | --- | --- | --- |
| `RN-PLAT-001` | DOM tags (`div`, `span`, `p`, `a`, `img`, `button`, `input`, `h1`-`h6`) in a return path. | No DOM on device; the tag renders nothing. | deny |
| `RN-LIST-001` | `<FlatList>` without a `keyExtractor={` function. | Index-keyed rows show stale data after inserts. | deny |
| `RN-PERM-001` | `BackHandler.exitApp()` or a bare `exitApp()` call. | Killing the process reads as a crash; the OS owns lifetime. | deny |
| `RN-STORE-001` | Secret-shaped values in `AsyncStorage.setItem`/`multiSet`. | AsyncStorage is unencrypted on-device storage. | deny |
| `RN-SECRET-001` | `EXPO_PUBLIC_*` names containing secret words. | `EXPO_PUBLIC_` values ship in the client bundle. | deny |
| `RN-LOG-001` | `openURL` with an `exp://` development URL. | Shipped code links through the app scheme, not Expo Go. | deny |
| `RN-NAV-001` | `navigate()` with a concatenated or templated route name. | Computed names bypass the typed route map. | deny |
| `RN-OTA-001` | Secret-shaped values in `navigate()` params. | Params persist in navigation state and shared links. | deny |
| `RN-TEXT-001` | Literal text, a quoted string or a template directly inside `View`, `ScrollView`, `Pressable` and other react-native containers (renamed imports included). | A bare string outside `<Text>` throws at render time. | deny |

## Methodologies

- `react-native/platform` — RN-PLAT-001, RN-LIST-001, RN-PERM-001, RN-STORE-001, RN-TEXT-001
- `react-native/security` — RN-SECRET-001, RN-LOG-001, RN-NAV-001, RN-OTA-001

## Fixture coverage and limits

`pregate rules test packs/react-native` runs **45** real fixtures (2 pass + 2 fail + 1 trap per check). Every check has a failing trap with exact lines: DOM shell with a native child, templated text under a renamed `View`, string-form `keyExtractor`, bare-imported `exitApp`, batched `multiSet`, renamed secret destructure, templated `exp://` URL, templated route name, and a `credentials` param.

The patterns are closed syntax: they see names and shapes, not values or flows. Concrete uncaught cases and the reason for each deny default are in [BACKLOG.md](BACKLOG.md). Users can change severities in their preset after reviewing those limits.

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Exact rule contract

Category: **library**. Version: `1.2.0`. 10 distinct check IDs.

Methodologies: `react-native/platform` (complete), `react-native/security` (complete).

[Every rule's severity, defaults, provenance, repair guidance and limits](REFERENCE.md). The reviewed preset determines effective policy; these defaults are not a claim of complete framework compliance.
<!-- END generated reference -->
