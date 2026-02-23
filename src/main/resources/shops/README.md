# Shop Configuration Guide

This directory contains YAML configuration files for in-game shops. Each file represents a separate shop with its own items, prices, and settings.

## Shop Structure

Each shop configuration file follows this structure:

```yaml
gui-name: '&8Shop Name'
rows: 3
permission: ''
items:
  - material: ITEM_NAME
    name: '&fDisplay Name'
    price: 100
    sell-price: 50
    amount: 1
```

## Configuration Options

### Shop Settings

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gui-name` | String | Yes      | The display name of the shop GUI. Supports color codes with `&` |
| `rows` | Integer | No       | Number of rows in the shop GUI (1-6) |
| `permission` | String | No       | Permission required to access this shop. Leave empty (`''`) for no permission |
| `available-times` | List | No       | Time ranges when the shop is available (one per line). Examples: `Monday-Friday`, `08:00-17:00`, `2024-12-01 to 2024-12-31` |
| `stock-reset` | Section/String | No       | Auto reset stock for the whole shop (resets global stock counters for all items in this shop) |
| `sell-adds-to-stock` | Boolean | No       | If true, selling this shop's items replenishes global stock counters |
| `allow-sell-stock-overflow` | Boolean | No       | If true, selling can push stock beyond its configured cap (overflow) |

### Item Settings

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `material` | String | Yes      | Minecraft material name (e.g., `DIAMOND`, `STONE`) |
| `name` | String | No       | Display name for the item. Supports color codes with `&` |
| `price` | Integer | No       | Buy price for the item |
| `sell-price` | Integer | No       | Sell price for the item. Omit if item cannot be sold back |
| `amount` | Integer | No       | Quantity of items per transaction |
| `enchantments` | Map | No       | Enchantments to apply to the item (format: `ENCHANTMENT: LEVEL`, one per line) |
| `spawner-type` | String | No       | Mob type for spawners (e.g., `PIG`, `ZOMBIE`, `CREEPER`). Only for `SPAWNER` or `TRIAL_SPAWNER` materials |
| `potion-type` | String | No       | Potion effect type (e.g., `SPEED`, `STRENGTH`, `REGENERATION`). Only for `POTION`, `SPLASH_POTION`, `LINGERING_POTION`, or `TIPPED_ARROW` materials |
| `hide-attributes` | Boolean | No       | Hide attribute modifiers from item tooltip |
| `hide-additional` | Boolean | No       | Hide additional info (like potion effects, book author) from tooltip |
| `stock-reset` | Section/String | No       | Auto reset stock for this item only (resets this item's global stock counter) |
| `sell-adds-to-stock` | Boolean | No       | Item-level override for stock replenishment on sell |
| `allow-sell-stock-overflow` | Boolean | No       | Item-level override for allowing stock overflow on sell |

## Advanced Item Configuration

### Stock Reset (Shop or Item)

You can configure automatic stock resets either at shop level or item level.

Supported reset `type` values:
- `DAILY` (every day)
- `HOURLY` (every hour at configured minute/second)
- `MINUTE_INTERVAL` (every N minutes)
- `SECOND_INTERVAL` (every N seconds)
- `WEEKLY` (specific weekday)
- `MONTHLY` (specific day of month)
- `YEARLY` (specific month/day)
- `ONCE` (specific date/time, one-time)

Available fields:
- `enabled`: `true`/`false`
- `type`: reset type (see above)
- `time`: `HH:mm` or `HH:mm:ss` (24h, used by HOURLY/DAILY/WEEKLY/MONTHLY/YEARLY)
- `interval`: integer > 0 (used by `MINUTE_INTERVAL` and `SECOND_INTERVAL`)
- `day-of-week`: for `WEEKLY` (e.g. `MONDAY`)
- `day-of-month`: for `MONTHLY` (1-31)
- `month`: for `YEARLY` (e.g. `JANUARY`)
- `month-day`: for `YEARLY` (1-31)
- `date`: for `ONCE` (`yyyy-MM-dd HH:mm` or `yyyy-MM-dd'T'HH:mm`)
- `timezone`: IANA timezone (e.g. `Europe/Copenhagen`) or `server`

Shop-level example (every Monday at 22:00):

```yaml
stock-reset:
  enabled: true
  type: WEEKLY
  day-of-week: MONDAY
  time: "22:00"
  timezone: server
