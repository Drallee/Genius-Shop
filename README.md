# Genius Shop v1.6.0-BETA

A modern, data-driven economy shop plugin for Bukkit/Spigot/Paper/Purpur with GUI menus, dynamic pricing, price formulas, economy safety guards, campaign scheduling, item conditions, item variants, stock limits and resets, localization, and a built-in web editor.

[View Changelog](https://modrinth.com/plugin/genius-shop/changelog)

## Features

### Flexible Shop System
- Data-driven shops: create unlimited shop files in `shops/`
- Buy and sell support with per-item buy/sell control
- Per-item price mode toggles:
  - `buy-price-per-item` — price per single item or per configured amount
  - `sell-price-per-item` — price per single item or per configured amount
- Price formula rules per item (`buy-price-formula`, `sell-price-formula`) with variables for base price, dynamic price, stock counts, limits, and more
- Permission-based access for shops and individual items
- Multi-page GUI support with slot-based item placement
- Time-restricted shops/items with readable schedule output
- Dynamic pricing with min/max bounds and price-change rules
- Player limits and global stock limits
- Stock reset automation: daily, hourly, minute interval, second interval, weekly, monthly, yearly, once
- Shop-level and item-level stock behavior controls:
  - `sell-adds-to-stock`
  - `allow-sell-stock-overflow`
- Item requirement guards for selling (name/lore checks)
- Unstable TNT support
- Full support for potions, tipped arrows, spawners, and custom enchantments

### Advanced Item Conditions
- Per-item server-side condition checks enforced on visibility, buy, sell, and bulk sell:
  - `min-player-level` / `max-player-level`
  - `required-gamemode`
  - `allowed-worlds` / `denied-worlds`

### Scheduled Campaigns
- Item-level campaign windows with configurable start/end times and timezone
- `campaign-buy-multiplier` and `campaign-sell-multiplier` applied live across GUI display, purchase, sell, and bulk sell flows
- Campaign keys: `campaign-enabled`, `campaign-name`, `campaign-start`, `campaign-end`, `campaign-timezone`

### Item Variants
- Stable variant identity via `item-key` and `variant-key`
- Variant entries inherit base item settings; variant values override inherited ones
- Variants are materialized as separate runtime `ShopItem` entries with unique keys to avoid stock/limit/dynamic-pricing collisions
- Optional grouped variant selector menu (`variant-menu: true`) — one slot opens a variant selection inventory

### Economy Safety
- Max transaction value guard (`economy-safety.max-transaction-value`)
- Anti-spike pricing rules (`economy-safety.anti-spike.*`) for base-multiplier and step-change protection
- Per-action cooldowns (`economy-safety.cooldowns.*`) for buy, sell, and bulk sell
- Optional large-purchase double-confirm flow (`economy-safety.large-purchase-confirmation.*`)
- Strict pre-transaction checks (NaN, Infinity, negative, overflow values)
- Server-side price floor/ceiling enforcement against configured min/max bounds
- Explicit fail-safe handling for withdraw/deposit failures with player-facing error messaging
- Audit logging for guard/economy failures (reason, shop, item, player, total)
- Optional in-game admin alerts for failures (`economy-safety.admin-alerts.*`) with configurable permission and rate-limiting

### Modern GUI and Formatting
- Main menu + shop + purchase + sell + bulk sell interfaces
- Rich formatting with legacy colors, HEX, and gradients
- Multi-stop gradient support (`<gradient:#A:#B:#C>...</gradient>`)
- Proper legacy style compatibility inside gradients (e.g. `&l`)
- Configurable lore-format pipeline in `menus/gui-settings.yml`
- Lore placeholders:
  - `%global-limit%`
  - `%player-limit%`
  - `%stock-reset-timer%`
- Per-item display toggles:
  - `show-stock`
  - `show-stock-reset-timer`
- Live GUI updates while open for stock/price/lore changes

### Web Editor
- Real-time visual editing and live Minecraft-style item preview (updates as fields are edited)
- Preview parity mode (`PARITY: ON/OFF`) — expands GUI lore tokens for accurate in-game comparison
- Main menu editor + shop/item editor + GUI settings editor
- Section toggles for lore, enchantments, commands, limits, and available-times
- `run-as` dropdown for command execution context (player/console)
- **Export tools**:
  - `Export Item` in the item modal (JSON)
  - `Export` in the Shop tab for the current shop (YAML/JSON) or entire project (JSON)
  - Menu import/export (JSON and YAML) for Main Menu, Purchase, and Sell menus
  - File import format auto-detected from file name/content
- **Clone actions**: `Clone to Shop` (single target) and `Clone to Multiple` (multi-select) with searchable floating pickers
- **Import Items**: supports JSON and YAML file uploads with auto ID assignment
- **Stock Analytics** dashboard (`STOCK` tab): summary cards, shop filter, per-item stock table
- **Data editor** (`DATA` tab): direct SQLite management for player counts, global counts, and stock resets with row-level add/save/delete/refresh
- **Economy Safety** panel: presets (`STRICT`, `BALANCED`, `OFF`) and full config save via dedicated API endpoint
- **Server-side audit + rollback**: all file actions logged to `activity-log.json` with one-click rollback
- Secure login flow with in-game confirmation for new IPs
- Built-in REST API for remote management

### Economy, Integrations, and Runtime
- Vault economy integration
- Optional SmartSpawner integration
- Optional Floodgate/Bedrock compatibility improvements
- Discord webhook transaction notifications
- SQLite runtime storage (`data.db`) with legacy `data.yml` migration
- Debug error file logging (`plugins/Genius-Shop/debug/error.log`) for support diagnostics
- Update checks and in-game update notifications with configurable sound
- Permission-aware `/shop` tab completion
- Commands:
  - `/shop`
  - `/shop reload`
  - `/shop editor`
  - `/shop confirmlogin <token>`
  - `/shop wiki`
  - `/shop resetstock all|shop|item`
  - `/shop validate-prices` — dry-run scanner for risky/invalid price configs
  - `/shop exportitem` — export held item to a web-editor JSON file

### Developer API
- Public API for opening menus and querying shop data
- Custom events for shop open, buy, sell, and transactions

## Requirements

- Minecraft: 1.21+ (Bukkit, Spigot, Paper, Purpur)
- Java: 21+
- Vault: required
- Economy plugin: any Vault-compatible economy provider (e.g. EssentialsX)

## Dependencies

### Required
- Vault
  - Spigot: https://www.spigotmc.org/resources/vault.34315/
- Economy plugin (Vault-compatible, choose one)
  - EssentialsX (Spigot): https://www.spigotmc.org/resources/essentialsx.9089/
  - EssentialsX (Modrinth): https://modrinth.com/plugin/essentialsx

### Optional
- SmartSpawner (for advanced spawner item integration)
  - Modrinth: https://modrinth.com/plugin/smartspawner
- Floodgate (for Bedrock support improvements)
  - Modrinth: https://modrinth.com/plugin/floodgate

## Quick Start

1. Install Vault and an economy plugin
2. Drop `Shop-x.x.x.jar` into your plugins folder
3. Start the server
4. Configure shops in `plugins/Genius-Shop/shops/`
5. Configure menus in `plugins/Genius-Shop/menus/`
6. (Optional) enable web editor API in `config.yml`
7. Run `/shop reload`
8. Use `/shop` in game

## Configuration

- Shop files: `plugins/Genius-Shop/shops/*.yml`
- Menu files: `plugins/Genius-Shop/menus/*.yml`
- Languages: `plugins/Genius-Shop/languages/*.yml`
- Web editor/API settings: `config.yml`

For detailed schema and examples, see:
- `wiki/Configuration.md`
- `wiki/Examples.md`

## Permissions

- `geniusshop.use` — open and use shops
- `geniusshop.sell` — use bulk sell
- `geniusshop.reload` — reload plugin config
- `geniusshop.resetstock` — run stock reset commands
- `geniusshop.wiki` — access `/shop wiki`
- `geniusshop.validateprices` — use `/shop validate-prices` dry-run scanner
- `geniusshop.exportitem` — use `/shop exportitem` to export held item
- `geniusshop.admin` — full admin access
- `geniusshop.login.ip.bypass` — approve web-editor IP bypass flow

## Data Storage

- Runtime counters and state: `plugins/GeniusShop/data.db` (SQLite)
- Legacy migration: `data.yml` migrates automatically on startup
- Debug error log: `plugins/Genius-Shop/debug/error.log` (when enabled)

## BStats

![BStats Metrics](https://bstats.org/signatures/bukkit/Genius-Shop.svg)