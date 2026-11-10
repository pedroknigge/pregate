import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { removeTree } from "./remove-tree.ts";

// The CLI, against a fixture project, is the gate a repository gets.
const cli = join(import.meta.dir, "../src/main.ts");
const area = mkdtempSync(join(tmpdir(), "pregate-astro-pack-"));
afterAll(() => removeTree(area));

const collectionWithoutLoader = `import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({ title: z.string() }),
});

export const collections = { blog };
`;
const collectionReady = `import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/blog" }),
  schema: z.object({ title: z.string() }),
});

export const collections = { blog };
`;
const collectionNoSchema = `import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/data/blog" }),
});

export const collections = { blog };
`;
const clientSecret = `import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_SECRET: envField.string({ context: "client", access: "secret" }),
    },
  },
});
`;
const serverSecret = `import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      API_SECRET: envField.string({ context: "server", access: "secret" }),
    },
  },
});
`;
const serverWithoutAdapter = `import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
});
`;
const serverWithAdapter = `import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
});
`;
const defaultMiddleware = `import { defineMiddleware } from "astro:middleware";

export default defineMiddleware(async (_context, next) => next());
`;
const namedMiddleware = `import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (_context, next) => next());
`;
const lowercaseEndpoint = `export const get = () => new Response("ok");
`;
const uppercaseEndpoint = `export const GET = () => new Response("ok");
`;
const actionWithoutHandler = `import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  like: defineAction({
    input: z.object({ postId: z.string() }),
  }),
};
`;
const actionWithHandler = `import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  like: defineAction({
    input: z.object({ postId: z.string() }),
    handler: async (input) => input.postId,
  }),
};
`;

