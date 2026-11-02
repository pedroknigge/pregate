// Inline interpreter code (python -c, node -e, perl -e, ruby -e, php -r, a heredoc to one of them)
// that can reach a file-writing or code-running API. A name is enough: an alias (`from os import
// open as o`), a computed path or a concatenated string still has to go through one of these
// sinks. This is fail-closed for code that writes outside the project too; code that only computes
// and prints passes.

// Python modules that cannot write a file or run a program. Anything else imported is a sink.
const PYTHON_MODULES = new Set(["json", "sys", "re", "math", "cmath", "datetime", "time", "calendar", "collections", "itertools",
  "functools", "string", "textwrap", "random", "base64", "binascii", "hashlib", "hmac", "uuid", "decimal", "fractions",
  "statistics", "pprint", "typing", "dataclasses", "enum", "struct", "unicodedata", "difflib", "ipaddress", "html", "heapq",
  "bisect", "copy", "keyword", "numbers", "zlib", "colorsys"]);
// Builtins that open files, evaluate text or reach other modules and attributes by name.
const PYTHON_SINK = /\b(?:exec|eval|compile|__import__|getattr|setattr|delattr|vars|globals|locals|breakpoint|help|input|memoryview|modules|__\w+__)\b/;
const PYTHON_READ_MODE = /^[rbtU]*$/;

const NODE_SINK = new RegExp([
  String.raw`\b(?:require|import|module|exports|fs|child_process|worker_threads|vm|inspector|wasi|cluster|repl|eval|Function|constructor`,
  String.raw`prototype|__proto__|__defineGetter__|__lookupGetter__|getPrototypeOf|setPrototypeOf|defineProperty|getOwnPropertyDescriptors?`,
  String.raw`globalThis|global|this|self|Reflect|Proxy|Bun|Deno|WebAssembly|Worker|setTimeout|setInterval|with)\b`,
  // process exposes bindings and the main module; its version, platform, argv, env and streams only report.
  String.raw`\bprocess\b(?!\s*\.\s*(?:version|versions|platform|arch|argv|env|cwd|pid|ppid|exitCode|exit|stdout|stderr|uptime|hrtime|memoryUsage|execPath|release|title|nextTick)\b)`,
  // A computed member (`x[k]`, `x["constructor"]`) reaches any property; an index does not.
  String.raw`[\w$)\]]\s*\[(?!\s*\d+\s*\])`,
].join("|"));

