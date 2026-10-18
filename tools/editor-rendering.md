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

## Follow-up: Asset Priority and Repeat Visits

The embedded server now versions local CSS/JS references in HTML with a SHA-256
content hash. Matching versioned URLs use `public, max-age=31536000, immutable`.
HTML and unversioned CSS/JS use `no-cache` with an ETag, allowing conditional
requests to return 304 without a body. Updating an asset changes its URL and the
HTML validator, including when a test build reuses the same plugin version.
API responses remain `no-store`. Gzip responses vary by Accept-Encoding and
use the same weak validator as the equivalent uncompressed representation.

The editor preconnects to the texture host and preloads the first occupied
preview slot once its configuration is known. Only the first preview image has
high fetch priority; other preview images remain eager at normal priority.
Other item-list images are lazy and low priority so off-screen cards do not
compete with the visible preview. A list image sharing the primary texture
remains eager/high priority because it can be the LCP element on mobile.
No particular material or shop is hardcoded.

Comparison against `d2ffc93` on 2026-10-18, using the same 4x CPU/120ms request
delay harness (one run per viewport, not a live-server guarantee):

| View | FCP Before | FCP After | LCP Before | LCP After | CLS After |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop | 508 | 384 | 1152 | 884 | 0.055 |
| Mobile | 408 | 308 | 1112 | 960 | 0.078 |
| Collapsed sidebar | 424 | 300 | 1164 | 916 | 0.063 |

The grid reserves six rows only while empty. After rendering, its height follows
the configured one-to-six rows without permanent blank space. This introduces
a small first-load adjustment compared with the earlier permanently oversized
grid, while remaining below the CLS 0.10 threshold in all three tested views.
The workflow check verifies every supported row count ends at the final slot.

The trace harness intercepts requests, which disables the browser cache; these
numbers do not measure the repeat-visit cache benefit. Java tests separately
exercise content-hash updates, conditional requests, gzip, HEAD, fallback-file
updates, unchanged API caching, and a real HTTP request returning an empty 304.
To reproduce this follow-up baseline, run
`node tools/editor-rendering-check.cjs before d2ffc93` before the after run.

The three local layout stylesheets stay render-blocking to preserve the stable
first paint. Deferring them without a complete critical-style extraction would
risk flashing unstyled content and reintroducing layout shifts. Their presence
in an audit is not by itself evidence that deferring them improves the result.

The embedded JDK HTTP server still uses HTTP/1.1. HTTP/2 or HTTP/3 requires a
compatible HTTPS reverse proxy or a different server implementation; adding
`defer`, caching, or fetch priority does not upgrade the protocol. No proxy,
TLS, firewall, or deployment setting was changed. Proxy setup must preserve the
editor's authentication/IP trust behavior and must not cache API responses.

## CSP Verification

No eval, Function-constructor calls, or string-based timers were found in the
current editor scripts or the bundled YAML parser. The state store uses ordinary
object access and function callbacks. Its presence, or the filename
`yaml.min.js`, does not establish that the application requires unsafe-eval.

The Node web-test context disables string code generation. Tests prove that
eval/Function are rejected while YAML parsing/editing and state subscriptions
continue to work. Run `node --test src/test/web/*.test.cjs`.

Run `node src/test/web/csp-browser-check.cjs` for Chrome/Firefox desktop/mobile
checks with `script-src 'self' 'unsafe-inline'` and no unsafe-eval permission.
This test-only policy preserves the editor's existing inline handlers while
blocking eval; it is not a claim of compatibility with a self-only script policy
and is not applied to the production server. The tested load/edit/state workflows
produce no CSP violations.

The reported live eval violation has not been reproduced. Investigating that
specific report requires the exact Console message, source file/line or stack,
and actual response CSP header. Do not add unsafe-eval or replace the parser
without identifying the blocked execution first.
