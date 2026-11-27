import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fixtureLock, patternsOf } from "./compile.ts";
import { canonical, findRoot, writeAtomic } from "./disk.ts";
import { equal } from "./schema.ts";
import { eventFiles, sha256, stateDir } from "./state.ts";
import type { CallEvent, Files, Fixture } from "./types.ts";
import { pathKey } from "./paths.ts";

interface Denial { id: string; folder: string; event: CallEvent }

function denials(root: string): Denial[] {
  const sessions = join(stateDir(), "sessions");
  if (!existsSync(sessions)) return [];
  return readdirSync(sessions).flatMap((session) => {
    const folder = join(sessions, session), events = join(folder, "events");
    if (!existsSync(events)) return [];
    return eventFiles(folder).flatMap((file) => {
      const event = JSON.parse(readFileSync(file, "utf8")) as CallEvent;
      return event.root === root && event.kind === "pre-edit" && event.verdict === "deny"
        ? [{ id: sha256(`${session}\0${basename(file)}`).slice(0, 24), folder, event }] : [];
    });
  }).sort((a, b) => b.event.at - a.event.at || a.id.localeCompare(b.id));
}

function content(denial: Denial, hash: string): string {
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Denied content has an invalid blob hash.");
  const text = readFileSync(join(denial.folder, "blobs", hash), "utf8");
  if (sha256(text) !== hash) throw new Error("Denied content blob does not match its recorded hash.");
  return text;
}

export function dispute(args: string[]): { code: number; text: string } {
  if (args.length > 1 || (args[0] !== undefined && args[0] !== "--last" && !/^[0-9a-f]{24}$/.test(args[0]))) return { code: 1, text: "usage: pregate dispute [--last | <event id>]" };
  const root = findRoot(canonical(process.cwd()), () => true);
  if (root === null) return { code: 1, text: "Dispute needs a repository with a PREGATE preset." };
  const selected = denials(root).find((d) => args[0] === undefined || args[0] === "--last" || d.id === args[0]);
  if (selected === undefined) return { code: 1, text: "No matching denied call recorded for this repository." };
  const { event } = selected;
  if (event.afterSha === null || !event.dispute?.rules.length) return { code: 1, text: "This denial has no replayable rule/content record. Reproduce it with the current engine first." };
  return draftDispute(root, selected, event.afterSha);
}

function draftDispute(root: string, selected: Denial, afterSha: string): { code: number; text: string } {
  try {
    const after = content(selected, afterSha);
    const before = selected.event.beforeSha ? content(selected, selected.event.beforeSha) : null;
    const files = disputeFixtures(selected.event, selected.id, after, before);
    const drafts = join(root, "pregate-drafts");
    if (pathKey(canonical(drafts)) !== pathKey(drafts)) throw new Error("Drafts directory must not redirect through a symlink.");
    mkdirSync(drafts, { recursive: true });
    const dir = canonical(mkdtempSync(join(drafts, `dispute-${selected.id}-`)));
    for (const [path, text] of Object.entries(files)) {
      const dest = join(dir, path);
      mkdirSync(dirname(dest), { recursive: true });
      writeAtomic(dest, text);
    }
    return { code: 0, text: `Fixture candidates: ${dir}\nEvent ID: ${selected.id}\nNext: copy each pass/dispute-${selected.id} case into its check's fixtures/pass/ in the rule source checkout. Fix the check until \`pregate rules test .\` passes there, including this new case and all existing fixtures. Use /pregate to propose the corrected rule/pack and preset; activation requires the D27 one-click human approval. The active contract is unchanged.` };
  } catch (error) {
    return { code: 1, text: `Cannot draft dispute: ${(error as Error).message}` };
  }
}

// Candidates assert the human's intended result; they never change the active contract.
function disputeFixtures(event: CallEvent, id: string, after: string, before: string | null): Files {
  const files: Files = {};
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  for (const rule of event.dispute?.rules ?? []) {
    const check = rule.check.split("@")[0]!;
    const definition = event.dispute?.checks[rule.id];
    if (definition === undefined || `${definition.id}@${definition.version}` !== rule.check) throw new Error("Dispute needs the recorded check definition.");
    const target = event.violations.find((v) => v.rule === rule.id)?.path;
    if (target === undefined || target.startsWith("/") || target.split("/").some((p) => p === ".." || p === "." || p === "")) throw new Error("Dispute needs a repo-relative target.");
    if (!/^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test(check)) throw new Error("Dispute needs a valid check ID.");
    const dir = `${check.split("/")[0]}/checks/${check.split("/").slice(1).join("/")}/fixtures/pass/dispute-${id}`;
    const params = { ...rule.params };
    if (patternsOf(definition.impl).some((p) => p.files !== undefined)) delete params.paths;
    const replay = fixtureLock(definition, params, event.dispute!.context).rules[0]!;
    if (!equal(replay.impl, rule.impl) || !equal(replay.params, rule.params)) throw new Error("Recorded check differs from the denied rule.");
    const fixture: Fixture = { language: "typescript", params, context: event.dispute!.context,
      target, before: before === null ? null : "before/", expect: { verdict: "pass" } };
    files[`${dir}/fixture.json`] = json(fixture);
    files[`${dir}/CHECK.json`] = json(definition);
    files[`${dir}/files/${target}.fixture`] = after;
    if (before !== null) files[`${dir}/before/${target}.fixture`] = before;
    files[`${dir}/NOTE.md`] = `# Disputed denial\n\nEvent: ${id}\nRule: ${rule.id}\nCheck: ${rule.check}\nTarget: ${target}\n\nThe user disputes this denial. Review why this code should pass, then fix the check\nwith this regression case and preserve its existing pass/fail/trap cases.\nDo not weaken the preset or add an exception to make this case pass.\n`;
  }
  return files;
}
