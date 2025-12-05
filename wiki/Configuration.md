# Configuration Guide

This guide explains all configuration files for Genius-Shop and how to customize them.

## Configuration Files Overview

Genius-Shop uses multiple YAML configuration files:

- **config.yml** - Main plugin settings (economy, updates, API)
- **messages.yml** - All player-facing messages and text
- **discord.yml** - Discord webhook notifications
- **menus/gui-settings.yml** - GUI text and lore customization
- **menus/main-menu.yml** - Main shop menu layout
- **menus/purchase-menu.yml** - Purchase GUI settings
- **menus/sell-menu.yml** - Sell GUI settings
- **shops/*.yml** - Individual shop definitions

---

## config.yml

Main plugin configuration file.

### General Settings

```yaml
config-version: 5

# Auto-update config files when new keys are added
merge-missing-defaults: true

# Check for plugin updates on startup
check-updates: true

# Notify admins about updates when they join
send-update-message-ingame: true

# Enable debug logging to console
debug: false
```

### Economy Settings

```yaml
eco:
  # Override currency symbol (empty = use Vault economy plugin's symbol)
  # Examples: "$", "€", "G", "coins"
  override-currency-symbol: ""

# Fallback if no Vault economy is available
fallback-currency-symbol: "$"
```

### Date Format

```yaml
# How dates are displayed for time-limited shops
# Options: "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "dd MMM yyyy", etc.
date-format: "dd MMM yyyy"
```

### Default Shops

```yaml
# Create example shop files on first run
# Creates: blocks.yml, farming.yml, misc.yml, premium.yml, spawners.yml, weekend_market.yml
create-default-shops: true
```

### Web Editor API

```yaml
api:
  enabled: true
  port: 8080
  # IMPORTANT: Change this to a secure random key!
  # Generate at: https://www.uuidgenerator.net/
  api-key: "change-this-to-a-secure-random-key"
```

**⚠️ Security Warning**: Keep your API key secret! Anyone with the key can edit your shop configs through the web editor.

---

## messages.yml

All player-facing messages and feedback text.

### Message Structure

```yaml
config-version: 3

messages:
  prefix: "&8&l| &cSHOP &8&l| "
  no-permission: "%prefix%&cYou don't have permission to do that."
  player-only: "&cOnly players can use this command."

  # Shop access
  shop-not-found: "&cShop '&e%shop%&c' was not found."
  shop-no-permission: "%prefix%&cYou don't have permission to open the &e%shop%&c shop."
  shop-not-available: "%prefix%&cThe &e%shop%&c shop is not available right now!\n%prefix%&7Available: &e%available-times%"
  shop-always-available: "&aAlways"

  # Economy
  economy-not-ready: "&cEconomy plugin is not ready."
  not-enough-money: "&cYou can't afford &7%amount%x &4%item%&c for &4%price%."
  buy-success: "&eYou bought &7%amount%x &6%item%&e for &6%price%."
  payment-error: "&cSomething went wrong with the payment."

  # Selling
  cannot-sell: "%prefix%&cYou can't sell that item."
  no-items-to-sell: "%prefix%&cYou don't have any &e%item%&c to sell."
  sell-success: "%prefix%&aYou sold &7%amount%x &6%item%&a for &6%price%."
  sell-all-success: "%prefix%&aYou sold &7%amount%x &6%item%&a for &6%price% in total."

  # Buying guard
  cannot-buy: "%prefix%&cYou can't buy that item."

  # Admin
  reload-no-permission: "%prefix%&cYou don't have permission to reload the plugin."
  reload-success: "%prefix%&aGenius-Shop has been reloaded."
  reload-failed: "%prefix%&cReload failed, check console."
  update-available: "%prefix%&aA new update is available! &7(&c%current% &7-> &a%new%&7)"
```

### Available Placeholders

- `%prefix%` - Message prefix
- `%shop%` - Shop name
- `%item%` - Item name
- `%amount%` - Item quantity
- `%price%` - Price/earnings
- `%available-times%` - When shop is available
- `%current%` - Current plugin version
- `%new%` - New plugin version

### Color Codes

Use standard Minecraft color codes:
- `&0-9, a-f` - Colors
- `&l` - Bold
- `&o` - Italic
- `&n` - Underline
- `&r` - Reset

---

## discord.yml

Discord webhook notifications for shop transactions.

### Basic Setup

```yaml
config-version: 1

# Enable Discord notifications
enabled: false

# Your Discord webhook URL
webhook-url: "WEBHOOK_URL_HERE"
```

**How to create a webhook:**
1. Go to your Discord server settings
2. Select "Integrations" → "Webhooks"
3. Click "New Webhook"
4. Copy the webhook URL and paste it into discord.yml

### Purchase Notifications

```yaml
purchase:
  enabled: true
  type: "embed"  # "embed" or "plain"

  # For plain messages
  plain-message: "🛒 **%player%** purchased **%amount%x %item%** for **%currency%%price%**"

  # For embed messages
  embed:
    title: "🛒 Purchase Transaction"
    description: "**%player%** purchased items from the shop"
    color: 3066993  # Green
    fields:
      - name: "Player"
        value: "%player%"
        inline: true
      - name: "Item"
        value: "%item%"
        inline: true
      - name: "Amount"
        value: "%amount%"
        inline: true
      - name: "Total Cost"
        value: "%currency%%price%"
        inline: true
    footer: "Genius Shop"
    timestamp: true
```

### Sell Notifications

```yaml
sell:
  enabled: true
  type: "embed"
  plain-message: "💰 **%player%** sold **%amount%x %item%** for **%currency%%price%**"
  embed:
    title: "💰 Sell Transaction"
    description: "**%player%** sold items to the shop"
    color: 15844367  # Gold
    fields:
      - name: "Player"
        value: "%player%"
        inline: true
      - name: "Item"
        value: "%item%"
        inline: true
      - name: "Amount"
        value: "%amount%"
        inline: true
      - name: "Total Earned"
        value: "%currency%%price%"
        inline: true
    footer: "Genius Shop"
    timestamp: true
```

### Common Embed Colors

- `3066993` - Green (#2ecc71)
- `15844367` - Gold (#f1c40f)
- `3447003` - Blue (#3498db)
- `15158332` - Red (#e74c3c)
- `10181046` - Purple (#9b59b6)

### Available Placeholders

- `%player%` - Player username
- `%item%` - Item name (color codes stripped)
- `%amount%` - Number of items
- `%price%` - Total price/earnings
- `%currency%` - Currency symbol
- `%timestamp%` - Current timestamp (ISO 8601)

---

## Menu Configuration

### gui-settings.yml

Global GUI settings for all shop menus.

```yaml
gui:
  # Navigation buttons
  back-button:
    name: '&9BACK TO CATEGORIES'
    lore:
      - ''
      - '&bClick to return to the main menu.'
      - ''

  prev-button:
    name: '&e<- PREVIOUS PAGE'
    lore:
      - ''
      - '&7See the previous page.'
      - ''

  next-button:
    name: '&eNEXT PAGE ->'
    lore:
      - ''
      - '&7See the next page.'
      - ''

  # Item lore customization
  item-lore:
    # Price display (shown at top of lore)
    show-buy-price: true
    buy-price-line: '&6Buy Price: &a%price%'
    show-sell-price: true
    sell-price-line: '&cSell Price: &a%sell-price%'

    # Hint lines (shown at bottom of lore)
    show-buy-hint: true
    buy-hint-line: '&eLeft-click to buy'
    show-sell-hint: true
    sell-hint-line: '&aRight-click to sell'

    # Purchase menu lines
    amount-line: '&eAmount: &7%amount%'
    total-line: '&eTotal: &7%total%'
```

### main-menu.yml

Defines the main shop menu layout. See [Examples](Examples) for detailed shop menu configuration.

### purchase-menu.yml

Settings for the item purchase GUI (amount selection interface).

### sell-menu.yml

Settings for the item selling GUI (amount selection interface).

---

## Shop Definitions

Individual shop files are stored in the `shops/` folder. Each shop is a separate YAML file.

### Making Items Non-Purchasable or Non-Sellable

**Important**: To disable buying or selling for an item, you have three options:

- **To disable buying**: Remove the `price:` field entirely, OR set it to `0`, OR set it to a negative value (e.g., `-1`)
- **To disable selling**: Remove the `sell-price:` field entirely, OR set it to `0`, OR set it to a negative value (e.g., `-1`)

**Example - Display only (cannot buy or sell):**
```yaml
items:
  0:
    material: DIAMOND
    name: "&bRare Diamond"
    lore:
      - "&7This is for display only!"
    # Omit price/sell-price, OR set to 0, OR set to -1
```

**Example - Can only buy (cannot sell):**
```yaml
items:
  0:
    material: DIAMOND_SWORD
    name: "&cSpecial Sword"
    price: 1000.0
    sell-price: -1  # Can also omit or set to 0
```

**Example - Can only sell (cannot buy):**
```yaml
items:
  0:
    material: DIRT
    name: "&7Dirt"
    price: 0  # Can also omit or set to -1
    sell-price: 0.5
```

See the [Examples](Examples) page for detailed information on creating and configuring shops.

---

## Configuration Tips

1. **Always back up** your configs before making major changes
2. **Use the web editor** for easier configuration with live preview
3. **Test time restrictions** before deploying to production
4. **Keep your API key secure** - don't share it publicly
5. **Use `/shop reload`** after changing configs to apply changes
6. **Check the console** for error messages if configs don't load

---

## Auto-Update System

Genius-Shop automatically merges new config keys when you update the plugin:

- **merge-missing-defaults: true** - Adds new keys while keeping your changes
- **merge-missing-defaults: false** - Never modifies your configs (not recommended)

When enabled, the plugin will:
- Add new configuration keys from updates
- Keep all your existing values and customizations
- Create backups before making changes
- Log all changes to the console

This means you can safely update the plugin without losing your configuration!

---

## Next Steps

- **[Web Editor](Web-Editor)** - Use the web interface for easier configuration
- **[Examples](Examples)** - See example shop setups
- **[Commands & Permissions](Commands-and-Permissions)** - Learn all commands

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
