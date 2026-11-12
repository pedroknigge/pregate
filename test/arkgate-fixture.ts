// The published hexagonal example (pedroknigge/arkgate examples/hexagonal-order-api), trimmed,
// plus the exclude, forbiddenGlobals and peerIsolation fields from that repo's schema.
export const arkConfig = {
  $schema: "https://unpkg.com/arkgate@2/schemas/ark.config.schema.json",
  schemaVersion: "1.0",
  name: "order-api",
  include: ["src"],
  excludeGenerated: true,
  safety: { allowInMemory: true },
  layers: [
    { name: "DomainModel", patterns: ["src/domain/**"], exclude: ["src/domain/**/*.spec.ts"], intentPrefixes: ["Domain."], forbiddenGlobals: ["Date.now", "fetch"] },
    { name: "ApplicationOrchestration", patterns: ["src/application/**"], intentPrefixes: ["Application."] },
    { name: "PersistenceAdapters", patterns: ["src/adapters/persistence/**"], intentPrefixes: ["Adapter.Persistence."] },
    { name: "PresentationAdapters", patterns: ["src/adapters/http/**"], intentPrefixes: ["Presentation.", "Adapter.Api."] },
    { name: "Kernel", patterns: ["src/main.ts"], intentPrefixes: ["Kernel."] },
  ],
  rules: [
    { from: "DomainModel", to: "ApplicationOrchestration", allowed: false },
    { from: "DomainModel", to: "PersistenceAdapters", allowed: false },
    { from: "DomainModel", to: "PresentationAdapters", allowed: false },
    { from: "ApplicationOrchestration", to: "PersistenceAdapters", allowed: false },
    { from: "ApplicationOrchestration", to: "PresentationAdapters", allowed: false },
    { from: "ApplicationOrchestration", to: "DomainModel", allowed: true },
    { from: "ApplicationOrchestration", to: "ApplicationOrchestration", allowed: false, peerIsolation: true, sliceFolders: ["src/application/*"] },
    { from: "PresentationAdapters", to: "PersistenceAdapters", allowed: false },
    { from: "PresentationAdapters", to: "DomainModel", allowed: false },
    { from: "PersistenceAdapters", to: "ApplicationOrchestration", allowed: false },
    { from: "PersistenceAdapters", to: "PresentationAdapters", allowed: false },
  ],
};

export const arkFiles = {
  "src/domain/order.ts": "import { save } from \"../adapters/persistence/db\";\nimport { money } from \"../lib/finance/decimal\";\nexport function order(id: string): string { return save(id) + money(1); }\n",
  "src/domain/order.spec.ts": "import { order } from \"./order\";\nexport const sample = order(\"a\");\n",
  "src/application/place.ts": "import { order } from \"../domain/order\";\nexport function place(id: string): string { return order(id); }\n",
  "src/adapters/persistence/db.ts": "import { order } from \"../../domain/order\";\nexport function save(id: string): string { return order(id); }\n",
  "src/adapters/http/page.ts": "import { place } from \"../../application/place\";\nexport function show(id: string): string { return place(id); }\n",
  "src/main.ts": "import { place } from \"./application/place\";\nexport function main(id: string): string { return place(id); }\n",
  "src/lib/finance/decimal.ts": "export function money(value: number): string { return value.toFixed(2); }\n",
};
