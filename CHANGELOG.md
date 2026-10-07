### Genius Shop v1.7.0 - Custom Items, Sell Wands & SmartSpawner Loot

#### Custom Items & Sell Wands
* Added `custom-items.yml` for configurable right-click actions: sell container contents, open menus, or run player/console commands.
* Added `/shop giveitem` for issuing custom items, with persistent item identity, permissions, cooldowns, and optional limited uses.
* Successful actions can consume a use and remove the item when its uses run out; failed actions do not consume a use.
* Sell wands support per-item multipliers, such as `1.0` or `1.5`, with configurable campaign participation through `use-campaigns`.
* Container sales honor shop eligibility, item metadata, pricing, limits, stock, and transaction safety; failed payments restore removed items.
* Added custom-item configuration controls to the classic and React web editors, plus configuration examples and documentation.

#### SmartSpawner Loot Selling
* Sell-container wands can sell eligible loot stored inside compatible SmartSpawner blocks, without selling experience or the spawner itself.
* Native menu access, protection checks, the `smartspawner.sellall` permission, and cancellable native sale events remain enforced.
* Added SmartSpawner 1.5.8 compatibility for legacy sale locks and list-based virtual storage, alongside support for newer storage methods.
* Avoided resolving unrelated optional ShopGUI+ integration classes; ShopGUI+ is not required for wand sales.
* Added a legacy native-sale guard to reject stale queued sales before payment, plus regression tests for compatibility, cancellation, locks, and rollback.

---

### 🚀 Genius Shop v1.6.0 - Economy Safety, Advanced Pricing & Web Editor Overhaul

This release is a major feature expansion focused on economy safety, advanced pricing mechanics, campaign scheduling, item conditions, and a significantly upgraded web editor.

#### 💰 Pricing & Economy
* **Per-item price mode toggles**:
    * `buy-price-per-item` — toggle whether buy price is per single item or per configured amount.
    * `sell-price-per-item` — toggle whether sell price is per single item or per configured amount.
    * Both default to `true`. With either set to `false`, the corresponding total is `price * (selected amount / configured amount)`.
* **Price formula rules**:
    * New per-item keys: `buy-price-formula` and `sell-price-formula`.
    * Safe server-side formula evaluator supporting `+`, `-`, `*`, `/`, parentheses, unary operators, and functions: `min`, `max`, `abs`, `round`, `floor`, `ceil`, `pow`.
    * Formula variables: `base`, `price`, `dynamic` / `dynamic_price`, `global_count` / `count`, `amount`, `price_change`, `min_price`, `max_price`, `limit`, `global_limit`.
    * Formula-based pricing is applied across shop GUI display, purchase, sell, bulk sell, best-sell matching, and public API lookups.
* **Economy safety guards**:
    * Max transaction value guard (`economy-safety.max-transaction-value`).
    * Optional unit-price cap (`economy-safety.max-unit-price`).
    * Anti-spike pricing rules (`economy-safety.anti-spike.*`) — base-multiplier and step-change protection.
    * Per-action cooldowns (`economy-safety.cooldowns.*`) for buy, sell, and bulk sell.
    * Optional large-purchase double-confirm flow (`economy-safety.large-purchase-confirmation.*`).
    * Strict invalid-value checks before transactions (NaN, Infinity, negative, hard-cap values).
    * Server-side unit floor/ceiling enforcement against configured min/max bounds.
    * Explicit fail-safe handling for withdraw/deposit failures with player-facing error messaging.
    * Inventory capacity is checked before charging; purchases no longer drop overflow items on the ground. Delivery failures after withdrawal trigger a refund attempt.
    * Anti-spike multipliers now compare against the configured base price, before dynamic pricing, formulas, or campaigns. Rejection messages include clearer reasons and diagnostic values.
    * Audit logging for guard/economy failures including reason, shop key, item, player, and total.
    * Optional in-game admin alerts for guard/economy failures with configurable permission and rate-limiting (`economy-safety.admin-alerts.*`).
* **New dry-run validation command**:
    * `/shop validate-prices` — scans all loaded shop items and reports risky or invalid price configurations without modifying any data.

