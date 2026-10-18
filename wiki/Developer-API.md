# Developer API

Genius-Shop exposes two different interfaces: a Java API for Bukkit plugins and an HTTP API used by the web editor. They do not share authentication or deployment requirements.

## Java Plugin Integration

Compile against the matching Genius-Shop release. Do not bundle another copy of its plugin/API classes into your plugin. Add the exact plugin name to `plugin.yml`:

```yaml
depend: [Genius-Shop]
```

Use `softdepend: [Genius-Shop]` instead when your plugin can run without the integration, and handle a missing API instance.

```java
import me.dralle.shop.api.GeniusShopAPI;
import me.dralle.shop.api.GeniusShopAPIProvider;
import org.bukkit.plugin.java.JavaPlugin;

public final class ShopIntegration extends JavaPlugin {
    @Override
    public void onEnable() {
        GeniusShopAPI api = GeniusShopAPIProvider.getAPI();
        if (api == null) {
            getLogger().warning("Genius-Shop API is unavailable.");
            return;
        }
        getLogger().info("Loaded shops: " + api.getShopKeys());
    }
}
```

Call player/inventory/shop operations from the server thread. Obtain current data again after a configuration reload rather than relying on cached `ShopData`/`ShopItem` instances. The API does not expose an arbitrary asynchronous transaction service.

## Java Methods

| Method | Behavior |
| --- | --- |
| `openMainMenu(Player)` | Open the main menu. |
| `openShop(Player, String)` | Open a shop by key. |
| `openShop(Player, String, int)` | Open a shop page; page numbers start at 1. |
| `openBulkSellMenu(Player)` | Open the bulk-sell GUI. |
| `getShop(String)` | Return `ShopData`, or null for a missing shop. |
| `getShopKeys()` | Return loaded shop keys. |
| `getItemBuyPrice(Player, String, ShopItem)` | Current buy-price lookup, or null if unavailable/inaccessible. |
| `getItemSellPrice(Player, String, ShopItem)` | Current sell-price lookup, or null if unavailable/inaccessible. |
| `getBestBuyOffer(Player, ItemStack)` | Cheapest accessible matching buy offer, or null. |
| `getBestSellOffer(Player, ItemStack)` | Highest accessible matching sell offer, or null. |

Shop keys omit `.yml`. Specific-item lookup expects an item belonging to that shop. Supply a real player when permission-aware results are required; the interface allows a nullable player context. Price lookups do not reserve stock, withdraw money, deliver items, or guarantee that a later transaction passes safety checks.

`PriceLookupResult` exposes `getShopKey()`, `getShopItem()`, and `getPrice()`.

```java
import me.dralle.shop.api.GeniusShopAPIProvider;
import me.dralle.shop.api.PriceLookupResult;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

public void reportBestSellOffer(Player player, ItemStack stack) {
    var api = GeniusShopAPIProvider.getAPI();
    if (api == null) return;
    PriceLookupResult result = api.getBestSellOffer(player, stack);
    if (result != null) {
        player.sendMessage("Best sell offer: " + result.getPrice()
                + " in " + result.getShopKey());
    }
}
```

## Events

Events are in `me.dralle.shop.api.events`. Register your Bukkit listener normally.

| Event | Timing and data |
| --- | --- |
| `ShopOpenEvent` | Shop-open attempt; cancellable. Provides player and shop. |
| `ShopPurchaseEvent` | Successful purchase notification; not cancellable. |
| `ShopSellEvent` | Successful sale notification; not cancellable. |

Purchase and sell events inherit `ShopTransactionEvent`, exposing `getPlayer()`, `getItem()`, `getAmount()`, `getTotalPrice()`, and `getShopKey()`. They are notifications, not pre-payment authorization hooks.

```java
import me.dralle.shop.api.events.ShopOpenEvent;
import me.dralle.shop.api.events.ShopPurchaseEvent;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;

public final class ShopListener implements Listener {
    @EventHandler
    public void onOpen(ShopOpenEvent event) {
        if (event.getShop().getKey().equals("premium")
                && !event.getPlayer().hasPermission("rank.vip")) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onPurchase(ShopPurchaseEvent event) {
        event.getPlayer().sendMessage("Purchase total: " + event.getTotalPrice());
    }
}
```

## Editor HTTP API

The plugin serves editor assets and API endpoints on the same port. This is an administrative interface, not a public player purchase API. Its payloads are coupled to the editor; check `ConfigApiServer.java` in your installed release before writing integrations.

### Port and Hosting Requirements

`api.port` defaults to `8080`, but any suitable available TCP port can be configured. If `8080` fails, first check whether the API started, whether another process uses the port, and whether the firewall permits incoming connections. Changing ports requires a restart.

If you rent a Minecraft server, ask the hosting provider whether an additional TCP port is available for an HTTP/HTTPS listener. Use the assigned port and public address, not an arbitrary port that only happens to be free inside the server/container. Your host may require a separate allocation or restrict extra listeners.

See [Web Editor: Network Access](Web-Editor#network-access-and-ports) for local/remote checks, alternate-port examples, firewall rules, and proxy/TLS caveats. A successful local bind does not prove public reachability.

### Authentication

Login endpoints include `POST /api/login`, `POST /api/autologin`, and `POST /api/logincode`. Prefer the user-facing `/shop editor` workflow instead of inventing credentials. Successful authentication returns a `sessionToken`; authenticated requests send it as `X-Session-Token`. IP/session checks still apply. Supplying `X-API-Key` alone is not supported as an alternative to an authenticated session.

`GET /api/language` and `GET /api/languages` provide the login/editor's localization data. Other administrative endpoints require session validation.

### Endpoint Overview

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/files` | GET | Load editor configuration files/data. |
| `/api/file/{path}` | GET, POST, DELETE | Read/save/delete supported configuration files. |
| `/api/activity-log` | GET | Read recorded changes. |
| `/api/activity-log/rollback` | POST | Restore a recorded file change. |
| `/api/activity-log/clear` | POST | Clear history. |
| `/api/economy-safety` | GET, POST | Read/update transaction guard settings. |
| `/api/stock-analytics` | GET | Read stock analytics. |
| `/api/database` | GET, POST, DELETE | Read/update/delete supported runtime data entries. |
| `/api/telemetry` | GET, POST | Editor telemetry controls/data. |

A supported file-save request uses JSON containing `content`, for example:

```json
{"content":"gui-name: '&aExample'\nrows: 3\nitems: []\n"}
```

File paths are restricted by the backend. Do not assume arbitrary filesystem access or use these endpoints to bypass validation. Malformed YAML is rejected before writing; custom commands receive command-specific validation. Successful file saves reload plugin configuration, and command files also reload their subsystem. There is no separate `/api/reload` endpoint in this implementation. Web-triggered reloads execute on the server thread and wait for completion.

Use HTTPS or a trusted local network for administrative access. Do not expose tokens, log sensitive headers, or assume file history rolls back economy balances. Runtime data is persisted in SQLite `data.db`; direct edits and database endpoints can materially change stock and player limits.

[Web Editor](Web-Editor) | [Configuration](Configuration) | [Commands and Permissions](Commands-and-Permissions)
