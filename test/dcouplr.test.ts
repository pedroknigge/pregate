import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile, packCatalog } from "../src/compile.ts";
import { readTree } from "../src/disk.ts";
import { blocking } from "../src/decide.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import type { Lock, Preset } from "../src/types.ts";
import { parse } from "../src/ts.ts";

beforeAll(grammars);

const EFFECT_RULES = ["dcouplr/DCP-AMBIENT-001", "dcouplr/DCP-FACTORY-EFFECTS-001"];
const SAGA_RULES = ["dcouplr/DCP-SAGA-CTOR-001", "dcouplr/DCP-SAGA-NODE-001"];
function sagaFindings(text: string): string[] {
  return [...new Set(denied("src/bootstrap/sagas.ts", text).filter(id => SAGA_RULES.includes(id)))];
}
test.each([
  "['one', 'one']", "['zero', 'one', 'two', 'one']",
  "['one', /* other */ 'two', 'one']", "['one', ...otherIds, 'one']",
  '["one", "two", "one"]', "[`one`, `two`, `one`]",
  "['a\"b', 'a\"b']", "(['one', 'one'] as const)",
  "['one', \"one\"]", "['one', `one`]", '["one", `one`]',
  '[`one`, "other", \'one\']', "['one', ...otherIds, `one`]",
])("dcouplr rejects duplicate literal join references: %s", refs => {
  expect(sagaFindings(`saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ${refs}});`)).toEqual([SAGA_RULES[1]!]);
});
test.each([
  "['one', 'two']", "[nextId(), nextId()]", "[namedId, namedId]",
  "['one', 'ONE']", "[' one', 'one']", "['one', `one-${suffix}`]",
  "['one', 'on\\x65']", "['one', \"two\"]", "['one', `two`]",
  '["one", `on${suffix}`]',
  '["${suffix}", `${suffix}`]',
  "[`one-${suffix}`, `one-${suffix}`]",
])("dcouplr preserves distinct or unresolved join references: %s", refs => {
  expect(sagaFindings(`saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ${refs}});`)).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr duplicate join references use the actual %s grammar", extension => {
  expect(denied(`src/bootstrap/sagas.${extension}`, "saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', `one`]});")
    .filter(id => SAGA_RULES.includes(id))).toEqual([SAGA_RULES[1]!]);
});
test.each([
  "saga['registerNode']?.(({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', 'one']} as Node));",
  "saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', 'two'], expectedStepIds: ['one', 'one']});",
])("dcouplr duplicate join references follow wrappers and last field ownership: %s", code => {
  expect(sagaFindings(code)).toEqual([SAGA_RULES[1]!]);
});
test.each([
  "saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', 'one'], expectedStepIds: ['one']});",
  "saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', 'one'], expectedStepIds});",
  "saga.registerNode({kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one', 'one'], ...node});",
])("dcouplr duplicate join references do not infer overwritten or unresolved arrays: %s", code => {
  expect(sagaFindings(code)).toEqual([]);
});
test.each([
  "new DStructuredSaga()", "new DStructuredSaga('orders')", "new DStructuredSaga('orders', 'id')",
  "new DStructuredSaga('', 'id', kernel)", "new DStructuredSaga('  ', 'id', kernel)",
  "new DStructuredSaga('orders', ` `, kernel)", "new DStructuredSaga(1, 'id', kernel)",
  "new DStructuredSaga('orders', null, kernel)", "new DStructuredSaga(undefined, 'id', kernel)",
  "new DStructuredSaga('orders', void 0, kernel)", "new DStructuredSaga('orders', 'id', null)",
  "new DStructuredSaga('orders', 'id', false)", "new DStructuredSaga('orders', 'id', [])",
  "new DStructuredSaga('orders', 'id', undefined)", "new DStructuredSaga('orders', 'id', () => {})",
  "new lib.DStructuredSaga(/* type */ '', 'id', kernel)",
  "new lib['DStructuredSaga']('orders', (' ' as string), kernel)",
  "new (DStructuredSaga as Constructor)('orders', 'id', (null as IDKernel))",
  "new DStructuredSaga('', ...configuration)",
  "new DStructuredSaga('orders', '', ...configuration)",
  "new DStructuredSaga('orders', 'id', null, ...extra)",
])("dcouplr rejects a known invalid saga constructor: %s", code => {
  expect(sagaFindings(code)).toEqual([SAGA_RULES[0]!]);
});
test.each([
  "new DStructuredSaga('orders', 'id', kernel)", "new lib.DStructuredSaga('orders', `id`, kernel)",
  "new lib['DStructuredSaga']('orders', 'id', kernel)", "new (DStructuredSaga as Constructor)('orders', 'id', kernel)",
  "new DStructuredSaga(sagaType, sagaId, injected)", "new DStructuredSaga(...configuration)",
  "new DStructuredSaga('orders', `id-${suffix}`, kernel)",
  "new DStructuredSaga(...configuration, '', null)", "new DStructuredSaga('orders', ...configuration, null)",
  "new DStructuredSaga('ord\\x65rs', 'id', kernel)", "new DStructuredSaga('orders', 'id', {})",
  "new OtherSaga('', '', null)", "DStructuredSaga('', '', null)",
])("dcouplr preserves valid, unrelated or unresolved saga construction: %s", code => {
  expect(sagaFindings(code)).toEqual([]);
});
test.each([
  "saga.registerNode()", "saga.registerNode(null)", "saga.registerNode(undefined)",
  "saga.registerNode([])", "saga.registerNode('step')", "saga.registerNode({})",
  "saga.registerNode({ stepId: ' ' })", "saga.registerNode({ stepId: 1 })",
  "saga.registerNode({ stepId: 'one' })", "saga.registerNode({ stepId: 'one', on: 'REQUEST' })",
  "saga.registerNode({ stepId: 'one', on: '', handler: async () => {} })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: 'not-callable' })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: function* () {} })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async function* () {} })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {}, compensate: false })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {}, isCheckpoint: 'false' })",
  "saga.registerNode({ kind: 'invalid', stepId: 'one', on: 'REQUEST', handler: async () => {} })",
  "saga.registerNode({ kind: null, stepId: 'one', on: 'REQUEST', handler: async () => {} })",
  "saga.registerNode({ kind: 'join', stepId: 'join' })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'some', expectedStepIds: ['one'] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'every', expectedStepIds: [] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'every', expectedStepIds: 'one' })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: [1] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: [' '] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one'], onSuccess: false })",
  "saga['registerNode'](({ kind: 'join', stepId: 'join', mode: 'some', expectedStepIds: ['one'] } as Node))",
  "(saga.registerNode as Register)?.(/* node */ { stepId: 'one', on: null, handler: async () => {} })",
  "saga.registerNode(null, ...additionalNodes)",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST' }, ...additionalNodes)",
])("dcouplr rejects a known invalid saga node: %s", code => {
  expect(sagaFindings(code)).toEqual([SAGA_RULES[1]!]);
});
test.each([
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {} })",
  "saga.registerNode({ kind: 'step', stepId: 'one', on: 'REQUEST', handler: event => handle(event) })",
  "saga.registerNode({ kind: undefined, stepId: 'one', on: 'REQUEST', handler })",
  "saga.registerNode({ stepId, on, handler })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {}, isCheckpoint: true, branchId: '' })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: async () => {}, compensate: undefined })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'any', expectedStepIds: ['one'] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: `every`, expectedStepIds: ['one', 'two'] })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode, expectedStepIds: [namedStep] })",
  "saga.registerNode({ kind: nodeKind, stepId: 'one' })",
  "saga.registerNode({ stepId: 'one', ...node })",
  "saga.registerNode({ ['stepId']: 'one', on: 'REQUEST', handler })",
  "saga.registerNode({ get stepId() { return 'one'; }, on: 'REQUEST', handler })",
  "saga.registerNode({ __proto__: node })", "saga.registerNode({ 'step\\u0049d': 'one', on, handler })",
  "saga.registerNode({ stepId: '', stepId: 'one', on: 'REQUEST', handler })",
  "saga.registerNode({ stepId: 'one', on: 'REQUEST', handler: false, handler })",
  "saga.registerNode({ kind: 'join', stepId: 'join', mode: 'invalid', mode: 'any', expectedStepIds: ['one'] })",
  "saga.registerNode(node)", "saga.registerNode(...nodes)", "saga.registerOther({})",
  "saga.registerNode(...nodes, null)",
])("dcouplr preserves valid, unrelated or unresolved saga nodes: %s", code => {
  expect(sagaFindings(code)).toEqual([]);
});
test.each([
  "type Capability = typeof fetch;",
  "type Capability = typeof globalThis.fetch;",
  "type Capability = typeof Math.random;",
  "type Capability = typeof Date.now;",
  "const capture: typeof fetch = injected;",
  "const capture = injected as typeof fetch;",
  "const capture = injected satisfies typeof globalThis.fetch;",
  "const capture: ReturnType<typeof fetch> = injected;",
  "function capture(input: typeof fetch): typeof fetch { return input; }",
])("dcouplr effects admit erased type queries: %s", declaration => {
  const code = `admission.addFactoryMethod(() => { ${declaration} return {}; });`;
  expect(() => new Bun.Transpiler({ loader: "ts" }).transformSync(code)).not.toThrow();
  expect(denied("src/services/orders.ts", code).filter(id => EFFECT_RULES.includes(id))).toEqual([]);
});

test.each([
  "typeof fetch", "typeof globalThis.fetch", "typeof Math.random", "typeof Date.now",
  "fetch as typeof fetch", "globalThis.fetch satisfies typeof fetch",
])("dcouplr effects retain runtime access beside type queries: %s", expression => {
  const code = `admission.addFactoryMethod(() => ({ capture: () => (${expression}) }));`;
  expect([...new Set(denied("src/services/orders.ts", code).filter(id => EFFECT_RULES.includes(id)))].sort()).toEqual(EFFECT_RULES);
});

function bootstrapFindings(text: string): string[] {
  const path = "src/bootstrap/setup.ts";
  return parsedDenials(parse(path, text), path, text).filter(id => ["dcouplr/DCP-SETUP-001", "dcouplr/DCP-SETTINGS-001"].includes(id));
}

