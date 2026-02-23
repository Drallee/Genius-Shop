package me.dralle.shop.api;

import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import java.util.Set;

/**
 * Public API for Genius-Shop.
 * Allows other plugins to interact with shops and open menus.
 */
public interface GeniusShopAPI {

    /**
     * Opens the main category menu for a player.
     * @param player The player to open the menu for
     */
    void openMainMenu(Player player);

    /**
     * Opens a specific shop for a player on the first page.
     * @param player  The player to open the shop for
     * @param shopKey The unique key of the shop (filename without .yml)
     */
    void openShop(Player player, String shopKey);

    /**
     * Opens a specific shop for a player on a specific page.
     * @param player  The player to open the shop for
     * @param shopKey The unique key of the shop
     * @param page    The page number (starting from 1)
     */
    void openShop(Player player, String shopKey, int page);

    /**
     * Opens the bulk sell GUI for a player.
     * @param player The player to open the menu for
     */
    void openBulkSellMenu(Player player);

    /**
     * Gets the data for a specific shop.
     * @param shopKey The unique key of the shop
     * @return ShopData or null if not found
     */
    ShopData getShop(String shopKey);

    /**
     * Gets a set of all loaded shop keys.
     * @return Set of shop keys
     */
    Set<String> getShopKeys();

    /**
     * Gets the current buy price for a specific shop item in a specific shop,
     * respecting player shop/item permissions and availability windows.
     *
     * @param player  Player context for permission checks (nullable)
     * @param shopKey The unique key of the shop
     * @param item    The exact shop item from that shop
     * @return current buy price, or null if not purchasable/accessible
     */
    Double getItemBuyPrice(Player player, String shopKey, ShopItem item);

    /**
     * Gets the current sell price for a specific shop item in a specific shop,
     * respecting player shop/item permissions and availability windows.
     *
     * @param player  Player context for permission checks (nullable)
     * @param shopKey The unique key of the shop
     * @param item    The exact shop item from that shop
     * @return current sell price, or null if not sellable/accessible
     */
    Double getItemSellPrice(Player player, String shopKey, ShopItem item);

    /**
     * Finds the best current buy offer for an item across all shops the player can access.
     *
     * @param player Player context for permission checks (nullable)
     * @param stack  Item to match against shop entries
     * @return best buy offer, or null if no accessible buy entry exists
     */
    PriceLookupResult getBestBuyOffer(Player player, ItemStack stack);

    /**
     * Finds the best current sell offer for an item across all shops the player can access.
     *
     * @param player Player context for permission checks (nullable)
     * @param stack  Item to match against shop entries
     * @return best sell offer, or null if no accessible sell entry exists
     */
    PriceLookupResult getBestSellOffer(Player player, ItemStack stack);
}
