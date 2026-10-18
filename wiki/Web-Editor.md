# Web Editor

The editor is served by Genius-Shop's built-in HTTP/HTTPS API. It edits the server's configuration files; it is not a separate hosted copy of your shops.

## Enable and Connect

1. Review `api` in `config.yml`, set a unique secret, and choose an available TCP port.
2. On managed hosting, request an additional port allocation and confirm the correct public address.
3. Restart the server after changing API enablement, port, or TLS settings. Check the API startup log.
4. Join the Minecraft server with `geniusshop.admin` and run `/shop editor`.
5. Open the generated login link, or enter the generated login code in the editor's login page.

Auto-login tokens expire after five minutes. Sessions last approximately one hour. Keep links, codes, session tokens, and configuration secrets private. A fresh link is needed after expiration or a server restart.

## Network Access and Ports

### Port 8080 Is Optional

`api.port: 8080` is the default. You can use another available TCP port, such as `8081`, or the port assigned by your host. It must be in the range `1-65535`; prefer ports above `1023` unless you have intentionally configured privileged binding. Do not reuse your occupied Minecraft, proxy, database, or other plugin port.

Example using a host-assigned port:

```yaml
api:
  enabled: true
  port: 25590
  domain: 'http://editor.example.com:25590'
```

This is a configuration excerpt, not a complete file. Substitute your allocated port and address; `25590` is not automatically available. Restart, then use the matching URL and regenerate `/shop editor` links.

### Hosting Services

Check the provider's port-allocation/network panel or contact support before selecting a port. Ask:

- Does this plan allow an additional TCP port for a plugin HTTP/HTTPS server?
- Which internal port should Genius-Shop bind to?
- Which public hostname and external port should administrators connect to?
- Are additional firewall rules, proxy settings, or allocations required?

A process can successfully listen inside a container while remaining unreachable externally. Changing `api.port` alone does not reserve a hosting allocation or open a firewall. Providers may restrict additional listeners or require a paid allocation.

### Diagnose the Failure

| Symptom | Checks |
| --- | --- |
| API startup says address already in use | Another service owns the port. Select a different free/allocated port or intentionally reconfigure the conflicting service. |
| API cannot bind or reports permission denied | Check port range, privileged-port restrictions, and hosting policy. |
| API started, but browser times out remotely | Check OS/provider firewalls, hosting allocation, router/container TCP forwarding, and the public address. |
| Local connection refused | Check API enablement, startup errors, actual listener port, and HTTP/HTTPS scheme. |
| Page opens, but API/login requests fail | Check the reverse-proxy route, session expiration, IP matching, and browser/server logs. |
| Generated link uses a private IP or localhost | Configure a reachable `api.domain` and generate a new link. |

Check local access on the server machine using `http://127.0.0.1:PORT` (or HTTPS if enabled). On another computer, use the server's reachable address. `0.0.0.0` is a bind address, not a browser destination, and `localhost` means the computer running the browser.

Optional read-only diagnostics, replacing `8080` with your port:

```powershell
# On Windows: check local listeners and test TCP access.
Get-NetTCPConnection -LocalPort 8080 -State Listen
Test-NetConnection -ComputerName YOUR_SERVER_HOST -Port 8080
```

```bash
# On Linux: inspect listeners and test the local HTTP endpoint.
ss -ltnp
curl -I http://127.0.0.1:8080/
```

A TCP connection test does not prove the firewall is reachable from every network or that login/proxy routing works. Do not terminate an unfamiliar process merely to free its port. On shared hosting, ask support to identify a conflict.

### Firewalls and Forwarding

Allow inbound TCP on the selected editor port only from intended networks when practical. Home-hosted servers may need router forwarding to the server's internal address. Containers may need a published port, and cloud/hosting firewalls may be separate from the OS firewall. Never disable the entire firewall as a troubleshooting shortcut.

### Domains and HTTPS

`api.domain` changes the advertised address. It does not configure DNS, reserve a port, open a firewall, or install a certificate. Use an explicit URL such as `https://editor.example.com` for a correctly configured HTTPS proxy.

The default listener is HTTP unless `api.ssl.enabled` is true. For native HTTPS, configure a valid keystore and restart:

```yaml
api:
  ssl:
    enabled: true
    keystore: 'ssl/keystore.p12'
    keystore-password: 'REPLACE_WITH_KEYSTORE_PASSWORD'
    key-password: ''
    keystore-type: PKCS12
```

Relative keystore paths are relative to the plugin data directory. An empty key password reuses the keystore password. Certificates must be trusted and valid for the hostname used by the browser. Alternatively, use an HTTPS reverse proxy and restrict direct access to the backend listener. Route both editor assets and `/api/` requests to the same plugin service.

