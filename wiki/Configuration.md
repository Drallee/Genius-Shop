# Configuration

Paths below are relative to the plugin data directory, normally `plugins/Genius-Shop/`. Back up that directory before bulk edits. The installed release's generated files are the reference for available defaults.

## Files

| Path | Purpose |
| --- | --- |
| `config.yml` | General settings, economy safety, formatting, integrations, and editor API. |
| `shops/*.yml` | Individual shops; filename without `.yml` is the shop key. |
| `menus/main-menu.yml` | Main category menu. |
| `menus/purchase-menu.yml`, `menus/sell-menu.yml` | Transaction menus and amount controls. |
| `menus/bulk-sell-menu.yml` | Bulk-selling layout. |
| `menus/gui-settings.yml` | Shared navigation buttons and lore templates. |
| `languages/*.yml` | In-game messages, menu text, and editor translations. |
| `campaigns.yml` | Global campaign definitions, when created/configured. |
| `commands.yml` | Custom command definitions. |
| `discord.yml` | Optional webhook notifications. |
| `data.db` | SQLite player/global counts and stock-reset state. Not YAML. |
| `trusted-ips.yml` | Trusted editor-login addresses. Treat as sensitive. |
| `item-exports/*.json` | Held-item exports created by `/shop exportitem`. |

Do not delete the database to fix a YAML error. Stop the server before taking a database backup or editing SQLite externally.

## General Settings

| Key | Default | Purpose |
| --- | --- | --- |
| `merge-missing-defaults` | `true` | Merge applicable missing defaults during configuration updates. |
| `language` | `en_US` | Language filename without `.yml`. |
| `debug` | `false` | Additional diagnostics. |
| `debug-error-log.enabled` | `true` | Error-file logging while debug is enabled. |
| `debug-error-log.file` | `debug/error.log` | Log path relative to the data directory. |
| `metrics` | `true` | bStats metrics toggle. |
| `updates.check-updates` | `true` | Update checking. |
| `updates.send-update-message-ingame` | `true` | Notify eligible administrators. |
| `create-default-shops` | `true` | Create bundled example shops when applicable. |
| `stock-reset-check-interval-seconds` | `1` | Frequency of scheduled reset checks. |
| `date-format` | `dd MMM yyyy` | Display format for date availability. |
| `wiki.url` | Project wiki | Target for `/shop wiki` and the editor link. |

Ordinary file changes can be applied with `/shop reload`. Restart after changing the plugin JAR or API listener settings. Existing menus are not automatically filled with missing default buttons. Review changes after an upgrade rather than relying solely on `config-version`.

## Currency and Price Display

Vault must have an economy provider. `eco.override-currency-symbol` optionally overrides the displayed currency symbol. `fallback-currency-symbol` is a formatting fallback, not a replacement economy.

`price-format.mode` supports `plain`, `compact`, and `grouped`. Compact suffixes and scientific notation are configurable under `price-format.compact`; grouping separators and precision are under `price-format.grouped`. Formatting does not change transaction amounts.

## Editor API

```yaml
api:
  enabled: true
  port: 8080
  api-key: "REPLACE_WITH_A_UNIQUE_SECRET"
  enable-editor-command: true
  domain: ""
  allow-ip-bypass: false
  ssl:
    enabled: false
    keystore: ""
    keystore-password: ""
    key-password: ""
    keystore-type: "PKCS12"
```

The HTTP server binds to `0.0.0.0`. `8080` is only a default; choose another available TCP port in `api.port` if it is occupied or not allocated by your host. Managed hosting may require an additional port allocation. Ask your provider which internal and external ports are available. Open the corresponding firewall/forwarding rules and restart after changing the listener.

`api.domain` changes the advertised editor address; it does not create DNS, open a port, configure a proxy, or enable TLS. Editor operations use authenticated sessions, not merely an `X-API-Key` header. See [Web Editor](Web-Editor) for networking, HTTPS, and login troubleshooting.

## Shop Structure

```yaml
gui-name: '&aBuilding Materials'
rows: 3
permission: ''
sell-adds-to-stock: false
allow-sell-stock-overflow: false
items:
  - material: STONE
    item-key: building-stone
    slot: 10
    name: '&fStone'
    amount: 1
    price: 10
    sell-price: 5
    lore:
      - '&7A building material.'
```

`items` is a YAML sequence, not a map. Slots are zero-based; one inventory page has nine columns and at most six visible rows. Shops can paginate. Give important entries a stable `item-key`, especially when several items share a material or serialized metadata. Renaming a key can change which persisted counters belong to the entry.

### Item Fields