#### 🗓️ Scheduled Campaigns
* Reusable campaign definitions can be stored globally in `campaigns.yml` or locally in a shop's `campaigns` list, then assigned to shops or items with `campaign: <key>`.
* New item-level campaign window keys: `campaign-enabled`, `campaign-name`, `campaign-start`, `campaign-end`, `campaign-timezone`, `campaign-buy-multiplier`, `campaign-sell-multiplier`.
* Campaign multipliers are applied live to buy/sell prices across the shop GUI, purchase flow, sell flow, bulk sell flow, and best-sell item matching.
* Web editor campaign management includes template editing and bulk assignment/removal for selected shops and items.

#### 🔒 Advanced Item Conditions
* New server-side condition checks: `min-player-level`, `max-player-level`, `required-gamemode`, `allowed-worlds`, `denied-worlds`.
* Conditions are enforced during shop item visibility/opening, buy flow, sell flow, and bulk sell matching.

#### 🏷️ Item Variants
* New stable variant identity keys: `variant-key` and `item-key`.
* Variant entries inherit base item settings; variant-level values override inherited values. Variants are materialized as separate runtime `ShopItem` entries with unique keys to avoid stock/limit/dynamic-pricing collisions.
* Optional grouped variant selector menu — set `variant-menu: true` on a base item to show one slot that opens a variant selection inventory.

#### 🖥️ Web Editor Improvements
* Redesigned the editor around the Minecraft inventory preview, with responsive layouts, collapsible sidebar navigation, animated transitions, and a compact icon rail.
* Replaced fragile shop/menu/command YAML parsing with structured, comment-preserving editing. Saves validate YAML and preserve unknown fields and unchanged references.
* Added draft state, schema normalization/validation, centralized save dispatch, autosave handling, and opt-in editor telemetry.
* Added an alternate React editor at `/react.html` alongside the classic editor.
* Resolved language references are now displayed in names, titles, lore, and message fields.
* **Export tools**:
    * `Export Item` action in the item modal (JSON).
    * `Export` action in the Shop tab for the current shop (YAML/JSON) or entire project (JSON).
    * Menu import/export support (JSON and YAML) for Main Menu, Purchase Menu, and Sell Menu.
    * File import format is now auto-detected (JSON vs YAML) from file name/content, with manual selection as fallback.
* **Clone actions**:
    * `Clone to Shop` — copies an item to another shop file with auto slot assignment using a floating single-select picker.
    * `Clone to Multiple` — bulk clone to multiple shops using a floating multi-select picker.
* **Import Items**:
    * Supports JSON and YAML file uploads.
    * Appends imported items with auto ID assignment and optional keep-provided-slot behavior.
* **Live item preview**:
    * Side preview box next to the item edit modal — updates live as fields are edited (material, name, amount, prices, lore).
    * Preview includes enchantments, commands, limits, dynamic pricing summary, permission/flags/stock reset indicators.
    * Persistent preview visibility toggle in the modal form area.
* **Shop preview parity mode** (`PARITY: ON/OFF`) toggle — switches between a simplified tooltip preview and a lore-format parity preview that expands GUI lore tokens (`%price-line%`, `%custom-lore%`, `%global-limit%`, `%player-limit%`, `%stock-reset-timer%`, hints, and spawner/potion lines). Parity toggle buttons added to Main Menu, Purchase, and Sell tabs.
* **Economy safety controls** panel in GUI Settings — includes presets (`STRICT`, `BALANCED`, `OFF`) and save integration via a dedicated API endpoint (`/api/economy-safety`).
* **YAML parse/export support** added for all new fields: pricing mode, formula, campaign, condition, item/variant keys.
* **Item modal** fields added for Buy/Sell Price Mode, Buy/Sell Price Formula, campaign fields, condition fields, `item-key`, and `variant-key`.
* Grouped modal checkboxes into titled sections for clearer organization.
* Shop item list badges for `item-key` and `variant-key`.
* Fixed unclickable footer buttons, duplicate search borders, stock text overflow, favicon references, invalid meta tags, missing image descriptions, and conflicting CSS overrides.

#### 📊 Stock Analytics Dashboard
* New `STOCK` tab in the web editor with a live dashboard.
* Global summary cards: tracked items, out-of-stock, low-stock, fill percentage.
* Shop filter dropdown and item stock table for stock-limited items with current/limit/remaining/status columns.
* Backed by a new API endpoint: `GET /api/stock-analytics`.