The backend checks the request's remote IP. A reverse proxy can change that IP; do not assume forwarded headers automatically satisfy the login check. Test the IP-confirmation flow and provider/proxy configuration before exposing the editor publicly.

## Authentication

The player must be online and have administrative access to authenticate. IP matching protects the login/session. If `api.allow-ip-bypass` is enabled and the player has `geniusshop.login.ip.bypass`, an untrusted different-IP login can require `/shop confirmlogin <token>` in-game. Confirm only your own request. Trusted addresses are stored in `trusted-ips.yml`.

Authenticated API operations use `X-Session-Token`. The configured API key is not a substitute for a valid editor session. Do not publish tokens in shared URLs or use an administrator account for untrusted automation.

## Navigation and Editing

The sidebar can collapse to an icon rail on desktop and opens as a drawer on narrow screens. The Minecraft preview is the focus for menu and shop editing; supporting settings sit below it. Previewed text resolves language references and color codes, but preview prices and conditions do not replace in-game testing.

| Section | What it edits/shows |
| --- | --- |
| Main Menu | Category buttons, title, rows, actions, permissions, and lore. |
| Shop | Shop selection, items, pricing, metadata, conditions, schedules, and variants. |
| Purchase / Sell | Transaction layouts, buttons, quantities, and titles. |
| GUI Settings | Shared navigation/lore templates and economy safety settings. |
| Campaigns | Campaign definitions and shop/item assignments. |
| Commands | Custom command names, aliases, actions, and validation. |
| Stock | Stock analytics and filters; long identifiers wrap within their cells. |
| Data Editor | Persisted player/global counts and reset data; changes affect live state. |

Click an item/button to open its form and preview. Drag items between slots where supported. Check page and slot numbers when editing multi-page shops. Use stable item keys for custom-command targets and persisted state.

### Resolved Language Text

Names, titles, and lore fields show resolved values instead of paths such as `menus.main.title`. Untouched references remain references on save. Editing the visible text creates a literal configuration override, not a language-file edit. Edit `languages/*.yml` directly when you want to update the shared translation.

### YAML Preservation

The structured YAML editor keeps comments separate from editable values. Unchanged supported documents round-trip without rewriting their source, and supported edits retain comments and unknown fields. Malformed YAML, duplicate keys, and invalid shapes can block saving. Formatting may change around edited values; this is not a general-purpose arbitrary-YAML editor.

## Save, Reload, and Publish

- **Save Tab** saves the active section after validation/confirmation.
- **Publish All** saves the supported editor sections; successful backend file saves apply configuration reloads.
- **Reload** fetches the server's files back into the editor and discards unsaved editor changes; it is not the in-game `/shop reload` command.
- **History** shows recorded changes and available rollback actions.
- **Auto-save**, when enabled, can save changes before you press Publish All.

Successful backend file saves reload the plugin configuration; custom-command saves also reload that subsystem. Save Tab and auto-save can therefore affect the live server immediately. A full project import or Publish All is not an atomic database transaction: check failures and test the resulting server state.

Use `/shop reload` after manual configuration edits. A port, API enablement, or TLS change still needs a restart. Replacing the plugin JAR always requires a restart.

## Import, Export, and History

The editor supports shop/item YAML and JSON workflows and project import/export through its dialogs. For exact custom metadata, hold the intended item, run `/shop exportitem [name]`, then import the generated JSON from `item-exports/`.

Review the destination shop, item keys, and prices before confirming an import. Keep an independent backup of configuration and `data.db`; an editor export/history rollback is not a complete server backup. History compares semantic values rather than treating YAML comments as edited fields. File rollback restores recorded configuration, not previous economy balances or all runtime counters.

## Troubleshooting Edits

If saving fails, read the validation errors, check YAML shape and duplicate keys, check command-name/alias conflicts, and confirm the session is still valid. Review server logs for write-permission or backend errors. Preserve the current export before reloading a broken document.

If a price is unexpected, check per-item/bundle mode, dynamic counters, formulas, and active campaigns. If safety rules reject a transaction, inspect `economy-safety` and the raw configured base price. See [Configuration](Configuration#pricing-and-safety).

The editor's telemetry is opt-in and separate from plugin bStats. When enabled, it records editor actions with section/mode, success, and operation metadata such as duration or failure reason. Review the installed build's controls before enabling it.

[Installation](Installation) | [Configuration](Configuration) | [Examples](Examples) | [Developer API](Developer-API)