test.each([
  "{ host: 7 }", "{ port: '4777' }", "{ maxEvents: '2000' }",
  "{ captureOnStart: 'false' }", "{ instanceId: false }", "{ announce: [] }",
  "{ debugConsole: 'false' }", "{ debugConsole: { enabled: 'false' } }",
  "{ debugConsole: { path: 1 } }", "{ debgConsole: false }",
  "{ debugConsole: { enabled: false, pat: '/inspect' } }",
  "{ host: '127.0.0.1', host: null }", "{ port: 0, 'port': false }",
  "{ port: 1n }", "{ maxEvents: -1n }",
  "{ maxEvents: Infinity }", "{ maxEvents: NaN }", "{ port: Infinity }",
  "{ maxEvents: -Infinity }", "{ maxEvents: +(Infinity as number) }",
  "{ maxEvents: Number.POSITIVE_INFINITY }", "{ maxEvents: Number.NEGATIVE_INFINITY }",
  "{ maxEvents: Number.NaN }", "{ maxEvents: Number['POSITIVE_INFINITY'] }",
  "{ maxEvents: globalThis.Infinity }", "{ maxEvents: globalThis['NaN'] }",
])("dcouplr rejects invalid public inspector fields: %s", options => {
  expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', inspector: ${options}});`)).toContain("dcouplr/DCP-SETUP-001");
  expect(bootstrapFindings(`startDcouplrInspector(app, ${options});`)).toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "{}", "true", "false", "undefined", "void 0",
  "{ host: '127.0.0.1', port: 0, maxEvents: 0, captureOnStart: false, instanceId: 'local', announce: false, debugConsole: {enabled: true, path: '/inspect'} }",
  "{ host: undefined, port: undefined, maxEvents: undefined, captureOnStart: undefined, instanceId: undefined, announce: undefined, debugConsole: undefined }",
  "{ host: false, host: '127.0.0.1', port: false, port: 0, announce: null, announce: false }",
  "{ debugConsole: {enabled: false, path: undefined} }",
  "{ debugConsole: {enabled: 1, enabled: true, path: 1, path: '/inspect'} }",
  "{ host: 1, host }", "{ debugConsole: { path: 1, path } }",
  "{ ...options, port: 'dynamic' }", "{ ['host']: 1 }",
  "{ debugConsole: { ...consoleOptions, path: 1 } }", "{ get host() {return 1;} }",
  "class { static host = '127.0.0.1'; static port = 0; }",
  "(class { static host = '127.0.0.1'; static port = 0; } as Options)",
  "{ debugConsole: class { static enabled = false; static path = '/inspect'; } }",
])("dcouplr preserves valid or unresolved public inspector fields: %s", options => {
  expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', inspector: ${options}});`)).toEqual([]);
  if (options !== "true" && options !== "false") expect(bootstrapFindings(`startDcouplrInspector(app, ${options});`)).toEqual([]);
});

test.each(["true", "false", "null", "1", "[]", "'options'"])("dcouplr direct inspector requires object options: %s", options => {
  expect(bootstrapFindings(`startDcouplrInspector(app, ${options});`)).toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "startDcouplrInspector(app)", "startDcouplrInspector(...args, {port: 'unresolved'})",
  "startDcouplrInspector(app, ...args)", "otherInspector(app, {port: 'unrelated'})",
])("dcouplr preserves default, unrelated or unresolved inspector calls: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});
test.each([
  "const Infinity = 2;", "const { Infinity } = options;", "const { limit: Infinity } = options;",
  "const Number = numbers;", "const globalThis = globals;",
  "import { limit as Infinity } from './limits';", "function configure(Infinity: number) {}",
  "try {} catch (Infinity) {}", "const \\u0049nfinity = 2;",
  "const configure = Infinity => Infinity;", "const configure = function Infinity() {};",
  "const configure = class Infinity {};", "with (options) {}",
])("dcouplr defers numeric globals when a file contains an explicit binding: %s", declaration => {
  expect(bootstrapFindings(`${declaration}\nstartDcouplrInspector(app, {maxEvents: Infinity});`)).toEqual([]);
});
test.each([
  "startDcouplrInspector(app, {maxEvents: Infinity, maxEvents: 2});",
  "startDcouplrInspector(app, {maxEvents: Infinity, maxEvents});",
  "startDcouplrInspector(app, {maxEvents: Infinity, ...options});",
  "startDcouplrInspector(app, {maxEvents: limits.Infinity});",
  "startDcouplrInspector(app, {maxEvents: Number[constantName]});",
])("dcouplr preserves overwritten or unresolved numeric inspector values: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr inspector fields use the actual %s grammar", extension => {
  expect(denied(`src/bootstrap/inspector.${extension}`, "startDcouplrInspector(app, {debugConsole: {path: 1}});")).toContain("dcouplr/DCP-SETUP-001");
  expect(denied(`src/bootstrap/inspector.${extension}`, "startDcouplrInspector(app, {maxEvents: Infinity});")).toContain("dcouplr/DCP-SETUP-001");
  expect(denied(`src/bootstrap/inspector.${extension}`, "const Infinity = 2; startDcouplrInspector(app, {maxEvents: Infinity});")).not.toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "lib['startDcouplrInspector']?.(app, ({port: false} as Options));",
  "(startDcouplrInspector as Starter)(app, {announce: 'false'});",
  "setupDcouplr({charEncoding: 'UTF-8', inspector: {port: 0}, inspector: {port: false}});",
])("dcouplr inspector fields retain call and outer ownership: %s", code => {
  expect(bootstrapFindings(code)).toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "setupDcouplr({charEncoding: 'UTF-8', inspector: {port: false}, inspector: {port: 0}});",
  "setupDcouplr({charEncoding: 'UTF-8', inspector: {port: false}, inspector});",
])("dcouplr ignores overwritten inspector configuration: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});

test.each([
  "{ Loger: logger }", "{ Kernel: kernelFactory }", "{ Logger: 1 }",
  "{ Logger: {} }", "{ Logger: { __semanticIdentifier: 'LOGGER', create: false } }",
  "{ Logger: { create: () => logger } }",
])("dcouplr system overrides reject a public contract breach: %s", overrides => {
  expect(bootstrapFindings(`setupDcouplr({ charEncoding: 'UTF-8', systemDependencies: ${overrides} });`)).toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "{}", "{ Logger: loggerFactory }", "{ Logger: undefined }",
  "{ Logger: { __semanticIdentifier: 'CUSTOM', create: () => logger } }",
  "{ ...factories }", "{ ['Logger']: loggerFactory }",
])("dcouplr system overrides preserve valid or unresolved factories: %s", overrides => {
  expect(bootstrapFindings(`setupDcouplr({ charEncoding: 'UTF-8', systemDependencies: ${overrides} });`)).toEqual([]);
});

const systemFactoryKeys = ["Logger", "EventBus", "MessageBus", "DCast", "IQueue", "IQueuePersistence", "MessageBrokerAdapter", "EventBrokerAdapter"];
test.each(systemFactoryKeys)("dcouplr system override %s owns only its last literal field", key => {
  for (const overrides of [
    `{ ${key}: false }`, `{ ${key}: {} }`,
    `{ ${key}: { __semanticIdentifier: 'CUSTOM', create: undefined } }`,
    `{ ${key}: { __semanticIdentifier: 'CUSTOM', create: () => value }, '${key}': 1 }`,
    `{ ${key}: 1, Other: otherFactory }`,
  ]) expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', systemDependencies: ${overrides}});`)).toContain("dcouplr/DCP-SETUP-001");
  for (const overrides of [
    `{ ${key}: 1, '${key}': factory }`, `{ ${key}: {}, ${key} }`,
    `{ ${key}: undefined }`, `{ ${key}: void 0 }`,
    `{ ${key}: { __semanticIdentifier: 'CUSTOM', create: () => value } }`,
  ]) expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', systemDependencies: ${overrides}});`)).toEqual([]);
});
test.each([
  "{ __semanticIdentifier: undefined, create }", "{ __semanticIdentifier: 1, create }",
  "{ __semanticIdentifier: 'CUSTOM' }", "{ __semanticIdentifier: 'CUSTOM', create: null }",
  "{ __semanticIdentifier: 'CUSTOM', create: class {} }",
  "{ __semanticIdentifier: 'CUSTOM', create: async () => value }",
  "{ __semanticIdentifier: 'CUSTOM', create: async /* callback */ function () {} }",
  "{ __semanticIdentifier: 'CUSTOM', create: function* () {} }",
  "{ __semanticIdentifier: 'CUSTOM', create: async function* () {} }",
  "({ __semanticIdentifier: 'CUSTOM', create: (false as Create) } satisfies Factory)",
  "{ __semanticIdentifier: 'CUSTOM', create, create: 1 }",
  "{ __semanticIdentifier: 'CUSTOM', __semanticIdentifier: null, create }",
])("dcouplr system factory rejects a known invalid literal: %s", value => {
  expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {EventBus: ${value}}});`)).toContain("dcouplr/DCP-SETUP-001");
});
test.each([
  "{ __semanticIdentifier, create }", "{ __semanticIdentifier: 'CUSTOM', create: function () { return value; } }",
  "{ __semanticIdentifier: 1, '__semanticIdentifier': 'CUSTOM', create }",
  "{ __semanticIdentifier: 'CUSTOM', create: false, 'create': () => value }",
  "{ __semanticIdentifier: 'CUSTOM', create: false, create }",
  "{ __semanticIdentifier: 'CUSTOM', create() { return value; } }",
  "{ __semanticIdentifier: 'CUSTOM', get create() { return callback; } }",
  "{ ...factory }", "{ ['create']: callback }", "{ __proto__: factory }",
  "{ '__semantic\\x49dentifier': 'CUSTOM', create }",
  "class { static __semanticIdentifier = 'CUSTOM'; static create() { return value; } }",
  "(class { static __semanticIdentifier = 'CUSTOM'; static create() { return value; } } as Factory)",
  "makeFactory()",
])("dcouplr system factory preserves valid or unresolved implementations: %s", value => {
  expect(bootstrapFindings(`setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {EventBus: ${value}}});`)).toEqual([]);
});
test.each([
  "setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {Logger: false}, systemDependencies: factories});",
  "setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {Logger: false}, systemDependencies});",
  "setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {Logger: false}, ...config});",
  "setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {Logger: false, ...factories}});",
  "setupDcouplr({charEncoding: 'UTF-8', systemDependencies: {Logger: {create: false, ...factory}}});",
  "setupDcouplr(...configs, {systemDependencies: {Logger: false}});",
])("dcouplr system overrides preserve unresolved outer ownership: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr system override uses the actual %s grammar", extension => {
  expect(denied(`src/bootstrap/setup.${extension}`, "runtime['setupDcouplr']?.({charEncoding: 'UTF-8', systemDependencies: ({EventBus: false})});"))
    .toContain("dcouplr/DCP-SETUP-001");
});

test.each([
  "setupDcouplr();", "setupDcouplr(null);", "setupDcouplr(undefined);", "setupDcouplr(1);", "setupDcouplr([]);",
  "setupDcouplr({});", "setupDcouplr({ mode: 'run' });", "setupDcouplr({ charEncoding: undefined });",
  "setupDcouplr({ charEncoding: null });", "setupDcouplr({ charEncoding: 1 });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'production' });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: null });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: true });",
  "setupDcouplr({ charEncoding: 'UTF-8', ephemeral: 'false' });",
  "setupDcouplr({ charEncoding: 'UTF-8', ephemeral: 0 });",
  "setupDcouplr({ charEncoding: 'UTF-8', ephemeral: null });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: 'console' });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: [1] });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: ['not-supported'] });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: ['Math.random', false] });",
  "setupDcouplr({ charEncoding: 'UTF-8', modde: 'test' });",
  "setupDcouplr({ charEncoding: 'UTF-8', inspector: 'true' });",
  "setupDcouplr({ charEncoding: 'UTF-8', systemDependencies: [] });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'run', 'mode': 'invalid' });",
  "setupDcouplr({ charEncoding: 'UTF-8', ephemeral: true, ephemeral: 'false' });",
  "runtime['setupDcouplr'](/* config */ { charEncoding: 1 });",
  "runtime?.[`setupDcouplr`]?.({ charEncoding: 'UTF-8', mode: `invalid` });",
  "(setupDcouplr as Setup)(({ charEncoding: 'UTF-8', ephemeral: 1 }) as Config);",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: [/* item */ `NOPE`] }, ...extra);",
])("dcouplr bootstrap rejects a known contract breach: %s", code => {
  expect(bootstrapFindings(code)).toContain("dcouplr/DCP-SETUP-001");
});

test.each([
  "setupDcouplr({ charEncoding: 'UTF-8' });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'run', ephemeral: false });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'test', ephemeral: true });",
  "setupDcouplr({ charEncoding, mode, ephemeral, forbiddenElements, inspector, systemDependencies });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: undefined, ephemeral: void 0, forbiddenElements: undefined });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: [] });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: ['console', 'process', 'fetch', 'localStorage', 'sessionStorage', 'document', 'window', 'WebSocket', 'Math.random', 'Date.now'] });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: [dynamicName, ...names] });",
  "setupDcouplr({ charEncoding: 'UTF-8', forbiddenElements: ['Math.random', `Date.now`] });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: `run`, ephemeral: !longRunning });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'invalid', mode: 'run' });",
  "setupDcouplr({ charEncoding: 1, 'charEncoding': 'UTF-8' });",
  "setupDcouplr({ charEncoding: 'UTF-8', ephemeral: 'false', ephemeral: true });",
  "setupDcouplr({ charEncoding: 'UTF-8', inspector: false, systemDependencies: {} });",
  "setupDcouplr({ charEncoding: 'UTF-8', inspector: { host: '127.0.0.1' } });",
  "setupDcouplr(config);", "setupDcouplr(...configs);", "setupDcouplr({ ...config });",
  "setupDcouplr({ charEncoding: 1, ...config });", "setupDcouplr({ ['charEncoding']: 'UTF-8' });",
  "setupDcouplr({ get charEncoding() { return 'UTF-8'; } });",
  "setupDcouplr({ __proto__: config });", "setupDcouplr({ 'char\\x45ncoding': 'UTF-8' });",
  "setupDcouplr({ charEncoding: 'UTF-8', mode: 'r\\x75n' });",
  "otherSetup({ charEncoding: 1 });",
  "const note = \"setupDcouplr({charEncoding: 1})\";",
  "runtime[method]({ charEncoding: 1 });",
])("dcouplr bootstrap preserves valid or unresolved configuration: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});

test.each(["charEncoding", "mode", "ephemeral", "forbiddenElements", "instanceId"])(
  "dcouplr bootstrap setting %s cannot change at runtime", key => {
    for (const code of [
      `kernel.settings.setSetting('${key}', 'replacement');`,
      `kernel['settings']['setSetting']('${key}', 'replacement');`,
      `kernel?.settings?.setSetting?.(\`${key}\`, 'replacement');`,
      `(kernel.settings.setSetting as Setter)(('${key}' as Key), 'replacement');`,
    ]) expect(bootstrapFindings(code)).toContain("dcouplr/DCP-SETTINGS-001");
  });