#### 🗃️ data.db Web Editor
* New `DATA` tab for direct SQLite data management.
* Grouped sections: `Player Counts` (per-player limits), `Global Counts` (shared stock counters), `Stock Resets` (last-run tracking).
* Row-level actions: `ADD ROW`, `SAVE`, `DELETE`, `REFRESH`.
* Readable timestamp display for stock reset `last_run` values.
* New API endpoints: `GET /api/database`, `POST /api/database`, `DELETE /api/database`.

#### 🕵️ Debug & Audit
* **Debug error file logging**:
    * Error/exception-only file logger integrated with debug mode.
    * Config keys: `debug-error-log.enabled`, `debug-error-log.file`.
    * Default output: `plugins/Genius-Shop/debug/error.log`.
    * Captures `ConsoleLog.error(...)`, `ConsoleLog.apiError(...)`, and plugin `SEVERE` logger events including thrown exceptions.
* **Server-side audit + rollback**:
    * Web editor file actions (create, update, delete, rollback) are audited in `activity-log.json`.
    * Server-side rollback via `POST /api/activity-log/rollback`.
    * Activity log clear via `POST /api/activity-log/clear`.
    * Web editor history modal reads from server audit data and performs server-side rollback.
* Added missing configuration-path diagnostics, with console notices and debug logging.
* Added compiled shop catalogs and structured validation warnings/errors, including invalid availability rules and duplicate/invalid slots; corrected validation of slots on later pages.

#### 🛒 Bulk Selling, Stock & Persistence
* Added the Bulk Sell GUI and `menus/bulk-sell-menu.yml` for selling multiple deposited items through `/shop sell`.
* Best-sell matching checks accessible shops, item metadata, availability, conditions, pricing formulas, and campaigns.
* Added dedicated stock reset rules/services for daily, hourly, minute/second intervals, weekly, monthly, yearly, and one-time schedules, with persisted last-run tracking.
* Cached player/global counters and stock reset timestamps, with batched SQLite writes and periodic flushing to reduce repeated database work.
* Improved shop refresh handling and variant stock identity so stock, limits, and dynamic prices remain consistent across menus.
* Shop navigation buttons now support configurable materials.

#### ⌨️ Custom Commands & Permissions
* Added `commands.yml` and a web editor Commands tab for configurable command names, aliases, descriptions, usage, permissions, and denial messages.
* Supported actions: `OPEN_SHOP`, `OPEN_ITEM` (buy, sell, or both), and `SELL_ALL` across all accessible shops or a selected shop. Example commands are disabled by default.
* Added command validation and dynamic registration/reloading; duplicate names and aliases are reported. Fixed custom names reverting to `shop` during saving and tightened alias validation.
* Added `/shop exportitem [file-name]` to export the held item as editor-importable JSON under `item-exports/`, preserving serialized `item-stack` data.
* Added `geniusshop.validateprices` and `geniusshop.exportitem`, explicit base/reload permissions, protected default-shop permissions and legacy aliases, and child permissions for `geniusshop.admin`.
* Corrected permission routing so `/shop` subcommands enforce their own access checks; added permission-aware completion for the new commands.

#### 🔐 HTTPS & Editor Login
* Added native HTTPS through `api.ssl.*`, with configurable keystore path, type, keystore password, and key password. Editor URLs support explicit schemes and custom domains.
* Login and editor screens now display `/shop confirmlogin <token>` with copy/retry controls for pending IP confirmation, including the React editor.
* Added `geniusshop.login.ip.bypass` for confirming logins from another IP. Confirmed trusted IPs can retain valid sessions for eligible users.
* Web-triggered plugin and custom-command reloads now run on the server thread; redundant command refreshes are coalesced.
* Guarded nullable player addresses during login/session checks.

#### 🧩 Integrations & Public API
* Added optional Floodgate detection and shortened inventory titles for Bedrock players.
* Added `GeniusShopAPI` / `GeniusShopAPIProvider` for opening menus, enumerating shops, querying item prices, and finding the best accessible buy/sell offers.
* Added shop-open and purchase/sell transaction events for plugin integrations.
* SmartSpawner delivery now uses its creation API, with support for `SmartSpawner` and `SmartSpawners` plugin names. Exported `item-stack` data takes priority when present.
* Added serialized `item-stack` support for exact item delivery and sell matching, and expanded editor controls for player-head owners/textures.
* Improved shared logging, metrics wrapping, and Discord webhook error diagnostics.

