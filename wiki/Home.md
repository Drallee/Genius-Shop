# Genius-Shop Wiki

Genius-Shop is a YAML-driven Minecraft economy shop with in-game menus and a built-in web editor. This wiki describes the current 1.7.0 codebase; older releases may not include every option shown here.

## Start Here

1. [Installation](Installation): requirements, first startup, upgrades, and troubleshooting.
2. [Configuration](Configuration): files, prices, limits, schedules, campaigns, and integrations.
3. [Web Editor](Web-Editor): login, editing, saving, and web-server networking.
4. [Commands and Permissions](Commands-and-Permissions): player commands and administration.
5. [Examples](Examples): complete YAML examples for common setups.
6. [Developer API](Developer-API): Java integration, events, and editor HTTP endpoints.
7. [Custom Items](Custom-Items): sell wands, multipliers, campaign options, menu tokens, and commands.

## Features

- Main-menu categories, paginated shops, purchase/sell menus, and bulk selling.
- Fixed or dynamic prices, formulas, per-item or bundle pricing, and campaign multipliers.
- Player/global limits, manual stock resets, and scheduled resets.
- Shop/item permissions, availability windows, world and player conditions.
- Custom command names and aliases through `commands.yml`.
- Serialized custom items, potions, heads, enchantments, and optional SmartSpawner API delivery.
- Localized names, lore, messages, and editor labels.
- Transaction safety guards and price-validation diagnostics.
- A preview-first web editor with collapsible navigation, campaigns, stock analytics, data editing, import/export, and history.
- Optional Discord transaction notifications and bStats metrics.

## Requirements

The project targets Minecraft 1.21 and Java 21. Vault is required, along with an economy provider registered with Vault. SmartSpawner is optional. Check compatibility with your particular server build and optional plugins before upgrading a live server.

The editor runs inside the plugin. Remote access requires an available TCP port and suitable network access. Port `8080` is only the default, not a requirement. On managed hosting, ask your provider for an additional port allocation before enabling public access.

## Common Commands

```text
/shop
/shop sell
/shop editor
/shop reload
/shop validate-prices
/shop resetstock item ores 10
```

See [Commands and Permissions](Commands-and-Permissions) for permissions and full syntax. Configuration reloads do not replace a plugin JAR or rebind the editor's listening port; restart for those changes.

## Support

Report reproducible problems through [GitHub Issues](https://github.com/Drallee/Genius-Shop/issues). Include the plugin version, server build, relevant configuration with secrets removed, steps to reproduce, and the complete exception. Back up configuration and runtime data before changing prices, importing projects, or rolling back files.
