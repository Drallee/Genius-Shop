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
- Draft state, validation, and optional autosave.
- YAML/JSON import/export, item cloning across shops, and held-item JSON imports.
- Stock analytics and a data editor for persisted player counts, global counts, and reset tracking.
- Activity history and file rollback through `activity-log.json`.
- An alternate React editor at `/react.html`, alongside the classic editor.
- Authenticated administrative HTTP endpoints and opt-in editor telemetry.

Successful editor saves apply configuration reloads to the live server. File-history rollback restores recorded configuration; it does not restore economy balances or all runtime state.

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

Join as an administrator and run `/shop editor` to obtain a login link/code. Administrative API requests use authenticated sessions; the configured API key alone does not replace login. Different-IP confirmation requires `api.allow-ip-bypass` and `geniusshop.login.ip.bypass`.

Port `8080` is only the default. Choose an available TCP port allocated by your hosting provider, or configure firewall/forwarding rules for your own server. The editor uses a separate port from Minecraft. Set `api.domain` when the generated address is not reachable; this setting advertises an address and does not configure DNS or networking.

Restart after changing API enablement, port, or TLS settings. Native HTTPS supports a configured keystore; an HTTPS reverse proxy is another option. Set `api.enabled: false` when the editor/API is not needed.

See [Web Editor](wiki/Web-Editor.md) for authentication, HTTPS, network troubleshooting, and save behavior.

## Commands and Permissions

| Command | Purpose | Permission |
| --- | --- | --- |
| `/shop` | Open the main menu | `geniusshop.use` |
| `/shop sell` | Open the bulk-sell menu | `geniusshop.sell` |
| `/shop reload` | Reload configuration and custom commands | `geniusshop.reload` |
| `/shop editor` | Generate an editor login link/code | `geniusshop.admin` |
| `/shop confirmlogin <token>` | Confirm an editor login request | IP-bypass workflow described above |
| `/shop wiki` | Show the configured wiki link | `geniusshop.wiki` |
| `/shop resetstock all` | Reset global counters across shops | `geniusshop.resetstock` |
| `/shop resetstock shop <shopKey>` | Reset a shop's global counters | `geniusshop.resetstock` |
| `/shop resetstock item <shopKey> <slot>` | Reset an item by shop and zero-based slot | `geniusshop.resetstock` |
| `/shop validate-prices` | Scan price configuration without trading | `geniusshop.validateprices` |
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

Chat shows a summary and the first results. The complete report is written to
`price-validation-<id>.txt` in the plugin data directory. Routes are labelled
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
| `item-exports/` | Held-item JSON exports |
| `activity-log.json` | Editor file-change history |
| `trusted-ips.yml` | Trusted editor-login addresses |
| `debug/error.log` | Default error-log path when debug logging is enabled |

Legacy `data.yml` is migrated automatically. Back up the data directory, including `data.db` and any SQLite companion files, while the server is stopped.

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
