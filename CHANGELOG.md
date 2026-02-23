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
