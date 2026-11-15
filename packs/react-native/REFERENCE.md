# react-native pack reference

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

Version: `1.2.0`. Category: **library**.

These are manifest defaults. All core rules activate automatically and enforce unless explicitly disabled in the reviewed preset, except the heuristic requirements whose default severity is `warn`: they advise until a reviewed promote or override raises them. Optional packs activate only when selected. `pregate preset show` gives the effective contract. A manifest's `complete` label refers to that manifest, not full library or methodology compliance.

## react-native/platform

Manifest version: `1.2.0`. Status: **complete**.

### react-native/RN-PLAT-001

Check: [`react-native/platform/no-web-components@1.0.0`](checks/platform/no-web-components/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-web-components`. Minimum severity: `none`.

A div or button compiles but renders nothing on device, and the failure is silent until manual QA on a phone.

Default parameters: `{}`.

**Repair:** Render View, Text, Image, TextInput, or Pressable instead of the DOM tag with the same name.

**Scope and limits:** Wrapping the DOM tag around a native child does not make it native. The outer tag still renders nothing.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native docs, Core Components",
  "locator": "View, Text, Image versus DOM elements",
  "paraphrase": "React Native renders native views, not DOM nodes. A lowercase DOM tag in a render path has no native counterpart."
}
```

### react-native/RN-LIST-001

Check: [`react-native/platform/no-flatlist-without-key@1.0.0`](checks/platform/no-flatlist-without-key/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-flatlist-without-key`. Minimum severity: `none`.

Without stable keys a list reuses the wrong row state after an insert, showing one order's data in another order's row.

Default parameters: `{}`.

**Repair:** Pass keyExtractor={(item) => item.id} with a stable id from the data.

**Scope and limits:** A keyExtractor string names no function and leaves rows keyed by index. A key on an inner View is not the list key.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native docs, FlatList",
  "locator": "keyExtractor prop",
  "paraphrase": "A FlatList needs a keyExtractor function so rows keep stable keys across inserts, deletes, and reorders."
}
```

### react-native/RN-PERM-001

Check: [`react-native/platform/no-exit-app@1.0.0`](checks/platform/no-exit-app/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-exit-app`. Minimum severity: `none`.

Killing the process looks like a crash to the OS and the user, breaks state restoration, and reads as a guideline violation on review.

Default parameters: `{}`.

**Repair:** Navigate back to the previous screen and unsubscribe the hardware-back listener instead of exiting.

**Scope and limits:** Calling exitApp through an imported helper or inside a back-press handler is the same kill with one hop in between.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native docs, BackHandler",
  "locator": "exitApp and app lifetime",
  "paraphrase": "The app never terminates its own process. Exiting is the OS job; screens go back through navigation instead."
}
```

### react-native/RN-STORE-001

Check: [`react-native/platform/no-asyncstorage-secret@1.0.0`](checks/platform/no-asyncstorage-secret/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-asyncstorage-secret`. Minimum severity: `none`.

Anything in AsyncStorage is readable on a rooted device or a backup, so a stored refresh token is a stored credential.

Default parameters: `{}`.

**Repair:** Keep tokens in the keychain or secure store, and keep only preferences and public state in AsyncStorage.

**Scope and limits:** Batching the secret inside multiSet, or encrypting it with a key that sits next to it in the same store.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native AsyncStorage docs, security guidance",
  "locator": "unencrypted storage",
  "paraphrase": "AsyncStorage is unencrypted on-device storage. Tokens, passwords, and keys never go through its write calls."
}
```

### react-native/RN-TEXT-001

Check: [`react-native/platform/no-raw-text-in-view@1.0.0`](checks/platform/no-raw-text-in-view/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.raw-text-in-view`. Minimum severity: `none`.

React Native has no implicit text node: a bare string under View throws 'Text strings must be rendered within a <Text> component' and the screen crashes.

Default parameters: `{}`.

**Repair:** Wrap the string in <Text>. For a pressable label, put <Text> inside the Pressable or TouchableOpacity.

**Scope and limits:** Only literal JSX text, quoted strings and templates with text placed directly inside View, ScrollView, SafeAreaView, KeyboardAvoidingView, Pressable, TouchableOpacity, TouchableHighlight or ImageBackground imported from react-native (renames included) are flagged. Whitespace, comments, variables, numbers and conditional expressions are not checked. Same-named components from other modules, such as themed wrappers that render their own Text, pass.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native documentation, Text, https://reactnative.dev/docs/text",
  "locator": "Containers",
  "paraphrase": "All text nodes must be wrapped inside a <Text> component. A text node cannot sit directly under a <View>."
}
```

### react-native/RN-PERF-001

Check: [`react-native/platform/no-inline-render-item@1.0.0`](checks/platform/no-inline-render-item/check.json). Default severity: **warn**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.render-item-perf`. Minimum severity: `none`.

An inline arrow or function expression creates a new function reference on every render, forcing FlatList, SectionList, and VirtualizedList cells to re-render during scroll.

Default parameters: `{}`.

**Repair:** Hoist the renderItem function to module scope or wrap it in useCallback, and pass the stable reference to renderItem.

**Scope and limits:** Both arrow functions and function expressions passed directly in renderItem={...} on FlatList, SectionList, or VirtualizedList are matched. Non-list custom components are ignored.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Native documentation, Optimizing FlatList Configuration (https://reactnative.dev/docs/optimizing-flatlist-configuration)",
  "locator": "Avoid anonymous function on renderItem",
  "paraphrase": "Move the renderItem function outside of the render function or wrap it in useCallback so it does not recreate itself each time the component renders."
}
```

## react-native/security

Manifest version: `1.0.0`. Status: **complete**.

### react-native/RN-SECRET-001

Check: [`react-native/security/no-expo-public-secret-name@1.0.0`](checks/security/no-expo-public-secret-name/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-expo-public-secret-name`. Minimum severity: `none`.

The bundle ships to every install, so a public token or service key in it is readable by anyone who downloads the app.

Default parameters: `{}`.

**Repair:** Keep secrets server-side and expose only an endpoint. Keep EXPO_PUBLIC_ names to URLs, ids, and feature flags.

**Scope and limits:** Renaming the binding on destructure does not rename the variable. The EXPO_PUBLIC_ name still ships.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Expo docs, Environment variables",
  "locator": "EXPO_PUBLIC_ prefix is client-visible",
  "paraphrase": "Every EXPO_PUBLIC_ variable is inlined into the client bundle. A secret-shaped name with that prefix is a published secret."
}
```

### react-native/RN-LOG-001

Check: [`react-native/security/no-exp-dev-url@1.0.0`](checks/security/no-exp-dev-url/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-exp-dev-url`. Minimum severity: `none`.

A leftover dev URL opens Expo Go or a dead tunnel on a user device instead of the screen the link promised.

Default parameters: `{}`.

**Repair:** Open myapp:// routes through the registered scheme, and resolve the host from config rather than a dev tunnel.

**Scope and limits:** Building the exp:// URL from a template hides the scheme from a literal search but opens the same dev channel.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "Expo docs, Linking and Expo Go",
  "locator": "exp:// development URLs",
  "paraphrase": "exp:// URLs point at the Expo Go development channel. Shipped code links through the registered app scheme."
}
```

### react-native/RN-NAV-001

Check: [`react-native/navigation/no-navigate-concat@1.0.0`](checks/navigation/no-navigate-concat/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-navigate-concat`. Minimum severity: `none`.

A computed route name bypasses the typed route map, so a rename compiles and then navigates nowhere at runtime.

Default parameters: `{}`.

**Repair:** Navigate with a literal route name and pass the varying value as a param object.

**Scope and limits:** A template literal with no plus sign is still concatenation. The type checker still cannot see the final name.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Navigation docs, type-safe routes",
  "locator": "static route names and params",
  "paraphrase": "Route names are a static set the navigator types check. Concatenating them builds names no type and no deep link can verify."
}
```

### react-native/RN-OTA-001

Check: [`react-native/security/no-sensitive-in-navigation-params@1.0.0`](checks/security/no-sensitive-in-navigation-params/check.json). Default severity: **deny**.

Implementation: `pattern`. Phases: `pre`, `stop`, `commit`, `ci`.

Languages: `typescript`. Cardinality: `singleton`. Dimension: `react-native.no-sensitive-in-navigation-params`. Minimum severity: `none`.

Params survive in state dumps, logs, and shared links, so a token param leaks the session wherever the state goes.

Default parameters: `{}`.

**Repair:** Pass an order or session id and load the secret value from the server on the destination screen.

**Scope and limits:** Bundling the secret as credentials or a session object does not change what the param carries.

Check-specific parameter schema (this check also accepts `paths`, `exclude` and intersecting `within` globs):

```json
{}
```

Source metadata:

```json
{
  "work": "React Navigation docs, params and state persistence",
  "locator": "params persist in navigation state",
  "paraphrase": "Navigation params persist in navigation state and deep-link URLs. Secret-shaped values travel as ids loaded server-side instead."
}
```