| Fields | Purpose |
| --- | --- |
| `material`, `slot`, `amount`, `item-key` | Material, location, configured quantity, stable identifier. |
| `name`, `lore` | Display text and lore list, including supported language references. |
| `price`, `sell-price` | Buy/sell price; omit or use non-positive pricing to disable the corresponding operation. |
| `buy-price-per-item`, `sell-price-per-item` | Interpret the price per item (`true`, default) or per configured bundle (`false`). |
| `dynamic-pricing`, `price-change`, `min-price`, `max-price` | Counter-based dynamic prices and optional bounds. |
| `buy-price-formula`, `sell-price-formula` | Optional formula overriding the resolved base/dynamic price. |
| `limit`, `global-limit` | Player and global purchase limits; `0` means unlimited. |
| `permission`, `available-times` | Additional access and availability conditions. |
| `min-player-level`, `max-player-level`, `required-gamemode` | Player conditions; leave optional bounds/mode unset when unused. |
| `allowed-worlds`, `denied-worlds` | World allow/deny lists. |
| `enchantments` | Enchantment identifier-to-level mapping. |
| `hide-attributes`, `hide-additional` | Display flags. |
| `require-name`, `require-lore` | Require configured metadata when matching items. |
| `spawner-type`, `spawner-item` | Spawner entity type and optional SmartSpawner item mode. |
| `potion-type`, `potion-level` | Potion metadata. |
| `head-texture`, `head-owner` | Player-head metadata. |
| `item-stack` | Serialized item data for custom metadata. |
| `commands`, `command`, `run-as`, `run-command-only` | Commands on purchase; delivery behavior described below. |
| `campaign`, `campaign-enabled`, `campaign-*` | Named or inline campaign assignment. |
| `stock-reset`, `sell-adds-to-stock`, `allow-sell-stock-overflow` | Reset schedule and item overrides of shop stock behavior. |
| `show-stock`, `show-stock-reset-timer` | Stock/countdown display controls. |
| `variants`, `variant-menu`, `variant-group`, `variant-key` | Variant definitions, grouping, and identifiers. |

Use display-only entries deliberately: an item with neither enabled buy nor sell pricing is not a transaction offer. Check the [Examples](Examples) page before configuring advanced delivery or formulas.

## Pricing and Safety

Per-item pricing: `price: 10`, `amount: 4`, `buy-price-per-item: true` costs 40 for four items. Bundle pricing with `buy-price-per-item: false` costs 10 for the configured four-item bundle. Buy and sell modes are independent.

Dynamic pricing starts from the configured buy or sell price and applies `global_count * price-change`, then applicable min/max bounds. Buy and sell bases differ, but share the stock counter. With formulas, `base`/`price` is the configured price for that direction and `dynamic`/`dynamic_price` is its dynamic result. Other variables include `global_count`/`count`, `amount` (configured item amount), `price_change`, `min_price`, `max_price`, `limit`, and `global_limit`.

```yaml
dynamic-pricing: true
price-change: 0.5
min-price: 5
max-price: 100
buy-price-formula: 'max(min_price, dynamic)'
sell-price-formula: 'max(0.01, min(dynamic * 0.5, base))'
```

Campaigns can further change transaction prices. Run `/shop validate-prices` and test representative quantities, bundles, formulas, and campaign dates. Do not assume a displayed base price is the current transaction price.

`economy-safety` contains these server-side controls:

| Setting | Default |
| --- | --- |
| `enabled` | `true` |
| `max-transaction-value` | `50000000` |
| `max-unit-price` | `10000000` |
| `cooldowns.enabled` | `true` |
| `cooldowns.buy-ms`, `sell-ms`, `bulk-sell-ms` | `250`, `250`, `500` |
| `anti-spike.enabled` | `true` |
| `anti-spike.max-base-multiplier` | `10.0` |
| `anti-spike.min-base-multiplier` | `0.0` |
| `anti-spike.max-step-change-ratio` | `5.0` |
| `large-purchase-confirmation.enabled` | `true` |
| `large-purchase-confirmation.threshold` | `1000000` |
| `large-purchase-confirmation.timeout-seconds` | `10` |
| `admin-alerts.enabled` | `false` |
| `admin-alerts.notify-permission` | `geniusshop.admin` |
| `admin-alerts.rate-limit-ms` | `3000` |

The anti-spike base is the configured raw buy/sell price, not a moving dynamic price. `max-base-multiplier: 1.5` rejects a unit price above 1.5 times that base. A value below 1 may block the starting price. `0` disables the multiplier bound or hard value cap where documented. The step-change ratio is relative to the last successful trade; it is not a replacement for the base multiplier check.

Prices do not gradually decay with elapsed time. Counter changes and resets affect dynamic pricing. Low sell prices can discourage selling, leaving elevated prices in place. Configure bounds/reset schedules and review the economy rather than expecting a safety rejection to lower the price automatically.

## Stock and Resets

Player and global counts persist in SQLite. A normal config reload does not clear them. `sell-adds-to-stock` defaults to false; enable it when selling should replenish stock. `allow-sell-stock-overflow` controls replenishment beyond the configured stock cap. Item-level values override shop defaults.

