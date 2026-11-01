import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// English-first repository. Accents and Spanish stopwords fail the build.
// Proper nouns, historical filenames, and quoted Unicode probes are removed
// before the scan. This file is not scanned: it is the word list.

const EXTENSIONS = [".md", ".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".sh", ".ps1", ".txt"];
const ACCENTS = /[áéíóúüñÁÉÍÓÚÜÑ¿¡]/;
const STOPWORDS = [
  "para", "porque", "también", "tambien", "está", "están", "estan", "según", "segun", "mediante",
  "cuando", "donde", "desde", "hasta", "sobre", "después", "despues", "aunque", "mientras",
  "siempre", "nunca", "hacer", "archivo", "código", "codigo", "usuario", "reglas", "metodología",
  "metodologia", "función", "funcion", "siguiente", "través", "traves", "además", "ademas",
  "embargo", "incluso", "durante", "entonces", "dentro", "fuera", "hacia", "acerca", "invariante",
  "invariantes", "capa", "capas", "deben", "obligatorio", "obligatoria", "corré", "corre",
  "requiere", "aprobación", "aprobacion", "comportamiento", "escritura", "llamada", "llamadas",
  "agente", "agentes", "dominio", "verificado", "elegido", "elegida", "tienen", "puede", "pueden",
].sort((a, b) => b.length - a.length);
const STOPWORD = new RegExp(`(?<![\\w-])(?:${STOPWORDS.join("|")})(?![\\w-])`, "i");

// Proper nouns and quoted probes. Longer entries first so a quote is removed whole.
const ALLOW = [
  "decisiones-usuario",
  "Garrido de Paz",
  "café.ts",
  "cafe\u0301.ts",
  "ñandú",
  "deben?",
  "obligatori[oa]",
  "tiene que",
  "[áéíóúñ¿]",
  "está",
  "corré",
  "requiere",
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

test("tracked text is English aside from proper nouns and quoted probes", () => {
  const failures: string[] = [];
  for (const file of trackedTextFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = visible(lines[index] ?? "");
      const accent = ACCENTS.exec(line);
      const word = STOPWORD.exec(line);
      if (accent || word) failures.push(`${file}:${index + 1}: ${accent?.[0] ?? word?.[0]}`);
    }
  }
  expect(failures).toEqual([]);
});