function project(name: string) {
  const root = join(area, name);
  const machine = join(area, "machine");
  mkdirSync(root);
  const env = {
    ...process.env,
    CI: "1",
    PREGATE_UNATTENDED_APPROVAL: "1",
    HOME: join(machine, "home"),
    USERPROFILE: join(machine, "home"),
    XDG_DATA_HOME: join(machine, "data"),
    XDG_STATE_HOME: join(machine, "state"),
    XDG_CONFIG_HOME: join(machine, "config"),
    CODEX_HOME: join(machine, "codex"),
    GROK_HOME: join(machine, "grok"),
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const run = (args: string[], input?: string) => {
    const out = Bun.spawnSync([process.execPath, cli, ...args], {
      cwd: root, env, stdin: input === undefined ? "ignore" : Buffer.from(input),
      stdout: "pipe", stderr: "pipe", timeout: 60_000,
    });
    if (out.signalCode) throw new Error(`${args.join(" ")} terminated: ${out.signalCode}\n${out.stderr.toString()}`);
    return { code: out.exitCode, stdout: out.stdout.toString(), stderr: out.stderr.toString(), text: out.stdout.toString() + out.stderr.toString() };
  };
  const git = (...args: string[]) => {
    const out = Bun.spawnSync(["git", ...args], { cwd: root, env, stdout: "pipe", stderr: "pipe", timeout: 20_000 });
    if (out.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr.toString()}`);
  };
  const hook = (event: string, sid: string, fields: object = {}) => run(["hook", "auto", "--harness", "claude-code"], JSON.stringify({
    cwd: root, session_id: sid, transcript_path: join(root, "transcript.jsonl"), hook_event_name: event,
    permission_mode: "acceptEdits", prompt_id: "turn", ...fields,
  }));
  return { root, put, run, git, hook };
}

test("the astro pack fixtures pass through the CLI", () => {
  const root = project("fixtures");
  const tested = root.run(["rules", "test", "--library", "astro"]);
  expect(tested.code, tested.text).toBe(0);
  expect(tested.text).toContain("ok   astro/content/no-collection-without-schema");
  expect(tested.text).toContain("ok   astro/content/no-collection-without-loader");
  expect(tested.text).toContain("ok   astro/config/no-client-secret");
  expect(tested.text).toContain("ok   astro/config/no-server-output-without-adapter");
  expect(tested.text).toContain("ok   astro/routing/no-missing-onrequest");
  expect(tested.text).toContain("ok   astro/routing/no-lowercase-endpoint-export");
  expect(tested.text).toContain("ok   astro/routing/no-action-without-handler");
}, 90_000);

test("hook and check deny Astro mistakes and accept the documented forms", () => {
  const p = project("gate");
  p.put("package.json", JSON.stringify({ name: "shop", dependencies: { astro: "^5.1.0" } }) + "\n");
  p.put("src/pages/index.ts", "export const GET = () => new Response('ok');\n");
  p.git("init", "-q");
  expect(p.run(["init", "--yes", "--preset", "integrity-only"]).code).toBe(0);
  expect(p.run(["pack", "add", "--library", "astro", "--yes"]).code).toBe(0);
  p.put(".pregate/requests/enforce.json", JSON.stringify({
    why: "Judge the Astro rules in enforcing mode.",
    patch: [{ op: "add", path: "/enforcement", value: "enforce" }],
  }));
  expect(p.run(["preset", "apply", ".pregate/requests/enforce.json", "--yes"]).code).toBe(0);
  p.git("add", "-A");
  p.git("commit", "-qm", "baseline");

  const deniedCollection = p.run(["check", "--stdin", "--path", "src/content.config.ts"], collectionWithoutLoader);
  expect(deniedCollection.code, deniedCollection.text).toBe(1);
  expect(deniedCollection.text).toContain("ASTRO-LOADER-001");
  expect(deniedCollection.text).not.toContain("ASTRO-SCHEMA-001");

  const warnedSchema = p.run(["check", "--stdin", "--path", "src/content.config.ts"], collectionNoSchema);
  expect(warnedSchema.code, warnedSchema.text).toBe(0);
  expect(warnedSchema.text).toContain("ASTRO-SCHEMA-001");
  expect(warnedSchema.text).not.toContain("ASTRO-LOADER-001");

  const readyCollection = p.run(["check", "--stdin", "--path", "src/content.config.ts"], collectionReady);
  expect(readyCollection.code, readyCollection.text).toBe(0);
  expect(readyCollection.text).not.toContain("ASTRO-SCHEMA-001");
  expect(readyCollection.text).not.toContain("ASTRO-LOADER-001");

  const deniedSecret = p.run(["check", "--stdin", "--path", "astro.config.ts"], clientSecret);
  expect(deniedSecret.code, deniedSecret.text).toBe(1);
  expect(deniedSecret.text).toContain("ASTRO-ENV-001");
  expect(deniedSecret.text).toContain("https://docs.astro.build/en/guides/environment-variables/");
  const allowedSecret = p.run(["check", "--stdin", "--path", "astro.config.ts"], serverSecret);
  expect(allowedSecret.code, allowedSecret.text).toBe(0);
  expect(allowedSecret.text).not.toContain("ASTRO-ENV-001");

  const deniedAdapter = p.run(["check", "--stdin", "--path", "astro.config.mjs"], serverWithoutAdapter);
  expect(deniedAdapter.code, deniedAdapter.text).toBe(1);
  expect(deniedAdapter.text).toContain("ASTRO-ADAPTER-001");
  const allowedAdapter = p.run(["check", "--stdin", "--path", "astro.config.mjs"], serverWithAdapter);
  expect(allowedAdapter.code, allowedAdapter.text).toBe(0);
  expect(allowedAdapter.text).not.toContain("ASTRO-ADAPTER-001");

  const deniedMiddleware = p.run(["check", "--stdin", "--path", "src/middleware.ts"], defaultMiddleware);
  expect(deniedMiddleware.code, deniedMiddleware.text).toBe(1);
  expect(deniedMiddleware.text).toContain("ASTRO-MW-001");
  const allowedMiddleware = p.run(["check", "--stdin", "--path", "src/middleware.ts"], namedMiddleware);
  expect(allowedMiddleware.code, allowedMiddleware.text).toBe(0);
  expect(allowedMiddleware.text).not.toContain("ASTRO-MW-001");

  const deniedRoute = p.run(["check", "--stdin", "--path", "src/pages/api/items.ts"], lowercaseEndpoint);
  expect(deniedRoute.code, deniedRoute.text).toBe(1);
  expect(deniedRoute.text).toContain("ASTRO-ROUTE-001");
  const allowedRoute = p.run(["check", "--stdin", "--path", "src/pages/api/items.ts"], uppercaseEndpoint);
  expect(allowedRoute.code, allowedRoute.text).toBe(0);
  expect(allowedRoute.text).not.toContain("ASTRO-ROUTE-001");

  const deniedAction = p.run(["check", "--stdin", "--path", "src/actions/index.ts"], actionWithoutHandler);
  expect(deniedAction.code, deniedAction.text).toBe(1);
  expect(deniedAction.text).toContain("ASTRO-ACTION-001");
  const allowedAction = p.run(["check", "--stdin", "--path", "src/actions/index.ts"], actionWithHandler);
  expect(allowedAction.code, allowedAction.text).toBe(0);
  expect(allowedAction.text).not.toContain("ASTRO-ACTION-001");

  const sid = randomUUID();
  expect(p.hook("SessionStart", sid, { source: "startup" }).code).toBe(0);
  const deniedHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "collection",
    tool_input: { file_path: join(p.root, "src/content.config.ts"), content: collectionWithoutLoader },
  });
  expect(deniedHook.code, deniedHook.text).toBe(2);
  expect(JSON.parse(deniedHook.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(deniedHook.text).toContain("ASTRO-LOADER-001");

  const allowedHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "ready",
    tool_input: { file_path: join(p.root, "src/content.config.ts"), content: collectionReady },
  });
  expect(allowedHook.code, allowedHook.text).toBe(0);
  expect(allowedHook.text).not.toContain("ASTRO-LOADER-001");
  expect(allowedHook.text).not.toContain("ASTRO-SCHEMA-001");

  const warnedHook = p.hook("PreToolUse", sid, {
    tool_name: "Write", tool_use_id: "schema",
    tool_input: { file_path: join(p.root, "src/content.config.ts"), content: collectionNoSchema },
  });
  expect(warnedHook.code, warnedHook.text).toBe(0);
  expect(warnedHook.stdout).not.toContain('"permissionDecision":"deny"');
  expect(warnedHook.text).toContain("ASTRO-SCHEMA-001");

  p.put("package.json", JSON.stringify({ name: "shop", dependencies: { astro: "^4.16.18" } }) + "\n");
  const astro4 = p.run(["check", "--stdin", "--path", "src/content.config.ts"], collectionWithoutLoader);
  expect(astro4.code, astro4.text).toBe(0);
  expect(astro4.text).not.toContain("ASTRO-LOADER-001");

  const explained = p.run(["explain", "ASTRO-ENV-001"]);
  expect(explained.code, explained.text).toBe(0);
  expect(explained.text).toContain("https://docs.astro.build/en/guides/environment-variables/");
  const loader = p.run(["explain", "ASTRO-LOADER-001"]);
  expect(loader.code, loader.text).toBe(0);
  expect(loader.text).toContain("https://docs.astro.build/en/guides/content-collections/");
}, 180_000);
