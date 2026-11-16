import type { Node, Parsed } from "./ts.ts";

const TOKEN = /sk_live_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|BEGIN PRIVATE KEY/;
const CREDENTIAL_URL = /:\/\/[^/\s:]+:[^/\s@]+@/;
const REDACTED = "[redacted]";

// The same token and credential-URL shapes as credentialLiterals, for text that is not source.
// A fresh expression keeps TOKEN.lastIndex untouched for the source scan.
export function redactCredentialText(text: string): string {
  return text.replace(new RegExp(TOKEN.source, "g"), REDACTED).replace(new RegExp(CREDENTIAL_URL.source, "g"), "://[redacted]@");
}
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
