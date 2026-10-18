# Configuration Examples

These are configuration examples, not balanced prices for every server. Test on a staging server, run `/shop validate-prices`, and back up files/data before publishing. Paths are relative to the plugin data directory.

## Basic Shop

Create `shops/building.yml`:

```yaml
gui-name: '&aBuilding Shop'
rows: 3
permission: ''
items:
  - item-key: stone
    material: STONE
    slot: 10
    name: '&fStone'
    amount: 1
    price: 10
    sell-price: 5
    lore:
      - '&7Build something new.'
  - item-key: logs-bundle
    material: OAK_LOG
    slot: 11
    name: '&6Four Oak Logs'
    amount: 4
    price: 20
    sell-price: 8
    buy-price-per-item: false
    sell-price-per-item: false
```

Stone uses per-item pricing by default. Four logs cost 20 in total because that entry uses bundle pricing. A shop key is `building`, not `building.yml`.

Add a button under the existing `items:` mapping in `menus/main-menu.yml`:

```yaml
building:
  slot: 10
  material: BRICKS
  name: '&aBuilding Shop'
  lore:
    - '&7Blocks and materials.'
  shop-key: building
```

Choose a free menu slot. Do not create a second top-level `items:` key; merge the button into the existing mapping. Reload and test.

## Buy-Only, Sell-Only, and Display-Only Entries

```yaml
gui-name: '&8Trading Options'
rows: 3
items:
  - item-key: buy-diamond
    material: DIAMOND
    slot: 10
    price: 100
    amount: 1
  - item-key: sell-cobblestone
    material: COBBLESTONE
    slot: 11
    price: 0
    sell-price: 1
    amount: 1
  - item-key: information
    material: BOOK
    slot: 13
    name: '&eInformation'
    price: 0
    lore:
      - '&7This entry is not for sale.'
```

Omitting `sell-price` disables selling. Non-positive buy pricing disables buying. Keep display-only entries free of purchase commands unless you deliberately want command behavior.

## Dynamic Prices with Restocking

```yaml
gui-name: '&bOre Market'
rows: 3
sell-adds-to-stock: true
allow-sell-stock-overflow: false
stock-reset:
  enabled: true
  type: DAILY
  time: '06:00'
  timezone: server
items:
  - item-key: iron-block
    material: IRON_BLOCK
    slot: 10
    price: 100
    sell-price: 50
    amount: 1
    dynamic-pricing: true
    price-change: 1
    min-price: 25
    max-price: 200
    global-limit: 100
    limit: 20
    show-stock: true
    show-stock-reset-timer: true
```

Purchases affect the global counter and therefore dynamic pricing. Restocking through sales is explicitly enabled here. The daily reset affects global stock/dynamic-price state; it is not a daily reset of every player's `limit`. There is no gradual time-based price decay.

Review `economy-safety.anti-spike` separately. With raw buy price 100 and maximum base multiplier 1.5, a computed unit price above 150 is rejected even if `max-price` is 200.

## Item-Level Reset Schedule

An item can have its own reset schedule. Add this mapping to the intended item:

```yaml
stock-reset:
  enabled: true
  type: WEEKLY
  day-of-week: MONDAY
  time: '08:00'
  timezone: Europe/Copenhagen
```

For a minute interval, use `type: MINUTE_INTERVAL` and a positive `interval`, for example 30. Shop-wide schedules still reset all shop items, including items with their own rule. If you want independent item-only schedules, leave the shop-wide rule disabled. Disabling an item's rule does not exclude it from a shop-wide reset.

## Permissions and Availability

```yaml
gui-name: '&dWeekend VIP Market'
rows: 3
permission: rank.vip
available-times:
  - 'FRIDAY-SUNDAY'
  - '10:00AM-10:00PM'
items:
  - item-key: vip-diamond
    material: DIAMOND
    slot: 10
    name: '&bVIP Diamond'
    price: 80
    sell-price: 30
    min-player-level: 10
    required-gamemode: SURVIVAL
    allowed-worlds: [world]
```

Also set the main-menu button permission if it should be restricted. World names and ranks must match your server. The availability window uses the server's time handling, not the player's browser timezone.

## Price Formula

Add formulas to a priced item, with its dynamic settings:

```yaml
dynamic-pricing: true
price-change: 0.5
min-price: 5
max-price: 100
buy-price-formula: 'max(min_price, dynamic)'
sell-price-formula: 'max(0.01, min(dynamic * 0.5, base))'
```

