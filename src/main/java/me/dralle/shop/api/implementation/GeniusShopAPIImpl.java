package me.dralle.shop.api.implementation;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.api.GeniusShopAPI;
import me.dralle.shop.api.PriceLookupResult;
import me.dralle.shop.gui.MainMenu;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import java.util.Set;

public class GeniusShopAPIImpl implements GeniusShopAPI {

    private final ShopPlugin plugin;

    public GeniusShopAPIImpl(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public void openMainMenu(Player player) {
        MainMenu.open(player);
    }

    @Override
    public void openShop(Player player, String shopKey) {
        plugin.getGenericShopGui().openShop(player, shopKey, 1);
    }

    @Override
    public void openShop(Player player, String shopKey, int page) {
        plugin.getGenericShopGui().openShop(player, shopKey, page);
    }

    @Override
    public void openBulkSellMenu(Player player) {
        plugin.getBulkSellMenu().open(player);
    }

    @Override
    public ShopData getShop(String shopKey) {
        return plugin.getShopManager().getShop(shopKey);
    }

    @Override
    public Set<String> getShopKeys() {
        return plugin.getShopManager().getShopKeys();
    }

    @Override
    public Double getItemBuyPrice(Player player, String shopKey, ShopItem item) {
        if (!isAccessible(player, shopKey, item)) return null;
        double price = calculateBuyPrice(item);
        return price > 0 ? price : null;
    }

    @Override
    public Double getItemSellPrice(Player player, String shopKey, ShopItem item) {
        if (!isAccessible(player, shopKey, item)) return null;
        double price = calculateSellPrice(item);
        return price > 0 ? price : null;
    }

    @Override
    public PriceLookupResult getBestBuyOffer(Player player, ItemStack stack) {
        if (stack == null || stack.getType().isAir()) return null;

        PriceLookupResult best = null;
        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null || shop.getItems() == null) continue;

            for (ShopItem item : shop.getItems()) {
                if (!ShopItemUtil.isSameItem(stack, item)) continue;
                if (!isAccessible(player, shopKey, item)) continue;

                double price = calculateBuyPrice(item);
                if (price <= 0) continue;

                if (best == null || price < best.getPrice()) {
                    best = new PriceLookupResult(shopKey, item, price);
                }
            }
        }

        return best;
    }

    @Override
    public PriceLookupResult getBestSellOffer(Player player, ItemStack stack) {
        if (stack == null || stack.getType().isAir()) return null;

        PriceLookupResult best = null;
        for (String shopKey : plugin.getShopManager().getShopKeys()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null || shop.getItems() == null) continue;

            for (ShopItem item : shop.getItems()) {
                if (!ShopItemUtil.isSameItem(stack, item)) continue;
                if (!isAccessible(player, shopKey, item)) continue;

                double price = calculateSellPrice(item);
                if (price <= 0) continue;

                if (best == null || price > best.getPrice()) {
                    best = new PriceLookupResult(shopKey, item, price);
                }
            }
        }

        return best;
    }

    private boolean isAccessible(Player player, String shopKey, ShopItem item) {
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null || item == null) return false;
        if (shop.getItems() == null || !shop.getItems().contains(item)) return false;

        // Shop permission
        if (player != null && shop.getPermission() != null && !shop.getPermission().isEmpty()) {
            if (!player.hasPermission(shop.getPermission())) return false;
        }

        // Item permission
        if (player != null && item.getPermission() != null && !item.getPermission().isEmpty()) {
            if (!player.hasPermission(item.getPermission())) return false;
        }

        // Shop availability
        if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) return false;

        // Item availability
        return ShopTimeUtil.isShopAvailable(item.getAvailableTimes());
    }

    private double calculateBuyPrice(ShopItem item) {
        double base = item.getPrice();
        if (!item.isDynamicPricing()) return base;

        int globalCount = plugin.getDataManager().getGlobalCount(item.getUniqueKey());
        double current = base + (globalCount * item.getPriceChange());

        if (item.getMinPrice() > 0 && current < item.getMinPrice()) current = item.getMinPrice();
        if (item.getMaxPrice() > 0 && current > item.getMaxPrice()) current = item.getMaxPrice();

        return current;
    }

    private double calculateSellPrice(ShopItem item) {
        if (item.getSellPrice() == null) return 0;

        double base = item.getSellPrice();
        if (!item.isDynamicPricing()) return base;

        int globalCount = plugin.getDataManager().getGlobalCount(item.getUniqueKey());
        double current = base + (globalCount * item.getPriceChange());

        if (current < 0.01D) current = 0.01D;
        return current;
    }
}
