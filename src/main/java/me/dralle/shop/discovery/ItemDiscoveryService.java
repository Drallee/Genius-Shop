package me.dralle.shop.discovery;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ItemConditionUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.entity.Player;

import java.text.Normalizer;
import java.util.*;

/** Called on the server thread. Personal lists contain references, never cached price/access decisions. */
public final class ItemDiscoveryService {
    public enum Mode { SEARCH, FAVORITES, RECENT }
    public record Entry(ShopData shop, ShopItem item, ItemReference reference) { }
    private record Trade(String kind, Entry entry) { }
    private final ShopPlugin plugin;
    private final Map<UUID, Trade> trades = new HashMap<>();

    public ItemDiscoveryService(ShopPlugin plugin) { this.plugin = plugin; }

    public static boolean canUse(Player player) {
        return player.hasPermission("geniusshop.use") || player.hasPermission("geniusshop.admin")
                || player.hasPermission("shop.admin") || player.isOp();
    }

    public boolean accessible(Player player, ShopData shop, ShopItem item) {
        return canUse(player) && shop != null && item != null && item.getSlot() != null && item.getSlot() >= 0
                && permitted(player, shop.getPermission()) && permitted(player, item.getPermission())
                && ShopTimeUtil.isShopAvailable(shop.getAvailableTimes()) && ShopTimeUtil.isShopAvailable(item.getAvailableTimes())
                && ItemConditionUtil.check(plugin, player, item).allowed();
    }

    private boolean permitted(Player player, String node) { return node == null || node.isBlank() || player.hasPermission(node); }

    public List<Entry> list(Player player, Mode mode, String query) {
        if (!canUse(player)) return List.of();
        List<Entry> entries = new ArrayList<>();
        if (mode != Mode.SEARCH) {
            Map<ShopData, Set<ShopItem>> seen = new IdentityHashMap<>();
            List<ItemReference> references = mode == Mode.FAVORITES ? plugin.getDataManager().getFavorites(player.getUniqueId())
                    : plugin.getDataManager().getRecentItems(player.getUniqueId());
            for (ItemReference reference : references) {
                Entry entry = resolve(player, reference);
                if (entry != null && seen.computeIfAbsent(entry.shop(), ignored -> Collections.newSetFromMap(new IdentityHashMap<>())).add(entry.item())) entries.add(entry);
            }
            return List.copyOf(entries);
        }
        String normalized = normalize(query);
        for (String key : new TreeSet<>(plugin.getShopManager().getShopKeys())) {
            ShopData shop = plugin.getShopManager().getShop(key);
            if (shop == null || !permitted(player, shop.getPermission()) || !ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) continue;
            for (ShopItem item : shop.getItems()) {
                if (!accessible(player, shop, item)) continue;
                String name = plugin.getMessages().resolveConfiguredString(item.getName(), item.getMaterial().name());
                String haystack = normalize(name + " " + item.getMaterial().name());
                if (!normalized.isEmpty() && !Arrays.stream(normalized.split(" ")).allMatch(haystack::contains)) continue;
                entries.add(new Entry(shop, item, ItemReference.of(key, item)));
            }
        }
        return List.copyOf(entries);
    }

    public Entry resolve(Player player, ItemReference reference) {
        ShopData shop = plugin.getShopManager().getShop(reference.shopKey());
        ShopItem item = reference.resolve(shop);
        return accessible(player, shop, item) ? new Entry(shop, item, reference) : null;
    }

    public ItemReference favoriteReference(Player player, Entry entry) {
        for (ItemReference reference : plugin.getDataManager().getFavorites(player.getUniqueId())) {
            Entry saved = resolve(player, reference);
            if (saved != null && saved.shop() == entry.shop() && saved.item() == entry.item()) return reference;
        }
        return null;
    }

    public boolean toggleFavorite(Player player, ItemReference reference) {
        Entry entry = resolve(player, reference);
        if (entry == null) { unavailable(player); return false; }
        ItemReference saved = favoriteReference(player, entry);
        boolean success = plugin.getDataManager().setFavorite(player.getUniqueId(), saved != null ? saved : entry.reference(), saved == null);
        player.sendMessage(text(success ? saved == null ? "favorite-added" : "favorite-removed" : "save-failed"));
        return success;
    }

    public void recordRecent(Player player, String shopKey, ShopItem item) {
        if (shopKey != null && item != null && item.getSlot() != null && item.getSlot() >= 0) {
            plugin.getDataManager().recordRecentItem(player.getUniqueId(), ItemReference.of(shopKey, item));
        }
    }

    public void bindTrade(Player player, String kind, String shopKey, ShopItem item) {
        clearTrade(player.getUniqueId());
        ShopData shop = shopKey != null ? plugin.getShopManager().getShop(shopKey) : null;
        if (shop != null && item.getSlot() != null && item.getSlot() >= 0) {
            trades.put(player.getUniqueId(), new Trade(kind, new Entry(shop, item, ItemReference.of(shopKey, item))));
        }
    }

    private Trade trade(Player player, String kind, String shopKey, String itemKey) {
        Trade trade = trades.get(player.getUniqueId());
        if (trade != null && trade.kind().equals(kind) && trade.entry().reference().shopKey().equals(shopKey)
                && Objects.equals(trade.entry().item().getUniqueKey(), itemKey)) return trade;
        return null;
    }

    public boolean guardTrade(Player player, String kind, String shopKey, String itemKey) {
        Trade trade = trade(player, kind, shopKey, itemKey);
        if (trade == null) return true;
        Entry latest = resolve(player, trade.entry().reference());
        // Configuration reloads invalidate an open transaction, even when the bookmark itself still resolves.
        if (latest == null || latest.item() != trade.entry().item() || latest.shop() != trade.entry().shop()) {
            unavailable(player);
            player.closeInventory();
            return false;
        }
        return true;
    }

    public ShopItem transactionItem(Player player, String kind, String shopKey, String itemKey) {
        Trade trade = trade(player, kind, shopKey, itemKey);
        if (trade != null) {
            Entry entry = resolve(player, trade.entry().reference());
            return entry == null ? null : entry.item();
        }
        ShopData shop = shopKey != null ? plugin.getShopManager().getShop(shopKey) : null;
        return shop == null ? null : shop.getItemByUniqueKey(itemKey);
    }

    public void clearTrade(UUID player) { trades.remove(player); }
    public void shutdown() { trades.clear(); }
    public void unavailable(Player player) { player.sendMessage(text("unavailable")); }
    public String text(String key) { return plugin.getMessages().getMessage("discovery." + key); }

    public static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKC).replaceAll("<[^>]+>", "")
                .replaceAll("(?i)[&\\u00a7]#[a-f0-9]{6}", "").replaceAll("(?i)[&\\u00a7][0-9a-fk-orx]", "")
                .toLowerCase(Locale.ROOT).replace("minecraft:", "").replace('_', ' ').replaceAll("\\s+", " ").trim();
    }
}
