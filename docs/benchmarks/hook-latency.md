# Hook latency

`scripts/bench.ts` times the compiled binary behind the registered Pre hook. CI runs that command on `ubuntu-latest`, `macos-latest`, and `windows-latest` for four TypeScript routes: 200 lines and 2,000 lines, first touch and second touch. Each job takes 25 samples, repeats that three times, and keeps the median of the three p95 values. The required check is named `bench` and is the `ubuntu-latest` job. macOS and Windows run the same gate.

The 150 ms p95 budget belongs to the reference machine in the [architecture notes](../ARCHITECTURE.md): macOS arm64, M5 Pro, 18 cores. CI passes `--inform`, so a runner that misses 150 ms does not fail for that miss. The failure is the baseline comparison below. Hardware, file size, and the contract change the number. A passing job is not a promise that every machine meets 150 ms.

See the [benchmark script](../../scripts/bench.ts), the [gate](../../scripts/latency-gate.ts), and the [precision notes](../guides/rule-precision.md).

<!-- BEGIN generated reference -->

Generated from the current CLI and source manifests by `bun scripts/docs-reference.ts`. Do not edit this section by hand.

## Committed baselines

These p95 milliseconds are the gate in `bench/latency-baseline.json`. CI fails a route when the new median p95 is above 1.55 times that platform's baseline.

| Platform | Architecture | Runner | Route | Baseline p95 ms |
| --- | --- | --- | --- | ---: |
| `darwin` | `arm64` | `macos-latest` | 200 lines, first touch | 145.5 |
| `darwin` | `arm64` | `macos-latest` | 200 lines, second touch | 137.3 |
| `darwin` | `arm64` | `macos-latest` | 2,000 lines, first touch | 263.0 |
| `darwin` | `arm64` | `macos-latest` | 2,000 lines, second touch | 264.4 |
| `linux` | `x64` | `ubuntu-latest` | 200 lines, first touch | 127.8 |
| `linux` | `x64` | `ubuntu-latest` | 200 lines, second touch | 118.4 |
| `linux` | `x64` | `ubuntu-latest` | 2,000 lines, first touch | 252.9 |
| `linux` | `x64` | `ubuntu-latest` | 2,000 lines, second touch | 241.5 |
| `win32` | `x64` | `windows-latest` | 200 lines, first touch | 811.8 |
| `win32` | `x64` | `windows-latest` | 200 lines, second touch | 801.6 |
| `win32` | `x64` | `windows-latest` | 2,000 lines, first touch | 948.8 |
| `win32` | `x64` | `windows-latest` | 2,000 lines, second touch | 928.4 |

<!-- END generated reference -->

## One hosted run

[CI run 42265778062](https://github.com/pedroknigge/pregate/actions/runs/42265778062), commit `e2d42353`, 6 November 2026. These are compiled Pre-hook measurements on TypeScript fixtures, not whole-project audit times. Values are the median p95 across three repeats of 25 samples per route, in milliseconds.

| Hosted runner | 200 lines, first touch | 200 lines, second touch | 2,000 lines, first touch | 2,000 lines, second touch |
| --- | ---: | ---: | ---: | ---: |
| Linux x64 | 107.1 | 96.9 | 199.8 | 197.2 |
| macOS arm64 | 167.0 | 163.3 | 301.1 | 301.8 |
| Windows x64 | 836.0 | 838.6 | 1,046.4 | 1,001.6 |

On this run the Windows medians were about 836 ms to 1,046 ms for a measured edit. That describes this hosted runner, not a budget for every Windows PC. These medians are not the committed baselines above. The baselines are the median of an earlier sample of hosted runs, and the gate compares a new run with those baselines.
