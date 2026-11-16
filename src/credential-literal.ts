import type { Node, Parsed } from "./ts.ts";

const TOKEN = /sk_live_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|BEGIN PRIVATE KEY/;

// Receipts and other stored command text keep the surrounding diagnosis and drop these shapes.
export function redactSecrets(text: string): string {
  return text
    .replace(/sk_live_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/g, "[redacted]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted]")
    .replace(/:\/\/[^/\s:]+:[^/\s@]+@/g, "://[redacted]@");
}
const CREDENTIAL_URL = /:\/\/[^/\s:]+:[^/\s@]+@/;
const PLACEHOLDER_URL = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/\s:]+:(?:secret|password|changeme)@[^/\s@]+(?:\/[^\s]*)?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;

// Tokens and keys remain findings even beside a placeholder URL. The exception
// is one static URL literal in a test file, never comments or interpolated text.
export function credentialLiterals(p: Parsed): Node[] {
  return p.root.descendantsOfType(["string", "template_string", "comment"]).filter(node => {
    if (!node.isNamed) return false;
    if (TOKEN.test(node.text)) return true;
    if (!CREDENTIAL_URL.test(node.text)) return false;
    return !TEST_FILE.test(p.rel) || !placeholder(node);
  });
}

function placeholder(node: Node): boolean {
  const value = node.text.slice(1, -1);
  return node.type !== "comment"
    && !node.namedChildren.some(child => child.type === "template_substitution" || child.type === "escape_sequence")
    && PLACEHOLDER_URL.test(value)
    && !CREDENTIAL_URL.test(value.slice(value.indexOf("@") + 1));
}
