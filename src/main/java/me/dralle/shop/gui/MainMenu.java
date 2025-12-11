package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.util.ItemUtil;
import me.dralle.shop.util.TimeRestrictionUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MainMenu implements Listener {

    private final ShopPlugin plugin;

    public MainMenu(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Opens the main shop menu for a player.
     * Uses main-menu.yml from menus/ folder
     */
    public static void open(Player player) {
        ShopPlugin plugin = ShopPlugin.getInstance();

        ConfigurationSection mainConfig = plugin.getMenuManager().getMainMenuConfig();
        if (mainConfig == null) {
            // very small fallback if main-menu.yml is broken
            Inventory fallback = Bukkit.createInventory(player, 27, ItemUtil.color("&8Shop Menu"));
            player.openInventory(fallback);
            return;
        }

        String rawTitle = mainConfig.getString("title", "&8Shop Menu");
        String title = plugin.getMessages().color(rawTitle);

        // Support both 'rows' and 'size' config (rows = number of rows, size = total slots)
        int size;
        if (mainConfig.contains("rows")) {
            int rows = mainConfig.getInt("rows", 3);
            rows = Math.min(Math.max(rows, 1), 6); // Clamp between 1-6
            size = rows * 9;
        } else {
            // Backward compatibility with 'size'
            size = mainConfig.getInt("size", 27);
            if (size < 9) size = 9;
            if (size > 54) size = 54;
            if (size % 9 != 0) size = 27;
        }

        Inventory inv = Bukkit.createInventory(player, size, title);

        ConfigurationSection itemsSec = mainConfig.getConfigurationSection("items");
        if (itemsSec != null) {
            for (String key : itemsSec.getKeys(false)) {
                ConfigurationSection itemSec = itemsSec.getConfigurationSection(key);
                if (itemSec == null) continue;

                int slot = itemSec.getInt("slot", -1);
                if (slot < 0 || slot >= size) continue;

                String matName = itemSec.getString("material", "BARRIER");
                Material mat = Material.matchMaterial(matName);
                if (mat == null) mat = Material.BARRIER;

                String name = itemSec.getString("name", key);
                List<String> loreRaw = itemSec.getStringList("lore");
                List<String> lore = new ArrayList<>();
                
                // Get shop key to check for available times
                String shopKey = itemSec.getString("shop-key", null);
                String availableTimes = "";
                if (shopKey != null) {
                    ShopData shopData = plugin.getShopManager().getShop(shopKey);
                    if (shopData != null) {
                        availableTimes = TimeRestrictionUtil.formatAvailableTimes(shopData.getAvailableTimes(), plugin);
                    }
                }
                
                for (String line : loreRaw) {
                    String processed = line
                            .replace("%available-times%", availableTimes)
                            .replace("%version%", plugin.getDescription().getVersion());

                    // Handle update-available placeholder
                    if (processed.contains("%update-available%")) {
                        if (plugin.getUpdateChecker() != null && plugin.getUpdateChecker().isUpdateAvailable()) {
                            processed = processed.replace("%update-available%",
                                    "&4&l⚠ &cNew version available: &e" + plugin.getUpdateChecker().getLatestVersion());
                        } else {
                            // Skip this line if no update is available
                            continue;
                        }
                    }

                    lore.add(plugin.getMessages().color(processed));
                }

                ItemStack item = ItemUtil.create(mat, 1, name, lore);
                
                // Apply item flags if specified
                ItemMeta meta = item.getItemMeta();
                if (meta != null) {
                    boolean hideAttributes = itemSec.getBoolean("hide-attributes", false);
                    boolean hideAdditional = itemSec.getBoolean("hide-additional", false);
                    
                    if (hideAttributes) {
                        meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
                    }
                    if (hideAdditional) {
                        meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
                    }
                    
                    item.setItemMeta(meta);
                }

                inv.setItem(slot, item);
            }
        }

        player.openInventory(inv);
    }

    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;

        // Check that this is the main menu by matching title
        ConfigurationSection mainConfig = plugin.getMenuManager().getMainMenuConfig();
        if (mainConfig == null) return;

        String expectedTitle = plugin.getMessages().color(
                mainConfig.getString("title", "&8Shop Menu")
        );
        if (!e.getView().getTitle().equals(expectedTitle)) return;

        e.setCancelled(true);
        if (e.getCurrentItem() == null || e.getCurrentItem().getType() == Material.AIR) return;

        int clickedSlot = e.getSlot();

        ConfigurationSection itemsSec = mainConfig.getConfigurationSection("items");
        if (itemsSec == null) return;

        // Map slot -> item section
        Map<Integer, ConfigurationSection> slotToItem = new LinkedHashMap<>();
        for (String key : itemsSec.getKeys(false)) {
            ConfigurationSection itemSec = itemsSec.getConfigurationSection(key);
            if (itemSec == null) continue;
            int slot = itemSec.getInt("slot", -1);
            if (slot < 0) continue;
            slotToItem.put(slot, itemSec);
        }

        if (!slotToItem.containsKey(clickedSlot)) return;

        ConfigurationSection clickedItem = slotToItem.get(clickedSlot);

        // Optional per-button permission (from gui.yml)
        String buttonPermission = clickedItem.getString("permission", "");
        if (buttonPermission != null && !buttonPermission.isEmpty()) {
            if (!player.hasPermission(buttonPermission)) {
                player.sendMessage(plugin.getMessages().getMessage("no-permission"));
                return;
            }
        }

        // Open the linked shop
        String shopKey = clickedItem.getString("shop-key", null);
        if (shopKey != null && !shopKey.isEmpty()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null) {
                player.sendMessage(
                        plugin.getMessages().getMessage("shop-not-found")
                                .replace("%shop%", shopKey)
                );
                return;
            }

            // Check time restrictions
            if (!TimeRestrictionUtil.isShopAvailable(shop.getAvailableTimes())) {
                String availableTimes = TimeRestrictionUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);
                player.sendMessage(
                        plugin.getMessages()
                                .getMessage("shop-not-available")
                                .replace("%shop%", ItemUtil.color(shop.getGuiName()))
                                .replace("%available-times%", availableTimes)
                );
                return;
            }

            plugin.getGenericShopGui().openShop(player, shopKey, 1);
            plugin.shopsOpened++;
        }
    }
}