`base` refers to the configured buy or sell price for that direction. `dynamic` is the calculated dynamic price for that direction. Formula `amount` is the configured item amount, not automatically the player's selected transaction quantity. See [Configuration](Configuration#pricing-and-safety) for available variables.

## Campaign

Create/configure `campaigns.yml`:

```yaml
campaigns:
  - key: launch-sale
    name: Launch Sale
    start: '2030-01-01 00:00'
    end: '2030-01-03 23:59'
    timezone: server
    buy-multiplier: 0.9
    sell-multiplier: 1.0
```

Replace the illustrative dates with your actual campaign window. Add `campaign: launch-sale` to a shop or item. A shop can also contain its own `campaigns:` list. Use the Campaigns section to check assignments, and verify resulting prices in-game before enabling overlapping campaigns.

## Spawners and Potions

```yaml
gui-name: '&aSpecial Items'
rows: 3
items:
  - item-key: pig-spawner
    material: SPAWNER
    slot: 10
    spawner-type: PIG
    name: '&aPig Spawner'
    price: 50000
    amount: 1
  - item-key: speed-potion
    material: POTION
    slot: 11
    potion-type: SPEED
    potion-level: 1
    name: '&bSpeed Potion'
    price: 100
    amount: 1
```

When enabled and available, SmartSpawner creation API support supplies its native spawner metadata. Exact imported `item-stack` data takes precedence. The legacy-named `smart-spawner-command-fallback` config option now controls API fallback, not an automatically generated give command.

For exact custom potions, enchanted equipment, plugin-specific items, or other metadata, hold the actual item, run `/shop exportitem [name]`, and import the resulting JSON through the editor. Do not fabricate serialized item-stack data manually.

## Enchanted Items

```yaml
gui-name: '&bEquipment'
rows: 3
items:
  - item-key: enchanted-sword
    material: DIAMOND_SWORD
    slot: 10
    name: '&bEnchanted Sword'
    price: 2000
    enchantments:
      minecraft:sharpness: 3
      minecraft:unbreaking: 2
    hide-attributes: true
    require-name: true
```

Use enchantment identifiers supported by your server. `require-name`/`require-lore` influence item matching; do not enable them casually on generic materials you expect players to sell.

## Item Variants

```yaml
gui-name: '&bPotion Variants'
rows: 3
items:
  - material: POTION
    slot: 10
    amount: 1
    price: 100
    variant-menu: true
    variant-group: utility-potions
    variants:
      - item-key: utility-speed
        name: '&bSpeed'
        potion-type: SPEED
        potion-level: 1
      - item-key: utility-strength
        name: '&cStrength'
        potion-type: STRENGTH
        potion-level: 1
        price: 150
```

Variants inherit the parent material, amount, and price unless overridden. Give each variant a distinct stable identifier. Nested variants are an advanced YAML feature; review the saved/exported structure when combining them with editor workflows.

## Explicit Command-Only Delivery

For a plugin that exposes its own give command, replace this illustrative command with the actual syntax of that plugin:

```yaml
gui-name: '&eCommand Rewards'
rows: 3
items:
  - item-key: external-reward
    material: PAPER
    slot: 10
    name: '&eExternal Reward'
    price: 1000
    amount: 1
    run-as: console
    run-command-only: true
    commands:
      - 'yourplugin give %player% reward %amount%'
```

The command is an example, not a Genius-Shop command. Test it manually first. Command-only delivery does not deliver the displayed PAPER item, and the receiving plugin is responsible for inventory handling and command errors. Set `run-command-only: false` only when you intentionally want both ordinary item delivery and commands.

## Custom Sell-All Command

Add a unique entry under the existing `commands:` mapping in `commands.yml`:

```yaml
sell-inventory:
  enabled: true
  aliases: [sell-bag]
  description: 'Sell eligible inventory items'
  usage: '/sell-inventory'
  permission: 'geniusshop.command.sell-inventory'
  action:
    type: SELL_ALL
```

Add `shop: building` under `action` to restrict the search to that shop. Grant the command permission and relevant shop/item access. This is separate from `/shop sell`, which opens a GUI.

## Language References

In a menu, `name: menus.main.items.blocks.name` refers to `messages.menus.main.items.blocks.name` in the selected language file. You can replace it with literal text, for example `name: '&aBuilding Blocks'`, or change the shared translation in the language file.

The editor displays the resolved text. Unedited references survive saving; edited text becomes a literal override. For shared language keys that resemble YAML booleans, quote the key:

```yaml
messages:
  "on": " on "
```

[Configuration](Configuration) | [Commands and Permissions](Commands-and-Permissions) | [Web Editor](Web-Editor)
