# Commands and Permissions

## Built-In Commands

| Command | Purpose | Primary permission |
| --- | --- | --- |
| `/shop` | Open the main menu. | `geniusshop.use` |
| `/shop sell` | Open the bulk-sell menu. | `geniusshop.sell` |
| `/shop reload` | Reload configuration, shops, messages, and custom commands. | `geniusshop.reload` |
| `/shop editor` | Create a web-editor login link and code. Player only. | `geniusshop.admin` |
| `/shop confirmlogin <token>` | Confirm the login requested for your account. Player only. | IP-bypass workflow below |
| `/shop wiki` | Show the configured wiki link. | `geniusshop.wiki` |
| `/shop resetstock all` | Reset global counters for all shops. | `geniusshop.resetstock` |
| `/shop resetstock shop <shopKey>` | Reset global counters for one shop. | `geniusshop.resetstock` |
| `/shop resetstock item <shopKey> <slot>` | Reset an item identified by its shop and slot. | `geniusshop.resetstock` |
| `/shop validate-prices` | Scan prices without executing transactions. | `geniusshop.validateprices` |
| `/shop exportitem [file-name]` | Export the held item to JSON in `item-exports/`. Player only. | `geniusshop.exportitem` |

Shop keys are filenames without `.yml`, such as `ores`. Slots are zero-based. `/shop resetstock item ores 10` targets slot 10, not the tenth YAML entry.

The validator reports invalid prices/amounts, dynamic-price bounds, formula issues, and applicable safety-cap problems. A clean scan does not prove every future dynamic price or external command is safe.

## Permission Defaults

| Permission | Default | Notes |
| --- | --- | --- |
| `geniusshop.use` | Everyone | Base `/shop` access. |
| `geniusshop.sell` | Everyone | Bulk-sell menu access. |
| `geniusshop.admin` | Operators | Administrative access and children listed below. |
| `geniusshop.reload` | Operators | Configuration reload. |
| `geniusshop.resetstock` | Operators | Manual resets. |
| `geniusshop.wiki` | Operators | Wiki link. |
| `geniusshop.validateprices` | Operators | Price diagnostics. |
| `geniusshop.exportitem` | Operators | Held-item export. |
| `geniusshop.login.ip.bypass` | Operators | Eligible for different-IP editor login confirmation when enabled. |
| `geniusshop.shop` | Not granted | Parent access node for the default protected shops. |
| `geniusshop.shop.spawners` | Not granted | Default spawner shop/menu access. |
| `geniusshop.shop.premium` | Not granted | Default premium shop/menu access. |
| `geniusshop.spawners`, `geniusshop.premium` | Not granted | Legacy access nodes for those categories. |

`geniusshop.admin` grants the built-in use, reload, sell, resetstock, wiki, validateprices, exportitem, and login-IP-bypass child nodes. Legacy `shop.admin` is recognized in several admin checks but is not a declared node; use `geniusshop.admin` for new installations. Custom shop/item permissions are separate settings, not automatically invented children of the admin node.

`/shop editor` also requires `api.enabled` and `api.enable-editor-command`. A different-IP login requires `api.allow-ip-bypass`, the appropriate permission, and in-game confirmation for an untrusted address. Only confirm login requests you initiated.

## Shop and Item Access

A shop's `permission` controls access to that shop. A main-menu button's `permission` can independently control button access. Items can have their own permission, availability, level, game-mode, and world conditions.

```yaml
gui-name: '&dVIP Shop'
rows: 3
permission: 'rank.vip'
items:
  - material: DIAMOND
    slot: 10
    price: 100
    permission: 'rank.vip.diamonds'
```

Grant the relevant nodes rather than assuming menu visibility alone grants shop access.

Example LuckPerms commands:

```text
lp group default permission set geniusshop.use true
lp group default permission set geniusshop.sell true
lp group admin permission set geniusshop.admin true
lp group vip permission set rank.vip true
lp group vip permission set rank.vip.diamonds true
```

## Custom Commands

`commands.yml` defines names as mapping keys. Every enabled name and alias must be unique. Avoid existing server/plugin command names, including `shop`. Bundled examples are disabled until configured and enabled.

```yaml
commands:
  blocks-market:
    enabled: true
    aliases: [building-market]
    description: 'Open the building shop'
    usage: '/blocks-market'
    permission: 'geniusshop.command.blocks-market'
    no-permission-message: '&cYou cannot use this command.'
    shop-bypass-permission: ''
    action:
      type: OPEN_SHOP
      shop: blocks
```

| Action | Target | Behavior |
| --- | --- | --- |
| `OPEN_SHOP` | `shop` | Open a shop. |
| `OPEN_ITEM` | `shop`, `item` | Open an item; `menu` is `BOTH`, `BUY`, or `SELL`. |
| `SELL_ALL` | Optional `shop` | Sell eligible inventory items across accessible shops or one shop. |

Use the item key shown in the editor's selector, not an assumed display name. A material can be ambiguous when several entries share it. Blank command permission means no additional command-specific permission. A configured `shop-bypass-permission` is a separate override checked by custom commands; review it carefully.

Save through the editor or use `/shop reload` after manual edits. Invalid definitions are reported during validation. If your server cannot update runtime registration reliably, restart after command-name or alias changes.

[Configuration](Configuration) | [Web Editor](Web-Editor) | [Examples](Examples)
