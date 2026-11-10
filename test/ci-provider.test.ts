import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeCi, detectProviders } from "../src/ci/detect.ts";
import { GitHubCiError, readGitHubSignals } from "../src/ci/github.ts";
import { install } from "../src/install.ts";
import {
  classify, deploymentVerdict, isVercelContext, judge, pregateJobNames,
  type ProviderExpectation, type RawGitHubSignal,
} from "../src/ci/provider.ts";
import { VERSIONS } from "../src/versions.ts";
import { removeTree } from "./remove-tree.ts";

const EN = "Vercel \u2013 web";

function raw(partial: Partial<RawGitHubSignal> & Pick<RawGitHubSignal, "name">): RawGitHubSignal {
  return {
    kind: "commit-status", state: "success", status: "", description: "", url: null, appSlug: null, ...partial,
  };
}

test("Vercel contexts are the deployment status, not other Vercel checks", () => {
  expect(isVercelContext("Vercel")).toBe(true);
  expect(isVercelContext(EN)).toBe(true);
  expect(isVercelContext("Vercel - docs")).toBe(true);
  expect(isVercelContext("Vercel Preview Comments")).toBe(false);
  expect(isVercelContext("vercel")).toBe(false);
  expect(isVercelContext("Vercel –")).toBe(false);
  expect(isVercelContext("My Vercel")).toBe(false);
});

test("Ready passes and Error, Canceled, skipped, and unknown states fail closed", () => {
  expect(deploymentVerdict("success", "", "Ready")).toBe("pass");
  expect(deploymentVerdict("success", "", "Deployment has completed")).toBe("pass");
  expect(deploymentVerdict("failure", "", "Error")).toBe("fail");
  expect(deploymentVerdict("error", "", "Canceled")).toBe("fail");
  expect(deploymentVerdict("cancelled", "completed", "Canceled")).toBe("fail");
  expect(deploymentVerdict("success", "", "Canceled")).toBe("fail");
  expect(deploymentVerdict("success", "", "Skipped")).toBe("fail");
  expect(deploymentVerdict("pending", "", "Building")).toBe("pending");
  expect(deploymentVerdict("", "in_progress", "Building")).toBe("pending");
  expect(deploymentVerdict("mystery", "", "")).toBe("fail");
  expect(deploymentVerdict("", "completed", "")).toBe("fail");
});

test("a Vercel-only repository passes on Ready and fails when the status is missing or Error", () => {
  const required: ProviderExpectation[] = [{ id: "vercel", required: true, checks: [] }];
  const ready = classify(raw({ name: "Vercel", description: "Ready" }), []);
  expect(judge(required, [ready!]).verdict).toBe("pass");
  expect(judge(required, []).verdict).toBe("missing");
  const error = classify(raw({ name: EN, state: "failure", description: "Error" }), []);
  expect(judge(required, [error!]).verdict).toBe("fail");
  const canceled = classify(raw({
    kind: "check-run", name: "Vercel", state: "cancelled", status: "completed", description: "Canceled", appSlug: "vercel",
  }), []);
  expect(judge(required, [canceled!]).verdict).toBe("fail");
  const pending = classify(raw({ name: "Vercel", state: "pending", description: "Building" }), []);
  expect(judge(required, [pending!]).verdict).toBe("pending");
});

test("Actions and Vercel aggregate, and a repository with no Actions does not require Actions", () => {
  const both: ProviderExpectation[] = [
    { id: "github-actions", required: true, checks: ["pregate"] },
    { id: "vercel", required: true, checks: [] },
  ];
  const actions = classify(raw({
    kind: "check-run", name: "pregate", state: "success", status: "completed", appSlug: "github-actions",
  }), ["pregate"]);
  const vercel = classify(raw({ name: "Vercel", description: "Ready" }), ["pregate"]);
  expect(judge(both, [actions!, vercel!]).verdict).toBe("pass");
  const broken = classify(raw({ name: EN, state: "failure", description: "Error" }), ["pregate"]);
  expect(judge(both, [actions!, broken!]).verdict).toBe("fail");
  expect(judge(both, [vercel!]).verdict).toBe("missing");
  const failedActions = classify(raw({
    kind: "check-run", name: "pregate", state: "failure", status: "completed", appSlug: "github-actions",
  }), ["pregate"]);
  expect(judge(both, [failedActions!, vercel!]).verdict).toBe("fail");
  expect(judge([{ id: "vercel", required: true, checks: [] }], [vercel!]).verdict).toBe("pass");
  expect(judge([], [vercel!]).verdict).toBe("missing");
});

test("one failing Vercel project fails the provider even when another is Ready", () => {
  const web = classify(raw({ name: EN, description: "Ready" }), [])!;
  const docs = classify(raw({ name: "Vercel \u2013 docs", state: "error", description: "Canceled" }), [])!;
  expect(judge([{ id: "vercel", required: true, checks: [] }], [web, docs]).verdict).toBe("fail");
});

