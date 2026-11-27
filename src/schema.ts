import check from "../schema/check.v1.json" with { type: "json" };
import fixture from "../schema/fixture.v1.json" with { type: "json" };
import methodology from "../schema/methodology.v1.json" with { type: "json" };
import preset from "../schema/preset.v1.json" with { type: "json" };
import request from "../schema/request.v1.json" with { type: "json" };
import source from "../schema/source.v1.json" with { type: "json" };

// Interpreter for the JSON Schema subset the product uses (A13). It trusts its schemas: the six
// files and every check's params pass `unsupported` first, so no keyword is ever silently ignored.
export type SchemaName = "preset" | "check" | "methodology" | "fixture" | "source" | "request";
type Schema = Record<string, unknown>;

const SCHEMAS: Record<SchemaName, Schema> = { preset, check, methodology, fixture, source, request };
const TYPES = new Set(["object", "array", "string", "integer", "number", "boolean", "null"]);
// The value each supported keyword must have; `errors` skips a malformed one, so it is rejected here.
const SHAPES: Record<string, (x: unknown) => boolean> = {
  type: (x) => typeof x === "string" && TYPES.has(x), properties: isObject, dependentSchemas: isObject,
  required: (x) => Array.isArray(x) && x.every((k) => typeof k === "string"), enum: Array.isArray, const: () => true,
  items: isObject, pattern: (x) => typeof x === "string" && compiles(x),
  additionalProperties: (x) => x === false || isObject(x), oneOf: Array.isArray, minimum: (x) => typeof x === "number",
  minItems: (x) => Number.isInteger(x) && (x as number) >= 0,
};

// Errors as "<pointer>: <message>"; [] means valid.
export function validate(schema: SchemaName | Schema, v: unknown): string[] {
  const found = errors(typeof schema === "string" ? SCHEMAS[schema] : schema, v, "");
  return schema === "preset" ? found.map(error => error.startsWith("/overrides/") && error.endsWith("matches no allowed form")
    ? error + '. Allowed: "deny", "ask", "warn", "off", or an object with severity, enforcement ("enforce"/"shadow"), params and note. For an enforcement string, use {"enforcement":"enforce"} or {"enforcement":"shadow"}.'
    : error) : found;
}

// Keywords outside the subset (e.g. `default`, `maxLength`) and values it cannot check (e.g. `type: "date"`).
export function unsupported(schema: unknown, at = ""): string[] {
  if (!isObject(schema)) return [`${at || "/"}: a schema must be an object`];
  const out: string[] = [];
  for (const [k, sub] of Object.entries(schema)) {
    if (!Object.hasOwn(SHAPES, k)) out.push(`${at}/${k}: unsupported keyword`);
    else if (!SHAPES[k]!(sub)) out.push(`${at}/${k}: invalid value ${JSON.stringify(sub)}`);
    else if (k === "properties" || k === "dependentSchemas") {
      for (const [p, s] of Object.entries(sub as Schema)) out.push(...unsupported(s, `${at}/${k}/${p}`));
    } else if (k === "oneOf") (sub as unknown[]).forEach((s, i) => out.push(...unsupported(s, `${at}/oneOf/${i}`)));
    else if (k === "items" || (k === "additionalProperties" && sub !== false)) out.push(...unsupported(sub, `${at}/${k}`));
  }
  return out;
}

// Deep equality of JSON values; object key order does not matter.
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => equal(x, b[i]));
  if (!isObject(a) || !isObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}

function errors(s: Schema, v: unknown, at: string): string[] {
  const out: string[] = [];
  const fail = (message: string): void => void out.push(`${at || "/"}: ${message}`);
  if (Array.isArray(s.oneOf)) {
    const n = s.oneOf.filter((branch: Schema) => errors(branch, v, at).length === 0).length;
    if (n !== 1) fail(n === 0 ? "matches no allowed form" : "matches more than one allowed form");
  }
  if ("const" in s && !equal(v, s.const)) fail(`must be ${JSON.stringify(s.const)}`);
  if (Array.isArray(s.enum) && !s.enum.some((e) => equal(e, v))) {
    fail(`must be one of ${s.enum.map((e) => JSON.stringify(e)).join(", ")}`);
  }
  if (typeof s.type === "string" && !isType(v, s.type)) {
    fail(`must be of type ${s.type}`);
    return out;
  }
  if (typeof v === "string" && typeof s.pattern === "string" && !new RegExp(s.pattern, "u").test(v)) {
    fail(`must match ${s.pattern}`);
  }
  if (typeof v === "number" && typeof s.minimum === "number" && v < s.minimum) fail(`must be >= ${s.minimum}`);
  if (Array.isArray(v) && typeof s.minItems === "number" && v.length < s.minItems) fail(`must have at least ${s.minItems} items`);
  if (Array.isArray(v) && isObject(s.items)) v.forEach((x, i) => out.push(...errors(s.items as Schema, x, `${at}/${i}`)));
  if (isObject(v)) out.push(...objectErrors(s, v, at));
  return out;
}

function objectErrors(s: Schema, v: Record<string, unknown>, at: string): string[] {
  const out: string[] = [];
  const properties = isObject(s.properties) ? s.properties : {};
  for (const k of Array.isArray(s.required) ? s.required : []) if (!Object.hasOwn(v, k)) out.push(`${at}/${pointer(k)}: is required`);
  for (const [k, x] of Object.entries(v)) {
    const sub = Object.hasOwn(properties, k) ? properties[k] : s.additionalProperties;
    if (isObject(sub)) out.push(...errors(sub, x, `${at}/${pointer(k)}`));
    else if (sub === false) out.push(`${at}/${pointer(k)}: is not allowed`);
  }
  if (isObject(s.dependentSchemas)) {
    for (const [key, schema] of Object.entries(s.dependentSchemas)) {
      if (Object.hasOwn(v, key) && isObject(schema)) out.push(...errors(schema, v, at));
    }
  }
  return out;
}

function pointer(key: string): string { return key.replaceAll("~", "~0").replaceAll("/", "~1"); }

function isType(v: unknown, type: string): boolean {
  switch (type) {
    case "object": return isObject(v);
    case "array": return Array.isArray(v);
    case "integer": return Number.isInteger(v);
    case "null": return v === null;
    default: return typeof v === type;
  }
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern, "u");
    return true;
  } catch {
    return false;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
