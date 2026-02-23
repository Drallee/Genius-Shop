# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-02-24

### Added
- **Multi-language Support (Localization)**
  - Added a new `languages/` folder for translation files.
  - New `language` setting in `config.yml` to switch between locales (default: `en_US`).
  - Web editor now dynamically loads and displays translations.
- **Custom Enchantments Support**
  - Items in shops can now include custom enchantments using namespace keys.
  - Fully integrated into the purchase and rendering pipeline.
- **Slot-based GUI Positioning**
  - Precise item placement in shop GUIs using the `slot` property.
  - Drag-and-drop support in the web editor for visual layout management.
- **Enhanced Time Restrictions**
  - Improved display of available times in item lores.
  - New formatting options for dates, times, and day separators in `config.yml`.
- **SmartSpawner Integration**
  - Added `smart-spawner-support` toggle to use SmartSpawner's command API for delivering spawners.
- **Developer API**
  - New `GeniusShopAPI` interface for opening menus and accessing shop data.
  - Custom Bukkit events for deep integration: `ShopOpenEvent`, `ShopPurchaseEvent`, `ShopSellEvent`, and `ShopTransactionEvent`.
  - Added comprehensive [Developer API Guide](wiki/Developer-API.md).
- **Bulk Sell System**
  - Added a new Bulk Sell GUI to sell multiple items at once.
  - Customizable bulk sell menu configuration in `menus/bulk-sell-menu.yml`.
- **Bedrock Edition Support**
  - Integrated with Floodgate API to improve GUI compatibility for Bedrock players.
  - Optimized GUI titles for Bedrock clients.
- **Improved Shop Sorting**
  - New internal logic for more flexible shop item sorting.
- **Player Head Texture Editing in Web Editor**
  - Added `PLAYER_HEAD` texture controls in the item modal (texture type, texture value, and optional owner).
  - Added YAML support in the editor for `head-texture` and `head-owner` fields.
  - Added preview rendering for custom head textures in item lists and GUI slot previews.
- **In-game Update Notice Styling and Sound**
  - Reworked admin update notification into a styled multi-line message with clickable download link.
  - Added configurable update sound settings in `config.yml`:
    - `update-message-sound.enabled`
    - `update-message-sound.type`
    - `update-message-sound.volume`
    - `update-message-sound.pitch`
- **Wiki Access Improvements**
  - Added `/shop wiki` command with permission support (`geniusshop.wiki`).
  - Added configurable wiki URL in `config.yml` (`wiki.url`).
  - Added direct wiki shortcut link in the web editor footer.
  - Added dedicated `WIKI` tab in the web editor with focused usage documentation for the web editor.
- **SQLite Runtime Data Storage**
  - Migrated runtime counters from `data.yml` to SQLite (`data.db`).
  - Automatic migration from legacy `data.yml` on startup.
  - Added graceful database close handling on plugin disable.
- **Documentation Refresh**
  - Updated root docs and wiki pages with command usage, permissions, stock reset guidance, and data storage details.
- **Platform Compatibility Target**
  - Runtime code is Bukkit-safe and intended to work on Bukkit/Spigot/Paper/Purpur.
  - Build target uses `paper-api` for dependency resolution reliability.
- **Permission-aware `/shop` Tab Completion**
  - Added tab completion for `/shop` subcommands.
  - Suggestions are now filtered by the player's actual permissions.
  - Added completion hints for `resetstock` arguments.
- **Command Executor Selection (`run-as`)**
  - Added `run-as` support for item commands and main-menu command entries.
  - Web editor now exposes `run-as` as a dropdown for command configuration.
- **Shop Lore Placeholder Extensions**
  - Added `%stock-reset-timer%`, `%global-limit%`, and `%player-limit%` support in shop item lore formatting.
  - Added GUI settings templates:
    - `global-limit-line`
    - `player-limit-line`
    - `stock-reset-timer-line`
    - `global-limit-value-format`
    - `player-limit-value-format`
    - `stock-reset-timer-value-format`
- **Per-item Display Toggles**
  - Added `show-stock` and `show-stock-reset-timer` item toggles.
  - Web editor includes controls for these toggles in the item modal.
- **Localized Stock Reset Countdown Units**
  - Stock reset countdown unit labels are now driven by language file keys for easier localization.