const PERL_SINK = /\b(?:open|sysopen|rename|unlink|truncate|link|symlink|chmod|chown|utime|mkdir|rmdir|system|exec|eval|do|require|use|no|syscall|qx|dbmopen|tie|pipe|fork|socket|can|import)\b|`|::|<\*|&\s*\{|&\$|->\s*\(/;
const RUBY_SINK = /\b(?:File|IO|Dir|FileUtils|Pathname|Kernel|Process|Open3|PTY|Tempfile|ObjectSpace|Object|Module|Class|BasicObject|system|exec|spawn|open|sysopen|eval|instance_eval|class_eval|module_eval|instance_exec|send|__send__|public_send|method|methods|const_get|instance_variable_get|define_method|require|require_relative|load|autoload|syscall|fork|binding|at_exit|trap|`|ENV)\b|`|%x/;
const PHP_SINK = /\b(?:file_put_contents|fopen|fwrite|fputs|fputcsv|ftruncate|touch|unlink|rename|copy|mkdir|rmdir|symlink|link|chmod|chown|chgrp|tempnam|tmpfile|system|exec|shell_exec|passthru|popen|proc_open|pcntl_exec|mail|eval|assert|create_function|call_user_func\w*|forward_static_call\w*|array_map|array_walk\w*|usort|uasort|uksort|array_filter|array_reduce|preg_replace_callback\w*|register_shutdown_function|include|include_once|require|require_once|SplFileObject|SplFileInfo|SplTempFileObject|ZipArchive|Phar\w*|ReflectionFunction|ReflectionClass|ReflectionMethod|new|ini_set|putenv|extract|parse_str|define|constant|move_uploaded_file|error_log)\b|`|\$\w+\s*\(|['")\]]\s*\(|::/i;

export function inlineSink(name: string, program: string, options: string[]): boolean {
  if (name === "python") return pythonSink(program);
  if (name === "perl") return options.some((o) => /^-[A-Za-z0-9]*[Mm]/.test(o)) || PERL_SINK.test(program);
  if (name === "ruby") return options.some((o) => /^-[A-Za-z]*r/.test(o)) || RUBY_SINK.test(program);
  if (name === "php") return PHP_SINK.test(program);
  return NODE_SINK.test(masked(program, false));
}

function pythonSink(program: string): boolean {
  const text = masked(program, true);
  if (PYTHON_SINK.test(text)) return true;
  if (!imports(text)) return true;
  for (const call of text.matchAll(/\bopen\b/g)) {
    const at = (call.index ?? 0) + call[0].length;
    const args = callArguments(text, at);
    if (args === null || !readOnlyOpen(args)) return true;
  }
  return false;
}

// Every `import a.b as c, d` and `from a import b` names an allowed module; any other use of the
// word `import` is not read and counts against the program.
function imports(text: string): boolean {
  // `from json import loads`: the names after it are not modules.
  const stripped = text.replace(/\bfrom[ \t]+([\w.]+)[ \t]+import\b/g, (all, module: string) => (allowed(module) ? " " : all));
  if (/\bfrom[ \t]+[\w.]+[ \t]+import\b/.test(stripped)) return false;
  const list = /[ \t]+([\w.]+(?:[ \t]+as[ \t]+\w+)?(?:[ \t]*,[ \t]*[\w.]+(?:[ \t]+as[ \t]+\w+)?)*)/y;
  for (const match of stripped.matchAll(/\bimport\b/g)) {
    list.lastIndex = (match.index ?? 0) + match[0].length;
    const names = list.exec(stripped);
    if (names === null || !names[1]!.split(",").every((part) => allowed(part.trim().split(/[ \t]+/)[0]!))) return false;
  }
  return true;
}

function allowed(module: string): boolean {
  return PYTHON_MODULES.has(module.split(".")[0]!);
}

// The argument list after `open`, split at top-level commas, or null when it is not a plain call.
function callArguments(text: string, at: number): string[] | null {
  let i = at;
  while (text[i] === " " || text[i] === "\t") i++;
  if (text[i] !== "(") return null;
  const args: string[] = [];
  let depth = 0, start = i + 1;
  for (i++; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]" || c === "}") && depth > 0) depth--;
    else if (c === "," && depth === 0) { args.push(text.slice(start, i).trim()); start = i + 1; }
    else if (c === ")") { args.push(text.slice(start, i).trim()); return args.filter((a, k) => a !== "" || k === 0); }
  }
  return null;
}

// `open(path)`, `open(path, "rb")`, `open(path, mode="r", encoding="utf-8")`.
function readOnlyOpen(args: string[]): boolean {
  let positional = 0;
  for (const arg of args) {
    if (arg.startsWith("*")) return false;
    const keyword = /^(\w+)\s*=(?!=)\s*([\s\S]*)$/.exec(arg);
    if (keyword === null) {
      positional++;
      if (positional === 2 && !readMode(arg)) return false;
      if (positional > 2) return false;
    } else if (keyword[1] === "mode" ? !readMode(keyword[2]!) : !["encoding", "errors", "newline"].includes(keyword[1]!)) return false;
  }
  return true;
}

function readMode(arg: string): boolean {
  const literal = /^(['"])(.*)\1$/.exec(arg);
  return literal !== null && PYTHON_READ_MODE.test(literal[2]!);
}

// The program with the contents of plain string literals blanked, so that words in messages are
// not read as calls. Python f-strings and JavaScript template literals hold code and stay. A
// Python read mode ("r", "rb") stays for readOnlyOpen.
function masked(program: string, python: boolean): string {
  const literal = python
    ? /([A-Za-z]{0,2})('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g
    : /()('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
  return program.replace(literal, (all, prefix: string, body: string) => {
    if (/[fF]/.test(prefix)) return all;
    const quote = body.startsWith("'''") || body.startsWith('"""') ? body.slice(0, 3) : body[0]!;
    const inner = body.slice(quote.length, body.length - quote.length);
    return prefix + quote + (python && PYTHON_READ_MODE.test(inner) ? inner : "s") + quote;
  });
}
