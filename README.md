# Genius Shop v1.7.0-TB.26.10.07

A data-driven economy shop plugin for Minecraft 1.21 Bukkit/Spigot servers and Paper/Purpur, with configurable inventory menus, dynamic pricing, stock management, scheduled campaigns, and a built-in web editor.

[Download](https://modrinth.com/plugin/genius-shop) | [Changelog](CHANGELOG.md) | [Wiki](https://github.com/Drallee/Genius-Shop/wiki)

## Requirements

- Java 21 or newer and a compatible Minecraft 1.21 server. The project compiles against the Paper 1.21.1 API.
- [Vault](https://www.spigotmc.org/resources/vault.34315/) and a Vault-compatible economy provider, such as [EssentialsX](https://modrinth.com/plugin/essentialsx). Vault itself does not provide player balances.
- An additional available TCP port for remote web-editor access.

Optional integrations include [SmartSpawner](https://modrinth.com/plugin/smartspawner) for native spawner items and [Floodgate](https://modrinth.com/plugin/floodgate) for Bedrock compatibility improvements.

## Quick Start

1. Install Vault and your economy provider.
2. Put the Genius-Shop release JAR in the server's `plugins/` folder. Keep only one version installed.
3. Start the server and check the console for startup errors.
4. Configure the generated files in `plugins/Genius-Shop/`, including shop prices, menu layouts, language, and permissions.
5. Review the API settings below. The bundled configuration enables the web editor by default.
6. Run `/shop reload` after configuration edits, then `/shop validate-prices`.
7. Test `/shop`, a small purchase, and a sale before opening the shops to players.

Back up the entire plugin data directory before upgrading. Stop the server, replace the JAR, and restart. Configuration reloads do not install new plugin code.

## Features

### Shops, Items, and Menus

- Separate YAML shop files with configurable slots, pages, shop/item permissions, and availability schedules.
- Main, shop, purchase, sell, bulk-sell, and grouped variant menus.
- Independent buy/sell controls and prices per single item or configured bundle.
- Dynamic pricing with minimum/maximum bounds, price-change rules, and formula expressions.
- Player limits, shared stock limits, and scheduled resets: daily, hourly, minute/second intervals, weekly, monthly, yearly, or once.
- Shop/item controls for whether sales replenish stock and whether stock overflow is allowed.
- Selling requirements for item names/lore, plus potion, tipped-arrow, spawner, enchantment, and exported item-stack metadata support.
- Item conditions for player level, game mode, and allowed/denied worlds.
- Item variants that inherit base settings, with separate runtime identities and optional `variant-menu: true` selection.
- Configurable lore, legacy colors, HEX colors, multi-stop gradients, stock/reset placeholders, and live GUI updates.
- Custom commands in `commands.yml` for opening shops/items or selling eligible inventory items. Bundled command examples are disabled by default.

### Transaction Settlement

Purchase, sell, bulk-menu, command sell-all, and container/spawner-wand transactions
share `TransactionService` for pricing, eligibility, payment/delivery ordering, count
updates, and compensation. Service results expose a UUID, status, and failure reason.
Transactions execute on the server thread and reject nested settlement for the same player.

Purchases withdraw before delivery. If delivery throws, the inventory snapshot is restored
before a durable refund case is created and repayment is attempted. Sales remove validated
quantities before paying; definitively refused payments restore the source. Ambiguous
sale payouts retain the removed items for provider review, preventing potentially paid
items from being returned as well. Failed restoration or refunds return `COMPENSATION_FAILED`
and log the transaction ID, player UUID, amount, context, and error for manual reconciliation.
Payments and refunds are not automatically retried. If inventory restoration fails after a
purchase, the service does not also refund potentially delivered items.

Count-update failures after money/items settle return `COMPLETED_WITH_ERRORS` and are
logged at severe level. Do not repeat the trade to repair counts: financial settlement is
already complete, and count updates may be partially applied. Notifications and completed
trade events remain outside compensation. Arbitrary purchase command effects (permissions,
other plugins, external state) are not reversible, even if money and inventory are restored.
Vault providers must report payment outcomes correctly; an external provider that changes a
balance and then reports failure cannot be made atomic with Bukkit inventories.

Intentional safety changes: selling without a functioning economy no longer removes items;
normal/bulk sales remove before payment and restore on failure; bulk-menu limits include
all already-planned stacks and its anti-spike reference uses the executed price;
execution rechecks shop/item permissions and conditions.
API price lookups also respect player conditions. Unit/bundle pricing, formulas, campaigns,
wand multipliers, source-selection rules, and successful-trade messages are preserved.
See [transaction testing](docs/transaction-testing.md) for the server regression checklist.

### Pricing and Campaigns

Use `buy-price-per-item` and `sell-price-per-item` to choose unit or bundle pricing. Both default to `true`; when set to `false`, the corresponding total is `price * (selected amount / configured amount)`.

Per-item `buy-price-formula` and `sell-price-formula` support arithmetic, parentheses, and functions including `min`, `max`, `abs`, `round`, `floor`, `ceil`, and `pow`. Variables include base/dynamic prices, counts, amounts, and limits.

Campaigns can be defined globally in `campaigns.yml` or within a shop, then assigned with `campaign: <key>`. Inline item campaign settings also support start/end times, timezones, and buy/sell multipliers. Active campaigns affect displayed prices, transactions, bulk selling, and best-offer matching.

### Economy Safety

The `economy-safety` configuration provides:

- Transaction-total and unit-price caps.
- Anti-spike checks against configured base prices and previous successful trades.
- Buy, sell, and bulk-sell cooldowns.
- Optional second confirmation for expensive purchases.
- Invalid-value checks and configured price bounds.
- Economy failure logging and optional administrator alerts.

Ordinary item purchases check inventory capacity before charging. If delivery fails after withdrawal, the plugin attempts a refund. Use `/shop validate-prices` for a dry-run configuration scan; test transactions as well, especially when using formulas, campaigns, or external command deliveries.

### Web Editor

- Responsive Minecraft inventory previews for shops and menus, with live item tooltips and lore parity previews.
- Editing for items, transaction menus, GUI settings, economy safety, campaigns, and custom commands.
- Structured YAML editing that preserves comments, unknown fields, and unchanged language references for supported edits.
- Persistent per-admin drafts, complete-configuration validation, diff review, and explicit publishing. Autosave saves drafts only.
- YAML/JSON import/export, item cloning across shops, and held-item JSON imports.
- Stock analytics and a data editor for persisted player counts, global counts, and reset tracking.
- A Sales dashboard with persistent transaction totals, popular items, money flow, and effective price history.
- Activity history and file rollback through `activity-log.json`.
- An alternate React editor at `/react.html`, alongside the classic editor.
- Authenticated administrative HTTP endpoints and opt-in editor telemetry.
- Interactive first-run tutorials in the classic editor, with per-section replay from the question-mark Tutorial button. Progress is stored per username in this browser for this server origin. Exit or Skip Section dismisses the relevant onboarding; completed and dismissed sections stay hidden on subsequent visits. New or revised sections appear on later logins unless automatic new-feature tutorials are disabled in Tutorial. Manual replay remains available. Clearing browser storage resets these preferences.

Editing lessons use temporary practice data in the actual editor controls. Completed tasks advance automatically after a short pause; informational steps wait for Next. Going Back cancels pending advancement, and revisiting a completed task leaves it open for review. Exit and Skip Section remain available. Required field values are highlighted and copyable. Tasks cover preview titles, click-to-edit, materials, prices, lore, dynamic pricing, permissions, commands, local item saves, dragging, adding items, purchase/sell settings, campaigns, custom commands, reusable items, and shared GUI buttons. Touch and keyboard users can move an item through its Slot field instead of dragging. Stock and data lessons remain informational.

Practice blocks API writes, pauses autosave without changing its preference, and restores original drafts and history on exit. Any autosave pending before the tutorial is rescheduled after restoration. The item dialog's Save only applies edits to temporary practice models; Save Draft and Review & Publish are not practice tasks. Sample items are available even when the real shop is empty. An already-open user edit dialog is never replaced.

Save Draft stores the current tab separately from live configuration in `plugins/Genius-Shop/editor-drafts/`. Drafts survive browser reloads, logins, and server restarts, and are isolated by admin username. Creating or deleting a shop and restoring a file-history version also update the draft, not the live server. Unsaved edits in other tabs are included when opening Review & Publish.

Review & Publish saves the complete editor workspace, validates all proposed YAML and cross-file shop, item, campaign, and command references, and shows added, modified, and deleted files with their live/draft contents. Only the explicit Publish button installs the reviewed set and reloads the server. Draft saves and autosave never reload live configuration, even if an older browser preference selected publish autosave. Database counter edits remain live data operations, not configuration drafts.

If the draft changes after review, or live files change after the workspace was loaded, publishing is rejected. Review again for a changed draft; for changed live files, retain any edits you need before discarding the draft and reloading live configuration. A failed write or reload restores the prior live files and reloads them while retaining the draft. A rollback failure is reported explicitly for administrator intervention. Keep normal backups; publishing is a server-thread transaction, not a crash-proof filesystem transaction. File-history restore does not restore economy balances or all runtime state.

Shop-item saves patch changed values without filling in unrelated optional fields.
Item stock settings distinguish inherited shop values from explicit enabled/disabled
overrides. New stock-reset sections contain only the relevant schedule settings;
existing configured values, comments, unknown keys, and untouched disabled-feature
options are retained. Repeated unchanged saves do not expand the configuration.

Configuration reads include content-based file revisions. Every editor save, delete, economy-safety update, and history restore sends the originally loaded revision. A changed file, including one edited outside the browser, produces a conflict instead of overwriting it. The conflict view retains local edits, pauses autosave, and compares the loaded version, latest server version, and local changes. Keep Editing leaves those edits untouched; Download Local exports them; Reload Latest replaces only the affected file after confirmation. Reconcile opens editable YAML (JSON for economy settings), and Save Reconciled checks the latest revision again. A second conflict retains the reconciled text. Other sections' local edits are not discarded by targeted reload or reconciliation.

Older browser pages and API clients without a revision receive HTTP 428 and must reload. API clients should retain `revisions` from `GET /api/files`, or `revision` from `GET /api/file/{path}` / `GET /api/economy-safety`, and send it as `X-File-Revision` on mutations. New files use the explicit revision `missing`; HTTP 409 includes the latest revision and content. Economy conflicts expose only economy settings, not API credentials. Check-and-write operations share one API lock and use atomic file replacement where the filesystem supports it. External edits completed before a save are detected by a SHA-256 content hash; external programs do not participate in the API lock.

### Integrations and Developer API

- Vault economy, optional SmartSpawner/Floodgate support, and Discord transaction webhooks.
- SQLite storage with automatic legacy `data.yml` migration.
- Localization, update notifications, configurable price formatting, and debug error logging.
- Java API for opening menus, reading shops, looking up prices, and finding best buy/sell offers.
- Cancellable shop-open events and successful purchase/sale notification events.

See [Developer API](wiki/Developer-API.md) for Java integration and the editor HTTP API.

## Web Editor Setup

Review the generated `config.yml`:

```yaml
api:
  enabled: true
  port: 8080
  enable-editor-command: true
  domain: ""
  allow-ip-bypass: false
  ssl:
    enabled: false
```

This is an excerpt, not a replacement for the whole file. The plugin generates an API key when the configured key is empty or still the bundled placeholder.

Join as an administrator or a delegated editor and run `/shop editor` to obtain a login link/code. API requests use authenticated sessions; the configured API key alone does not replace login. Different-IP confirmation requires `api.allow-ip-bypass` and `geniusshop.login.ip.bypass`.

Port `8080` is only the default. Choose an available TCP port allocated by your hosting provider, or configure firewall/forwarding rules for your own server. The editor uses a separate port from Minecraft. Set `api.domain` when the generated address is not reachable; this setting advertises an address and does not configure DNS or networking.

Restart after changing API enablement, port, or TLS settings. Native HTTPS supports a configured keystore; an HTTPS reverse proxy is another option. Set `api.enabled: false` when the editor/API is not needed.

See [Web Editor](wiki/Web-Editor.md) for authentication, HTTPS, network troubleshooting, and save behavior.

## Commands and Permissions

| Command | Purpose | Permission |
| --- | --- | --- |
| `/shop` | Open the main menu | `geniusshop.use` |
| `/shop sell` | Open the bulk-sell menu | `geniusshop.sell` |
| `/shop reload` | Reload configuration and custom commands | `geniusshop.reload` |
| `/shop editor` | Generate an editor login link/code | Full admin or any `geniusshop.editor.*` capability below |
| `/shop confirmlogin <token>` | Confirm an editor login request | IP-bypass workflow described above |
| `/shop wiki` | Show the configured wiki link | `geniusshop.wiki` |
| `/shop resetstock all` | Reset global counters across shops | `geniusshop.resetstock` |
| `/shop resetstock shop <shopKey>` | Reset a shop's global counters | `geniusshop.resetstock` |
| `/shop resetstock item <shopKey> <slot>` | Reset an item by shop and zero-based slot | `geniusshop.resetstock` |
| `/shop validate-prices` | Scan price configuration without trading | `geniusshop.validateprices` |
| `/shop ledger [filters]` | Search completed purchases, sales, and wand sales | `geniusshop.ledger` |
| `/shop refunds list [page]` | List unresolved refunds | `geniusshop.refunds` |
| `/shop refunds inspect <id>` | Inspect a refund's status, reason, and attempts | `geniusshop.refunds` |
| `/shop refunds retry <id>` | Retry a pending refund for an online player | `geniusshop.refunds` |
| `/shop refunds review <id> <paid\|unpaid> <note>` | Record the checked provider outcome of an uncertain refund | `geniusshop.refunds` |
| `/shop exportitem [file-name]` | Export the held item to JSON | `geniusshop.exportitem` |

Use and bulk-sell permissions default to everyone; administrative permissions default to operators. `geniusshop.admin` includes the declared administrative child permissions. Custom shop/item permissions remain separate.

The protected default shops use `geniusshop.shop.spawners` and `geniusshop.shop.premium`, with parent node `geniusshop.shop`; these are not granted by default. See [Commands and Permissions](wiki/Commands-and-Permissions.md) for access rules and custom-command examples.

### Price Simulation and Arbitrage

`/shop validate-prices` keeps the existing configuration checks and adds a sampled
buy/sell simulation. It compares the actual delivered item against each sell
offer using the normal metadata-matching rules. Counters are copied for every
scenario; balances, inventories, limits, live stock, and cooldown history are
never changed. Simulations run off the server thread after item matching and
optional player eligibility are captured.

```text
/shop validate-prices
/shop validate-prices player=Alice quantities=1,4,16 stock=live
/shop validate-prices at=2026-10-17T12:00:00Z quantities=64 stock=100 mode=sequential
```

`player` names an online player whose current permissions, conditions, and player
counts are used. Without it, the audit assumes fresh player counts and reports
the permissions and world/level/game-mode conditions required for a route.
Contradictory conditions and unavailable shops/items are excluded. `at` accepts
an ISO UTC timestamp; without it, samples include now, the next week's opening
boundaries, date-range endpoints, and configured campaign start/end boundaries.

`quantities` accepts up to eight values from 1 to 1024 (default `1,16,64`). `stock`
is a used-stock counter: `live`, `zero`, `half`, `depleted`, `all` (default), or an
explicit nonnegative count. Half/depleted use the configured global limit; items
without a limit instead sample at least 32/64 previously traded units. Each
scenario applies global/player limits, stock replenishment and overflow rules,
formula pricing, campaign precedence, floors/ceilings, and configured safety
caps. Reset schedules affect the copied global counters during a sequence.
Counter samples describe assumed starting conditions, not a forecast of future
player activity or stock before the sampled time.

`mode=batch` models one quantity purchase and one quantity sale using their
starting prices, matching current GUI transaction behavior. `mode=sequential`
reprices each individual buy and sale, updates shared counters, and advances
time between trades using configured cooldowns. Default `both` compares these
models. The report gives each profitable route's best sampled scenario per mode:
shop/item keys, quantity, start time, stock counters, cost, revenue, estimated
profit, and eligibility conditions.

In-game chat shows a colored summary and the five most profitable route/mode
findings. Hover for prices, timing, exact identifiers, conditions, and assumptions;
click a finding to copy its intentional-route key. Skipped items and warnings are
grouped into one hoverable line. The full-report button copies the filename.
Console output and `price-validation/price-validation-<id>.txt` in the plugin data directory retain
the complete report, including every finding and warning. Routes are labelled
`REVIEW` by default. Acknowledged routes remain visible as `INTENTIONAL`:

```yaml
price-validation:
  max-simulated-units: 1000000
  intentional-routes:
    - "cheap:STONE->premium:STONE"
```

Copy the exact key from the report, including variant/name suffixes when present.
These labels acknowledge administrator intent; they do not change trading rules.
Each route samples at most 64 timestamps. Reports explicitly mark truncated
work/time sampling as incomplete and identify skipped command-backed purchases,
external spawner-API deliveries, or unverified item templates. No findings is not
proof that every possible route is unprofitable. Estimates assume enough capital
and inventory/storage, any required confirmation, and eligible initial safety
history; provider rounding, fees, other plugins, and command side effects are not
simulated.
### Delegated Web Editor Access

All five nodes default to **false** and independently allow editor login, including `/shop editor`, UUID login, links, and codes. Players must still be online and pass the existing session/IP checks. `geniusshop.admin`, legacy `shop.admin`, and OP retain full access; granular denials do not restrict a full administrator. Remove full-admin/OP access when delegating a limited role.

| Permission | Behavior |
| --- | --- |
| `geniusshop.editor.analytics` | View stock analytics; no configuration or database editing |
| `geniusshop.editor.drafts` | Read and save personal shop, menu, campaign, and custom-item drafts; cannot publish |
| `geniusshop.editor.publish` | Publish reviewed changes in the player's own draft; also requires the editing permission for every changed file |
| `geniusshop.editor.commands` | Manage `commands.yml` drafts; additionally required to edit, delete, or publish any shop/menu/custom-item file containing command actions |
| `geniusshop.editor.database` | Read, update, and delete live player counts, global counts, and stock reset rows; changes are immediate, not drafts |

For example, grant `geniusshop.editor.drafts` for a draft-only editor, add `geniusshop.editor.publish` for a shop maintainer, or grant only `geniusshop.editor.analytics` for an observer. Command managers need `geniusshop.editor.commands` and `geniusshop.editor.publish` to publish custom commands; command-bearing shop/custom-item files also need `geniusshop.editor.drafts`. Treat command delegation as privileged: configured actions may execute console commands. Files containing commands are entirely read-only without the command capability, even for price-only changes; ordinary files with empty command lists remain editable.

Raw `config.yml`, `discord.yml`, legacy `gui.yml`, language files, economy safety settings, audit history/snapshots/restores/clearing, and telemetry inspection remain full-admin-only. Delegated file listings exclude these sources. A draft containing files the player can no longer access cannot be reviewed or published; it is retained until permissions are restored or the player discards it.

Every protected API route checks live permissions server-side, including direct requests, raw file operations, history restores, and publication. Publish rechecks access in the server task before installing files, so a previously saved draft or review token does not preserve revoked rights. `GET /api/permissions` and the `permissions` object in `GET /api/files` expose the current capability flags; `readOnlyFiles` lists command-bearing files locked for that user. The UI hides unavailable sections/actions, and draft saving skips inaccessible files. Returning focus to the editor or a rejected save refreshes revoked access without discarding local edits; use Reload to load newly granted sections and their file contents. Unauthorized operations return HTTP 403; expired, offline, or fully revoked sessions return HTTP 401. Draft workspaces remain per-player, not a cross-player approval queue.

## Configuration and Data

Paths below are relative to the plugin data directory, normally `plugins/Genius-Shop/`.

| Path | Purpose |
| --- | --- |
| `config.yml` | General settings, economy safety, formatting, and editor/API settings |
| `shops/*.yml` | Shop definitions and items |
| `menus/*.yml` | Main, purchase, sell, bulk-sell, and shared GUI settings |
| `languages/*.yml` | Messages and translated menu text |
| `campaigns.yml` | Optional global campaign definitions |
| `commands.yml` | Custom commands and aliases |
| `discord.yml` | Discord webhook settings |
| `data.db` | SQLite stock, player counts, and reset state |
| `transactions.db` | Persistent ledger of completed purchases, sales, and wand sales |
| `refunds.db` | Durable purchase-refund recovery cases and completion details |
| `item-exports/` | Held-item JSON exports |
| `activity-log.json` | Editor file-change history |
| `trusted-ips.yml` | Trusted editor-login addresses |
| `debug/error.log` | Default error-log path when debug logging is enabled |
| `debug/debug.log` | Plugin debug, info, warning, and error messages when debug logging is enabled |

Legacy `data.yml` is migrated automatically. Back up the data directory, including `data.db` and any SQLite companion files, while the server is stopped.

With `debug: true`, `debug/debug.log` captures plugin logging, including purchase
attempts and routine rejections such as insufficient funds. `debug/error.log` keeps
warnings and errors, including failed payments, refunds, and restoration failures.
Exceptions include their stack traces. Both files append across reloads/restarts.
Configure them independently using `debug-log.enabled` / `debug-log.file` and
`debug-error-log.enabled` / `debug-error-log.file`, then run `/shop reload`.
The completed-transaction ledger remains separate from these diagnostic logs.

### Transaction Ledger

The classic web editor's **Sales** tab reports completed entries from `transactions.db`.
Reports survive restarts; they do not reconstruct trades from before ledger installation or
entries that could not be persisted (these failures are logged). Failed/refunded trades are excluded.
Date filters use inclusive UTC calendar days, default to the last 30 days, and allow up to 366 days.
Shop and item filters use exact ledger keys, including removed items and unattributed empty keys.

Purchases are player buys (money **from players**). Sales and wand sales are player sells
(money **to players**); net to players is sales plus wand sales minus purchases. This is shop
transaction flow, not the total economy balance or transfers between players.
Totals separate purchases, sales, and wand sales and count operations, ledger lines, and individual
item units. A bulk operation can contain multiple lines. Popular items are grouped by shop/item,
ranked by total traded units, and limited to the top 50; totals always include every matching entry.
Turnover is the sum of purchase and sale values, not profit.

Select a shop and item for daily effective buy/sell price history. Sell prices include wand sales.
Daily averages are quantity-weighted (`sum(total) / sum(quantity)`), alongside minimum/maximum
actual unit prices. Prices reflect completed trades, including discounts and bundle/wand effects,
not configured offers; days without trades are gaps, not zero-price observations.
The authenticated, read-only `GET /api/sales-analytics` endpoint accepts `from`, `through`, `shop`,
and `item` filters and uses the editor's existing online-administrator session checks.
Charts use locally bundled [Chart.js](https://www.chartjs.org/) 4.5.1 (MIT license in
`src/main/resources/web/vendor/chart-LICENSE.md`); exact values are also shown in tables.

The ledger records completed purchases, individual sales, bulk/command sales, and
container/spawner wand sales. Rejected payments and purchases refunded after
delivery failure are excluded. Records include a unique ID, UTC timestamp, player
UUID/name, transaction type, shop key, item key, quantity, effective unit price,
and total. Effective unit price is the actual total divided by quantity, including
bundle pricing, formulas, campaigns, and wand multipliers.

```text
/shop ledger
/shop ledger player=Alice shop=weekend_market type=PURCHASE from=2026-10-01 to=2026-10-12
/shop ledger item=STONE type=WAND_SALE page=2
```

Filters can be combined: `player` accepts an exact name (case insensitive) or UUID;
`shop` and `item` accept exact identifiers shown in the results. Types are
`PURCHASE`, `SALE`, and `WAND_SALE`. Date-only bounds cover complete UTC days;
ISO timestamps are also accepted, with an inclusive `from` and exclusive `to`.
Results show ten entries per page, newest first. Access requires
`geniusshop.ledger` (operator by default); full and legacy admins are supported.
Each result displays both its record ID and the operation ID shared by bulk lines.
In-game entries use gold for purchases, green for sales, and aqua for wand sales.
Hover an entry for full record/operation IDs, player UUID, and exact item/shop keys;
click it to copy the record ID. Chat shows compact summaries with a short record ID,
while console output retains the full identifiers.
Access is checked again before asynchronously queried results are displayed.

Ledger records are committed immediately to `transactions.db`, including SQLite
companion files when backing up. Bulk trades have one record per sale-plan line,
with a shared operation ID linking the lines. Duplicate record IDs cannot create
duplicate rows, and each bulk batch commits together. The database stays open
across configuration reloads and closes on shutdown. Bulk-sell completion events
now run after inventory removal and ledger recording. If the ledger cannot open
during startup, the plugin disables itself. A runtime write failure logs the full record
at severe level, including the operation and source lines; it does not interrupt,
repeat, or undo an already completed trade. Integrations can pass a stable operation
UUID to `recordTransactions(operationId, player, type, lines)` when retrying the same
completed operation with the same ordered lines. Record IDs are derived from that
operation and each line's position, so identical retries remain deduplicated after restarts.
Omitting the operation UUID creates a new operation on each call. Vault
payment and the SQLite commit are separate operations, so a process crash between
them is not protected by a shared transaction.

### SmartSpawner Resale

Spawner sale matching reads SmartSpawner's native item/mob identity through its
inspection API before considering vanilla block-state data. Item spawners match
their exact `spawner-item` material; mob spawners match `spawner-type`. Display names
alone cannot identify a spawner or make one item-spawner type sell as another.
Purchases preserve the provider's item data and apply explicitly required shop
names/lore so new purchases satisfy the same resale restrictions.

The bundled item-spawner examples use `require-name: false` and `require-lore: false`
to accept existing native SmartSpawner items. For an existing server, set these
values on the relevant entries in `plugins/GeniusShop/shops/spawners.yml` and run
`/shop reload`; existing shop files are not overwritten on upgrade. Keep these
restrictions enabled when a shop intentionally requires an exact custom variant.

### Refund Recovery

When purchase delivery fails and inventory restoration succeeds, the original shared
transaction ID, player UUID, amount,
failure reason, timestamps, and status are saved to `refunds.db` before the
automatic refund is attempted. A successful automatic refund is marked recovered;
a definitive rejection remains pending. Refunded purchases are not added to the
successful transaction ledger. A failed refund shows its reference ID to the
player and logs the error for administrators.
If inventory restoration fails, no automatic repayment case is created because the
player may still have the delivered items; the transaction requires manual investigation.

```text
/shop refunds list
/shop refunds inspect <transaction-id>
/shop refunds retry <transaction-id>
```

Retries use the stored player and amount; the player must be online. Each attempt
durably claims a pending case before paying. A recovered case cannot be retried,
and concurrent attempts cannot claim the same case. Recovery records the time
and the administrator's UUID/name (or console identity).

Null responses, provider exceptions, partial/uncertain payments, and attempts
interrupted by a restart become `REVIEW` and cannot be retried. Check the economy
provider's history first, then explicitly record its outcome with a note:

```text
/shop refunds review <transaction-id> paid Credit confirmed in provider history
/shop refunds review <transaction-id> unpaid No credit found in provider history
```

`paid` closes the case without paying again; `unpaid` returns it to pending for an
explicit retry. Review notes retain the administrator identity and time. Access
requires `geniusshop.refunds`, granted to operators and full admins by default.
Bulk selling, Sell All, and sell wands attach a colored receipt to the success
message on hover: quantities, item types, shop, actual paid totals, and average
price per item. Repeated stacks are grouped; large receipts show the first 12
item types and an overall total that includes all sold items.

Refund cases use colored statuses with full details on hover; clicking a case
suggests its read-only inspect command. Repayments still require an explicit retry.
Back up `refunds.db` and its SQLite companion files with the other plugin data
while the server is stopped. Configuration reloads leave the recovery store open.
If a database claim or completion cannot be saved, payment is blocked or the
attempt is flagged for review; the server log records the persistence failure.
If even that state update fails, it stays locked as `REFUNDING` until the next
restart moves it to `REVIEW`. Investigate and restore database access first.

`merge-missing-defaults` controls configuration updates. Existing menu files are intentionally not populated with missing default entries. See [Configuration](wiki/Configuration.md), [Examples](wiki/Examples.md), and [Installation](wiki/Installation.md) for details.

## Building from Source

Use JDK 21 or newer, Maven, and Node.js 24 for the web tests:

```sh
node --test src/test/web/*.test.cjs
mvn clean verify
```

The current test build is `1.7.0-TB.26.10.07` and produces `target/Shop-1.7.0-TB.26.10.07-all.jar`, which bundles runtime dependencies, alongside the unshaded JAR. Install the `-all.jar` when building from source.

Default builds write artifacts to `target/` and do not require a local Minecraft server. To copy the shaded JAR to a development server, explicitly enable the `dev-server` profile and supply the destination:

```sh
mvn package -Pdev-server "-Dserver.plugins.directory=E:\MC Servers\plugins"
```

Without a destination override, the profile copies to `target/dev-server/plugins/`. The copy runs after shading and copies only the current build's `-all.jar`.

The **Build and Test** GitHub Actions workflow runs web tests and `mvn clean verify` on pushes and pull requests, and can also be started manually. Test failures fail the workflow. Successful runs provide the shaded JAR in the `Genius-Shop-shaded` artifact on the workflow run page.

## Metrics

Anonymous bStats metrics are enabled by default and can be disabled with `metrics: false` in `config.yml`. Editor telemetry is separate and opt-in.

![bStats Metrics](https://bstats.org/signatures/bukkit/Genius-Shop.svg)
