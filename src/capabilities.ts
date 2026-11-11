import type { HarnessId } from "./types.ts";

export const CAPABILITIES = {
  "claude-code": { nativeApproval: "interactive parent sessions", sessionContext: true, warnings: true, halt: true, stopLimitNotice: true, subagentStop: true },
  codex: { nativeApproval: null, sessionContext: true, warnings: true, halt: false, stopLimitNotice: true, subagentStop: true },
  cursor: { nativeApproval: null, sessionContext: true, warnings: true, halt: false, stopLimitNotice: false, subagentStop: false },
  grok: { nativeApproval: null, sessionContext: false, warnings: true, halt: false, stopLimitNotice: false, subagentStop: false },
  agy: { nativeApproval: null, sessionContext: true, warnings: false, halt: false, stopLimitNotice: false, subagentStop: false },
} satisfies Record<HarnessId, { nativeApproval: string | null; sessionContext: boolean; warnings: boolean; halt: boolean; stopLimitNotice: boolean; subagentStop: boolean }>;

export const LANGUAGE_COVERAGE = [
  { language: "typescript", extensions: [".ts", ".mts", ".cts", ".tsx", ".vue", ".svelte"], parser: "tree-sitter-typescript 0.23.2 (including <script> blocks in .vue and .svelte)" },
  { language: "javascript", extensions: [".js", ".mjs", ".cjs", ".jsx"], parser: "TypeScript/TSX grammar; see each rule's paths" },
  { language: "python", extensions: [".py"], parser: "tree-sitter-python 0.25.0", limits: "Explicit language rules required; root/src regular packages only, no search hooks or value-flow resolution." },
  { language: "go", extensions: [".go"], parser: "tree-sitter-go 0.25.0", limits: "Explicit language rules required; single-module package directories and unversioned local replacements, no workspace/module-graph resolution." },
  { language: "rust", extensions: [".rs"], parser: "tree-sitter-rust 0.24.2", limits: "Explicit language rules required; conventional Cargo modules, editions 2018/2021/2024, explicit use trees and canonical crate/self/super/std/core/alloc source paths. Source AST metrics/patterns only: no macro expansion, compiler/type/trait flow, cfg evaluation or Cargo graph. Custom roots, path/workspace dependencies and repository Cargo overrides are unresolved; restricted unresolved imports fail closed." },
];
