import { libraryPackHashes, readLibrary } from "./disk.ts" with { type: "macro" };
import type { Files } from "./types.ts";

// Keep both literals inside factories: Bun hoists module constants out of lazy
// require initializers. A hook that never queries a library must construct neither.
export function libraryPolicy(): Files {
  return readLibrary(false);
}

// One content hash per bundled pack, inlined so admission can skip reconstructing the packs.
export function libraryContentHashes(): Record<string, string> {
  return libraryPackHashes();
}
export function libraryFixtures(): Files {
  return readLibrary();
}
