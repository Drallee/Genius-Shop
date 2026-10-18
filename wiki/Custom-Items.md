# Custom Items

Custom items are built into Genius-Shop. Edit `plugins/Genius-Shop/custom-items.yml`
or use the **Custom Items** tab in the web editor, then run `/shop reload` for
manual file changes. Invalid definitions retain the last working configuration.

Give an item with `/shop giveitem <player> <item-id> [amount]`.
This command requires `geniusshop.giveitem` (operators by default).
Items are identified by persistent data, not their display names.
Renaming an item ID makes already-issued items with the old ID inactive.

```yaml
items:
  premium-wand:
    material: BLAZE_ROD
    name: '&6Premium Sell Wand'
    lore:
      - '&7Sell container contents at 1.5x'
    permission: geniusshop.customitems.premium
    cooldown-seconds: 1
    max-uses: 100
    actions:
      right-click-container:
        type: SELL_CONTAINER
        multiplier: 1.5
        use-campaigns: false
      right-click-air:
        type: OPEN_MAIN_MENU
```

## Pricing

- `multiplier` defaults to `1` and must be a finite positive number.
- `use-campaigns: true` (default) uses the current campaign-adjusted sell price,
  then applies the wand multiplier.
- `use-campaigns: false` ignores campaign bonuses and applies only the wand
  multiplier to the normal sell price. Dynamic pricing and price formulas still apply.
- Example: a normal sell price of 100, campaign bonus of 2x and wand bonus of
  1.5x pays 300 with campaigns enabled, or 150 with campaigns disabled.
- Stock changes and player limits always count real items, never multiplied quantities.
- With no `shop`, eligible offers across all accessible shops are considered.
  Set `shop: blocks` to restrict selling to that shop.
- Items without an eligible sell offer stay in the container. Custom items are
  excluded. Failed deposits restore container contents.

## Triggers And Actions

Triggers are `right-click-air`, `right-click-block`, and `right-click-container`.
A container click uses its own trigger, falling back to the block trigger if absent.
Only main-hand right clicks activate items.

Supported action types:

- `SELL_CONTAINER`: container trigger only; requires `geniusshop.sell`.
  Also sells stored loot when right-clicking a compatible SmartSpawner block.
- `OPEN_MAIN_MENU`: requires `geniusshop.use`.
- `OPEN_SHOP`: requires `shop`, `geniusshop.use`, and the shop's permission.
- `OPEN_BULK_SELL_MENU`: requires `geniusshop.sell`.
- `COMMAND`: runs a `commands` list; `run-as` defaults to `player`, or may be
  `console`. `%player%` expands to the activating player's name. Configure console
  commands carefully: item holders receive the authority of those commands.

```yaml
      right-click-air:
        type: COMMAND
        run-as: console
        commands:
          - 'say %player% activated a token'
```

Optional item fields are `enabled` (default true), `permission`, `lore`,
`enchantments` (name-to-level mapping), `cooldown-seconds` (default 0), and
`max-uses` (default 0, unlimited). Limited-use items must be issued one at a time;
uses are stored on the physical item and consumed only after successful actions.
Cooldowns apply per player and item ID for the current online session.

## Container Protection

Denied block/item interactions and locked containers cannot be sold. Before a sale,
the plugin uses the normal inventory-opening path so protection plugins can deny
access through `InventoryOpenEvent`. Test your server's protection configuration
before granting sell wands widely. Shop permissions, schedules, conditions, limits,
stock rules and transaction safety checks still apply.

## SmartSpawner Loot

Existing `right-click-container` / `SELL_CONTAINER` wand actions also work on
Nighter/OpenVdra SmartSpawner blocks. The same `shop`, `multiplier`, and
`use-campaigns` settings apply. Only loot with an eligible Genius-Shop offer is
sold; unsellable loot, stored experience, and the spawner itself remain untouched.
The player additionally needs `smartspawner.sellall`.

SmartSpawner must first allow its native menu/storage GUI to open for the clicked
spawner. Its protection checks and cancellable native sale event are also honored.
The integration uses the spawner's sale guard and inventory lock, closes its
viewers, restores removed quantities if payment fails, and queues changed storage
for saving while refreshing its sell-value and display caches.

SmartSpawner 1.5.8 is supported through its legacy inventory/sell locks and
list-based storage methods. A native sale-event guard rejects queued sales whose
item quantities are no longer available, before the native sale pays out.
ShopGUI+ is not required for this integration.

SmartSpawner's public API does not expose mutable loot storage, so this bridge
checks the upstream internal storage methods at runtime. Unsupported versions
fail without selling or consuming a wand use. Native sale listeners that override
the payout cause the wand sale to be rejected, since that override has not passed
Genius-Shop's pricing safety checks. Storage counts are handled without expanding
them into individual stacks; amounts above the shop engine's integer transaction
range remain for another sale. Validate compatibility and protections on a test
server before enabling this on a live economy.
