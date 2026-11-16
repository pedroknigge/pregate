// A closed grammar for stdin JSON inspection, not a Python sandbox. Unrecognized
// scripts retain the shell guard. No project module, arbitrary call or write qualifies.
export function pythonInspection(args: { text: string; literal: boolean }[]): boolean {
  if (args.length !== 3 || args[0]?.text !== "-I" || args[1]?.text !== "-c" || !args.every(arg => arg.literal)) return false;
  const tokens = tokenize(args[2]!.text);
  if (tokens === null) return false;
  return inspectsJson(tokens);
}

function inspectionRejected(error: unknown): boolean {
  return error instanceof Error && error.message === "unsupported inspection";
}

function inspectsJson(tokens: string[]): boolean {
  try { return new JsonInspection(tokens).parse(); }
  catch (error) { if (inspectionRejected(error)) return false; throw error; }
}

function tokenize(source: string): string[] | null {
  if (source.length > 16_384) return null;
  const tokens: string[] = [];
  const token = /[ \t\r]+|\n|#[^\n]*|'(?:[^'\\\n]|\\[^\n])*'|"(?:[^"\\\n]|\\[^\n])*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|[()[\]{},.:;=+-]/y;
  for (let at = 0; at < source.length;) {
    token.lastIndex = at;
    const found = token.exec(source);
    if (found === null || tokens.length >= 2048) return null;
    at = token.lastIndex;
    if (!/^[ \t\r#]/.test(found[0])) tokens.push(found[0] === "\n" ? ";" : found[0]);
  }
  return tokens;
}

const BUILTINS = ["len", "str", "int", "float", "bool", "sorted"];
const RESERVED = ["json", "sys", "print", ...BUILTINS, "True", "False", "None"];

class JsonInspection {
  private at = 0;
  private depth = 0;
  private readonly modules = new Set<string>();
  private readonly locals = new Set<string>();
  constructor(private readonly tokens: string[]) {}
  private take(value: string): boolean { return this.tokens[this.at] === value && (++this.at > 0); }
  private need(value: string): void { if (!this.take(value)) throw new Error("unsupported inspection"); }

  parse(): boolean {
    let output = false;
    while (this.at < this.tokens.length) {
      if (this.take(";")) continue;
      const head = this.tokens[this.at++];
      if (head === "import") {
        do {
          const module = this.tokens[this.at++];
          if (module !== "sys" && module !== "json") return false;
          this.modules.add(module);
        } while (this.take(","));
      } else if (head === "print") { this.call(1, 16); output = true; }
      else {
        if (head === undefined || !/^[A-Za-z]\w*$/.test(head) || RESERVED.includes(head)) return false;
        this.need("="); this.expression(); this.locals.add(head);
      }
      if (this.at < this.tokens.length && !this.take(";")) return false;
    }
    return output;
  }

  private call(minimum: number, maximum: number): void {
    this.need("("); let count = 0;
    if (!this.take(")")) {
      do { this.expression(); count++; } while (this.take(",") && this.tokens[this.at] !== ")");
      this.need(")");
    }
    if (count < minimum || count > maximum) throw new Error("unsupported inspection");
  }

  private expression(): void {
    if (++this.depth > 32) throw new Error("unsupported inspection");
    const value = this.tokens[this.at++];
    if (value === undefined) throw new Error("unsupported inspection");
    if (value === "json") this.json();
    else if (BUILTINS.includes(value)) this.call(1, 1);
    else if (value === "(") { this.expression(); this.need(")"); }
    else if (value === "[" || value === "{") this.collection(value);
    else if (!this.locals.has(value) && !/^(?:\d+(?:\.\d+)?|True|False|None)$/.test(value) && !/^['"]/.test(value)) throw new Error("unsupported inspection");
    while (this.tokens[this.at] === "[" || this.tokens[this.at] === ".") {
      if (this.take("[")) { this.expression(); this.need("]"); }
      else {
        this.need("."); const selector = this.tokens[this.at++];
        if (selector === "get") this.call(1, 2);
        else if (["keys", "values", "items"].includes(selector ?? "")) this.call(0, 0);
        else throw new Error("unsupported inspection");
      }
    }
    this.depth--;
  }

  private collection(start: string): void {
    const end = start === "[" ? "]" : "}";
    if (!this.take(end)) {
      do { this.expression(); if (start === "{") { this.need(":"); this.expression(); } } while (this.take(",") && this.tokens[this.at] !== end);
      this.need(end);
    }
  }

  private json(): void {
    if (!this.modules.has("json")) throw new Error("unsupported inspection");
    this.need("."); const method = this.tokens[this.at++]; this.need("(");
    if (method === "load" || method === "loads") {
      if (!this.modules.has("sys")) throw new Error("unsupported inspection");
      this.need("sys"); this.need("."); this.need("stdin");
      if (method === "loads") { this.need("."); this.need("read"); this.need("("); this.need(")"); }
    } else if (method === "dumps") {
      this.expression();
      const options = new Set<string>();
      while (this.take(",")) {
        const name = this.tokens[this.at++];
        if (name === undefined || options.has(name) || !["indent", "sort_keys", "ensure_ascii"].includes(name)) throw new Error("unsupported inspection");
        options.add(name); this.need("=");
        const setting = this.tokens[this.at++];
        if (setting === undefined || !(name === "indent" ? /^(?:\d+|None)$/.test(setting) : /^(?:True|False)$/.test(setting))) throw new Error("unsupported inspection");
      }
    } else throw new Error("unsupported inspection");
    this.need(")");
  }
}

// Closed grammar for `node -e`/`-p` and `bun -e` (the same flag). A program this accepts is
// read-only and is allowed; anything else keeps today's deny path.
//
// Allowed: locals, literals, member reads, `+`, `{` blocks, and `for (const|let|var name of …)`
// where the iterable is an array of string literals or a local bound to one. Calls are only
// `console.log`/`console.error`, `JSON.stringify`, `Object.keys`/`values`/`entries`, and
// `require()`/`import()` of a JSON path. The path's first static piece must itself start with
// `./`, `../` or `/`, and its last static piece must itself end with `.json`. A hole
// (`+ name` or `${name}`) is allowed only between those pieces, and only when `name` is bound
// directly to one string literal or is that `for…of` variable. A path made of literals must be
// one string: `"./a" + ".json"` stays denied. A bare package name, a `.js`
// path, a `require` of a variable, and a concatenation whose suffix is not the static `.json`
// stay out.
//
// Not in the grammar, so still denied: `fs` write/append/rm/rename/mkdir/copy, `child_process`/
// `spawn`/`exec`, `process.binding`, `Bun.write`, `eval`/`Function`, network calls, a call
// through a computed member, method calls other than the list above, arrows, and any source
// containing `#` or `\`.
// Comments and escapes are rejected rather than interpreted. This is not a JavaScript sandbox.
export function nodeInspection(args: { text: string; literal: boolean }[]): boolean {
  if (args.length !== 2 || !/^(-e|-p|--eval|--print)$/.test(args[0]!.text) || !args.every(arg => arg.literal)) return false;
  const tokens = tokenizeJs(args[1]!.text);
  if (tokens === null) return false;
  try { return new NodeInspection(tokens).parse(); }
  catch (error) { if (inspectionRejected(error)) return false; throw error; }
}

// `#` and `\` are rejected whole, so a comment or an escape cannot hide a sink. A newline is a
// statement break. A template is one token; an interpolation that is not a bare identifier fails.
function tokenizeJs(source: string): string[] | null {
  if (source.length > 16_384 || /[#\\]/.test(source)) return null;
  const tokens: string[] = [];
  const push = (token: string): boolean => tokens.length < 2048 && (tokens.push(token), true);
  for (let i = 0; i < source.length;) {
    const c = source[i]!;
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "\n") { if (!push(";")) return null; i++; continue; }
    if (c === "'" || c === '"') {
      const q = c;
      let j = i + 1;
      while (j < source.length && source[j] !== q && source[j] !== "\n") j++;
      if (source[j] !== q || !push(source.slice(i, j + 1))) return null;
      i = j + 1;
      continue;
    }
    if (c === "`") {
      const template = readTemplate(source, i);
      if (template === null || !push(template.token)) return null;
      i = template.end;
      continue;
    }
    const word = c >= "0" && c <= "9" ? /^\d+(?:\.\d+)?/ : /[A-Za-z_]/.test(c) ? /^[A-Za-z_]\w*/ : null;
    const found = word?.exec(source.slice(i));
    if (found !== null && found !== undefined) { if (!push(found[0])) return null; i += found[0].length; continue; }
    if ("()[]{},.:;=+-".includes(c)) { if (!push(c)) return null; i++; continue; }
    return null;
  }
  return tokens;
}

function readTemplate(source: string, i: number): { token: string; end: number } | null {
  const parts: { l?: string; i?: string }[] = [];
  let j = i + 1, stat = "";
  while (j < source.length) {
    const c = source[j]!;
    if (c === "`") { parts.push({ l: stat }); return { token: `TPL:${JSON.stringify(parts)}`, end: j + 1 }; }
    if (c === "$" && source[j + 1] === "{") {
      parts.push({ l: stat });
      stat = "";
      j += 2;
      const id = /^[A-Za-z_]\w*/.exec(source.slice(j));
      if (id === null || source[j + id[0].length] !== "}") return null;
      parts.push({ i: id[0] });
      j += id[0].length + 1;
      continue;
    }
    if (c === "\n") return null;
    stat += c;
    j++;
  }
  return null;
}

const NODE_RESERVED = ["require", "import", "JSON", "Object", "console", "const", "let", "var", "for", "of", "true", "false", "null", "undefined"];
const NODE_CALLS: Record<string, [string[], number, number]> = {
  JSON: [["stringify"], 1, 3], Object: [["keys", "values", "entries"], 1, 1], console: [["log", "error"], 0, 16],
};
const JSON_START = /^(?:\.\.\/|\.\/|\/)/;
type PathPart = { kind: "lit"; value: string } | { kind: "hole" };

function safeJson(parts: PathPart[]): boolean {
  const first = parts[0], last = parts[parts.length - 1];
  if (first?.kind !== "lit" || last?.kind !== "lit" || !JSON_START.test(first.value) || !last.value.endsWith(".json")) return false;
  return parts.length === 1 || parts.some((part) => part.kind === "hole");
}

class NodeInspection {
  private at = 0;
  private depth = 0;
  private readonly locals = new Set<string>();
  private readonly holes = new Set<string>();
  private readonly strs = new Set<string>();
  constructor(private readonly tokens: string[]) {}
  private take(value: string): boolean { return this.tokens[this.at] === value && (++this.at > 0); }
  private need(value: string): void { if (!this.take(value)) throw new Error("unsupported inspection"); }
  private next(): string {
    const token = this.tokens[this.at++];
    if (token === undefined) throw new Error("unsupported inspection");
    return token;
  }
  private ident(name: string): boolean { return /^[A-Za-z_]\w*$/.test(name) && !NODE_RESERVED.includes(name); }
  private stopped(): boolean { const next = this.tokens[this.at]; return next === undefined || next === ";" || next === "}"; }

  parse(): boolean {
    while (this.at < this.tokens.length) {
      if (this.take(";")) continue;
      if (!this.statement()) return false;
      if (this.at < this.tokens.length && this.tokens[this.at] !== "}" && !this.take(";")) return false;
    }
    return true;
  }

  private statement(): boolean {
    if (this.tokens[this.at] === "{") return this.block();
    if (this.take("for")) return this.forOf();
    if (["const", "let", "var"].includes(this.tokens[this.at] ?? "")) { this.at++; return this.binding(); }
    this.expression();
    return true;
  }

  private block(): boolean {
    this.need("{");
    while (!this.take("}")) {
      if (this.at >= this.tokens.length) return false;
      if (this.take(";")) continue;
      if (!this.statement()) return false;
      if (this.tokens[this.at] !== "}" && !this.take(";")) return false;
    }
    return true;
  }

  private forOf(): boolean {
    this.need("(");
    if (!["const", "let", "var"].includes(this.next())) return false;
    const name = this.next();
    if (!this.ident(name)) return false;
    this.need("of");
    if (!this.stringIterable()) return false;
    this.need(")");
    this.locals.add(name);
    this.holes.add(name);
    return this.tokens[this.at] === "{" ? this.block() : this.statement();
  }

  private binding(): boolean {
    const name = this.next();
    if (!this.ident(name)) return false;
    this.need("=");
    const start = this.at;
    if (this.wholeString()) this.holes.add(name);
    else {
      this.at = start;
      if (this.wholeStringArray()) this.strs.add(name);
      else { this.at = start; this.expression(); }
    }
    this.locals.add(name);
    return true;
  }

  private wholeString(): boolean {
    const token = this.tokens[this.at];
    if (token === undefined || !/^(['"]).*\1$/.test(token)) return false;
    const next = this.tokens[this.at + 1];
    if (next !== undefined && next !== ";" && next !== "}") return false;
    this.at++;
    return true;
  }

  private wholeStringArray(): boolean {
    const start = this.at;
    if (!this.stringArray() || !this.stopped()) { this.at = start; return false; }
    return true;
  }

  private stringIterable(): boolean {
    const name = this.tokens[this.at];
    if (name !== undefined && this.strs.has(name)) { this.at++; return true; }
    return this.stringArray();
  }

  private stringArray(): boolean {
    if (!this.take("[")) return false;
    if (this.take("]")) return true;
    do {
      const item = this.tokens[this.at];
      if (item === undefined || !/^(['"]).*\1$/.test(item)) return false;
      this.at++;
    } while (this.take(",") && this.tokens[this.at] !== "]");
    return this.take("]");
  }

  private expression(): void {
    if (++this.depth > 32) throw new Error("unsupported inspection");
    this.operand();
    while (this.take("+")) this.operand();
    this.depth--;
  }

  private operand(): void {
    const value = this.next();
    const known = NODE_CALLS[value];
    if (value === "require" || value === "import") { this.need("("); this.jsonArgument(); this.need(")"); }
    else if (known) this.call(known);
    else if (value === "(") { this.expression(); this.need(")"); }
    else if (value === "[" || value === "{") this.collection(value);
    else if (!this.locals.has(value) && !/^(?:\d+(?:\.\d+)?|true|false|null|'.*'|".*")$/.test(value)) throw new Error("unsupported inspection");
    while (this.tokens[this.at] === "[" || this.tokens[this.at] === ".") {
      if (this.take("[")) { this.expression(); this.need("]"); }
      else { this.need("."); if (!/^[A-Za-z_]\w*$/.test(this.next())) throw new Error("unsupported inspection"); }
    }
  }

  private call([methods, minimum, maximum]: [string[], number, number]): void {
    this.need("."); if (!methods.includes(this.next())) throw new Error("unsupported inspection");
    this.need("("); let count = 0;
    if (!this.take(")")) {
      do { this.expression(); count++; } while (this.take(",") && this.tokens[this.at] !== ")");
      this.need(")");
    }
    if (count < minimum || count > maximum) throw new Error("unsupported inspection");
  }

  // Node loads a path that ends in `.json` as data. A package name or a script path would run code,
  // so the prefix and the `.json` suffix both have to be static text.
  private jsonArgument(): void {
    const parts = this.pathShape();
    if (parts === null || !safeJson(parts)) throw new Error("unsupported inspection");
  }

  private pathShape(): PathPart[] | null {
    const first = this.pathAtom();
    if (first === null) return null;
    const parts = [...first];
    while (this.tokens[this.at] === "+") {
      const saved = this.at;
      this.at++;
      const next = this.pathAtom();
      if (next === null) { this.at = saved; break; }
      parts.push(...next);
    }
    return parts;
  }

  private pathAtom(): PathPart[] | null {
    const token = this.tokens[this.at];
    if (token === undefined) return null;
    if (token.startsWith("TPL:")) { this.at++; return this.templateParts(token); }
    if (/^(['"]).*\1$/.test(token)) { this.at++; return [{ kind: "lit", value: token.slice(1, -1) }]; }
    if (this.holes.has(token) && this.ident(token)) { this.at++; return [{ kind: "hole" }]; }
    return null;
  }

  private templateParts(token: string): PathPart[] | null {
    const parts = JSON.parse(token.slice(4)) as { l?: string; i?: string }[];
    const out: PathPart[] = [];
    for (const part of parts) {
      if (typeof part.l === "string") { if (part.l !== "") out.push({ kind: "lit", value: part.l }); }
      else if (typeof part.i === "string" && this.holes.has(part.i)) out.push({ kind: "hole" });
      else return null;
    }
    return out;
  }

  private collection(start: string): void {
    const end = start === "[" ? "]" : "}";
    if (this.take(end)) return;
    do {
      if (start === "{" && !/^(?:[A-Za-z_]\w*|'.*'|".*")$/.test(this.next())) throw new Error("unsupported inspection");
      if (start === "{") this.need(":");
      this.expression();
    } while (this.take(",") && this.tokens[this.at] !== end);
    this.need(end);
  }
}
