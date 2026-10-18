# Installation

## Requirements

- A compatible Minecraft 1.21 server; the plugin targets the Spigot API and is also used on Paper-based servers.
- Java 21.
- Vault and a working Vault-compatible economy provider. Vault itself does not supply balances.
- Optional SmartSpawner for its native spawner items.
- An additional available TCP port if you want remote access to the web editor.

## First Startup

1. Stop the server and back up existing plugin data.
2. Put the Genius-Shop release JAR, Vault, and your economy provider in `plugins/`. Keep only one Genius-Shop JAR installed.
3. Start the server and check the console for dependency, economy, YAML, or API-startup errors.
4. Locate the generated data directory. With the current plugin name, it is normally `plugins/Genius-Shop/`; use the directory your server actually created.
5. Review `config.yml`, `shops/`, `menus/`, and `languages/`. Configure permissions before granting editor access.
6. Test `/shop`, a small purchase, and a sale. Run `/shop validate-prices` before making a shop public.

Default shop files are controlled by `create-default-shops`. The bundled examples include blocks, farming, ores, potions, miscellaneous items, premium items, spawners, and a weekend market. Customize their prices and access rules for your economy.

## Web Editor Setup

The editor and its HTTP API share a listening port. The Minecraft game port is a separate service.

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
```

Use the generated configuration rather than replacing the whole file with this excerpt. Restart after changing API enablement, port, or TLS settings.

Join as an administrator and run `/shop editor`. Open the generated link within five minutes. See [Web Editor](Web-Editor) for login methods, IP checks, HTTPS, and session expiration.

### Choosing a Port

`8080` is the default only. Another available port, such as `8081` or a port assigned by your host, can be set in `api.port`. Use a port from `1` through `65535`, preferably an unprivileged port above `1023`. It must not already be used by Minecraft, another plugin, a proxy, a web server, or another process.

On a hosting service, check its network/allocations panel or contact support. Ask whether your plan allows an additional **TCP port for an HTTP/HTTPS listener**, which port to configure inside the server, and which external hostname/port to use. An arbitrary unused port inside a container may still be inaccessible from the internet. Do not assume port `8080` is allocated to you.

### If the Editor Will Not Connect

1. Check the startup log. If the API failed to start with an address-in-use error, choose an unused or host-assigned port and restart. Opening a firewall cannot fix a port conflict.
2. Confirm `api.enabled` is true and the URL uses the configured port and correct `http://` or `https://` scheme.
3. On the server machine, try `http://127.0.0.1:8080` with the actual port. `localhost` in a browser on another computer refers to that computer, not the Minecraft server.
4. If local access works but remote access does not, check the operating-system firewall, host firewall, hosting allocation, and router/container TCP forwarding.
5. Ask your hosting provider whether the port is available and externally reachable. Request the public address and port if they differ from the internal listener.
6. Generate a fresh `/shop editor` link after correcting the address. Set `api.domain` when automatic address detection produces an unusable address.

Full diagnostics and optional terminal checks are in [Web Editor: Network Access](Web-Editor#network-access-and-ports).

## Upgrading

1. Stop the server. Back up the entire plugin data directory, including `data.db` and any SQLite companion files.
2. Replace the old JAR with the new release; do not install both versions together.
3. Start the server and review startup warnings and generated/migrated configuration.
4. Check permissions, custom command names, item keys, prices, and integrations. Test transactions on a staging server when practical.

`merge-missing-defaults` controls the configuration updater. It is not a substitute for backups. Existing menu files are intentionally not populated with missing default entries. `/shop reload` reloads configuration, not plugin code. Do not use server-wide `/reload` to install an update.

## Troubleshooting

### Economy Is Unavailable

Check that Vault and an economy provider loaded successfully and that the provider registered with Vault. A displayed fallback currency symbol does not create an economy provider.

### Purchase Is Blocked

Check funds, inventory space, permissions, availability, item conditions, limits, and `economy-safety`. Ordinary item purchases require room for the entire delivery and do not intentionally drop overflow onto the ground. External command-only deliveries are controlled by the receiving plugin.

### Missing `messages.on`

Older files used an unquoted `on` YAML key, which can parse as `true`. Use `"on": " on "` under `messages:` or its translated value. Current builds also read legacy `messages.true` when `messages.on` is absent.

### Async Command Builder Exception

An exception in Paper's `Commands.sendAsync` concerns client command-tree generation. Current reloads run on the server thread and refresh player commands after registration. Restart after upgrading. If it persists, record the triggering action, Paper build, and plugins; [Paper issue #11101](https://github.com/PaperMC/Paper/issues/11101) tracks a related upstream race.

### Debugging

Temporarily enable `debug` in `config.yml`. With `debug-error-log.enabled`, errors can be recorded at the configured path, normally `debug/error.log` relative to the data directory. Remove API keys, login tokens, webhook URLs, and personal details before sharing logs.

[Configuration](Configuration) | [Web Editor](Web-Editor) | [Commands and Permissions](Commands-and-Permissions) | [Examples](Examples)
