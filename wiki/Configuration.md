# Configuration Guide

This guide covers the YAML configuration files for Genius Shop.

## Configuration Files

```
plugins/GeniusShop/
├── config.yml          # Main plugin settings
├── messages.yml        # All plugin messages
├── discord.yml         # Discord webhook settings
├── menus/              # GUI menu configurations
│   ├── gui-settings.yml
│   ├── main-menu.yml
│   ├── purchase-menu.yml
│   └── sell-menu.yml
└── shops/              # Individual shop files
    ├── blocks.yml
    ├── farming.yml
    └── ...
```

## config.yml

Main configuration file for the plugin.

```yaml
# API server for web editor
api:
  enabled: true
  port: 8080
  # The API key gets generated on startup, change it for security purposes!
  api-key: "change-this-to-a-secure-random-key"

# Update checker
check-updates: true
send-update-message-ingame: true

# Shop settings
shop:
  sound-effects: true
  close-on-purchase: false
  transaction-cooldown: 0  # Seconds between transactions

# Discord integration
discord:
  enabled: false
  webhook-file: discord.yml
```

### Key Settings Explained

- **api.bind-address**:
  - `localhost` or `127.0.0.1` - Only local access
  - `0.0.0.0` - Allow remote access (use with caution!)

## messages.yml

Customize all plugin messages with Minecraft color codes.

```yaml
prefix: "&8[&5GeniusShop&8]&r"

shop:
  opened: "&aOpened shop: &e{shop}"
  purchase-success: "&aYou purchased &e{amount}x {item} &afor &6${price}"
  purchase-fail: "&cYou don't have enough money! Need: &e${price}"
  sell-success: "&aYou sold &e{amount}x {item} &afor &6${price}"
  sell-fail: "&cYou don't have any {item} to sell!"

errors:
  no-permission: "&cYou don't have permission to use this!"
  invalid-shop: "&cThat shop doesn't exist!"

admin:
  reload-success: "&aGeniusShop reloaded successfully!"
  token-generated: "&aWeb editor token: &e{token}"
```

### Color Codes

Use standard Minecraft color codes:
- `&0-9, a-f` - Colors
- `&l` - Bold
- `&o` - Italic
- `&n` - Underline
- `&r` - Reset

## Menu Configuration

### gui-settings.yml

Global GUI settings for all menus.

```yaml
gui-settings:
  show-buy-price: true
  buy-price-line: "&7Buy: &a${price}"
  show-buy-hint: true
  buy-hint-line: "&eLeft-click to buy"

  show-sell-price: true
  sell-price-line: "&7Sell: &c${price}"
  show-sell-hint: true
  sell-hint-line: "&eRight-click to sell"
```

### main-menu.yml

Configure the main shop selection menu.

```yaml
gui:
  main:
    title: "&8&l⛏ &5&lGENIUS SHOP"
    rows: 3
    items:
      blocks:
        slot: 11
        material: STONE
        name: "&6&lBlocks Shop"
        lore:
          - "&7Building blocks and materials"
          - ""
          - "&eClick to browse!"
        shop-key: blocks
        permission: ""
```

### purchase-menu.yml

Configure the quantity selection menu for purchases.

```yaml
purchase-menu:
  title-prefix: "&8Buy: "
  max-amount: 2304  # 36 stacks
  slots:
    1:
      slot: 10
      material: PAPER
    64:
      slot: 13
      material: IRON_INGOT
```

### sell-menu.yml

Configure the sell confirmation menu.

```yaml
sell-menu:
  title-prefix: "&8Sell: "
  max-amount: 2304
  slots:
    1:
      slot: 10
      material: PAPER
```

## Shop Files

Individual shop configurations in `shops/` folder.

### Basic Shop Structure

```yaml
# shops/blocks.yml
shop:
  gui-name: "&6&lBlocks Shop"
  rows: 6
  permission: ""
  available-times: ""  # Empty = always available

  items:
    0:  # Slot number
      material: STONE
      buy-price: 10.0
      sell-price: 5.0
      name: "&fStone"
      lore:
        - "&7A basic building block"
        - ""
        - "&aBuy: &6$10"
        - "&aSell: &c$5"
      amount: 64
      max-stack-size: 64
```

### Item Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `material` | String | Yes | Minecraft material name |
| `buy-price` | Number | No | Purchase price (0 or negative = can't buy) |
| `sell-price` | Number | No | Sell price (0 or negative = can't sell) |
| `name` | String | No | Display name (supports colors) |
| `lore` | List | No | Item lore/description |
| `amount` | Number | No | Default purchase amount |
| `max-stack-size` | Number | No | Maximum per transaction |
| `permission` | String | No | Required permission |
| `enchantments` | Map | No | Enchantments (see below) |
| `potion-type` | String | No | For potions (SPEED, STRENGTH, etc.) |
| `spawner-type` | String | No | For spawners (PIG, ZOMBIE, etc.) |

### Advanced Features

#### Enchantments

```yaml
items:
  0:
    material: DIAMOND_SWORD
    name: "&bEnchanted Sword"
    enchantments:
      SHARPNESS: 5
      UNBREAKING: 3
      FIRE_ASPECT: 2
```

#### Potions

```yaml
items:
  0:
    material: POTION
    name: "&bSpeed Potion"
    potion-type: SPEED
```

#### Spawners

```yaml
items:
  0:
    material: SPAWNER
    name: "&6Pig Spawner"
    spawner-type: PIG
    buy-price: 10000
```

#### Time Restrictions

```yaml
shop:
  available-times: "MON 00:00-23:59, SAT 00:00-23:59, SUN 00:00-23:59"
  # Format: DAY HH:MM-HH:MM, DAY HH:MM-HH:MM
  # Days: MON, TUE, WED, THU, FRI, SAT, SUN
```

## Discord Integration

Configure Discord webhooks in `discord.yml`:

```yaml
discord:
  webhooks:
    - url: "https://discord.com/api/webhooks/..."
      events:
        - purchase
        - sell
      embed-color: 5814783
```

Events available:
- `purchase` - Item purchases
- `sell` - Item sales
- `shop-open` - Shop opens

## Tips

1. **Use the Web Editor**: Much easier than manually editing YAML
2. **Backup Configs**: Before major changes, backup your configs
3. **Test Changes**: Use `/shop reload` to test without restarting
4. **Color Codes**: Preview colors at [Minecraft Color Codes](https://www.digminecraft.com/lists/color_list_pc.php)
5. **Material Names**: Use exact Minecraft material names (see [Spigot API](https://hub.spigotmc.org/javadocs/bukkit/org/bukkit/Material.html))

## Next Steps

- **[Web Editor](Web-Editor)** - Use the web interface for easier configuration
- **[Examples](Examples)** - See example shop setups
- **[Commands & Permissions](Commands-and-Permissions)** - Learn all commands

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