```

Item-level example (reset daily at midnight):

```yaml
items:
  - material: DIAMOND
    name: '&bDaily Stock Item'
    price: 1000
    global-limit: 100
    stock-reset:
      enabled: true
      type: DAILY
      time: "00:00"
```

Item-level example (reset every 15 minutes):

```yaml
items:
  - material: EMERALD
    name: '&aInterval Stock Item'
    price: 250
    global-limit: 500
    stock-reset:
      enabled: true
      type: MINUTE_INTERVAL
      interval: 15
```

Item-level one-time reset example:

```yaml
items:
  - material: NETHER_STAR
    name: '&dEvent Item'
    price: 5000
    global-limit: 50
    stock-reset:
      enabled: true
      type: ONCE
      date: "2026-12-25 10:00"
      timezone: server
```

Manual reset command:
- `/shop resetstock all`
- `/shop resetstock shop <shopKey>`
- `/shop resetstock item <shopKey> <slot>`

In-game docs command:
- `/shop wiki` (requires `geniusshop.wiki` or admin permissions)

### New Feature Showcase Snippets

The bundled `farming.yml` and `spawners.yml` now include these patterns.

Shop-level stock behavior:

```yaml
sell-adds-to-stock: true
allow-sell-stock-overflow: false
stock-reset:
  enabled: true
  type: MINUTE_INTERVAL
  interval: 30
  timezone: server
```

Item-level stock behavior overrides:

```yaml
items:
  - material: PUMPKIN
    sell-adds-to-stock: false
    allow-sell-stock-overflow: false
    global-limit: 240
    show-stock: true
```

Item-level reset timer (second interval):

```yaml
items:
  - material: WHEAT
    global-limit: 512
    show-stock: true
    show-stock-reset-timer: true
    stock-reset:
      enabled: true
      type: SECOND_INTERVAL
      interval: 45
```

Commands + execution context:

```yaml
items:
  - material: DIAMOND_HOE
    commands:
      - 'broadcast <gradient:#A8E063:#F6D365>%player% bought the Master Farmer Hoe!</gradient>'
      - 'lp user %player% permission settemp geniusshop.bonus.harvest true 7d'
    run-as: console
    run-command-only: false
```

Gradient names and lore:

```yaml
items:
  - material: SPAWNER
    name: '<gradient:#57C1FF:#7EE8FA:#EEC0C6>Diamond Spawner</gradient>'
    lore:
      - '&7Produces diamonds.'
      - '&7Available: <gradient:#C8FF00:#9BFCA2>%available-times%</gradient>'
```

### Enchantments

Add enchantments to items using the `enchantments` field with the format `ENCHANTMENT: LEVEL` (one per line):

```yaml
items:
  - material: DIAMOND_SWORD
    name: '&bLegendary Sword'
    price: 5000
    amount: 1
    enchantments:
      SHARPNESS: 5
      UNBREAKING: 3
      FIRE_ASPECT: 2
      LOOTING: 3
      MENDING: 1
```

**Common Enchantments:**
- Weapon: `SHARPNESS`, `SMITE`, `BANE_OF_ARTHROPODS`, `FIRE_ASPECT`, `KNOCKBACK`, `LOOTING`, `SWEEPING_EDGE`
- Armor: `PROTECTION`, `FIRE_PROTECTION`, `BLAST_PROTECTION`, `PROJECTILE_PROTECTION`, `THORNS`, `FEATHER_FALLING`
- Tool: `EFFICIENCY`, `FORTUNE`, `SILK_TOUCH`, `UNBREAKING`, `MENDING`
- Bow: `POWER`, `PUNCH`, `FLAME`, `INFINITY`
- Fishing: `LUCK_OF_THE_SEA`, `LURE`

### Spawners

Specify the mob type for spawners using the `spawner-type` field:

```yaml
items:
  - material: SPAWNER
    name: '&6Pig Spawner'
    price: 10000
    amount: 1
    spawner-type: PIG
  - material: TRIAL_SPAWNER
    name: '&5Trial Zombie Spawner'
    price: 50000
    amount: 1
    spawner-type: ZOMBIE