test("unrelated checks are not Pregate's Actions provider", () => {
  const lint = classify(raw({
    kind: "check-run", name: "lint", state: "failure", status: "completed", appSlug: "github-actions",
  }), ["pregate"]);
  expect(lint).toBeNull();
  const comments = classify(raw({
    kind: "check-run", name: "Vercel Preview Comments", state: "success", status: "completed", appSlug: "vercel",
  }), []);
  expect(comments).toBeNull();
});

test("the generated Actions workflow requires the pregate job", () => {
  const yaml = readFileSync(join(import.meta.dir, "../assets/ci-github.yml"), "utf8");
  expect(pregateJobNames(yaml)).toEqual(["pregate"]);
});

test("detection sees Actions, Vercel, both, or neither", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-ci-detect-"));
  try {
    expect(detectProviders(dir)).toEqual([]);
    expect(describeCi(dir).text).toContain("none configured");
    mkdirSync(join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(join(dir, ".github/workflows/pregate.yml"), readFileSync(join(import.meta.dir, "../assets/ci-github.yml"), "utf8"));
    expect(detectProviders(dir).map((provider) => provider.id)).toEqual(["github-actions"]);
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(join(dir, "scripts/pregate-vercel-build.sh"), "#!/bin/bash\n");
    expect(detectProviders(dir).map((provider) => provider.id)).toEqual(["github-actions", "vercel"]);
    rmSync(join(dir, ".github"), { recursive: true });
    expect(detectProviders(dir).map((provider) => provider.id)).toEqual(["vercel"]);
  } finally {
    removeTree(dir);
  }
});

test("GitHub responses keep the latest status per context and fail closed on a bad body", async () => {
  const respond = async (url: string | URL | Request): Promise<Response> => {
    const path = String(url);
    if (path.endsWith("/statuses?per_page=100")) {
      return Response.json([
        { context: "Vercel", state: "success", description: "Ready", target_url: "https://example.vercel.app" },
        { context: "Vercel", state: "pending", description: "Building", target_url: null },
      ]);
    }
    return Response.json({
      total_count: 1,
      check_runs: [{
        name: "pregate", status: "completed", conclusion: "success", html_url: "https://github.com/acme/web/runs/1",
        output: { title: "pass", summary: "" }, app: { slug: "github-actions" },
      }],
    });
  };
  const signals = await readGitHubSignals("acme/web", "abc", { api: "http://127.0.0.1:9", token: null, fetch: respond as typeof fetch }, ["pregate"]);
  expect(signals.map((signal) => `${signal.provider}:${signal.name}:${signal.verdict}`)).toEqual([
    "vercel:Vercel:pass",
    "github-actions:pregate:pass",
  ]);

  const broken = async (): Promise<Response> => Response.json({ total_count: 2, check_runs: [] });
  await expect(readGitHubSignals("acme/web", "abc", {
    api: "http://127.0.0.1:9", token: "secret", fetch: (async (url: string | URL | Request) => String(url).includes("statuses")
      ? Response.json([])
      : broken()) as typeof fetch,
  }, [])).rejects.toBeInstanceOf(GitHubCiError);

  await expect(readGitHubSignals("acme/web", "abc", {
    api: "http://127.0.0.1:9", token: null, fetch: (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
  }, [])).rejects.toThrow("500");
});

test("install --ci vercel writes the recipe and leaves an existing buildCommand", () => {
  const dir = mkdtempSync(join(tmpdir(), "pregate-ci-install-"));
  const git = (...args: string[]) => {
    const child = Bun.spawnSync(["git", "-c", "user.name=Pregate", "-c", "user.email=pregate@example.com", ...args], { cwd: dir });
    if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  };
  try {
    git("init", "-q");
    mkdirSync(join(dir, ".pregate"), { recursive: true });
    writeFileSync(join(dir, ".pregate/preset.json"), "{}\n");
    const vercel = install(dir, { gitHook: false, ci: ["vercel"] });
    expect(vercel.code).toBe(0);
    expect(readFileSync(join(dir, "scripts/pregate-vercel-build.sh"), "utf8")).toContain("check --ratchet");
    const config = JSON.parse(readFileSync(join(dir, "vercel.json"), "utf8")) as { buildCommand: string };
    expect(config.buildCommand).toContain("pregate-vercel-build.sh");
    writeFileSync(join(dir, "vercel.json"), JSON.stringify({ buildCommand: "next build" }));
    const kept = install(dir, { gitHook: false, ci: ["vercel"] });
    expect(kept.text).toContain("left unchanged");
    expect(JSON.parse(readFileSync(join(dir, "vercel.json"), "utf8"))).toEqual({ buildCommand: "next build" });
    const actions = install(dir, { gitHook: false, ci: ["github-actions"] });
    expect(actions.code).toBe(0);
    expect(readFileSync(join(dir, ".github/workflows/pregate.yml"), "utf8")).toContain("check --ratchet");
    expect(actions.text).toContain(`CI template`);
    expect(VERSIONS.engine.length).toBeGreaterThan(0);
  } finally {
    removeTree(dir);
  }
});