#### 🌍 Localization & Configuration Fixes
* Added/expanded bundled language files and localized menu titles, buttons, messages, custom-command feedback, and diagnostic output.
* Missing language defaults are merged even when an existing language file already has the current version.
* Fixed placeholder replacement before lore coloring and default merging for nested configuration sections.
* Quoted language `on` keys to avoid YAML boolean interpretation, while retaining compatibility with legacy `messages.true` values.

#### 📚 Examples, Documentation & Build
* Updated `weekend_market.yml` with a reusable Weekend Boost campaign (`0.85` buy and `1.10` sell multipliers), four-apple bundle pricing, and dynamic/formula-priced Ancient Debris. Campaign dates are examples and must be adjusted for a live promotion.
* Added `variants_demo.yml` and expanded potion, special-item, miscellaneous, and spawner examples, including item export/import guidance.
* Updated the README, shop configuration guide, and wiki documentation for commands, pricing, campaigns, conditions, editor workflows, integrations, and the public API. Hosting guidance covers alternate API ports, conflicts, firewalls, HTTPS, and provider allocations.
* Maven now produces a shaded `Shop-1.6.0-all.jar` alongside the regular JAR; the server-copy build step uses the shaded artifact.
* Added JUnit/Mockito and Surefire support. Earlier test files and temporary development notes/worktrees were cleaned up; the current tree retains custom-command repository tests.
* Pinned compile/test dependencies to Log4j API `2.25.5`, Commons Lang `3.18.0`, and Plexus Utils `3.6.1`. Server-provided runtime dependencies remain supplied by the server.
* Added an MIT license, updated copyright information, and expanded Git ignore rules for generated/development files.

#### 🔄 Changes
* Buy and sell total calculations now respect each item's configured pricing mode.
* Bulk sell total calculation now respects the sell pricing mode.
* Shop item lore price lines now show totals for the configured item amount (for both per-item and per-configured-amount modes).
* Buy/Sell menu lore now resolves stock placeholders in item/custom lore: `%global-limit%`, `%player-limit%`, `%limit%`, `%stock-reset-timer%`.
* Transaction guard pricing checks treat formula-driven item pricing as dynamic guard input where applicable.
* Fixed menu inventory holders returning null and validated enchantment metadata before applying it; guarded SmartSpawner plugin lookup and removed redundant/unused runtime and editor code.

---
**Compatible with Minecraft 1.21+ and Java 21.**

### 🚀 Genius Shop v1.5.0 - Web Editor, Stock System & Localization Update

This release focuses on usability, flexibility, and live economy behavior with major upgrades to stock handling, placeholders, gradients, and editor workflows.

#### 🌍 Localization & Formatting
* **Multi-language system**: Added `languages/` files and configurable `language` selection.
* **Gradient upgrades**:
    * Full support for multi-stop gradients (e.g. `<gradient:#ff0000:#ff3033:#ff6666>...</gradient>`).
    * Better compatibility with legacy styles like `&l` (bold) inside gradients.

#### 📈 Stock, Limits & Economy Improvements
* **Advanced stock reset automation**:
    * Added/reset support for `DAILY`, `HOURLY`, `MINUTE_INTERVAL`, `SECOND_INTERVAL`, `WEEKLY`, `MONTHLY`, `YEARLY`, `ONCE`.
    * Improved lifecycle reliability for automatic resets.
* **New stock/limit placeholders**:
    * `%stock-reset-timer%`
    * `%global-limit%`
    * `%player-limit%`
* **Per-item display toggles**:
    * `show-stock`
    * `show-stock-reset-timer`
* **Sell-to-stock controls**:
    * Shop-level and item-level toggles for whether selling replenishes stock.
    * Overflow behavior toggles (`allow-sell-stock-overflow`).

#### 🧩 Web Editor: Major UX Improvements
* **`run-as` dropdown support** (console/player) for command sections (main menu + item commands).
* **Grouped modal toggles** for lore, enchantments, commands, limits, and available-times sections.
* **Commands section toggle behavior** now properly controls textarea visibility and persistence.

#### 🛠️ Gameplay & Runtime Improvements
* **Permission-aware `/shop` tab completion**:
    * Suggestions now respect player permissions.
    * Added completion help for `resetstock` arguments.
* **Live GUI refresh**:
    * Open shop pages now update stock/price/lore in real time.
* **Main menu placeholder**:
    * `%latest-update-highlights%` new placeholder to show a little snippet of new features for new updates.
