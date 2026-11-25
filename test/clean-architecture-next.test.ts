import { beforeAll, expect, test } from "bun:test";
import { BUILTIN } from "../src/assets.ts";
import { compile } from "../src/compile.ts";
import { analyze } from "../src/evaluate.ts";
import { clock, grammars, VERSIONS } from "../src/gate.ts";
import { librarySource } from "../src/library.ts";
import type { Lock, Preset } from "../src/types.ts";

// Issue 158. CA-DEP-002 scopes @layers:core and bans next. A saved map can still
// call the Next.js app router core. Delivery files are outside the rule. A core file is not.
beforeAll(grammars);

const ROUTE = "src/app/api/admin/position-access/external/[kind]/route.ts";
const NEXT = "import { NextResponse } from 'next/server';\nexport function GET() {\n  return NextResponse.json({ ok: true });\n}\n";

function lock(): Lock {
  const files = librarySource("architecture")!;
  const preset: Preset = {
    name: "clean-architecture-next", version: "1.0.0", engine: VERSIONS.engine,
    sources: [
      { ns: "core", kind: "builtin", version: VERSIONS.core },
      { ns: "architecture", kind: "library", version: JSON.parse(files["source.json"]!).version },
    ],
    methodologies: ["architecture/clean-architecture"],
    enforcement: "enforce",
    layers: {
      domain: { paths: ["src/domain/**"], mayImport: [], kind: "core" },
      app: { paths: ["src/app/**", "app/**"], mayImport: ["domain"], kind: "core" },
      core: { paths: ["src/core/**"], mayImport: [], kind: "core" },
      edge: { paths: ["middleware.ts", "src/middleware.ts", "proxy.ts", "src/proxy.ts", "src/pages/**", "pages/**"], mayImport: [], kind: "core" },
    },
  };
  const out = compile(JSON.stringify(preset), (source) => source.kind === "builtin" ? BUILTIN : librarySource(source.ns), VERSIONS);
  if ("errors" in out) throw new Error(out.errors.join("\n"));
  return out.lock;
}

function rules(path: string, source: string): string[] {
  const out = analyze(lock(), "pre", path, source, { now: clock, read: () => null });
  if ("cause" in out) throw new Error(out.cause);
  return out.violations.map((finding) => finding.rule);
}

test("issue 158: an API route may import next/server while a core file may not", () => {
  expect(rules(ROUTE, NEXT)).not.toContain("architecture/CA-DEP-002");
  expect(rules("app/api/[kind]/route.ts", NEXT)).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/app/page.tsx", "import { use } from 'react';\nexport default function Page() { return use; }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/app/layout.tsx", "import type { ReactNode } from 'react';\nexport default function Layout({ children }: { children: ReactNode }) { return children; }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/app/dashboard/actions.ts", "\"use server\";\nimport { revalidatePath } from 'next/cache';\nexport async function save() { revalidatePath('/'); }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/app/dashboard/actions/submit.ts", "\"use server\";\nimport { revalidatePath } from 'next/cache';\nexport async function submit() { revalidatePath('/'); }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/middleware.ts", NEXT)).not.toContain("architecture/CA-DEP-002");
  expect(rules("middleware.ts", "import { NextResponse } from 'next/server';\nexport function middleware() { return NextResponse.next(); }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/proxy.ts", "import { NextResponse } from 'next/server';\nexport function proxy() { return NextResponse.next(); }\n")).not.toContain("architecture/CA-DEP-002");
  expect(rules("src/pages/api/health.ts", NEXT)).not.toContain("architecture/CA-DEP-002");
  expect(rules("pages/api/admin/route.ts", "const { NextResponse } = require('next/server');\nmodule.exports = NextResponse;\n")).not.toContain("architecture/CA-DEP-002");

  const core = "import { NextResponse } from 'next/server';\nexport function policy() {\n  return NextResponse.json({ ok: true });\n}\n";
  expect(rules("src/core/policy.ts", core)).toContain("architecture/CA-DEP-002");
  expect(rules("src/domain/order.ts", core)).toContain("architecture/CA-DEP-002");
  expect(rules("src/domain/order.ts", "export async function load() {\n  const { NextResponse } = await import('next/server');\n  return NextResponse.json({});\n}\n")).toContain("architecture/CA-DEP-002");
  expect(rules("src/app/orders/create-order.ts", core)).toContain("architecture/CA-DEP-002");
  expect(rules("src/domain/middleware.ts", core)).toContain("architecture/CA-DEP-002");
});
