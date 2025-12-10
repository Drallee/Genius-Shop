package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ItemUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SellMenu implements Listener {

    private final ShopPlugin plugin;

    public SellMenu(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /* ============================================================
     *  OPEN SELL MENU FOR SHOP ITEM
     * ============================================================ */
    public static void open(Player player, ShopItem item, String shopKey, int shopPage) {

        Double sellPrice = item.getSellPrice();
        if (sellPrice == null || sellPrice <= 0) {
            player.sendMessage(ShopPlugin.getInstance().getMessages().getMessage("cannot-sell"));
            return;
        }

        int owned = countPlayerItems(player, item.getMaterial(), item.getSpawnerType(), item.getPotionType(), item.getEnchantments(), item.getName(), item.getLore(), item.requiresName(), item.requiresLore());
        if (owned <= 0) {
            // NEW: Do NOT open the menu if player owns none
            String msg = ShopPlugin.getInstance().getMessages()
                    .getMessage("no-items-to-sell")
                    .replace("%item%", item.getName() != null ? item.getName() : item.getMaterial().name());
            player.sendMessage(ItemUtil.color(msg));
            return;
        }

        open(
                player,
                item.getMaterial(),
                sellPrice,
                1,
                item.getSpawnerType(),
                item.getPotionType(),
                item.getEnchantments(),
                item.getName(),
                item.getLore(),
                item.shouldHideAttributes(),
                item.shouldHideAdditional(),
                item.requiresName(),
                item.requiresLore(),
                shopKey,
                shopPage
        );
    }

    /* ============================================================
     *  OPEN SELL MENU (INTERNAL)
     * ============================================================ */
    public static void open(
            Player player,
            Material material,
            Double sellPrice,
            int amount,
            String spawnerType,
            String potionType,
            Map<String, Integer> enchantments,
            String customName,
            List<String> customLore,
            boolean hideAttributes,
            boolean hideAdditional,
            boolean requireName,
            boolean requireLore,
            String shopKey,
            int shopPage
    ) {
        ShopPlugin plugin = ShopPlugin.getInstance();

        FileConfiguration guiCfg = plugin.getMenuManager().getSellMenuConfig();

        String currency = plugin.getCurrencySymbol();

        String titlePrefix = plugin.getMessages().getGuiString("sell.title-prefix", "&8Selling ");
        String title = ItemUtil.color(titlePrefix + customName);
        Inventory inv = Bukkit.createInventory(player, 54, title);

        int owned = countPlayerItems(player, material, spawnerType, potionType, enchantments, customName, customLore, requireName, requireLore);
        if (amount > owned) amount = owned;

        List<String> lore = new ArrayList<>();
        if (customLore != null) {
            for (String line : customLore) {
                lore.add(ItemUtil.color(line));
            }
            lore.add("");
        }

        lore.add(plugin.getMessages().getGuiString("sell.selected-amount", "&eSelected amount: &7") + amount);
        lore.add(plugin.getMessages().getGuiString("sell.sell-price", "&eSell price: &7") + currency + sellPrice);
        lore.add(plugin.getMessages().getGuiString("sell.you-own", "&eYou own: &7") + owned);

        if (spawnerType != null && !spawnerType.isEmpty()) {
            lore.add(plugin.getMessages().getGuiString("sell.spawner", "&7Spawner: &e") + spawnerType);
        }
        lore.add("");

        String finalName = customName != null ? ItemUtil.color(customName) : null;
        ItemStack display = ItemUtil.create(material, amount > 0 ? amount : 1, finalName, lore);

        // NEW FLAGS
        ItemMeta meta = display.getItemMeta();
        if (hideAttributes) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
        if (hideAdditional) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
        display.setItemMeta(meta);

        int displaySlot = plugin.getMenuManager().getSellMenuConfig().getInt("display-slot", 22);
        inv.setItem(displaySlot, display);

        /* Buttons - using nested gui.yml structure */
        String confirmName = guiCfg.getString("buttons.confirm.name", "&aCONFIRM SELL");
        String sellAllName = guiCfg.getString("buttons.sell-all.name", "&6SELL ALL");
        
        // Get shop name for placeholders
        String shopName = "Categories";
        if (shopKey != null && !shopKey.isEmpty()) {
            ShopData shopData = plugin.getShopManager().getShop(shopKey);
            if (shopData != null) {
                shopName = ItemUtil.color(shopData.getGuiName());
            }
        }
        
        String backName = guiCfg.getString("buttons.back.name", "&9BACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancelName = guiCfg.getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Get materials from config
        Material addMaterial = Material.valueOf(guiCfg.getString("buttons.add.material", "LIME_STAINED_GLASS_PANE"));
        Material remMaterial = Material.valueOf(guiCfg.getString("buttons.remove.material", "RED_STAINED_GLASS_PANE"));
        Material setMaterial = Material.valueOf(guiCfg.getString("buttons.set.material", "YELLOW_STAINED_GLASS_PANE"));
        Material confirmMaterial = Material.valueOf(guiCfg.getString("buttons.confirm.material", "LIME_STAINED_GLASS"));
        Material sellAllMaterial = Material.valueOf(guiCfg.getString("buttons.sell-all.material", "GOLD_BLOCK"));
        Material backMaterial = Material.valueOf(guiCfg.getString("buttons.back.material", "ENDER_CHEST"));
        Material cancelMaterial = Material.valueOf(guiCfg.getString("buttons.cancel.material", "RED_STAINED_GLASS"));

        // Get slots from config
        int confirmSlot = guiCfg.getInt("buttons.confirm.slot", 48);
        int sellAllSlot = guiCfg.getInt("buttons.sell-all.slot", 40);
        int backSlot = guiCfg.getInt("buttons.back.slot", 49);
        int cancelSlot = guiCfg.getInt("buttons.cancel.slot", 50);

        int maxAmount = guiCfg.getInt("max-amount", 2304);
        int effectiveMax = Math.min(owned, maxAmount);

        // Dynamic add buttons
        if (amount < effectiveMax) {
            var addSection = guiCfg.getConfigurationSection("buttons.add");
            if (addSection != null) {
                for (String key : addSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String name = guiCfg.getString("buttons.add." + key + ".name", "&aAdd " + value);
                        int slot = guiCfg.getInt("buttons.add." + key + ".slot", -1);
                        if (slot >= 0 && slot < 54) {
                            inv.setItem(slot, ItemUtil.create(addMaterial, 1, name, null));
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // Dynamic remove buttons
        if (amount > 1) {
            var removeSection = guiCfg.getConfigurationSection("buttons.remove");
            if (removeSection != null) {
                for (String key : removeSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String name = guiCfg.getString("buttons.remove." + key + ".name", "&cRemove " + value);
                        int slot = guiCfg.getInt("buttons.remove." + key + ".slot", -1);
                        if (slot >= 0 && slot < 54) {
                            if (amount > value || value == 1) {
                                inv.setItem(slot, ItemUtil.create(remMaterial, 1, name, null));
                            }
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // Dynamic set buttons
        var setSection = guiCfg.getConfigurationSection("buttons.set");
        if (setSection != null) {
            for (String key : setSection.getKeys(false)) {
                if (key.equals("material")) continue;
                try {
                    int value = Integer.parseInt(key);
                    String name = guiCfg.getString("buttons.set." + key + ".name", "&aSet to " + value);
                    int slot = guiCfg.getInt("buttons.set." + key + ".slot", -1);
                    if (slot >= 0 && slot < 54) {
                        if (value != amount && value <= effectiveMax) {
                            inv.setItem(slot, ItemUtil.create(setMaterial, 1, name, null));
                        }
                    }
                } catch (NumberFormatException ignored) {}
            }
        }

        // Confirm button with lore
        List<String> confirmLore = guiCfg.getStringList("buttons.confirm.lore");
        List<String> confirmLoreColored = new ArrayList<>();
        for (String line : confirmLore) {
            confirmLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(confirmSlot, ItemUtil.create(confirmMaterial, 1, confirmName, confirmLoreColored.isEmpty() ? null : confirmLoreColored));

        // Sell All button with lore
        if (owned > 0) {
            List<String> sellAllLore = guiCfg.getStringList("buttons.sell-all.lore");
            List<String> sellAllLoreColored = new ArrayList<>();
            for (String line : sellAllLore) {
                sellAllLoreColored.add(ItemUtil.color(line
                        .replace("%shop%", shopName)
                        .replace("%page%", String.valueOf(shopPage))
                        .replace("%max%", String.valueOf(effectiveMax))));
            }
            inv.setItem(sellAllSlot, ItemUtil.create(sellAllMaterial, 1, sellAllName, sellAllLoreColored.isEmpty() ? null : sellAllLoreColored));
        }

        // Back button with lore
        List<String> backLore = guiCfg.getStringList("buttons.back.lore");
        List<String> backLoreColored = new ArrayList<>();
        for (String line : backLore) {
            backLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(backSlot, ItemUtil.create(backMaterial, 1, backName, backLoreColored.isEmpty() ? null : backLoreColored));

        // Cancel button with lore
        List<String> cancelLore = guiCfg.getStringList("buttons.cancel.lore");
        List<String> cancelLoreColored = new ArrayList<>();
        for (String line : cancelLore) {
            cancelLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(cancelSlot, ItemUtil.create(cancelMaterial, 1, cancelName, cancelLoreColored.isEmpty() ? null : cancelLoreColored));

        player.openInventory(inv);

        /* Metadata storage */
        player.setMetadata("sell.material", new FixedMetadataValue(plugin, material.name()));
        player.setMetadata("sell.price", new FixedMetadataValue(plugin, sellPrice));
        player.setMetadata("sell.amount", new FixedMetadataValue(plugin, amount));
        player.setMetadata("sell.hide_attr", new FixedMetadataValue(plugin, hideAttributes));
        player.setMetadata("sell.hide_add", new FixedMetadataValue(plugin, hideAdditional));

        if (spawnerType != null)
            player.setMetadata("sell.spawnerType", new FixedMetadataValue(plugin, spawnerType));
        else
            player.removeMetadata("sell.spawnerType", plugin);

        if (potionType != null)
            player.setMetadata("sell.potionType", new FixedMetadataValue(plugin, potionType));
        else
            player.removeMetadata("sell.potionType", plugin);

        if (enchantments != null && !enchantments.isEmpty())
            player.setMetadata("sell.enchantments", new FixedMetadataValue(plugin, enchantments));
        else
            player.removeMetadata("sell.enchantments", plugin);

        if (customName != null)
            player.setMetadata("sell.customName", new FixedMetadataValue(plugin, customName));
        else
            player.removeMetadata("sell.customName", plugin);

        if (customLore != null && !customLore.isEmpty())
            player.setMetadata("sell.customLore", new FixedMetadataValue(plugin, String.join("\n", customLore)));
        else
            player.removeMetadata("sell.customLore", plugin);

        player.setMetadata("sell.requireName", new FixedMetadataValue(plugin, requireName));
        player.setMetadata("sell.requireLore", new FixedMetadataValue(plugin, requireLore));

        // Store shop context for back button
        if (shopKey != null && !shopKey.isEmpty()) {
            player.setMetadata("sell.shopKey", new FixedMetadataValue(plugin, shopKey));
            player.setMetadata("sell.shopPage", new FixedMetadataValue(plugin, shopPage));
        }
    }

    /* ============================================================
     *  CLICK HANDLER
     * ============================================================ */
    @EventHandler
    public void onClick(InventoryClickEvent e) {

        if (!(e.getWhoClicked() instanceof Player)) return;
        Player player = (Player) e.getWhoClicked();

        String titlePrefix = ShopPlugin.getInstance().getMessages().getGuiString("sell.title-prefix", "&8Selling ");
        if (!e.getView().getTitle().startsWith(ItemUtil.color(titlePrefix))) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null) return;

        ShopPlugin plugin = ShopPlugin.getInstance();
        String currency = plugin.getCurrencySymbol();

        String materialName = getMeta(player, "sell.material", "DIRT");
        double sellPrice = getMetaDouble(player, "sell.price", 0.0);
        int amount = getMetaInt(player, "sell.amount", 1);
        String spawnerType = getMeta(player, "sell.spawnerType", null);
        String potionType = getMeta(player, "sell.potionType", null);
        Map<String, Integer> enchantments = null;
        if (player.hasMetadata("sell.enchantments")) {
            enchantments = (Map<String, Integer>) player.getMetadata("sell.enchantments").get(0).value();
        }
        String customName = getMeta(player, "sell.customName", null);
        boolean hideAttr = getMetaBool(player, "sell.hide_attr");
        boolean hideAdd = getMetaBool(player, "sell.hide_add");
        boolean requireName = getMetaBool(player, "sell.requireName");
        boolean requireLore = getMetaBool(player, "sell.requireLore");

        // Restore lore if present
        List<String> customLore = null;
        if (player.hasMetadata("sell.customLore")) {
            String packed = player.getMetadata("sell.customLore").get(0).asString();
            customLore = java.util.Arrays.asList(packed.split("\n"));
        }

        Material material = Material.matchMaterial(materialName);
        if (material == null) material = Material.DIRT;

        String name = clicked.hasItemMeta() && clicked.getItemMeta().hasDisplayName()
                ? clicked.getItemMeta().getDisplayName()
                : "";

        /* Button names - using nested gui.yml structure */
        FileConfiguration guiCfg = plugin.getMenuManager().getSellMenuConfig();
        String confirmName = guiCfg.getString("buttons.confirm.name", "&aCONFIRM SELL");
        String sellAllName = guiCfg.getString("buttons.sell-all.name", "&6SELL ALL");
        
        // Get shop name for placeholders
        String shopKey = player.hasMetadata("sell.shopKey") ? player.getMetadata("sell.shopKey").get(0).asString() : null;
        int shopPage = player.hasMetadata("sell.shopPage") ? player.getMetadata("sell.shopPage").get(0).asInt() : 1;
        String shopName = "Categories";
        if (shopKey != null && !shopKey.isEmpty()) {
            ShopData shopData = plugin.getShopManager().getShop(shopKey);
            if (shopData != null) {
                shopName = ItemUtil.color(shopData.getGuiName());
            }
        }
        
        String backName = guiCfg.getString("buttons.back.name", "&9BACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancelName = guiCfg.getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Load configured materials
        Material addMat = Material.valueOf(guiCfg.getString("buttons.add.material", "LIME_STAINED_GLASS_PANE"));
        Material remMat = Material.valueOf(guiCfg.getString("buttons.remove.material", "RED_STAINED_GLASS_PANE"));
        Material setMat = Material.valueOf(guiCfg.getString("buttons.set.material", "RED_STAINED_GLASS_PANE"));
        Material confirmMat = Material.valueOf(guiCfg.getString("buttons.confirm.material", "LIME_STAINED_GLASS"));
        Material cancelMat = Material.valueOf(guiCfg.getString("buttons.cancel.material", "RED_STAINED_GLASS"));
        Material sellAllMat = Material.valueOf(guiCfg.getString("buttons.sell-all.material", "GOLD_BLOCK"));
        Material backMat = Material.valueOf(guiCfg.getString("buttons.back.material", "ENDER_CHEST"));

        int maxAmount = guiCfg.getInt("max-amount", 2304);
        int owned = countPlayerItems(player, material, spawnerType, potionType, enchantments, customName, customLore, requireName, requireLore);
        if (owned <= 0) {
            String msg = plugin.getMessages().getMessage("no-items-to-sell")
                    .replace("%item%", material.name());
            player.sendMessage(ItemUtil.color(msg));
            player.closeInventory();
            return;
        }

        /* --- BUTTON ACTIONS --- */
        // Dynamic add buttons
        if (clicked.getType() == addMat) {
            var addSection = guiCfg.getConfigurationSection("buttons.add");
            if (addSection != null) {
                for (String key : addSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = guiCfg.getString("buttons.add." + key + ".name", "&aAdd " + value);
                        if (name.equals(ItemUtil.color(buttonName))) {
                            int newAmount = Math.min(amount + value, Math.min(owned, maxAmount));
                            open(player, material, sellPrice, newAmount, spawnerType, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage);
                            return;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // Dynamic remove buttons
        if (clicked.getType() == remMat) {
            var removeSection = guiCfg.getConfigurationSection("buttons.remove");
            if (removeSection != null) {
                for (String key : removeSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = guiCfg.getString("buttons.remove." + key + ".name", "&cRemove " + value);
                        if (name.equals(ItemUtil.color(buttonName))) {
                            open(player, material, sellPrice, Math.max(1, amount - value), spawnerType, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage);
                            return;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // Dynamic set buttons
        if (clicked.getType() == setMat) {
            var setSection = guiCfg.getConfigurationSection("buttons.set");
            if (setSection != null) {
                for (String key : setSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = guiCfg.getString("buttons.set." + key + ".name", "&aSet to " + value);
                        if (name.equals(ItemUtil.color(buttonName))) {
                            int newAmount = Math.max(1, Math.min(value, Math.min(owned, maxAmount)));
                            open(player, material, sellPrice, newAmount, spawnerType, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage);
                            return;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // CONFIRM SELL
        if (clicked.getType() == confirmMat &&
                name.equals(ItemUtil.color(confirmName))) {

            sellItems(player, material, spawnerType, potionType, enchantments, amount, sellPrice, customName, customLore, hideAttr, hideAdd, requireName, requireLore);
            return;
        }

        // SELL ALL
        if (clicked.getType() == sellAllMat &&
                name.equals(ItemUtil.color(sellAllName))) {

            int sellAmount = Math.min(owned, maxAmount);
            sellItems(player, material, spawnerType, potionType, enchantments, sellAmount, sellPrice, customName, customLore, hideAttr, hideAdd, requireName, requireLore);
            return;
        }

        // BACK
        if (clicked.getType() == backMat &&
                name.equals(ItemUtil.color(backName))) {

            // Return to shop if context exists, otherwise main menu
            if (shopKey != null) {
                plugin.getGenericShopGui().openShop(player, shopKey, shopPage);
            } else {
                MainMenu.open(player);
            }
            return;
        }

        // CANCEL
        if (clicked.getType() == cancelMat &&
                name.equals(ItemUtil.color(cancelName))) {

            // Return to shop if context exists, otherwise close
            if (shopKey != null) {
                plugin.getGenericShopGui().openShop(player, shopKey, shopPage);
            } else {
                player.closeInventory();
            }
            return;
        }
    }

    private static Material getMaterial(String path, Material def) {
        String name = ShopPlugin.getInstance().getGuiConfig().getString(path);
        if (name == null) return def;
        Material mat = Material.matchMaterial(name);
        return mat != null ? mat : def;
    }

    /* ============================================================
     *  SELL LOGIC
     * ============================================================ */
    private void sellItems(Player player, Material material, String spawnerType, String potionType,
                           Map<String, Integer> enchantments, int amount, double sellPrice, String customName,
                           List<String> customLore, boolean hideAttr, boolean hideAdd, boolean requireName, boolean requireLore) {

        int owned = countPlayerItems(player, material, spawnerType, potionType, enchantments, customName, customLore, requireName, requireLore);
        ShopPlugin plugin = ShopPlugin.getInstance();
        plugin.debug("Sell attempt: " + player.getName() + " selling " + amount + "x " + material + " (owns: " + owned + ")");

        if (owned < amount) {
            plugin.debug("Sell failed: Player doesn't have enough items");
            // Re-color the final message so %item% color codes work
            String msg = plugin.getMessages()
                    .getMessage("no-items-to-sell")
                    .replace("%item%", material.name());
            player.sendMessage(ItemUtil.color(msg));
            return;
        }

        removeItems(player, material, spawnerType, potionType, enchantments, amount, customName, customLore, requireName, requireLore);

        double total = sellPrice * amount;

        EconomyHook eco = plugin.getEconomy();

        if (eco.isReady()) {
            eco.deposit(player, total);
        }

        plugin.itemsSold++;
        plugin.debug("Sell successful: " + player.getName() + " sold " + amount + "x " + material + " for $" + total);

        // Send Discord webhook notification
        String itemDisplayName = customName != null ? customName : material.name();
        plugin.getDiscordWebhook().sendSellNotification(
                player.getName(),
                itemDisplayName,
                amount,
                total,
                plugin.getCurrencySymbol()
        );

        String itemName = customName != null ? customName.replace("&", "§") : material.name();
        String currency = plugin.getCurrencySymbol();

        String msg = plugin.getMessages().getMessage("sell-success")
                .replace("%amount%", String.valueOf(amount))
                .replace("%item%", itemName)
                .replace("%price%", currency + total);

        player.sendMessage(ItemUtil.color(msg));

        // Refresh the menu so "You own: X" updates
        // We recalculate amount to ensure it doesn't exceed new owned count
        int newOwned = countPlayerItems(player, material, spawnerType, potionType, enchantments, customName, customLore, requireName, requireLore);
        int newAmount = Math.min(amount, newOwned);
        if (newAmount <= 0) newAmount = 1; // Default to 1 if they sold everything, just for display

        String shopKey = player.hasMetadata("sell.shopKey") ? player.getMetadata("sell.shopKey").get(0).asString() : null;
        int shopPage = player.hasMetadata("sell.shopPage") ? player.getMetadata("sell.shopPage").get(0).asInt() : 1;
        open(player, material, sellPrice, newAmount, spawnerType, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage);
    }

    /* ============================================================
     *  UTILITIES
     * ============================================================ */
    private static int countPlayerItems(Player player, Material material, String spawnerType, String potionType, Map<String, Integer> enchantments, String customName, List<String> customLore, boolean requireName, boolean requireLore) {
        int count = 0;
        for (ItemStack it : player.getInventory().getContents()) {
            if (it == null || it.getType() != material) continue;

            if (material == Material.SPAWNER && spawnerType != null) {
                if (!spawnerMatches(it, spawnerType)) continue;
            }

            if ((material == Material.POTION || material == Material.SPLASH_POTION ||
                 material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW) && potionType != null) {
                if (!potionMatches(it, potionType)) continue;
            }

            if (enchantments != null && !enchantments.isEmpty()) {
                if (!enchantmentsMatch(it, enchantments)) continue;
            }

            // Check custom name if enabled
            if (requireName && customName != null) {
                if (!nameMatches(it, customName)) continue;
            }

            // Check custom lore if enabled
            if (requireLore && customLore != null && !customLore.isEmpty()) {
                if (!loreMatches(it, customLore)) continue;
            }

            count += it.getAmount();
        }
        return count;
    }

    private static boolean spawnerMatches(ItemStack it, String type) {
        if (!(it.getItemMeta() instanceof BlockStateMeta)) return false;
        BlockStateMeta meta = (BlockStateMeta) it.getItemMeta();
        if (!(meta.getBlockState() instanceof CreatureSpawner)) return false;
        CreatureSpawner cs = (CreatureSpawner) meta.getBlockState();
        return cs.getSpawnedType().name().equalsIgnoreCase(type);
    }

    private static boolean potionMatches(ItemStack it, String type) {
        if (!(it.getItemMeta() instanceof org.bukkit.inventory.meta.PotionMeta)) return false;
        org.bukkit.inventory.meta.PotionMeta meta = (org.bukkit.inventory.meta.PotionMeta) it.getItemMeta();
        org.bukkit.potion.PotionType potionType = meta.getBasePotionType();
        return potionType != null && potionType.name().equalsIgnoreCase(type);
    }

    private static boolean enchantmentsMatch(ItemStack it, Map<String, Integer> requiredEnchants) {
        if (!it.hasItemMeta() || requiredEnchants == null || requiredEnchants.isEmpty()) return false;

        ItemMeta meta = it.getItemMeta();
        if (!meta.hasEnchants()) return false;

        // Check each required enchantment
        for (Map.Entry<String, Integer> entry : requiredEnchants.entrySet()) {
            String enchantName = entry.getKey();
            int requiredLevel = entry.getValue();

            org.bukkit.enchantments.Enchantment enchant = org.bukkit.enchantments.Enchantment.getByName(enchantName.toUpperCase());
            if (enchant == null) continue;

            int itemLevel = meta.getEnchantLevel(enchant);
            if (itemLevel != requiredLevel) return false;
        }

        return true;
    }

    private static boolean nameMatches(ItemStack it, String requiredName) {
        if (!it.hasItemMeta()) return false;
        ItemMeta meta = it.getItemMeta();
        if (!meta.hasDisplayName()) return false;
        String itemName = meta.getDisplayName();
        String coloredRequiredName = ItemUtil.color(requiredName);
        return itemName.equals(coloredRequiredName);
    }

    private static boolean loreMatches(ItemStack it, List<String> requiredLore) {
        if (!it.hasItemMeta()) return false;
        ItemMeta meta = it.getItemMeta();
        if (!meta.hasLore()) return false;
        List<String> itemLore = meta.getLore();
        if (itemLore == null || itemLore.size() != requiredLore.size()) return false;

        // Check each lore line matches
        for (int i = 0; i < requiredLore.size(); i++) {
            String coloredRequired = ItemUtil.color(requiredLore.get(i));
            if (!itemLore.get(i).equals(coloredRequired)) return false;
        }

        return true;
    }

    private static void removeItems(Player player, Material material, String spawnerType, String potionType, Map<String, Integer> enchantments, int amount, String customName, List<String> customLore, boolean requireName, boolean requireLore) {
        int toRemove = amount;
        for (int i = 0; i < player.getInventory().getSize(); i++) {
            ItemStack it = player.getInventory().getItem(i);
            if (it == null || it.getType() != material) continue;

            if (material == Material.SPAWNER && spawnerType != null) {
                if (!spawnerMatches(it, spawnerType)) continue;
            }

            if ((material == Material.POTION || material == Material.SPLASH_POTION ||
                 material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW) && potionType != null) {
                if (!potionMatches(it, potionType)) continue;
            }

            if (enchantments != null && !enchantments.isEmpty()) {
                if (!enchantmentsMatch(it, enchantments)) continue;
            }

            // Check custom name if enabled
            if (requireName && customName != null) {
                if (!nameMatches(it, customName)) continue;
            }

            // Check custom lore if enabled
            if (requireLore && customLore != null && !customLore.isEmpty()) {
                if (!loreMatches(it, customLore)) continue;
            }

            int stack = it.getAmount();
            if (stack <= toRemove) {
                player.getInventory().setItem(i, null);
                toRemove -= stack;
            } else {
                it.setAmount(stack - toRemove);
                toRemove = 0;
            }

            if (toRemove <= 0) break;
        }
    }

    /* ============================================================
     *  METADATA HELPERS
     * ============================================================ */
    private String getMeta(Player p, String key, String def) {
        return p.hasMetadata(key) ? p.getMetadata(key).get(0).asString() : def;
    }
    private int getMetaInt(Player p, String key, int def) {
        return p.hasMetadata(key) ? p.getMetadata(key).get(0).asInt() : def;
    }
    private double getMetaDouble(Player p, String key, double def) {
        return p.hasMetadata(key) ? p.getMetadata(key).get(0).asDouble() : def;
    }
    private boolean getMetaBool(Player p, String key) {
        return p.hasMetadata(key) && p.getMetadata(key).get(0).asBoolean();
    }
}