```yaml
stock-reset:
  enabled: true
  type: DAILY
  time: '06:00'
  timezone: server
```

| Type | Relevant fields |
| --- | --- |
| `NONE` | Disabled schedule. |
| `HOURLY` | `time` selects the minute/second position within the hour. |
| `MINUTE_INTERVAL`, `SECOND_INTERVAL` | Positive `interval`. |
| `DAILY` | `time`. |
| `WEEKLY` | `day-of-week`, `time`. |
| `MONTHLY` | `day-of-month`, `time`. |
| `YEARLY` | `month`, `month-day`, `time`. |
| `ONCE` | `date`. |

Use `timezone: server` or a valid timezone such as `Europe/Copenhagen`. Quote time/date strings. Shop schedules reset all items in that shop; item schedules can trigger additional resets. An item schedule does not exempt it from a shop-wide reset. Manual `/shop resetstock` targets global counters and therefore dynamic-price state, not a blanket reset of every player's purchase limit. Back up data before using the editor's database controls.

## Availability and Campaigns

Shop and item `available-times` can contain day ranges, time ranges, and supported date restrictions:

```yaml
available-times:
  - 'FRIDAY-SUNDAY'
  - '10:00AM-10:00PM'
```

Define global campaigns in `campaigns.yml` or shop-local `campaigns` lists. Assign a campaign key using `campaign` at shop/item level. Inline item campaign fields are also supported. Use real future/current dates, not unchanged sample dates.

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

Review combined shop/item assignments and resulting prices before publishing.

## Menus and Language Values

Main-menu `items` is a mapping with named entries, unlike shop `items`. Each menu button has a material, slot, name, and lore. `shop-key` selects a shop. Other actions include `command`, `command-close`, and `close`, with `commands`, `run-as`, and `close-after-action` where applicable.

`menus/gui-settings.yml` stores shared settings under `gui:`. `item-lore.lore-format` orders placeholders such as `%custom-lore%`, `%price-line%`, `%hint-line%`, `%spawner-type-line%`, `%potion-type-line%`, `%global-limit%`, `%player-limit%`, and `%stock-reset-timer%`.

Values such as `menus.main.title` refer to `messages.menus.main.title` in the selected language file. Literal text is also allowed. The editor displays resolved names/titles/lore but keeps untouched references on save. Editing the displayed text writes a literal override to the configuration field; it does not edit the language file.

Color support includes `&a` formatting, `&#RRGGBB` hex colors, and `<gradient:#FF0000:#00FF00>Text</gradient>`. Quote values containing YAML-significant characters. Always quote language keys such as `"on"` that YAML 1.1 may interpret as booleans.

## Special Items and Command Delivery

Prefer `/shop exportitem` and editor JSON import for exact custom-item metadata. For SmartSpawner, serialized `item-stack` data is preferred; otherwise the optional creation API is used when support and the legacy-named `smart-spawner-command-fallback` option are enabled. That option now controls API fallback delivery, not an automatic give command.

Explicit purchase commands remain supported. `run-as` is `console` or `player`, and `run-command-only` defaults to true when commands are used. Set it explicitly to avoid accidental double delivery. Command placeholders include `%player%`, `%amount%`, `%item%`, and `%price%`. External command-only delivery cannot use Genius-Shop's ordinary inventory-capacity guarantee; test the receiving plugin's behavior.

### YAML Variants

A shop entry can contain a `variants` sequence. Each variant inherits parent fields and overrides its own fields. With `variant-menu: true`, the parent slot acts as the group entry. Use a stable `variant-group` and distinct `item-key`/`variant-key` values for its variants. The group slot is derived from the parent `slot`; there is no separate `variant-group-slot` configuration field. See [Examples](Examples#item-variants) for the structure. Review advanced nested YAML after editor imports/exports rather than assuming every nested format has a dedicated form.

## Discord

Set `discord.yml` `enabled: true` and a private `webhook-url`. Configure `purchase` and `sell` independently. Both support `type: embed` or `plain`, with embed fields, title, description, color, footer, and timestamp settings.

Placeholders include `%player%`, `%item%`, `%amount%`, `%price%`, `%currency%`, and `%timestamp%`. Keep webhook URLs out of screenshots, public repositories, and support logs.

## YAML Editing Rules

Use spaces, not tabs. Keep shop entries as sequences and menu/command entries as mappings. Avoid duplicate keys. Quote apostrophes correctly or use double-quoted strings. Current editor saves use a structured parser, preserve comments/unknown fields where supported, and reject malformed YAML before overwriting a file. This does not remove the need for backups or protect against unrelated simultaneous edits.

[Examples](Examples) | [Web Editor](Web-Editor) | [Commands and Permissions](Commands-and-Permissions)
