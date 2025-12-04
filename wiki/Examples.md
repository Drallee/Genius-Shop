# Shop Configuration Examples

This guide provides real-world examples of shop configurations. Each shop file should be placed in the `plugins/GeniusShop/shops/` directory.

## Table of Contents

- [Shop Structure](#shop-structure)
- [Basic Shop](#basic-shop)
- [Enchanted Items Shop](#enchanted-items-shop)
- [Spawner Shop](#spawner-shop)
- [Potion Shop](#potion-shop)
- [VIP-Only Shop](#vip-only-shop)
- [Time-Limited Shop](#time-limited-shop)
- [Advanced Features](#advanced-features)

---

## Shop Structure

Each shop file follows this structure:

```yaml
gui-name: '&8Shop Name'
rows: 3
permission: ''
available-times:
  - Monday-Friday
  - "08:00-17:00"
items:
  - material: ITEM_NAME
    name: '&fDisplay Name'
    lore:
      - '&7Description line 1'
      - '&7Description line 2'
    price: 100
    sell-price: 50
    amount: 1
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `gui-name` | String | Shop menu title (supports `&` color codes) |
| `rows` | Integer | GUI rows (1-6) |
| `permission` | String | Required permission (empty = no permission) |
| `available-times` | List | Time restrictions (optional) |
| `items` | List | List of shop items |

### Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `material` | String | Minecraft material name |
| `name` | String | Display name (supports `&` color codes) |
| `lore` | List | Item description lines |
| `price` | Number | Buy price (omit or negative = can't buy) |
| `sell-price` | Number | Sell price (omit or negative = can't sell) |
| `amount` | Integer | Default quantity |
| `enchantments` | Map | Enchantments (ENCHANTMENT: LEVEL) |
| `spawner-type` | String | For spawners (PIG, ZOMBIE, etc.) |
| `potion-type` | String | For potions (SPEED, STRENGTH, etc.) |

---

## Basic Shop

Simple shop for building blocks.

**File:** `shops/blocks.yml`

```yaml
gui-name: '&6&lBlocks Shop'
rows: 3
permission: ''
items:
  - material: STONE
    name: '&fStone'
    lore:
      - '&7A basic building block'
      - ''
      - '&aBuy: &6$10'
      - '&cSell: $5'
    price: 10
    sell-price: 5
    amount: 64

  - material: DIRT
    name: '&6Dirt'
    lore:
      - '&7For landscaping'
      - ''
      - '&aBuy: &6$5'
      - '&cSell: $2'
    price: 5
    sell-price: 2
    amount: 64

  - material: OAK_LOG
    name: '&eOak Wood'
    lore:
      - '&7Essential for building'
      - ''
      - '&aBuy: &6$20'
      - '&cSell: $10'
    price: 20
    sell-price: 10
    amount: 64
```

---

## Enchanted Items Shop

Shop selling pre-enchanted items.

**File:** `shops/enchanted.yml`

```yaml
gui-name: '&5&lEnchanted Items'
rows: 3
permission: ''
items:
  - material: DIAMOND_SWORD
    name: '&b&lWarrior Blade'
    lore:
      - '&7A legendary sword'
      - ''
      - '&9Sharpness V'
      - '&9Unbreaking III'
      - '&9Fire Aspect II'
      - ''
      - '&aBuy: &6$5,000'
    price: 5000
    amount: 1
    enchantments:
      SHARPNESS: 5
      UNBREAKING: 3
      FIRE_ASPECT: 2

  - material: DIAMOND_PICKAXE
    name: '&3&lMiner''s Dream'
    lore:
      - '&7Mine faster and longer'
      - ''
      - '&9Efficiency V'
      - '&9Unbreaking III'
      - '&9Fortune III'
      - ''
      - '&aBuy: &6$4,500'
    price: 4500
    amount: 1
    enchantments:
      EFFICIENCY: 5
      UNBREAKING: 3
      FORTUNE: 3

  - material: BOW
    name: '&c&lHunter''s Bow'
    lore:
      - '&7For precise shots'
      - ''
      - '&9Power V'
      - '&9Infinity I'
      - '&9Flame I'
      - ''
      - '&aBuy: &6$3,000'
    price: 3000
    amount: 1
    enchantments:
      POWER: 5
      INFINITY: 1
      FLAME: 1
```

**Common Enchantments:**
- Weapon: `SHARPNESS`, `SMITE`, `BANE_OF_ARTHROPODS`, `FIRE_ASPECT`, `KNOCKBACK`, `LOOTING`
- Armor: `PROTECTION`, `FIRE_PROTECTION`, `BLAST_PROTECTION`, `THORNS`, `FEATHER_FALLING`
- Tool: `EFFICIENCY`, `FORTUNE`, `SILK_TOUCH`, `UNBREAKING`, `MENDING`
- Bow: `POWER`, `PUNCH`, `FLAME`, `INFINITY`

---

## Spawner Shop

High-value spawner shop.

**File:** `shops/spawners.yml`

```yaml
gui-name: '&6&lSpawner Shop'
rows: 3
permission: ''
items:
  - material: SPAWNER
    name: '&6Pig Spawner'
    lore:
      - '&7Spawns pigs'
      - ''
      - '&aBuy: &6$50,000'
      - '&cSell: $25,000'
    price: 50000
    sell-price: 25000
    amount: 1
    spawner-type: PIG

  - material: SPAWNER
    name: '&cZombie Spawner'
    lore:
      - '&7Spawns zombies'
      - ''
      - '&aBuy: &6$100,000'
      - '&cSell: $50,000'
    price: 100000
    sell-price: 50000
    amount: 1
    spawner-type: ZOMBIE

  - material: SPAWNER
    name: '&5Enderman Spawner'
    lore:
      - '&7Spawns endermen'
      - ''
      - '&aBuy: &6$500,000'
      - '&cSell: $250,000'
    price: 500000
    sell-price: 250000
    amount: 1
    spawner-type: ENDERMAN
```

**Common Mob Types:** `PIG`, `COW`, `CHICKEN`, `SHEEP`, `ZOMBIE`, `SKELETON`, `CREEPER`, `SPIDER`, `ENDERMAN`, `BLAZE`, `IRON_GOLEM`

---

## Potion Shop

Shop for various potions.

**File:** `shops/potions.yml`

```yaml
gui-name: '&5&lPotion Shop'
rows: 3
permission: ''
items:
  - material: POTION
    name: '&bSpeed Potion'
    lore:
      - '&7Move faster'
      - ''
      - '&aBuy: &6$100'
    price: 100
    amount: 1
    potion-type: SPEED

  - material: POTION
    name: '&cStrength Potion'
    lore:
      - '&7Increase damage'
      - ''
      - '&aBuy: &6$150'
    price: 150
    amount: 1
    potion-type: STRENGTH

  - material: SPLASH_POTION
    name: '&cHealing Splash Potion'
    lore:
      - '&7Instant healing'
      - ''
      - '&aBuy: &6$200'
    price: 200
    amount: 1
    potion-type: INSTANT_HEAL

  - material: TIPPED_ARROW
    name: '&5Poison Arrow'
    lore:
      - '&7Arrows with poison effect'
      - ''
      - '&aBuy: &6$50'
    price: 50
    amount: 8
    potion-type: POISON
```

**Common Potion Types:** `SPEED`, `STRENGTH`, `REGENERATION`, `FIRE_RESISTANCE`, `WATER_BREATHING`, `INVISIBILITY`, `NIGHT_VISION`, `WEAKNESS`, `POISON`, `INSTANT_HEAL`, `INSTANT_DAMAGE`

---

## VIP-Only Shop

Exclusive shop for VIP players with custom permission.

**File:** `shops/vip.yml`

```yaml
gui-name: '&d&lVIP Shop'
rows: 3
permission: 'myserver.vip'  # Custom permission required
items:
  - material: DIAMOND
    name: '&bDiamond'
    lore:
      - '&7VIP Price!'
      - ''
      - '&aBuy: &6$50'
      - '&cSell: $40'
    price: 50
    sell-price: 40
    amount: 1

  - material: EMERALD
    name: '&aEmerald'
    lore:
      - '&7VIP Price!'
      - ''
      - '&aBuy: &6$75'
      - '&cSell: $60'
    price: 75
    sell-price: 60
    amount: 1

  - material: NETHERITE_INGOT
    name: '&4Netherite Ingot'
    lore:
      - '&7Exclusive VIP Item'
      - ''
      - '&aBuy: &6$1,000'
      - '&cSell: $800'
    price: 1000
    sell-price: 800
    amount: 1
```

**Setup:** Give VIP permission with LuckPerms:
```
lp group vip permission set myserver.vip true
```

---

## Time-Limited Shop

Weekend market available only on weekends.

**File:** `shops/weekend_market.yml`

```yaml
gui-name: '&e&lWeekend Market'
rows: 3
permission: ''
available-times:
  - Saturday-Sunday
  - "00:00-23:59"
items:
  - material: DIAMOND
    name: '&b&lWeekend Deal: Diamond'
    lore:
      - '&7Special weekend price!'
      - '&750% off regular price'
      - ''
      - '&aBuy: &6$40'
      - '&cSell: $35'
    price: 40
    sell-price: 35
    amount: 1

  - material: GOLDEN_APPLE
    name: '&6&lWeekend Special'
    lore:
      - '&7Only available on weekends'
      - ''
      - '&aBuy: &6$100'
    price: 100
    amount: 1
```

**Time Format Examples:**
- Day ranges: `Monday-Friday`, `Saturday-Sunday`
- Time ranges: `08:00-17:00`, `18:00-23:59`
- Date ranges: `2024-12-01 to 2024-12-31`

---

## Advanced Features

### Color Codes

Use `&` followed by a color/format code:

| Code | Color | Code | Format |
|------|-------|------|--------|
| `&0` | Black | `&l` | **Bold** |
| `&1` | Dark Blue | `&o` | *Italic* |
| `&2` | Dark Green | `&n` | <u>Underline</u> |
| `&3` | Dark Aqua | `&m` | ~~Strikethrough~~ |
| `&4` | Dark Red | `&r` | Reset |
| `&5` | Purple |
| `&6` | Gold |
| `&7` | Gray |
| `&8` | Dark Gray |
| `&9` | Blue |
| `&a` | Green |
| `&b` | Aqua |
| `&c` | Red |
| `&d` | Pink |
| `&e` | Yellow |
| `&f` | White |

### Sell-Only Items

Set `price` to negative or omit it to make items sell-only:

```yaml
items:
  - material: COBBLESTONE
    name: '&7Cobblestone'
    lore:
      - '&7Sell your excess cobblestone'
      - ''
      - '&cSell: $1'
    sell-price: 1
    amount: 64
```

### Buy-Only Items

Set `sell-price` to negative or omit it to make items buy-only:

```yaml
items:
  - material: GOLDEN_APPLE
    name: '&6Golden Apple'
    lore:
      - '&7Cannot be sold back'
      - ''
      - '&aBuy: &6$100'
    price: 100
    amount: 1
```

## Best Practices

💡 **Pricing**: Sell prices are typically 25-50% of buy prices
💡 **GUI Size**: Choose row count based on items (9 items per row)
💡 **Permissions**: Use custom permissions for VIP/premium shops
💡 **Organization**: Group related items in the same shop
💡 **Naming**: Use descriptive filenames (`tools.yml`, `food.yml`)

## Next Steps

- **[Configuration](Configuration)** - Learn more about config options
- **[Web Editor](Web-Editor)** - Use visual editor for easier setup
- **[Commands & Permissions](Commands-and-Permissions)** - Set up permissions

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