* **Command execution context**:
    * Item commands can run as player or console via `run-as`.

#### 📚 Documentation & Examples
* Updated wiki pages, and shop examples to reflect new config keys and workflows.
* Default shop examples now showcase gradients, stock reset rules, stock/lore toggles, and `run-as` command usage.

---
**Compatible with Minecraft 1.21+ and Java 21.**

### 🚀 Genius Shop v1.4.0 - The Advanced Economy & Shop availability Update

This version transforms the Web Editor into a powerful tool and introduces deep economy controls, advanced time-based shop availability, and item properties.

#### 🎨 Web Editor: Overhaul
*   **Undo & Rollback System**: A complete session history log. Revert any change (Created, Updated, or Deleted) with a single click.
*   **Dynamic UI Feedback**:
    *   **Renamed Workflow**: Buttons renamed to **HISTORY**, **RELOAD**, **SAVE TAB**, and **PUBLISH ALL** for logical clarity.
    *   **Save Summaries**: A new confirmation modal shows exactly which items are being saved and which are deferred.
*   **Visual Enhancements**:
    *   **Preview**: Increased Minecraft GUI preview size for better readability.
    *   **Status Badges**: Item cards now feature badges for Enchantments, Lore, Dynamic pricing, Limits, and Permissions.
    *   **Lore Preview**: Live multi-line lore rendering with color support directly on item cards.
    *   **Search Engine**: New search bar to instantly find items by name or material.

#### 💎 Advanced Economy & Shop Features
*   **Advanced Shop Availability**: Restrict shop access to specific times, days of the week, or date ranges (e.g., `Monday-Friday`, `08:00-22:00`, `2024-12-01 to 2024-12-31`).
*   **Unstable TNT**: Support for primed-on-break TNT items.

*   **Dynamic Pricing**: Implemented supply-and-demand logic. Item prices can now automatically shift as players buy and sell.
*   **Transaction Limits**: Set per-player trading limits on any shop item to prevent market inflation.
*   **Metadata Mastery**: New item flags to enforce exact Name/Lore matches for selling.
*   **Special Item Support**:
    *   **Potion Levels**: Full support for custom potion amplifier levels (1-255).


#### 🛡️ Security & Technical Improvements
*   **Auto-Migration**: Configuration files now automatically update to include new keys from latest versions without touching your data.
*   **Robust Backend**: Optimized YAML parsing for complex multi-line lore and nested properties.

#### 🛠️ Commands & Permissions
*   `NEW` `/shop confirmlogin <token>` - Security confirmation for remote editor access.
*   `NEW` `geniusshop.login.ip.bypass` - Permission to use the editor from untrusted IPs.


---
**Compatible with Minecraft 1.20.5+ and Java 21.**

### 🚀 Genius Shop v1.3.0
### 🌐 Web-Based Configuration Editor
- Added built-in HTTP server with RESTful API for remote configuration management
- Implemented live GUI preview with real-time Minecraft texture rendering
- Added point-and-click interface for rearranging main menu items
- Integrated visual shop builder for creating and editing shops without YAML knowledge
- Added secure UUID-based authentication system
- Implemented auto-save functionality that syncs changes directly to server files


*Info:* _This is still a work in progress and errors may occur, please take backups before making changes with the web editor_

### 📢 Discord Integration
- Added Discord webhook support for transaction notifications
    - Implemented purchase event notifications to Discord channels
    - Implemented sell event notifications to Discord channels
- Added configurable webhook settings in `discord.yml`

### 📁 Modular Configuration System
- Shops: Migrated from single `shops.yml` to individual shop files in `shops/` folder
- Menus: Migrated from `gui.yml` to individual menu files in `menus/` folder
- Added automatic migration from legacy configuration formats
- Improved organization and maintainability of shop configurations
- Added `shops/README.md` with comprehensive configuration guide

### 🎮 Enhanced Item Support
- Added full support for potions
- Added support for tipped arrows with potion effects
- Added support for trial spawners
- Implemented enchantment support for all items

### 🚀 Genius Shop v1.2.0
---

**✨ New Features**

**🎛️ 1. Configurable Display Item Position**
- Purchase/Sell menu display item can now be placed in **any slot (0–53)**.
- New config option:
  ```yaml
  display-slot: 22
  ```
- Supported in both purchase and sell menus.

---