test.each([
  "kernel.settings.setSetting('feature', true);", "kernel.settings.setSetting(dynamicKey, true);",
  "kernel.settings.getSetting('mode');", "store.setSetting('mode', 'test');",
  "kernel[section].setSetting('mode', 'test');", "kernel.settings[method]('mode', 'test');",
])("dcouplr settings preserve runtime keys and unresolved receivers: %s", code => {
  expect(bootstrapFindings(code)).toEqual([]);
});

function policyFindings(text: string): string[] {
  const path = "src/bootstrap/policy.ts";
  return parsedDenials(parse(path, text), path, text).filter(id => ["dcouplr/DCP-FACTORY-SYNC-001", "dcouplr/DCP-FACTORY-VALIDATION-001"].includes(id));
}

const asynchronousPolicies = [
  "async () => true", "async input => ({ valid: true })", "async function check(input) { return true; }",
  "async /* check */ () => true", "function* check() { yield true; }", "async function* check() { yield true; }",
  "(async () => true)", "(async () => true) as Policy", "(async () => true) satisfies Policy", "(async () => true)!",
];
const namedPolicyForms = [
  (callback: string, method: string) => `const check = ${callback}; stage.${method}(check);`,
  (callback: string, method: string) => `function boot() { const check = ${callback}; stage.${method}(check); }`,
  (callback: string, method: string) => `{ const check = ${callback}; stage['${method}']?.(/* first */ check); }`,
  (callback: string, method: string) => `const check = ${callback}, registered = stage.${method}(check);`,
  (callback: string, method: string) => `export const check = ${callback}; stage.${method}((check as Policy));`,
  (callback: string, method: string) => `const check = ((${callback}) satisfies Policy); (stage.${method} as Setter)(check!);`,
];
for (const method of ["addValidationPolicy", "addVerificationPolicy"]) {
  for (const [form, source] of namedPolicyForms.entries()) test(`dcouplr named policy completion ${method} form ${form}`, () => {
    for (const callback of ["async () => true", "async function () { return true; }", "function* () { yield true; }", "async function* () { yield true; }"]) {
      expect(policyFindings(source(callback, method))).toContain("dcouplr/DCP-FACTORY-SYNC-001");
    }
    expect(policyFindings(source("() => true", method))).toEqual([]);
    expect(policyFindings(source("function () { return { valid: true }; }", method))).toEqual([]);
  });
  for (const declaration of [
    "async function check() { return true; }", "function* check() { yield true; }", "async function* check() { yield true; }",
  ]) for (const hoisted of [false, true]) test(`dcouplr declared policy completion ${method} ${declaration} hoisted=${hoisted}`, () => {
    const call = `stage.${method}(check);`;
    expect(policyFindings(hoisted ? call + declaration : declaration + call)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
    expect(policyFindings(`export ${declaration} ${call}`)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
  });
}
test.each([
  "const check = async () => true; other.call(check);",
  "const check = async () => true; stage.addFactoryMethod(check);",
  "const check = async () => true; stage.addValidationPolicy(() => true, check);",
  "const check = async () => true; stage.addValidationPolicy(...callbacks, check);",
  "const check = async () => true; function boot(check) { stage.addValidationPolicy(check); }",
  "const check = async () => true; function boot() { stage.addValidationPolicy(check); }",
  "const check = async () => true; { const check = () => true; stage.addValidationPolicy(check); }",
  "function check() { return true; } function boot() { async function check() { return true; } } stage.addValidationPolicy(check);",
  "async function check() { return true; } check = () => true; stage.addValidationPolicy(check);",
  "async function check() { return true; } [check] = [() => true]; stage.addValidationPolicy(check);",
  "async function check() { return true; } ({check} = {check: () => true}); stage.addValidationPolicy(check);",
  "async function check() { return true; } function check() { return true; } stage.addValidationPolicy(check);",
  "function* check() { yield true; } function check() { return true; } stage.addValidationPolicy(check);",
  "function check() { return true; } function* check() { yield true; } stage.addValidationPolicy(check);",
  "let check = async () => true; check = () => true; stage.addValidationPolicy(check);",
  "const check = async () => true; stage.addValidationPolicy(wrap(check));",
  "stage.addValidationPolicy(check); const check = async () => true;",
])("dcouplr named policy completion preserves unrelated, replaced and unresolved values: %s", code => {
  expect(policyFindings(code)).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr named policy completion uses the actual %s grammar", extension => {
  const code = "async function check() { return true; } stage.addVerificationPolicy(check);";
  expect(denied(`src/bootstrap/policy.${extension}`, code)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
});
test.each([
  "stage['addValidationPolicy']?.(/* first */ check, ...extras); export default async function check() { return true; }",
  "export default function* check() {} (stage.addVerificationPolicy as Setter)?.((check as Policy));",
  "const check = async () => true; stage[`addValidationPolicy`](check!);",
  "const check = function* () {}; stage.addVerificationPolicy((check satisfies Policy));",
])("dcouplr named policy completion retains default exports and first-reference wrappers: %s", code => {
  expect(policyFindings(code)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
});
test.each([
  "async function check() { return true; } var check = () => true; stage.addValidationPolicy(check);",
  "async function check() { return true; } function replace() { check = () => true; } stage.addValidationPolicy(check);",
  "async function check() { return true; } for (check of candidates) {} stage.addValidationPolicy(check);",
  "async function check() { return true; } function boot(check) { check = () => true; } stage.addValidationPolicy(check);",
  "async function check() { return true; } stage.addValidationPolicy(wrap(check));",
  "function* check() { yield true; } async function check() { return true; } stage.addValidationPolicy(check);",
  "const check = async () => true; with (context) { stage.addValidationPolicy(check); }",
])("dcouplr named policy completion defers explicit writes and ambiguous reference ownership: %s", code => {
  expect(policyFindings(code)).toEqual([]);
});
test.each(["() => 1", "() => ({ valid: 'false' })", "function () { return; }", "function () { return {valid: true, msg: 1}; }"])(
  "dcouplr named validation result rejects its own malformed return: %s", callback => {
    for (const source of namedPolicyForms) {
      expect(policyFindings(source(callback, "addValidationPolicy"))).toContain("dcouplr/DCP-FACTORY-VALIDATION-001");
      expect(policyFindings(source(callback, "addVerificationPolicy"))).toEqual([]);
    }
  });
test.each([
  "function check() { return 1; } stage.addValidationPolicy(check);",
  "stage.addValidationPolicy(check); function check() { return { valid: 1 }; }",
  "export function check() { if (input) return {valid: true, msg: false}; return true; } stage.addValidationPolicy(check);",
])("dcouplr declared validation result rejects its own malformed return: %s", code => {
  expect(policyFindings(code)).toContain("dcouplr/DCP-FACTORY-VALIDATION-001");
});
test.each([
  "function check() { function helper() { return 1; } return true; } stage.addValidationPolicy(check);",
  "const check = () => { class Helper { result() { return 1; } } return {valid: true}; }; stage.addValidationPolicy(check);",
  "function check() { throw new Error('rejected'); } stage.addValidationPolicy(check);",
  "function check() { return false; } stage.addValidationPolicy(check);",
  "function check() { return 1; } stage.addVerificationPolicy(check);",
  "function check() { return 1; } check = () => true; stage.addValidationPolicy(check);",
])("dcouplr named validation result preserves own-body and replacement boundaries: %s", code => {
  expect(policyFindings(code)).toEqual([]);
});
const aliasedPolicyForms = [
  (callback: string, method: string) => `const check = ${callback}; const alias = check; stage.${method}(alias);`,
  (callback: string, method: string) => `function boot() { const check = ${callback}, alias = check, result = stage.${method}(alias); }`,
  (callback: string, method: string) => `{ const check = ${callback}; const alias = (check as Policy); stage['${method}']?.(alias!); }`,
  (callback: string, method: string) => `export const check = ${callback}; export const alias = check; (stage.${method} as Setter)((alias satisfies Policy));`,
];
for (const method of ["addValidationPolicy", "addVerificationPolicy"]) {
  for (const [form, source] of aliasedPolicyForms.entries()) test(`dcouplr aliased policy completion ${method} form ${form}`, () => {
    for (const callback of ["async () => true", "async function () { return true; }", "function* () {}", "async function* () {}"])
      expect(policyFindings(source(callback, method))).toContain("dcouplr/DCP-FACTORY-SYNC-001");
    expect(policyFindings(source("() => true", method))).toEqual([]);
  });
}
test.each([
  "async function check() { return true; } const alias = check; stage.addVerificationPolicy(alias);",
  "const alias = check; stage.addValidationPolicy(alias); async function check() { return true; }",
  "export default function* check() {} const alias = check; stage.addVerificationPolicy(alias);",
])("dcouplr aliased declared policy completion: %s", code => {
  expect(policyFindings(code)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
});
test.each(["() => 1", "() => ({ valid: 'false' })", "function () { return; }", "function () { return {valid: true, msg: 1}; }"])(
  "dcouplr aliased validation result retains the actual callback: %s", callback => {
    for (const source of aliasedPolicyForms) {
      expect(policyFindings(source(callback, "addValidationPolicy"))).toContain("dcouplr/DCP-FACTORY-VALIDATION-001");
      expect(policyFindings(source(callback, "addVerificationPolicy"))).toEqual([]);
    }
  });
test.each([
  "const check = async () => true; const alias = check; other.call(alias);",
  "const check = async () => true; const alias = check; stage.addValidationPolicy(() => true, alias);",
  "const check = async () => true; const alias = check; stage.addValidationPolicy(...policies, alias);",
  "const check = async () => true; let alias = check; alias = () => true; stage.addValidationPolicy(alias);",
  "const check = async () => true; const alias = check; function boot(alias) { stage.addValidationPolicy(alias); }",
  "const check = async () => true; const alias = check; { const alias = () => true; stage.addValidationPolicy(alias); }",
  "const check = async () => true; const alias = check; function boot() { stage.addValidationPolicy(alias); }",
  "stage.addValidationPolicy(alias); const check = async () => true; const alias = check;",
  "const alias = check; const check = async () => true; stage.addValidationPolicy(alias);",
  "const check = async () => true; const alias = wrap(check); stage.addValidationPolicy(alias);",
  "async function check() {} check = () => true; const alias = check; stage.addValidationPolicy(alias);",
])("dcouplr aliased policy retains unresolved ordering and ownership: %s", code => {
  expect(policyFindings(code)).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr aliased policy uses the actual %s grammar", extension => {
  expect(denied(`src/bootstrap/policy.${extension}`, "const check = async () => true; const alias = check; stage.addVerificationPolicy(alias);"))
    .toContain("dcouplr/DCP-FACTORY-SYNC-001");
});
test.each(["addValidationPolicy", "addVerificationPolicy"])("dcouplr %s must finish before creation returns", (method) => {
  for (const callback of asynchronousPolicies) {
    expect(policyFindings(`stage.${method}(${callback});`)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
  }
});
test.each([
  "stage['addValidationPolicy'](/* first */ async () => true);",
  "stage?.[`addVerificationPolicy`]?.(function* check() {});",
  "(stage.addVerificationPolicy)(async () => {});",
  "(stage.addValidationPolicy as PolicyMethod)(async () => true);",
  "stage.addValidationPolicy(async () => true, ...extra);",
  "stage.addVerificationPolicy(function* check() {}, ...extra);",
])("dcouplr policy completion survives call wrappers: %s", code => {
  expect(policyFindings(code)).toContain("dcouplr/DCP-FACTORY-SYNC-001");
});

const invalidValidationResults = [
  "0", "1", "'true'", "`result`", "`result${value}`", "null", "[]", "void 0", "typeof value", "+value", "-value", "~value", "value++",
  "{}", "{ msg: 'missing valid' }", "{ valid: 1 }", "{ valid: 'false' }", "{ valid: null }", "{ valid: {} }", "{ valid: [] }",
  "{ valid: () => true }", "{ valid: void 0 }", "{ valid: true, msg: 1 }", "{ valid: false, msg: null }", "{ valid: true, msg: {} }",
  "{ valid: true, msg: [] }", "{ valid: true, msg: false }", "{ valid: true, msg: () => 'no' }",
  "{ valid: true, 'valid': 0 }", "{ valid: true, msg: 'good', 'msg': false }",
];
test.each(invalidValidationResults)("dcouplr validation rejects a known invalid return: %s", result => {
  for (const callback of [`() => (${result})`, `function check() { return (${result}); }`, `() => { if (input) return (${result}); return true; }`]) {
    expect(policyFindings(`stage.addValidationPolicy(${callback});`)).toContain("dcouplr/DCP-FACTORY-VALIDATION-001");
  }
});
test.each([
  "stage.addValidationPolicy(() => {});", "stage.addValidationPolicy(function check() {});",
  "stage.addValidationPolicy(() => { return; });", "stage.addValidationPolicy(() => { if (input) { return; } return true; });",
  "stage['addValidationPolicy'](/* policy */ () => ({ valid: 1 }));",
  "stage?.addValidationPolicy?.((() => (1 as any)) as Policy);",
  "stage.addValidationPolicy(() => { function nested() { return true; } return 1; });",
  "stage.addValidationPolicy(() => 1, ...extra);",
  "stage.addValidationPolicy(() => ({ valid: 'false' }), ...extra);",
])("dcouplr validation catches empty and wrapped returns: %s", code => {
  expect(policyFindings(code)).toContain("dcouplr/DCP-FACTORY-VALIDATION-001");
});

test.each([
  "stage.addValidationPolicy();", "stage.addVerificationPolicy();", "stage.addValidationPolicy(check);",
  "stage.addVerificationPolicy(asyncCheck);", "stage.addValidationPolicy(...policies);",
  "stage[method](async () => true);", "stage.addFactoryMethod(async () => true);",
  "stage.addValidationPolicy(() => true, async () => false);",
  "stage.addValidationPolicy(() => false);", "stage.addValidationPolicy(() => !input);",
  "stage.addValidationPolicy(() => ({ valid: true }));", "stage.addValidationPolicy(() => ({ valid: false, msg: 'denied' }));",
  "stage.addValidationPolicy(() => ({ 'valid': false, 'msg': `denied${reason}` }));",
  "stage.addValidationPolicy(() => ({ valid: booleanResult, msg }));",
  "stage.addValidationPolicy(() => ({ valid }));", "stage.addValidationPolicy(() => ({ valid: +input, valid: true }));",
  "stage.addValidationPolicy(() => ({ msg: 1, 'msg': 'fixed', valid: true }));",
  "stage.addValidationPolicy(() => ({ valid: true, msg: void 0 }));",
  "stage.addValidationPolicy(() => ({ valid: true, msg: undefined }));",
  "stage.addValidationPolicy(() => ({ valid: 1, ...custom }));",
  "stage.addValidationPolicy(() => ({ ['valid']: true }));",
  "stage.addValidationPolicy(() => ({ get valid() { return true; } }));",
  "stage.addValidationPolicy(() => ({ __proto__: custom }));",
  "stage.addValidationPolicy(() => ({ 'v\\x61lid': true }));",
  "stage.addValidationPolicy(() => class Result { static valid = true; });",
  "stage.addValidationPolicy(() => result);", "stage.addValidationPolicy(() => verify(input));",
  "stage.addValidationPolicy(() => { throw new Error('rejected'); });",
  "stage.addValidationPolicy(() => { function helper() { return 1; } return true; });",
  "stage.addValidationPolicy(() => { const helper = () => { return 1; }; return { valid: true }; });",
  "stage.addValidationPolicy(() => { class Helper { invalid() { return 1; } } return true; });",
  "stage.addVerificationPolicy(() => { return 1; });",
  "const unrelated = async () => true; stage.addValidationPolicy(() => true);",
])("dcouplr preserves valid or explicitly unresolved policy behavior: %s", code => {
  expect(policyFindings(code)).toEqual([]);
});
const files = readTree("packs/dcouplr", true);
function candidate(methodologies: string[]): ReturnType<typeof compile> {
  const preset: Preset = { name: "dcouplr-test", version: "1.0.0", engine: VERSIONS.engine,
    sources: [{ ns: "core", kind: "builtin", version: VERSIONS.core }, { ns: "dcouplr", kind: "path", path: "packs/dcouplr" }],
    methodologies, layers: {
      managed: { paths: ["src/application/**", "src/services/**"], kind: "core", mayImport: ["ports"] },
      ports: { paths: ["src/ports/**"], kind: "port", mayImport: [] },
      adapters: { paths: ["src/adapters/**"], kind: "adapter", mayImport: ["ports"] },
      bootstrap: { paths: ["src/bootstrap/**"], kind: "main", mayImport: ["managed", "ports", "adapters"] },
    } };
  return compile(JSON.stringify(preset), (source) => source.kind === "builtin" ? BUILTIN : files, VERSIONS);
}
function lock(): Lock {
  const methodologies = Object.entries(files).filter(([path]) => path.startsWith("methodologies/") && path.endsWith(".json"))
    .map(([, text]) => JSON.parse(text).id as string);
  const result = candidate(methodologies);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  return result.lock;
}
function denied(path: string, text: string): string[] {
  const policy = lock();
  const result = analyze(policy, "pre", path, text, { read: () => null, now: clock });
  if ("cause" in result) throw new Error(result.cause);
  return blocking(policy, result.violations, null).violations.map((v) => v.rule);
}
function parsedDenials(parsed: ReturnType<typeof parse>, path: string, text: string): string[] {
  try {
    expect(parsed.root.hasError).toBe(false);
    return denied(path, text);
  } finally { parsed.root.tree.delete(); }
}

const FACTORY_OWNERSHIP_RULES = ["dcouplr/DCP-FACTORY-EFFECTS-001", "dcouplr/DCP-INJECT-001", "dcouplr/DCP-ARITY-001", "dcouplr/DCP-NEW-001"];
function factoryOwnership(path: string, text: string): string[] {
  const result = analyze(lock(), "pre", path, text, { read: () => null, now: clock });
  if ("cause" in result) throw new Error(result.cause);
  return [...new Set(result.violations.map(v => v.rule).filter(id => FACTORY_OWNERSHIP_RULES.includes(id)))].sort();
}
const factoryMembers = ["stage.addFactoryMethod", "stage['addFactoryMethod']", 'stage["addFactoryMethod"]', "stage[`addFactoryMethod`]",
  "stage?.['addFactoryMethod']", "(stage.addFactoryMethod as CreatorSetter)", "stage.addFactoryMethod!"];
const factoryWrappers = [(creator: string) => creator, (creator: string) => `(${creator})`,
  (creator: string) => `((${creator}) as Creator)`, (creator: string) => `((${creator}) satisfies Creator)`,
  (creator: string) => `((${creator})!)`];
for (const [memberIndex, member] of factoryMembers.entries()) for (const [wrapperIndex, wrap] of factoryWrappers.entries()) {
  for (const [creator, expected] of [
    ["() => Date.now()", "dcouplr/DCP-FACTORY-EFFECTS-001"],
    ["(input, kernel, required) => required", "dcouplr/DCP-INJECT-001"],
    ["(input = {}, kernel) => input", "dcouplr/DCP-ARITY-001"],
  ]) test(`dcouplr factory ownership checks inline ${expected} member ${memberIndex} wrapper ${wrapperIndex}`, () => {
    expect(factoryOwnership("src/bootstrap/register.ts", `${member}?.(/* creator */ ${wrap(creator!)});`)).toEqual([expected!]);
  });
  test(`dcouplr factory ownership preserves component roots member ${memberIndex} wrapper ${wrapperIndex}`, () => {
    expect(factoryOwnership("src/services/order.ts", `${member}?.(${wrap("(input, kernel) => new Order(input, kernel)")});`)).toEqual([]);
  });
}
for (const creator of ["() => Date.now()", "(input, kernel, required) => required", "(input = {}, kernel) => input"]) {
  for (const text of [
    `stage.addFactoryMethod(() => ({}), ${creator});`,
    `stage['addFactoryMethod']?.(() => ({}), ${creator});`,
    `stage.addFactoryMethod(...creators, ${creator});`,
    `stage.addFactoryMethod(wrap(${creator}));`,
  ]) test(`dcouplr factory ownership does not infer a creator from extra or indirect arguments: ${text}`, () => {
    expect(factoryOwnership("src/bootstrap/register.ts", text)).toEqual([]);
  });
}
test.each(["ts", "tsx", "js", "jsx"])("dcouplr factory ownership uses the actual %s grammar", extension => {
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, 'stage["addFactoryMethod"]?.((() => Date.now()));'))
    .toEqual(["dcouplr/DCP-FACTORY-EFFECTS-001"]);
  expect(factoryOwnership(`src/services/order.${extension}`, 'stage["addFactoryMethod"]((input, kernel) => new Order(input, kernel));')).toEqual([]);
  expect(factoryOwnership(`src/services/order.${extension}`, 'stage.addFactoryMethod(() => ({}), () => new Collaborator());'))
    .toEqual(["dcouplr/DCP-NEW-001"]);
});

const namedFactoryCases = [
  (creator: string) => `const makeOrder = ${creator}; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `function boot() { const makeOrder = ${creator}; stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `{ const makeOrder = ${creator}; stage['addFactoryMethod']?.(makeOrder); }`,
  (creator: string) => `const makeOrder = ${creator}, registered = stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `const makeOrder = ((${creator}) as Creator); stage.addFactoryMethod((makeOrder));`,
  (creator: string) => `const makeOrder = ((${creator}) satisfies Creator); stage["addFactoryMethod"]((makeOrder as Creator));`,
  (creator: string) => `const makeOrder = ((${creator})!); (stage.addFactoryMethod as Setter)(makeOrder!);`,
  (creator: string) => `const makeOrder: Creator = ${creator}; stage.addFactoryMethod(/* first */ makeOrder, ignored);`,
];
for (const [index, source] of namedFactoryCases.entries()) {
  for (const [creator, expected] of [
    ["() => Date.now()", "dcouplr/DCP-FACTORY-EFFECTS-001"],
    ["function(input, kernel, required) { return required; }", "dcouplr/DCP-INJECT-001"],
    ["(input = {}, kernel) => input", "dcouplr/DCP-ARITY-001"],
  ]) test(`dcouplr named factory ownership case ${index} checks ${expected}`, () => {
    expect(factoryOwnership("src/bootstrap/register.ts", source(creator!))).toEqual([expected!]);
  });
  test(`dcouplr named factory ownership case ${index} preserves the component root`, () => {
    expect(factoryOwnership("src/services/order.ts", source("(input, kernel) => new Order(input, kernel)"))).toEqual([]);
  });
}
const namedFactoryGaps = [
  (creator: string) => `const makeOrder = ${creator}; stage.addFactoryMethod(() => 1, makeOrder);`,
  (creator: string) => `const makeOrder = ${creator}; stage.addFactoryMethod(other);`,
  (creator: string) => `const makeOrder = ${creator}; function boot(makeOrder) { stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `const makeOrder = ${creator}; { const makeOrder = () => 1; stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `let makeOrder = ${creator}; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `var makeOrder = ${creator}; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `const makeOrder = ${creator}; { stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `stage.addFactoryMethod(makeOrder); const makeOrder = ${creator};`,
  (creator: string) => `const registered = stage.addFactoryMethod(makeOrder), makeOrder = ${creator};`,
  (creator: string) => `const makeOrder = ${creator}; stage.addFactoryMethod(wrap(makeOrder));`,
  (creator: string) => `const makeOrder = ${creator}; stage.addFactoryMethod(...others, makeOrder);`,
  (creator: string) => `const makeOrder = ${creator}; export { makeOrder };`,
];
for (const [index, source] of namedFactoryGaps.entries()) for (const creator of [
  "() => Date.now()", "function(input, kernel, required) { return required; }", "(input = {}, kernel) => input",
]) test(`dcouplr named factory ownership does not infer case ${index}: ${creator}`, () => {
  expect(factoryOwnership("src/bootstrap/register.ts", source(creator))).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr named factory ownership uses the actual %s grammar", extension => {
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, "const creator = function named() { return Date.now(); }; stage.addFactoryMethod(creator);"))
    .toEqual(["dcouplr/DCP-FACTORY-EFFECTS-001"]);
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, "const other = function creator() { return Date.now(); }; stage.addFactoryMethod(creator);"))
    .toEqual([]);
  expect(factoryOwnership(`src/services/order.${extension}`, "const creator = (input, kernel) => new Order(input, kernel); stage.addFactoryMethod(creator);"))
    .toEqual([]);
});
test.each(["creator(input, kernel)", "(creator)(input, kernel)", "creator?.(input, kernel)",
  "(creator as Creator)(input, kernel)", "creator!(input, kernel)"])("dcouplr named factory root retains direct-call protection: %s", call => {
  expect(factoryOwnership("src/services/order.ts", `const creator = (input, kernel) => new Order(input, kernel); stage.addFactoryMethod(creator); ${call};`))
    .toEqual(["dcouplr/DCP-NEW-001"]);
});
test("dcouplr named factory root does not infer nested-shadow direct calls", () => {
  expect(factoryOwnership("src/services/order.ts", "const creator = (input, kernel) => new Order(input, kernel); stage.addFactoryMethod(creator); function unrelated(creator) { return creator(); }"))
    .toEqual([]);
});

const declaredFactoryCases = [
  (creator: string) => `${creator} stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `stage.addFactoryMethod(makeOrder); ${creator}`,
  (creator: string) => `function boot() { ${creator} stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `{ stage['addFactoryMethod']?.((makeOrder)); ${creator} }`,
  (creator: string) => `export ${creator} stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `stage.addFactoryMethod(makeOrder as Creator); export ${creator}`,
  (creator: string) => `export default ${creator} stage.addFactoryMethod(makeOrder!);`,
];
for (const [index, source] of declaredFactoryCases.entries()) for (const [creator, expected] of [
  ["function makeOrder() { return Date.now(); }", "dcouplr/DCP-FACTORY-EFFECTS-001"],
  ["function makeOrder(input, kernel, required) { return required; }", "dcouplr/DCP-INJECT-001"],
  ["function makeOrder(input = {}, kernel) { return input; }", "dcouplr/DCP-ARITY-001"],
]) test(`dcouplr declared factory case ${index} checks ${expected}`, () => {
  expect(factoryOwnership("src/bootstrap/register.ts", source(creator!))).toEqual([expected!]);
});
const exportedFactoryCases = [
  (creator: string) => `export const makeOrder = ${creator}; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `export const makeOrder = ((${creator}) as Creator); stage['addFactoryMethod']?.((makeOrder));`,
  (creator: string) => `export const makeOrder = ((${creator}) satisfies Creator); stage.addFactoryMethod(makeOrder!);`,
  (creator: string) => `export const makeOrder = ((${creator})!); stage.addFactoryMethod(makeOrder as Creator);`,
  (creator: string) => `export const makeOrder = ${creator}, registered = stage.addFactoryMethod(makeOrder);`,
];
for (const [index, source] of exportedFactoryCases.entries()) for (const [creator, expected] of [
  ["() => Date.now()", "dcouplr/DCP-FACTORY-EFFECTS-001"],
  ["function(input, kernel, required) { return required; }", "dcouplr/DCP-INJECT-001"],
  ["(input = {}, kernel) => input", "dcouplr/DCP-ARITY-001"],
]) test(`dcouplr exported factory case ${index} checks ${expected}`, () => {
  expect(factoryOwnership("src/bootstrap/register.ts", source(creator!))).toEqual([expected!]);
});
const declaredFactoryGaps = [
  (creator: string) => `${creator} stage.addFactoryMethod(other);`,
  (creator: string) => `${creator} stage.addFactoryMethod(() => 1, makeOrder);`,
  (creator: string) => `${creator} stage.addFactoryMethod(...other, makeOrder);`,
  (creator: string) => `${creator} stage.addFactoryMethod(wrap(makeOrder));`,
  (creator: string) => `${creator} function boot(makeOrder) { stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `${creator} { const makeOrder = () => 1; stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `${creator} { stage.addFactoryMethod(makeOrder); }`,
  (creator: string) => `${creator} makeOrder = other; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} makeOrder ||= other; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} [makeOrder] = values; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} ({makeOrder} = values); stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} ({alias: makeOrder} = values); stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} makeOrder++; stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} for (makeOrder of values) {} stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} function overwrite() { makeOrder = other; } stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} function makeOrder() { return 1; } stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `function makeOrder() { return 1; } ${creator} stage.addFactoryMethod(makeOrder);`,
  (creator: string) => `${creator} var makeOrder = other; stage.addFactoryMethod(makeOrder);`,
];
for (const [index, source] of declaredFactoryGaps.entries()) for (const creator of [
  "function makeOrder() { return Date.now(); }", "function makeOrder(input, kernel, required) { return required; }",
  "function makeOrder(input = {}, kernel) { return input; }",
]) test(`dcouplr declared factory does not infer ambiguous case ${index}: ${creator}`, () => {
  expect(factoryOwnership("src/bootstrap/register.ts", source(creator))).toEqual([]);
});
test.each(["ts", "tsx", "js", "jsx"])("dcouplr declared and exported factories use the actual %s grammar", extension => {
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, "stage.addFactoryMethod(makeOrder); function makeOrder() { return Date.now(); }"))
    .toEqual(["dcouplr/DCP-FACTORY-EFFECTS-001"]);
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, "export const makeOrder = () => Date.now(); stage.addFactoryMethod(makeOrder);"))
    .toEqual(["dcouplr/DCP-FACTORY-EFFECTS-001"]);
  expect(factoryOwnership(`src/bootstrap/register.${extension}`, "function makeOrder(input, kernel) { return kernel.dependencies.resolve('STORE', input); } stage.addFactoryMethod(makeOrder);"))
    .toEqual([]);
});
test.each([
  "export const creator = (input, kernel) => new Order(input, kernel); stage.addFactoryMethod(creator);",
  "export const creator = (input, kernel) => new Order(input, kernel), registration = stage.addFactoryMethod(creator);",
  "const creator = (input, kernel) => new Order(input, kernel); export {creator}; stage.addFactoryMethod(creator);",
  "const creator = (input, kernel) => new Order(input, kernel); export {creator as make}; stage.addFactoryMethod(creator);",
  "const creator = (input, kernel) => new Order(input, kernel); export default creator; stage.addFactoryMethod(creator);",
  "function creator(input, kernel) { return new Order(input, kernel); } stage.addFactoryMethod(creator);",
])("dcouplr does not infer exclusive root ownership of an exported or declared factory: %s", source => {
  expect(factoryOwnership("src/services/order.ts", source)).toEqual(["dcouplr/DCP-NEW-001"]);
});
test("dcouplr root ownership does not confuse an exported alias with its local source", () => {
  expect(factoryOwnership("src/services/order.ts", "const creator = (input, kernel) => new Order(input, kernel); const other = 1; export {other as creator}; stage.addFactoryMethod(creator);"))
    .toEqual([]);
});
test.each([
  "function makeOrder(Date) { return Date.now(); } stage.addFactoryMethod(makeOrder);",
  "export function makeOrder(input, kernel) { type Capture = typeof fetch; return kernel; } stage.addFactoryMethod(makeOrder);",
  "export const makeOrder = () => 1; stage.addFactoryMethod(makeOrder);",
  "stage.addFactoryMethod(makeOrder); export const makeOrder = () => Date.now();",
  "export const registered = stage.addFactoryMethod(makeOrder), makeOrder = () => Date.now();",
  "export const makeOrder = () => Date.now(); function boot(makeOrder) { stage.addFactoryMethod(makeOrder); }",
  "function makeOrder() { return Date.now(); } export function makeOrder() { return 1; } stage.addFactoryMethod(makeOrder);",
  "export function makeOrder() { return Date.now(); } function makeOrder() { return 1; } stage.addFactoryMethod(makeOrder);",
])("dcouplr declared/exported factory boundaries preserve valid or unresolved values: %s", source => {
  expect(factoryOwnership("src/bootstrap/register.ts", source)).toEqual([]);
});
test.each([
  "export {creator} from './other';",
  "export type {creator};",
  "export {type creator};",
])("dcouplr root ownership distinguishes an erased or foreign export: %s", statement => {
  expect(factoryOwnership("src/services/order.ts", `const creator = (input, kernel) => new Order(input, kernel); ${statement} stage.addFactoryMethod(creator);`))
    .toEqual([]);
});
test.each(["(creator)", "creator as Creator", "creator satisfies Creator", "creator!"])("dcouplr root ownership follows a transparent default export: %s", value => {
  expect(factoryOwnership("src/services/order.ts", `const creator = (input, kernel) => new Order(input, kernel); export default ${value}; stage.addFactoryMethod(creator);`))
    .toEqual(["dcouplr/DCP-NEW-001"]);
});

test.each(["console.log('x')", "Date.now()", "document.title", "fetch('/orders')",
  "localStorage.getItem('x')", "Math.random()", "process.env.MODE", "sessionStorage.getItem('x')",
  "new WebSocket(url)", "window.location"])("dcouplr factory policy covers ambient dependency %s", (expression) => {
  expect(denied("src/bootstrap/register.ts", `admission.addFactoryMethod(() => ({ run: () => ${expression} }));`))
    .toContain("dcouplr/DCP-FACTORY-EFFECTS-001");
});

test("dcouplr rejects direct construction while admitting injected collaborators and factory roots", () => {
  expect(denied("src/services/orders.ts", "class Orders { run() { return new Store(); } }"))
    .toContain("dcouplr/DCP-NEW-001");
  expect(denied("src/services/orders.ts", "admission.addFactoryMethod((input, kernel) => new Orders(input, kernel));"))
    .not.toContain("dcouplr/DCP-NEW-001");
  expect(denied("src/services/orders.ts", "const run = (kernel) => kernel.dependencies.resolve('STORE');")).toEqual([]);
  expect(denied("src/adapters/http.ts", "const run = () => fetch('/orders');")).toEqual([]);
});

test.each([
  "export const kernel = d.getDcouplr();",
  "export const kernel = d['getDcouplr']();",
  "const { getDcouplr: get } = d; export const kernel = get();",
  "export const kernel = d.runtime.getDcouplr();",
])("dcouplr rejects a namespace runtime locator: %s", (usage) => {
  expect(denied("src/services/orders.ts", `import * as d from 'dcouplr';\n${usage}`))
    .toContain("dcouplr/DCP-LOCATOR-001");
});

test.each([
  "export const kernel = d.getDcouplrForTesting();",
  "export const reset = d['resetDcouplrForTesting'];",
  "const { resetDcouplrForTesting: reset } = d; reset();",
])("dcouplr rejects a namespace test helper in production: %s", (usage) => {
  expect(denied("src/bootstrap/main.ts", `import * as d from 'dcouplr';\n${usage}`))
    .toContain("dcouplr/DCP-TEST-001");
});

test("dcouplr runtime policies admit type-only imports, public constants and shadowed namespaces", () => {
  expect(denied("src/services/orders.ts", "import type { getDcouplr, resetDcouplrForTesting } from 'dcouplr'; export type Kernel = ReturnType<typeof getDcouplr>;"))
    .toEqual([]);
  expect(denied("src/services/orders.ts", "import { type getDcouplr, type resetDcouplrForTesting } from 'dcouplr'; export type Kernel = ReturnType<typeof getDcouplr>;"))
    .toEqual([]);
  expect(denied("src/services/orders.ts", "import * as d from 'dcouplr'; export const priority = d.QueuePriorities.Normal;"))
    .toEqual([]);
  expect(denied("src/services/orders.ts", "import * as d from 'dcouplr'; export const current = (d: { getDcouplr(): number }) => d.getDcouplr();"))
    .toEqual([]);
  expect(denied("src/bootstrap/main.ts", "import * as d from 'dcouplr'; d.setupDcouplr({ charEncoding: 'UTF-8' });"))
    .toEqual([]);
  expect(denied("test/runtime.test.ts", "import * as d from 'dcouplr'; d.resetDcouplrForTesting();"))
    .toEqual([]);
});

test.each([
  "(input, kernel, required) => ({ input, required })",
  "function (input, kernel, required) { return { input, required }; }",
  "(input, /* kernel */ kernel, required: string) => ({ required })",
  "function (this: void, input: object, kernel: unknown, required: string) { return { required }; }",
])("dcouplr rejects a required factory argument that it cannot inject: %s", (factory) => {
  expect(denied("src/bootstrap/register.ts", `admission.addFactoryMethod(${factory});`))
    .toContain("dcouplr/DCP-INJECT-001");
});

test.each([
  "() => ({ ready: true })",
  "input => ({ input })",
  "(input, kernel) => ({ input, kernel })",
  "(input, kernel, optional?: string) => ({ optional })",
  "(input, kernel, ownDefault = 'local') => ({ ownDefault })",
  "function (this: void, input: object, kernel: unknown) { return { input, kernel }; }",
])("dcouplr admits a supported factory signature: %s", (factory) => {
  expect(denied("src/bootstrap/register.ts", `admission.addFactoryMethod(${factory});`))
    .not.toContain("dcouplr/DCP-INJECT-001");
});

test.each(["registerForce", "registerSingletonForce"])("dcouplr reserves %s for test modules", (method) => {
  const code = `stage.${method}({ id: 'order' });`;
  expect(denied("src/bootstrap/register.ts", code)).toContain("dcouplr/DCP-FORCE-001");
  const colocated = denied("src/orders/order.test.ts", code);
  expect(colocated).not.toContain("dcouplr/DCP-FORCE-001");
  expect(colocated).toEqual(["dcouplr/DCP-EDGE-001"]);
  expect(denied("tests/order.ts", code)).toEqual([]);
});

test("dcouplr force policy covers literal brackets and optional calls but admits normal admission", () => {
  for (const call of ["stage['registerForce']()", "stage?.registerSingletonForce?.()", "stage[`registerForce`]()"]) {
    expect(denied("src/bootstrap/register.ts", call)).toContain("dcouplr/DCP-FORCE-001");
  }
  expect(denied("src/bootstrap/register.ts", "stage.register(); stage.registerSingleton({});")).toEqual([]);
  expect(denied("src/bootstrap/register.ts", "const member = 'registerForce'; const stage = { registerForce() {} };"))
    .toEqual([]);
});

test.each([
  "{ segmentCapacity: 0, maxSegments: 1 }",
  "{ segmentCapacity: 1, maxSegments: 1.5 }",
  "{ persistence: { aotMs: -1 } }",
  "{ persistence: { maxPendingOps: 0 } }",
])("dcouplr rejects invalid queue numeric literals: %s", (config) => {
  expect(denied("src/bootstrap/register.ts", `kernel.dependencies.resolve('I_QUEUE', ${config});`))
    .toContain("dcouplr/DCP-QUEUE-NUM-001");
});

test.each([
  "kernel.dependencies.resolve('I_QUEUE', /* configuration */ { segmentCapacity: 0 });",
  "kernel.dependencies.resolve(/* key */ 'I_QUEUE', { persistence: { aotMs: -1 } });",
])("comments do not bypass dcouplr queue literal checks: %s", (code) => {
  expect(denied("src/bootstrap/register.ts", code)).toContain("dcouplr/DCP-QUEUE-NUM-001");
});

test.each([
  "kernel.dependencies.resolve('I_QUEUE', { segmentCapacity: 1.0, maxSegments: 0x10 });",
  "kernel.dependencies.resolve(system.DependencyKeys.IQueue, { persistence: { aotMs: 1e3, maxPendingOps: 2 } });",
  "kernel.dependencies.resolve('STORE', { segmentCapacity: 0 });",
  "kernel.dependencies.resolve('I_QUEUE', { metadata: { segmentCapacity: 0 } });",
  "kernel.dependencies.resolve('I_QUEUE', { aotMs: 0 });",
  "kernel.dependencies.resolve('I_QUEUE', { segmentCapacity: configuredSize });",
  "kernel.dependencies.resolve('I_QUEUE', { segmentCapacity: 0, 'segmentCapacity': 1 });",
  "kernel.dependencies.resolve('I_QUEUE', { persistence: { aotMs: -1, aotMs: 10 } });",
  "kernel.dependencies.resolve('I_QUEUE', { persistence: { aotMs: -1 }, persistence: { aotMs: 10 } });",
  "kernel.dependencies.resolve('I_QUEUE', { segmentCapacity: 0, ...config });",
  "kernel.dependencies.resolve('I_QUEUE', { persistence: { aotMs: -1, ...persistence } });",
  "kernel.dependencies.resolve('I_QUEUE', { segmentCapacity: 0, [key]: 1 });",
  "kernel.dependencies.resolve('I_QUEUE', { persistence: { aotMs: -1, [key]: 10 } });",
])("dcouplr preserves valid or unrelated queue configuration: %s", (code) => {
  expect(denied("src/bootstrap/register.ts", code)).not.toContain("dcouplr/DCP-QUEUE-NUM-001");
});

test("dcouplr stays optional and metadata does not activate a methodology", () => {
  const result = candidate([]);
  if ("errors" in result) throw new Error(result.errors.join("\n"));
  expect(result.lock.rules.some((rule) => rule.id.startsWith("dcouplr/"))).toBe(false);
  const catalog = packCatalog(files);
  if ("errors" in catalog) throw new Error(catalog.errors.join("\n"));
  expect(catalog.category).toBe("library");
  expect(catalog.methodologies.every((method) => method.status === "preview")).toBe(true);
});

const queueDto = "{ queueId: 'orders', segmentCapacity: 1, maxSegments: 1, persistence: { enabled: false, mode: 'lagging', aotMs: 10, maxPendingOps: 2 } }";
test.each([
  "kernel.dependencies.resolve('I_QUEUE');",
  "kernel.dependencies.resolve('I_QUEUE', null);",
  "kernel.dependencies.resolve('I_QUEUE', []);",
  "kernel.dependencies.resolve('I_QUEUE', 'orders');",
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders', ", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("segmentCapacity: 1, ", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("maxSegments: 1, ", "")});`,
  "kernel.dependencies.resolve('I_QUEUE', { queueId: 'orders', segmentCapacity: 1, maxSegments: 1 });",
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("enabled: false, ", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging', ", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("aotMs: 10, ", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace(", maxPendingOps: 2", "")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: '  '")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: 1")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("segmentCapacity: 1", "segmentCapacity: '1'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("maxSegments: 1", "maxSegments: true")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("enabled: false", "enabled: 'false'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: false")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: 'custom'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: `custom`")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("aotMs: 10", "aotMs: '10'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("maxPendingOps: 2", "maxPendingOps: null")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("persistence: { enabled: false, mode: 'lagging', aotMs: 10, maxPendingOps: 2 }", "persistence: false")});`,
  "kernel.dependencies['resolve']('I_QUEUE', {});",
  "kernel.dependencies?.resolve?.(`I_QUEUE`, /* DTO */ {});",
  "kernel.dependencies.resolve(system.DependencyKeys.IQueue, {});",
])("dcouplr rejects a known invalid built-in queue DTO: %s", (code) => {
  expect(denied("src/bootstrap/register.ts", code)).toContain("dcouplr/DCP-QUEUE-SHAPE-001");
});

test.each([
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("'orders'", "'orders:primary'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: '', queueId: 'orders'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("enabled: false", "enabled: 'false', 'enabled': false")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("enabled: false", "enabled")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: 'leading'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: `leading`")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: 'lea\\ding'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("mode: 'lagging'", "mode: `lag${suffix}`")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: configuredQueueId")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("persistence: { enabled: false, mode: 'lagging', aotMs: 10, maxPendingOps: 2 }", "persistence")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("{ enabled: false, mode: 'lagging', aotMs: 10, maxPendingOps: 2 }", "{ __proto__: persistenceConfig }")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("{ enabled: false, mode: 'lagging', aotMs: 10, maxPendingOps: 2 }", "{ '__proto__': persistenceConfig }")});`,
  "kernel.dependencies.resolve('I_QUEUE', config);",
  "kernel.dependencies.resolve('I_QUEUE', { ...config });",
  "kernel.dependencies.resolve('I_QUEUE', { [field]: value });",
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: '', ['queueId']: 'orders'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: '', 'queue\\u0049d': 'orders'")});`,
  `kernel.dependencies.resolve('I_QUEUE', ${queueDto.replace("queueId: 'orders'", "queueId: '', get queueId() { return 'orders'; }")});`,
  "kernel.dependencies.resolve('STORE', {});",
  "const value = { persistence: {} };",
])("dcouplr does not reject a valid, unrelated or unresolved queue DTO: %s", (code) => {
  expect(denied("src/bootstrap/register.ts", code)).not.toContain("dcouplr/DCP-QUEUE-SHAPE-001");
});

const kernelAdmission = (key: string, method = "register") => `app.dependencyAdmission.declareIntent(${key})
  .addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy()
  .addFactoryMethod((input, kernel) => ({ input, kernel })).${method}();`;
function kernelOwnership(path: string, text: string): boolean {
  return parsedDenials(parse(path, text), path, text).includes("dcouplr/DCP-KERNEL-001");
}

test.each([
  kernelAdmission("'DKERNEL'"),
  kernelAdmission('"DKERNEL"', "registerSingleton"),
  kernelAdmission("`DKERNEL`", "registerForce"),
  kernelAdmission("system.DependencyKeys.Kernel", "registerSingletonForce"),
  kernelAdmission("d.system['DependencyKeys'][`Kernel`]"),
  kernelAdmission("(system.DependencyKeys.Kernel as string)"),
  kernelAdmission("('DKERNEL' satisfies string)"),
  kernelAdmission("('DKERNEL' as const)!"),
  kernelAdmission("/* intent */ 'DKERNEL' /* end */"),
  kernelAdmission("'DKERNEL'").replace(".declareIntent(", "[\"declareIntent\"](").replace(".register()", "[\"register\"]()"),
  kernelAdmission("'DKERNEL'").replace(".declareIntent(", "[`declareIntent`](").replace(".register()", "[`register`]()"),
  kernelAdmission("'DKERNEL'").replaceAll(".", "?.").replace(/(declareIntent|addMandatoryInputFields|addValidationPolicy|addVerificationPolicy|addFactoryMethod|register)\(/g, "$1?.("),
  `(${kernelAdmission("'DKERNEL'").replace(".register();", "")}).register();`,
  kernelAdmission("'DKERNEL'").replace(".addMandatoryInputFields({})", "['addMandatoryInputFields']({})"),
])("dcouplr preserves bootstrap kernel ownership in a direct admission chain: %s", (code) => {
  expect(kernelOwnership("src/bootstrap/register.ts", code)).toBe(true);
});

test.each([
  kernelAdmission("'ORDER'"),
  kernelAdmission("('ORDER' as 'DKERNEL')"),
  kernelAdmission("configuredIntent"),
  kernelAdmission("keys.Kernel"),
  kernelAdmission("system.OtherKeys.Kernel"),
  kernelAdmission("'DKERNEL'").replace(".register();", ".createOnly();"),
  "app.dependencyAdmission.declareIntent('DKERNEL');",
  "const step = app.dependencyAdmission.declareIntent('DKERNEL'); step.register();",
  "const register = builder.register; register();",
  "const text = \"app.declareIntent('DKERNEL').register()\";",
  "builder.register(app.dependencyAdmission.declareIntent('DKERNEL'));",
  "app.declareIntent('ORDER').addFactoryMethod(() => app.declareIntent('DKERNEL')).register();",
  "app.declareIntent('ORDER').addFactoryMethod(() => app.declareIntent('DKERNEL').addFactoryMethod(factory).createOnly()).register();",
  "app.declareIntent('ORDER').addFactoryMethod((input, kernel) => ({ kernel, intent: 'DKERNEL' })).register();",
])("dcouplr preserves valid factories and leaves unresolved kernel ownership explicit: %s", (code) => {
  expect(kernelOwnership("src/bootstrap/register.ts", code)).toBe(false);
});

test("dcouplr kernel ownership also applies to a direct registration in a test module", () => {
  expect(kernelOwnership("src/bootstrap/kernel.test.ts", kernelAdmission("'DKERNEL'", "registerSingletonForce"))).toBe(true);
});

function subscriptionFindings(text: string): string[] {
  const path = "src/bootstrap/subscriptions.ts";
  return parsedDenials(parse(path, text), path, text).filter((id) => /^dcouplr\/DCP-(EVENT|MESSAGE)-(SUB|TEARDOWN)-001$/.test(id));
}

const sequenceMethods = ["declareIntent", "addMandatoryInputFields", "addValidationPolicy", "addVerificationPolicy", "addFactoryMethod",
  "createOnly", "register", "registerSingleton", "registerForce", "registerSingletonForce",
  "raisesEvents", "sendsMessages", "usesDependencies", "reactsTo", "withExtendedInfo"];
const registrationMethods = sequenceMethods.slice(10);
const sequenceEdges = sequenceMethods.flatMap((previous, index) => {
  const valid = index < 4 ? [sequenceMethods[index + 1]] : index === 4 ? sequenceMethods.slice(5, 10)
    : index === 5 ? [] : registrationMethods;
  return sequenceMethods.map((next) => ({ previous, next, valid: valid.includes(next) }));
});
function sequenceFindings(text: string): string[] {
  const path = "src/bootstrap/sequence.ts";
  return parsedDenials(parse(path, text), path, text).filter((id) => id === "dcouplr/DCP-FACTORY-SEQUENCE-001");
}
test.each(sequenceEdges)("dcouplr direct admission edge $previous -> $next (valid: $valid)", ({ previous, next, valid }) => {
  const code = `builder.${previous}(() => ({})).${next}(() => ({}));`;
  expect(sequenceFindings(code)).toEqual(valid ? [] : ["dcouplr/DCP-FACTORY-SEQUENCE-001"]);
});
test.each([
  "builder['declareIntent']('ORDER')[`addFactoryMethod`](() => ({}));",
  "((builder.declareIntent('ORDER') as Step)!).addVerificationPolicy();",
  "builder?.addMandatoryInputFields?.({})?.register?.();",
  "(builder.addFactoryMethod(() => ({})) satisfies Stage).addValidationPolicy();",
  "builder.addFactoryMethod(() => ({})).createOnly().register();",
])("dcouplr direct stage order resists literal member and wrapper bypasses: %s", (code) => {
  expect(sequenceFindings(code)).toEqual(["dcouplr/DCP-FACTORY-SEQUENCE-001"]);
});
test.each([
  "builder.declareIntent('ORDER').addMandatoryInputFields({}).addValidationPolicy().addVerificationPolicy().addFactoryMethod(() => ({})).register().raisesEvents([]).usesDependencies([]);",
  "builder.addFactoryMethod(() => ({})).createOnly().create(input, kernel);",
  "const stage = builder.declareIntent('ORDER'); stage.addFactoryMethod(creator);",
  "builder.declareIntent('ORDER')[nextStage](creator);",
  "builder.declareIntent('ORDER').customStage(creator);",
  "builder.addFactoryMethod(() => { const item = other.declareIntent('NESTED'); return item; }).register();",
  "builder.addFactoryMethod(() => ({})).register().withExtendedInfo({ label: 'Order' }).reactsTo([]);",
  "// builder.declareIntent('ORDER').register()\nconst example = 'builder.addMandatoryInputFields({}).register()';",
])("dcouplr preserves valid direct sequences and discloses indirection: %s", (code) => {
  expect(sequenceFindings(code)).toEqual([]);
});

function admissionFindings(text: string): string[] {
  const path = "src/bootstrap/admission.ts";
  return parsedDenials(parse(path, text), path, text).filter((id) => /^dcouplr\/DCP-FACTORY-(CALLABLE|SINGLETON)-001$/.test(id));
}

test.each([
  "stage.addFactoryMethod();", "stage.addFactoryMethod(null);", "stage.addFactoryMethod('creator');",
  "stage.addFactoryMethod({});", "stage.addFactoryMethod([]);", "stage.addFactoryMethod(false);",
  "stage.addFactoryMethod(/creator/);", "stage.addFactoryMethod(class Creator {});",
  "stage.addFactoryMethod(void 0);", "stage.addFactoryMethod(typeof creator);",
  "stage?.['addFactoryMethod']?.(/* ignored */ 7);",
  "stage.addFactoryMethod(((false as unknown as Creator)));",
  "stage.addValidationPolicy(null);", "stage.addValidationPolicy(true);", "stage.addValidationPolicy({});",
  "stage['addValidationPolicy']('valid');", "stage.addValidationPolicy((7 satisfies number));",
  "stage.addVerificationPolicy(false);", "stage.addVerificationPolicy(null);",
  "stage[`addVerificationPolicy`](/* ignored */ []);",
])("dcouplr rejects an invalid admission callback: %s", (code) => {
  expect(admissionFindings(code)).toContain("dcouplr/DCP-FACTORY-CALLABLE-001");
});

test.each([
  "admission.addFactoryMethod(() => ({})).registerSingleton(null);",
  "admission.addFactoryMethod(() => ({})).registerSingleton(7);",
  "admission.addFactoryMethod(() => ({})).registerSingleton('input');",
  "admission.addFactoryMethod(() => ({})).registerSingleton(false);",
  "admission.addFactoryMethod(() => ({})).registerSingleton(() => ({}));",
  "admission.addFactoryMethod(() => ({})).registerSingleton(class Input {});",
  "admission.addFactoryMethod(() => ({})).registerSingleton(typeof input);",
  "admission['addFactoryMethod'](creator)['registerSingleton'](/* ignored */ -1);",
  "(admission.addFactoryMethod(creator) as Stage)?.registerSingleton?.((false satisfies boolean));",
  "admission.addFactoryMethod(creator).registerSingletonForce(null);",
])("dcouplr rejects an invalid fluent singleton input: %s", (code) => {
  expect(admissionFindings(code)).toContain("dcouplr/DCP-FACTORY-SINGLETON-001");
});

test.each([
  "stage.addFactoryMethod(() => ({}));", "stage.addFactoryMethod(function creator(input) { return input; });",
  "stage.addFactoryMethod(creator);", "stage.addFactoryMethod(resolveCreator());",
  "stage.addFactoryMethod(...argumentsFromConfig);",
  "stage.addValidationPolicy();", "stage.addValidationPolicy(undefined);", "stage.addValidationPolicy(void 0);",
  "stage.addValidationPolicy(() => true);", "stage.addVerificationPolicy();",
  "stage.addVerificationPolicy(undefined);", "stage.addVerificationPolicy(void effect());",
  "stage.addVerificationPolicy(created => { check(created); });",
  "stage.addVerificationPolicy(...policies);",
  "admission.addFactoryMethod(creator).registerSingleton();",
  "admission.addFactoryMethod(creator).registerSingleton(undefined);",
  "admission.addFactoryMethod(creator).registerSingleton(void 0);",
  "admission.addFactoryMethod(creator).registerSingleton({ id: 'original' });",
  "admission.addFactoryMethod(creator).registerSingleton([]);",
  "admission.addFactoryMethod(creator).registerSingleton(/input/);",
  "admission.addFactoryMethod(creator).registerSingleton(input);",
  "admission.addFactoryMethod(creator).registerSingleton(...inputs);",
  "store.registerSingleton(7);", "const stage = admission.addFactoryMethod(creator); stage.registerSingleton(7);",
  "// stage.addFactoryMethod(null)\nconst text = 'stage.addVerificationPolicy(false)';",
])("dcouplr preserves valid or unresolved admission inputs: %s", (code) => {
  expect(admissionFindings(code)).toEqual([]);
});

test.each([
  ["EVENT-SUB", "kernel.event.subscribe('ORDER', listener);"],
  ["EVENT-SUB", "kernel.event.subscribe('ORDER', async event => {});"],
  ["EVENT-SUB", "kernel.event.subscribe(null, 'ORDER');"],
  ["EVENT-SUB", "kernel.event.subscribe({}, 'ORDER');"],
  ["EVENT-SUB", "kernel.event.subscribe();"],
  ["EVENT-SUB", "kernel.event.subscribe(listener);"],
  ["EVENT-SUB", "kernel.event.subscribe(listener, '');"],
  ["EVENT-SUB", "kernel.event.subscribe(listener, 7);"],
  ["EVENT-SUB", "kernel.event.subscribe(listener, async () => {});"],
  ["EVENT-SUB", "kernel.event.subscribe(listener, 'ORDER', false);"],
  ["EVENT-SUB", "kernel['event'][`subscribe`](/* before */ 'ORDER', listener);"],
  ["EVENT-SUB", "kernel?.event?.subscribe?.(listener, /* ignored */ null);"],
  ["EVENT-SUB", "kernel.event.subscribe((('ORDER' as string)), listener);"],
  ["EVENT-SUB", "kernel.event.subscribe(listener, (7 satisfies number));"],
  ["MESSAGE-SUB", "kernel.message.registerHandler('peer', handler);"],
  ["MESSAGE-SUB", "kernel.message.registerHandler('peer', async message => {});"],
  ["MESSAGE-SUB", "kernel.message.registerHandler(false);"],
  ["MESSAGE-SUB", "kernel.message.registerHandler(/handler/);"],
  ["MESSAGE-SUB", "kernel.message.registerHandler();"],
  ["MESSAGE-SUB", "kernel.message.registerHandler(handler, {});"],
  ["MESSAGE-SUB", "kernel.message.registerHandler(handler, 'peer', 9);"],
  ["MESSAGE-SUB", "kernel['message']['registerHandler']?.('peer', handler);"],
  ["MESSAGE-SUB", "kernel.message.registerHandler((false as unknown as Handler));"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribe('event_sub_1');"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribe(async event => {});"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribe(function listener(event) {});"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribe();"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribeBySubscriptionId(listener => {});"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribeBySubscriptionId(1);"],
  ["EVENT-TEARDOWN", "kernel['event'][`unsubscribe`]('ORDER');"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribeBySubscriptionId();"],
  ["EVENT-TEARDOWN", "kernel.event.unsubscribe(((event => {}) as Listener));"],
  ["MESSAGE-TEARDOWN", "kernel.message.unregisterHandler(async message => {});"],
  ["MESSAGE-TEARDOWN", "kernel.message.unregisterHandlerBySubscriptionId({});"],
  ["MESSAGE-TEARDOWN", "kernel.message.unregisterHandler();"],
  ["MESSAGE-TEARDOWN", "kernel.message.unregisterHandlerBySubscriptionId();"],
  ["MESSAGE-TEARDOWN", "kernel.message.unregisterHandlerBySubscriptionId(false);"],
  ["MESSAGE-TEARDOWN", "kernel?.message?.['unregisterHandler']?.(null);"],
])("dcouplr rejects an incorrect %s contract: %s", (rule, code) => {
  expect(subscriptionFindings(code)).toContain(`dcouplr/DCP-${rule}-001`);
});

test.each([
  "const id = kernel.event.subscribe(listener, 'ORDER'); kernel.event.unsubscribe(listener);",
  "const id = kernel.event.subscribe(async event => {}, 'ORDER', 'listener'); kernel.event.unsubscribeBySubscriptionId(id);",
  "kernel.event.subscribe(function listener(event) {}, 'ORDER');",
  "kernel.event.subscribe(listener, `ORDER`, '');",
  "kernel['event'][`subscribe`](/* before */ listener, /* between */ 'ORDER');",
  "kernel?.event?.subscribe?.(listener, eventType);",
  "kernel.event.subscribe((listener as Listener), ('ORDER' satisfies string));",
  "kernel.eventBus.subscribe('ORDER', listener); kernel.eventBus.unsubscribe(listener);",
  "kernel.messageBus.subscribe('peer', handler); kernel.messageBus.unsubscribe(handler);",
  "kernel.message.registerHandler(handler);",
  "kernel.message.registerHandler(handler, undefined, 'human');",
  "kernel.message.registerHandler(async message => {}, 'peer', 'handler');",
  "kernel.message.registerHandler(function handler(message) {}, '');",
  "kernel.message.registerHandler(handler, peer, handlerId);",
  "kernel['message']['registerHandler'](handler, `peer`);",
  "kernel.message.unregisterHandler('peer');",
  "kernel.message.unregisterHandlerBySubscriptionId(id);",
  "kernel.event.unsubscribeBySubscriptionId('event_sub_1');",
  "kernel.event.unsubscribe(listener);",
  "store.subscribe('ORDER', listener); store.unsubscribe('ORDER');",
  "bus.registerHandler('peer', handler); bus.unregisterHandler(handler);",
  "const event = kernel.event; event.subscribe('ORDER', listener);",
  "kernel[gateName].subscribe('ORDER', listener);",
  "const text = \"kernel.event.subscribe('ORDER', listener)\";",
  "// kernel.event.subscribe('ORDER', listener)\nexport const value = 1;",
])("dcouplr preserves valid or unresolved subscription contracts: %s", (code) => {
  expect(subscriptionFindings(code)).toEqual([]);
});

test("pack classification rejects unknown values and preserves uncategorized local sources", () => {
  const metadata = JSON.parse(files["source.json"]!);
  expect(packCatalog({ ...files, "source.json": JSON.stringify({ ...metadata, category: "unknown" }) })).toHaveProperty("errors");
  delete metadata.category;
  expect(packCatalog({ ...files, "source.json": JSON.stringify(metadata) })).toHaveProperty("category", null);
  expect(packCatalog({ ...files, "source.json": "{" })).toHaveProperty("errors");
});
