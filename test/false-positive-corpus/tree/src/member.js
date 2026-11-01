export function scoped(code) {
  return globalThis.eval(code);
}
