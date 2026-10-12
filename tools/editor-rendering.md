# Web editor rendering checks

Issue: https://github.com/Drallee/Genius-Shop/issues/26

## Reproduce

Requires Node.js and an installed Google Chrome browser. Install the test-only
dependency in the ignored build directory:

```powershell
npm install --prefix target/rendering-tools --no-save playwright
node tools/editor-rendering-check.cjs before 0f48082
node tools/editor-rendering-check.cjs after
node --test src/test/web/*.test.cjs
```

The check starts and stops its own preview server on port 8796. Its API writes
only to memory. Browser traces, screenshots, metrics, and cached external assets
are written to `target/editor-rendering/`. The baseline uses the original HTML,
styles, and changed startup scripts at the supplied Git revision. Other assets
come from the working tree, preserving the existing issue #24 preview changes.

Both runs use Chrome, 4x CPU throttling, fresh browser contexts, and a 120 ms
delay per resource/API request. External assets are cached by URL and replayed
with the same delay. These are local comparison conditions, not the unknown
conditions behind the original synthetic report.

## Results

Measured on 2026-10-12; timings are milliseconds and vary between runs.

| View | FCP Before | FCP After | Preview Ready Before | Preview Ready After | CLS Before | CLS After |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop, 1440 x 900 | 620 | 476 | 1498 | 1440 | 0.216 | 0.000 |
| Mobile, 390 x 844 | 520 | 392 | 1545 | 1264 | 0.476 | 0.000 |
| Desktop, collapsed sidebar | 492 | 376 | 1555 | 1177 | 0.357 | 0.000 |

The trace confirms four blocking stylesheets before the change and three after.
The 16 external scripts were already at the end of the body. They are now
deferred in the head, retaining their dependency order while allowing earlier
discovery. The report's 17 scripts and two unidentified blocking requests were
not reproduced. Local layout styles remain blocking to avoid an unstyled first
paint; the icon stylesheet loads asynchronously. Inter uses optional font display
to avoid a late font swap. Existing separate scripts remain individually
cacheable; no generated bundle or extra production dependency is introduced.

The largest shifts came from the empty preview growing, late account information,
and applying the saved sidebar preference after paint. The preview now reserves
six supported rows, icons and account controls reserve dimensions, and the saved
sidebar preference applies before paint. Initial loading uses the existing
skeletons without loading/success toasts. Explicit reloads retain notifications.

**LCP limitation:** Before the change the largest element was footer text painted
at 620/520/492 ms, then moved out of view during loading. After the change it is
an actual item image, painted at 1544/1352/1288 ms. Thus raw LCP increased while
FCP and preview-ready time improved. The issue's requirement for improved LCP is
not established; it needs comparison on the live editor under the original test
conditions. The trace files retain these results without substituting readiness
for LCP.

## Functional Validation

All three viewports passed the CLS <= 0.10 check, with no page errors or horizontal
overflow. The browser check also verifies deferred script loading, navigation
preferences, mobile navigation, all editing tabs, real item texture loading,
autosave to the preview API, reload of the saved value, and the standalone preview's
initial Weekend Market selection. All 31 existing Node web tests passed.