**🧮 2. Dynamic Add/Remove/Set Buttons**
- Amount buttons are now fully dynamic.
- Add any number (1, 4, 8, 10, 32, 64, 100…) and the menu handles it automatically.

**Example:**
```yaml
add:
  4:
    name: '&aAdd 4'
    slot: 33
```

---

**📏 3. Buy/Sell Amount Limits**
- Prevent infinite/overflow purchases with:
  ```yaml
  max-amount: 2304
  ```
- Defaults to **36 stacks**.
- Applies to all add/set buttons and respects owned items when selling.

---

**🔙 4. Back Buttons Now Return to the Shop**
- Back/Cancel buttons now return to the **previous shop + page**, not the main menu.
- Added new placeholders:
    - `%shop%`
    - `%page%`

- All button lore is now fully configurable.

---

**⏰ 5. Time-Restricted Shops**  
Create shops that only open during certain:
- Hours
- Days
- Weekends
- Date ranges
- Or any combination of these

**Supported Formats**
- `"13:00-17:00"`
- `"1:00PM-5:00PM"`
- `"FRIDAY-SUNDAY"`
- `"2024-10-01 to 2024-10-31"`

**New Messages**
- `shop-not-available`
- `shop-always-available`

**New Placeholder**
- `%available-times%`

**New Config**
- `date-format` (custom date formatting)

---

**🧱 7. Main Menu Uses Rows Instead of Size**  
More intuitive config:
```yaml
rows: 3
```
Still compatible with old `size`.

---

**🎨 8. Hide Attributes/Additional Flags for Main Menu**  
Main menu items now support:
- `hide-attributes`
- `hide-additional`

Prevents vanilla tooltips like “When in main hand”.

---

**🐛 9. Full Debug Logging System**  
When `debug: true`, plugin now logs:
- Shop opening attempts
- Permission checks
- Time restriction checks
- Purchase/sell details (player, item, amount, total price)
- Success/failure reasons

---

**📝 Example Configurations**

**Weekend Market Shop**
```yaml
weekend_market:
  gui-name: '&d&lWeekend Market'
  rows: 4
  available-times:
    - "FRIDAY-SUNDAY"
    - "10:00AM-10:00PM"
  items:
    - material: DIAMOND_BLOCK
      name: '&bDiamond Block'
      price: 4500
      sell-price: 2250
      amount: 1
      lore:
        - '&7Weekend special pricing!'
```

**Main Menu Button**
```yaml
weekend_market:
  slot: 22
  material: NETHER_STAR
  name: '&d&lWeekend Market'
  lore:
    - ''
    - '&7Special items at discounted prices!'
    - '&7Available: &e%available-times%'
    - ''
  shop-key: weekend_market
  hide-attributes: true
```

**Purchase Menu Customization**
```yaml
gui:
  purchase:
    display-slot: 22
    max-amount: 2304
    back:
      name: '&9Back'
      lore:
        - ''
        - '&7Return to %shop%'
        - '&7Page %page%'
    add:
      1:
        name: '&aAdd 1'
        slot: 24
      10:
        name: '&aAdd 10'
        slot: 25
      32:
        name: '&aAdd 32'
        slot: 33
```


### 🚀 Genius Shop v1.1.0
**✨ New Features**
- 🔄 **Automatic update checking**
    - The plugin now checks for updates on startup.
    - Sends update notifications to players with the `geniusshop.admin` permission.
    - The console also receives update alerts.

- 💰 **Enhanced economy customization**
    - Added new `eco` configuration options:
        - `override-currency-symbol` — Overrides the currency symbol provided by Vault economy plugins.
        - `fallback-currency-symbol` — Used as a backup if economy formatting fails (default: `$`).

- 🎛️ **Fully customizable buy & sell menu buttons**
    - Buttons inside the buy and sell menus (confirm, cancel, add/remove amount, set amount) can now:
        - Be moved to **any slot**
        - Use **any material** you choose
    - Allows complete layout customization for purchase and selling menus.

**🔧 Changes**
- 🗂️ Improved config structure in `config.yml` and `gui.yml`.
- 🛒 Buy and sell menus no longer close after confirming purchases or using "sell all".
- 🚫 Players can no longer open the sell menu for items they do not have.

**🐞 Bug Fixes**
- 📊 Fixed an issue where metrics were not sending correct data.
- 🧱 Fixed a bug where placing a spawner in survival mode resulted in an empty, untyped spawner.
