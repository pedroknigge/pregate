// Literal write targets in interpreter code: `python -c`, `node -e`, `perl -e`, `ruby -e`, `php -r`,
// a heredoc to one of them, or a literal script file. The shell guard checks each target against
// the protected paths. It does not judge what else the code can do.

const PYTHON_READ_MODE = /^[rbtU]*$/;

// String literals that a call writes, appends, removes or creates. A read (`open(path)`,
// `readFileSync`) is not one. A computed path (`"src/" + name`, a template hole) is not one:
// the call is then opaque, and running it is allowed.
const WRITE_CALL = /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync|renameSync|copyFileSync|mkdirSync|truncateSync|writeTextFileSync|writeTextFile|write_text|write_bytes|file_put_contents)\s*\(\s*(['"`])([^'"`\n]+)\1(?!\s*\+)/g;
const BUN_WRITE = /\bBun\.write\s*\(\s*(['"`])([^'"`\n]+)\1/g;
const RUBY_WRITE = /\bFile\.write\s*\(\s*(['"`])([^'"`\n]+)\1/g;
const PATH_WRITE = /\bPath\s*\(\s*(['"])([^'"]+)\1\s*\)\s*\.\s*(?:write_text|write_bytes|unlink)\b/g;
const PY_OPEN = /\bopen\s*\(\s*(['"])([^'"]+)\1\s*,\s*(['"])([^'"]*)\3/g;
const PERL_REDIRECT = /['"]>([^'"\n]+)['"]/g;
const PERL_MODE = /['"]\s*>\s*['"]\s*,\s*['"]([^'"]+)['"]/g;

export function literalWriteTargets(program: string): string[] {
  const found: string[] = [];
  const add = (value: string | undefined) => {
    if (value === undefined || value === "" || value.includes("${") || value.includes("$(")) return;
    found.push(value);
  };
  for (const pattern of [WRITE_CALL, BUN_WRITE, RUBY_WRITE, PATH_WRITE, PERL_REDIRECT, PERL_MODE]) {
    for (const match of program.matchAll(pattern)) add(match[2] ?? match[1]);
  }
  for (const match of program.matchAll(PY_OPEN)) {
    const mode = match[4] ?? "";
    if (/[wax+]/.test(mode) && !PYTHON_READ_MODE.test(mode)) add(match[2]);
  }
  return found;
}