### Changed
- **Updated Minimum Requirement**
  - Raised minimum Minecraft version to 1.21.
  - Updated API target to 1.21.1.
- **Message Styling Pipeline**
  - Extended shared message formatting to support gradient tags (`<gradient:#RRGGBB:#RRGGBB>...</gradient>`).
  - Routed hardcoded `/shop editor` and `/shop confirmlogin` chat output through the shared color formatter for consistent styling.
  - Updated key editor/login/security headers to use gradient-styled text in-game.
- **Refactored GUI Rendering**
  - Moved to a modular rendering system for better performance and consistency across different menu types.
- **Web Editor UI/UX Improvements**
  - Added sticky tabs and panel titles for better navigation in large configurations.
  - Externalized inline CSS and JS for better caching and maintainability.
  - Improved Lore parsing to support multi-line indents and colors more reliably.
- **Configuration Versioning**
  - Bumped `config-version` to 9 to include wiki URL settings and current runtime behavior docs.
- **Gradient + Legacy Style Compatibility**
  - Improved formatting pipeline so legacy style codes (including `&l`) are preserved when gradient formatting is applied.
- **Live Shop View Refresh**
  - Open shop inventories now refresh dynamically so stock/price/lore changes are reflected while players keep the GUI open.
  - Dynamic buy/sell values in shop GUI now reflect current global pricing counters in real time.
- **Web Editor Modal Organization**
  - Grouped modal sections with explicit enable/disable toggles for lore, enchantments, commands, limits, and available times.
  - Commands section now uses a toggle-driven workflow (including textarea visibility and persistence behavior).
- **Web Editor Language/Preview Handling**
  - Improved language switching behavior to avoid overriding config-backed preview title fields.
  - Added immediate preview/tab refresh behavior to prevent stale "loading" states.
### Removed
- **Removed Support for 1.20.5 and Below**
  - Removed legacy NBT handling code in favor of modern Data Components.
- **Removed Legacy Files**
  - `messages.yml` has been deprecated and removed in favor of the new localization system.

### Fixed
- Fixed web editor main menu lore parsing bugs related to indentation.
- Fixed various minor issues in the REST API server.
- Fixed time restriction validation logic in `TimeRestrictionUtil`.
- Fixed legacy mojibake color artifacts (`Â§` / `Ã‚Â§`) by normalizing broken section-sign encodings before color processing.
- Fixed remaining direct hardcoded shop-empty message coloring by routing it through the shared formatter.
- **Web Editor API First-start File Load**
  - Fixed an issue where `/api/files` could fail on first server start until restart.
  - API now ensures default editor files exist before loading and reads files safely without failing the full response.
- **Stock Reset Service Lifecycle**
  - Fixed automatic stock resets not running reliably by ensuring reset scheduling starts/stops with plugin lifecycle.
  - Reduced reset scheduler floor to support second-level interval configurations.
- **Stock Reset Month Parsing**
  - Fixed `stock-reset.month` parsing to accept both month names and numeric values (`1-12`) in editor/API flows.
- **Web Editor Icon Rendering**
  - Fixed missing plus icon on the shop "add item" button (Font Awesome selector mismatch).

### Discord Copy (Raw Text)
```text
GeniusShop 1.5.0 (Unreleased) - Important Changes

- Added full multi-language support (new languages folder + switchable locale in config)
- Added bulk sell menu and improved Bedrock compatibility
- Added custom enchantment support and SmartSpawner integration
- Added stock reset scheduler with daily/hourly/minute/second/weekly/monthly/yearly/once support
- Added new stock placeholders: %stock-reset-timer%, %global-limit%, %player-limit%
- Added item toggles for live stock and reset timer display
- Added sell-to-stock controls (shop level + per-item overrides, overflow toggle)
- Added run-as support for commands (player/console) and permission-aware /shop tab completion
- Improved gradient support (multi-stop gradients + legacy style compatibility like &l)
- Live shop GUI now refreshes stock/price/lore while players keep menus open
- Web editor received major UX upgrades (section toggles, better language/preview handling)
- Fixed stock reset lifecycle issues, month parsing (1-12), and several web editor save/load bugs
```

---

## [1.4.0] - 2025-12-11
- Baseline version for current changelog tracking.
- Initial web configuration editor release.
- Vault economy integration.
- Dynamic pricing system.
