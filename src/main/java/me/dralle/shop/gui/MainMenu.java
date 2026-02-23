package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainMenu implements Listener {

    public static class MainMenuHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

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
            Inventory fallback = Bukkit.createInventory(player, 27, ShopItemUtil.color("&8Shop Menu"));
            player.openInventory(fallback);
            return;
        }

        String rawTitle = mainConfig.getString("title", "&8Shop Menu");
        String title = me.dralle.shop.util.BedrockUtil.formatTitle(player, plugin.getMessages().color(rawTitle));

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

        Inventory inv = Bukkit.createInventory(new MainMenuHolder(), size, title);

        ConfigurationSection itemsSec = mainConfig.getConfigurationSection("items");
        if (itemsSec != null) {
            for (String key : itemsSec.getKeys(false)) {
                ConfigurationSection itemSec = itemsSec.getConfigurationSection(key);
                if (itemSec == null) continue;

                // Permission check
                String permission = itemSec.getString("permission", "");
                if (permission != null && !permission.isEmpty()) {
                    if (!player.hasPermission(permission)) continue;
                }

                int slot = itemSec.getInt("slot", -1);
                if (slot < 0 || slot >= size) continue;

                String matName = itemSec.getString("material", "BARRIER");
                Material mat = Material.matchMaterial(matName);
                if (mat == null) mat = Material.BARRIER;

                String name = itemSec.getString("name", key);
                List<String> loreRaw = itemSec.getStringList("lore");
                List<String> lore = new ArrayList<>();
                List<String> latestHighlights = plugin.getUpdateChecker() != null
                        ? plugin.getUpdateChecker().getLatestReleaseHighlights()
                        : java.util.Collections.emptyList();
                boolean hasHighlightsPlaceholder = false;
                
// Get shop key to check for available times
                String shopKey = itemSec.getString("shop-key", null);
                String availableTimes = "";
                if (shopKey != null) {
                    ShopData shopData = plugin.getShopManager().getShop(shopKey);
                    if (shopData != null) {
                        availableTimes = ShopTimeUtil.formatAvailableTimes(shopData.getAvailableTimes(), plugin);
                    }
                }
                
                for (String line : loreRaw) {
                    String processed = replaceAvailableTimesPlaceholder(line, availableTimes)
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

                    // Expand latest-update-highlights placeholder into multiple lore lines.
                    if (processed.contains("%latest-update-highlights%")) {
                        hasHighlightsPlaceholder = true;
                        boolean updateAvailable = plugin.getUpdateChecker() != null
                                && plugin.getUpdateChecker().isUpdateAvailable();
                        if (!updateAvailable || latestHighlights.isEmpty()) {
                            continue;
                        }

                        lore.add(ShopItemUtil.color("&7Latest update highlights:"));
                        for (String highlight : latestHighlights) {
                            lore.add(ShopItemUtil.color("&8- &f" + highlight));
                        }
                        continue;
                    }

                    // Support multiple lines if \n is present (e.g. from %available-times%)
                    lore.addAll(ShopItemUtil.splitAndColor(processed));
                }

                ItemStack item = ShopItemUtil.create(mat, 1, name, lore);
                
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
        if (!(e.getInventory().getHolder() instanceof MainMenuHolder)) return;

        ConfigurationSection mainConfig = plugin.getMenuManager().getMainMenuConfig();
        if (mainConfig == null) return;

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

        String action = clickedItem.getString("action", "").trim().toLowerCase(Locale.ROOT);
        String shopKey = clickedItem.getString("shop-key", null);
        if (action.isEmpty()) {
            if (shopKey != null && !shopKey.isEmpty()) {
                action = "shop";
            } else if (clickedItem.contains("command") || clickedItem.contains("commands")) {
                action = "command";
            }
        }

        if ("close".equals(action)) {
            player.closeInventory();
            return;
        }

        if ("command".equals(action) || "command-close".equals(action)) {
            List<String> commands = new ArrayList<>();
            String singleCommand = clickedItem.getString("command", "").trim();
            if (!singleCommand.isEmpty()) {
                commands.add(singleCommand);
            }
            commands.addAll(clickedItem.getStringList("commands"));

            if (commands.isEmpty()) {
                return;
            }

            String runAs = clickedItem.getString("run-as", "player").trim().toLowerCase(Locale.ROOT);
            for (String cmdRaw : commands) {
                if (cmdRaw == null || cmdRaw.trim().isEmpty()) continue;

                String command = cmdRaw.trim().replace("%player%", player.getName());
                if (command.startsWith("/")) {
                    command = command.substring(1);
                }
                if (command.isEmpty()) continue;

                if ("console".equals(runAs)) {
                    Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
                } else {
                    Bukkit.dispatchCommand(player, command);
                }
            }

            boolean closeAfter = "command-close".equals(action) || clickedItem.getBoolean("close-after-action", false);
            if (closeAfter) {
                player.closeInventory();
            }
            return;
        }

        // Open the linked shop
        if (("shop".equals(action) || "shop-key".equals(action)) && shopKey != null && !shopKey.isEmpty()) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop == null) {
                player.sendMessage(
                        plugin.getMessages().getMessage("shop-not-found")
                                .replace("%shop%", shopKey)
                );
                return;
            }

            // Check time restrictions
            if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) {
                String availableTimes = ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin);
                player.sendMessage(
                        plugin.getMessages()
                                .getMessage("shop-not-available")
                                .replace("%shop%", ShopItemUtil.color(shop.getGuiName()))
                                .replace("%available-times%", availableTimes)
                );
                return;
            }

            Bukkit.getScheduler().runTask(plugin, () -> plugin.getGenericShopGui().openShop(player, shopKey, 1));
            plugin.shopsOpened++;
        }
    }

    /**
     * Avoid nested gradient tags when %available-times% is wrapped by a gradient in lore.
     * If placeholder is inside a gradient tag, strip formatting from replacement first.
     */
    private static String replaceAvailableTimesPlaceholder(String line, String availableTimes) {
        if (line == null || !line.contains("%available-times%")) {
            return line;
        }
        String replacement = availableTimes == null ? "" : availableTimes;
        if (isInsideGradientTag(line, "%available-times%")) {
            replacement = stripColorFormatting(replacement);
            String openGradientTag = findEnclosingGradientOpenTag(line, "%available-times%");
            if (openGradientTag != null && replacement.contains("\n")) {
                // Prevent gradients from spanning raw newlines by closing/reopening per line.
                replacement = replacement.replace("\n", "</gradient>\n" + openGradientTag);
            }
        }
        return line.replace("%available-times%", replacement);
    }

    private static boolean isInsideGradientTag(String line, String token) {
        int tokenIndex = line.indexOf(token);
        if (tokenIndex < 0) return false;

        int lastOpen = line.lastIndexOf("<gradient:", tokenIndex);
        if (lastOpen < 0) return false;

        int lastClose = line.lastIndexOf("</gradient>", tokenIndex);
        return lastOpen > lastClose;
    }

    private static String findEnclosingGradientOpenTag(String line, String token) {
        int tokenIndex = line.indexOf(token);
        if (tokenIndex < 0) return null;

        int lastOpen = line.lastIndexOf("<gradient:", tokenIndex);
        if (lastOpen < 0) return null;

        int openEnd = line.indexOf('>', lastOpen);
        if (openEnd < 0 || openEnd > tokenIndex) return null;

        int closeAfter = line.indexOf("</gradient>", tokenIndex);
        if (closeAfter < 0) return null;

        return line.substring(lastOpen, openEnd + 1);
    }

    private static String stripColorFormatting(String input) {
        if (input == null || input.isEmpty()) return "";

        String plain = input
                .replaceAll("(?i)</?gradient(?::[^>]*)?>", "")
                .replaceAll("(?i)&#[A-F0-9]{6}", "")
                .replaceAll("(?i)[&§][0-9A-FK-ORX]", "")
                .replace("Â§", "§")
                .replaceAll("(?i)§x(§[0-9A-F]){6}", "");
        return plain;
    }
}