```

**Common Mob Types:** `PIG`, `COW`, `CHICKEN`, `SHEEP`, `ZOMBIE`, `SKELETON`, `CREEPER`, `SPIDER`, `ENDERMAN`, `BLAZE`, `IRON_GOLEM`

### Potions & Tipped Arrows

Configure potion effects using the `potion-type` field:

```yaml
items:
  - material: POTION
    name: '&bSpeed Potion'
    price: 100
    amount: 1
    potion-type: SPEED
  - material: SPLASH_POTION
    name: '&cHealing Splash Potion'
    price: 150
    amount: 1
    potion-type: INSTANT_HEAL
  - material: TIPPED_ARROW
    name: '&5Poison Arrow'
    price: 50
    amount: 8
    potion-type: POISON
```

**Common Potion Types:** `SPEED`, `STRENGTH`, `REGENERATION`, `FIRE_RESISTANCE`, `WATER_BREATHING`, `INVISIBILITY`, `NIGHT_VISION`, `WEAKNESS`, `POISON`, `SLOWNESS`, `INSTANT_HEAL`, `INSTANT_DAMAGE`, `LUCK`

### Available Times

Restrict shop availability to specific times/dates:

```yaml
gui-name: '&6Weekend Market'
rows: 3
permission: ''
available-times:
  - Saturday-Sunday
  - "08:00-22:00"
  - "2024-12-20 to 2024-12-31"
items:
  # ... items here
```

**Time Format Examples:**
- Day ranges: `Monday-Friday`, `Saturday-Sunday`
- Time ranges: `08:00-17:00`, `18:00-23:59`
- Date ranges: `2024-12-01 to 2024-12-31`

## Color Codes

Use `&` followed by a color/format code:

- `&0-9` - Colors (0=black, 1=dark blue, 2=dark green, etc.)
- `&a-f` - Colors (a=green, b=aqua, c=red, d=light purple, e=yellow, f=white)
- `&l` - Bold
- `&n` - Underline
- `&o` - Italic

## Creating a New Shop

1. Create a new `.yml` file in the `shops` directory
2. Add the basic shop structure with `gui-name`, `rows`, and `permission`
3. Add items under the `items` list
4. Restart the server or run `/shop reload`

### Example: Creating a Tools Shop

```yaml
gui-name: '&8Tools Shop'
rows: 2
permission: ''
items:
  - material: DIAMOND_PICKAXE
    name: '&bDiamond Pickaxe'
    price: 800
    sell-price: 400
    amount: 1
  - material: IRON_AXE
    name: '&7Iron Axe'
    price: 150
    sell-price: 75
    amount: 1
  - material: SHEARS
    name: '&fShears'
    price: 50
    sell-price: 25
    amount: 1
```

## Best Practices

- **Naming**: Use descriptive filenames (e.g., `tools.yml`, `food.yml`)
- **Pricing**: Sell prices are typically 25-50% of buy prices
- **Permissions**: Use specific permissions for premium/special shops
- **Organization**: Group related items together in the same shop
- **GUI Size**: Choose appropriate row count based on number of items (9 items per row)

## Existing Shops

- `blocks.yml` - Building blocks and materials
- `farming.yml` - Seeds and farming resources
- `misc.yml` - Miscellaneous items
- `premium.yml` - High-tier items (requires permission)
- `spawners.yml` - Mob spawners
- `weekend_market.yml` - Special weekend shop
