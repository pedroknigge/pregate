import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// English-first repository. Accents and Spanish stopwords fail the build.
// Proper nouns, historical filenames, and quoted Unicode probes are removed
// before the scan. This file is not scanned: it is the word list.

const EXTENSIONS = [".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".sh", ".ps1", ".txt"];
const ACCENTS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/;
// Words that are also ordinary English (embargo, para, capa, sobre, fuera) are
// deliberately absent: English prose must never trip the scan.
const STOPWORDS = [
  "porque", "también", "tambien", "está", "están", "estan", "según", "segun", "mediante",
  "cuando", "donde", "desde", "hasta", "después", "despues", "aunque", "mientras",
  "siempre", "nunca", "hacer", "archivo", "código", "codigo", "usuario", "reglas", "metodología",
  "metodologia", "función", "funcion", "siguiente", "través", "traves", "además", "ademas",
  "incluso", "durante", "entonces", "dentro", "hacia", "acerca", "invariante",
  "invariantes", "deben", "obligatorio", "obligatoria", "corré", "corre",
  "requiere", "aprobación", "aprobacion", "comportamiento", "escritura", "llamada", "llamadas",
  "agente", "agentes", "dominio", "verificado", "elegido", "elegida", "tienen", "puede", "pueden",
].sort((a, b) => b.length - a.length);
const STOPWORD = new RegExp(`(?<![\\w-])(?:${STOPWORDS.join("|")})(?![\\w-])`, "i");

// Proper nouns, historical filenames and the exact source snippets that embed
// Spanish on purpose (the Spanish-detection regexes). Entries are literal
// phrases, never bare Spanish words, so a stray "está" in prose still fails.
// Longer entries first so a quote is removed whole.
const ALLOW = [
  "(must|shall|required|deben?|obligatori[oa]|tiene que)",
  "/[áéíóúñ¿]|está|corré|requiere|turno|aprob/",
  "decisiones-usuario",
  "Garrido de Paz",
  "café.ts",
  "cafe\u0301.ts",
  "ñandú",
  "é🧪",
  "notice é",
  "pack/é",
  "\\0é",
  "\"é\"",
  "'é",
  "á\\n",
];

function trackedTextFiles(): string[] {
  const listed = Bun.spawnSync(["git", "ls-files", "-z"], { stdout: "pipe" }).stdout.toString();
  return listed.split("\0").filter((file) => {
    if (!file || file.startsWith("vendor/") || file === "test/english-only.test.ts") return false;
    const base = file.split("/").pop() ?? "";
    return EXTENSIONS.some((ext) => file.endsWith(ext)) || file.endsWith(".fixture") || base === "LICENSE" || base === "THIRD_PARTY_NOTICES";
  });
}

function visible(line: string): string {
  let text = line;
  for (const allowed of ALLOW) text = text.replaceAll(allowed, " ");
  return text;
}

function offending(line: string): string | null {
  const text = visible(line);
  return ACCENTS.exec(text)?.[0] ?? STOPWORD.exec(text)?.[0] ?? null;
}

test("English prose that shares words with Spanish passes", () => {
  expect(offending("a trade embargo on exports")).toBeNull();
  expect(offending("see para 3 of the spec")).toBeNull();
  expect(offending("the capa layer sits above the sobre layer, fuera of scope")).toBeNull();
});

test("Spanish prose fails even when a word is also in an allowed snippet", () => {
  expect(offending("Esto está mal")).toBe("á");
  expect(offending("esto esta mal porque si")).toBe("porque");
  expect(offending("it requiere a turno")).toBe("requiere");
});

test("tracked text is English aside from proper nouns and quoted probes", () => {
  const failures: string[] = [];
  for (const file of trackedTextFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      const hit = offending(lines[index] ?? "");
      if (hit) failures.push(`${file}:${index + 1}: ${hit}`);
    }
  }
  expect(failures).toEqual([]);
});
