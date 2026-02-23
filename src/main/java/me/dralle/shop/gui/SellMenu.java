package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class SellMenu implements Listener {

    public static class SellHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

    private final ShopPlugin plugin;

    public SellMenu(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    /* ============================================================
     *  OPEN SELL MENU FOR SHOP ITEM
     * ============================================================ */
    public static void open(Player player, ShopItem item, String shopKey, int shopPage) {
        ShopPlugin plugin = ShopPlugin.getInstance();
        if (item.getHeadTexture() != null && !item.getHeadTexture().isEmpty()) {
            player.setMetadata("sell.headTexture", new FixedMetadataValue(plugin, item.getHeadTexture()));
        } else {
            player.removeMetadata("sell.headTexture", plugin);
        }
        if (item.getHeadOwner() != null && !item.getHeadOwner().isEmpty()) {
            player.setMetadata("sell.headOwner", new FixedMetadataValue(plugin, item.getHeadOwner()));
        } else {
            player.removeMetadata("sell.headOwner", plugin);
        }

        Double sellPrice = item.getSellPrice();
        if (sellPrice == null || sellPrice <= 0) {
            player.sendMessage(ShopPlugin.getInstance().getMessages().getMessage("cannot-sell"));
            return;
        }

        double currentSellPrice = calculateSellPrice(item);

        int owned = countPlayerItems(player, item.getMaterial(), item.getSpawnerType(), item.getSpawnerItem(), item.getPotionType(), item.getEnchantments(), item.getName(), item.getLore(), item.requiresName(), item.requiresLore());
        if (owned <= 0) {
            String msg = ShopPlugin.getInstance().getMessages()
                    .getMessage("no-items-to-sell")
                    .replace("%item%", item.getName() != null ? item.getName() : item.getMaterial().name());
            player.sendMessage(ShopItemUtil.color(msg));
            return;
        }

        open(
                player,
                item.getMaterial(),
                currentSellPrice,
                1,
                item.getSpawnerType(),
                item.getSpawnerItem(),
                item.getPotionType(),
                item.getEnchantments(),
                item.getName(),
                item.getLore(),
                item.shouldHideAttributes(),
                item.shouldHideAdditional(),
                item.requiresName(),
                item.requiresLore(),
                shopKey,
                shopPage,
                item.getUniqueKey(),
                item.getLimit(),
                item.getGlobalLimit(),
                item.isDynamicPricing(),
                item.getMinPrice(),
                item.getMaxPrice(),
                item.getPriceChange(),
                item.getPermission()
        );
    }

    private static double calculateSellPrice(ShopItem item) {
        if (!item.isDynamicPricing() || item.getSellPrice() == null) return item.getSellPrice() != null ? item.getSellPrice() : 0;

        int globalCount = ShopPlugin.getInstance().getDataManager().getGlobalCount(item.getUniqueKey());
        // For selling, we also use the same globalCount.
        // If globalCount is high (many bought), price is high.
        // Selling should decrease globalCount.
        double currentPrice = item.getSellPrice() + (globalCount * item.getPriceChange());

        // We might want to use a different min/max for selling, but for now we use the same or just clamp to positive.
        if (currentPrice < 0.01) currentPrice = 0.01;

        return currentPrice;
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
            String spawnerItem,
            String potionType,
            Map<String, Integer> enchantments,
            String customName,
            List<String> customLore,
            boolean hideAttributes,
            boolean hideAdditional,
            boolean requireName,
            boolean requireLore,
            String shopKey,
            int shopPage,
            String itemKey,
            int limit,
            int globalLimit,
            boolean dynamicPricing,
            double minPrice,
            double maxPrice,
            double priceChange,
            String permission
    ) {
        ShopPlugin plugin = ShopPlugin.getInstance();

        FileConfiguration guiCfg = plugin.getMenuManager().getSellMenuConfig();

        String titlePrefix = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.sell.title-prefix", "&8Selling ");
        String titleText = titlePrefix + (customName != null ? customName : material.name());
        String title = me.dralle.shop.util.BedrockUtil.formatTitle(player, ShopItemUtil.color(titleText));
        Inventory inv = Bukkit.createInventory(new SellHolder(), 54, title);

        int owned = countPlayerItems(player, material, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, requireName, requireLore);
        if (amount > owned) amount = owned;

        List<String> lore = new ArrayList<>();
        if (customLore != null) {
            for (String line : customLore) {
                lore.addAll(ShopItemUtil.splitAndColor(line));
            }
            lore.add("");
        }

        String selectedAmountTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.sell.selected-amount", "&eSelected amount: &7");
        String selectedAmountLine = selectedAmountTemplate.contains("%amount%")
                ? selectedAmountTemplate.replace("%amount%", String.valueOf(amount))
                : selectedAmountTemplate + amount;
        lore.addAll(ShopItemUtil.splitAndColor(selectedAmountLine));

        String sellPriceTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.sell.sell-price", "&eSell price: &7");
        String sellPriceValue = plugin.formatCurrency(sellPrice);
        String sellPriceLine = sellPriceTemplate;
        if (sellPriceLine.contains("%sell-price%")) {
            sellPriceLine = sellPriceLine.replace("%sell-price%", sellPriceValue);
        }
        if (sellPriceLine.contains("%price%")) {
            sellPriceLine = sellPriceLine.replace("%price%", sellPriceValue);
        }
        if (!sellPriceTemplate.contains("%sell-price%") && !sellPriceTemplate.contains("%price%")) {
            sellPriceLine = sellPriceTemplate + sellPriceValue;
        }
        lore.addAll(ShopItemUtil.splitAndColor(sellPriceLine));

        String youOwnTemplate = plugin.getMenuManager().getGuiSettingsConfig()
                .getString("gui.sell.you-own", "&eYou own: &7");
        String youOwnLine = youOwnTemplate.contains("%owned%")
                ? youOwnTemplate.replace("%owned%", String.valueOf(owned))
                : youOwnTemplate + owned;
        lore.addAll(ShopItemUtil.splitAndColor(youOwnLine));

        if (spawnerType != null && !spawnerType.isEmpty()) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-type-line", "&7Spawner Type: &e%type%");
            String processed = template.replace("%type%", spawnerType);
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }
        if (spawnerItem != null && !spawnerItem.isEmpty()) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-item-line", "&7Spawner Item: &e%item%");
            String processed = template.replace("%item%", spawnerItem);
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }
        if (potionType != null && !potionType.isEmpty()) {
            String template = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.potion-type-line", "&7Potion Type: &d%type%");
            String processed = template.replace("%type%", potionType);
            lore.addAll(ShopItemUtil.splitAndColor(processed));
        }

        if (limit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
            lore.add(ShopItemUtil.color("&eLimit: &7" + current + "/" + limit));
        }

        lore.add("");

        String finalName = customName != null ? ShopItemUtil.color(customName) : null;
        ItemStack display;
        String headTexture = player.hasMetadata("sell.headTexture") ? player.getMetadata("sell.headTexture").getFirst().asString() : null;
        String headOwner = player.hasMetadata("sell.headOwner") ? player.getMetadata("sell.headOwner").getFirst().asString() : null;
        int displayAmount = amount > 0 ? amount : 1;
        if (material == Material.SPAWNER && ((spawnerType != null && !spawnerType.isEmpty()) || (spawnerItem != null && !spawnerItem.isEmpty()))) {
            if (spawnerItem != null && !spawnerItem.isEmpty()) {
                display = ShopItemUtil.getSpawnerItem(spawnerItem, displayAmount, true);
            } else {
                display = ShopItemUtil.getSpawnerItem(spawnerType, displayAmount, false);
            }
            display = ShopItemUtil.create(display, finalName, lore);
        } else {
            display = ShopItemUtil.create(material, displayAmount, finalName, lore);
        }

        if (material == Material.PLAYER_HEAD) {
            ShopItemUtil.applyHeadTexture(display, headTexture, headOwner);
        }

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
                shopName = ShopItemUtil.color(shopData.getGuiName());
            }
        }
        
        String backName = guiCfg.getString("buttons.back.name", "&9BACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancelName = guiCfg.getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Get materials from config
        Material addMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.add.material"), Material.LIME_STAINED_GLASS_PANE);
        Material remMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.remove.material"), Material.RED_STAINED_GLASS_PANE);
        Material setMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.set.material"), Material.YELLOW_STAINED_GLASS_PANE);
        Material confirmMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        Material sellAllMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.sell-all.material"), Material.GOLD_BLOCK);
        Material backMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.back.material"), Material.ENDER_CHEST);
        Material cancelMaterial = ShopItemUtil.getMaterial(guiCfg.getString("buttons.cancel.material"), Material.RED_STAINED_GLASS);

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
                            inv.setItem(slot, ShopItemUtil.create(addMaterial, 1, name, null));
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
                                inv.setItem(slot, ShopItemUtil.create(remMaterial, 1, name, null));
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
                            inv.setItem(slot, ShopItemUtil.create(setMaterial, 1, name, null));
                        }
                    }
                } catch (NumberFormatException ignored) {}
            }
        }

        // Confirm button with lore
        List<String> confirmLore = guiCfg.getStringList("buttons.confirm.lore");
        List<String> confirmLoreColored = new ArrayList<>();
        for (String line : confirmLore) {
            confirmLoreColored.addAll(ShopItemUtil.splitAndColor(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(confirmSlot, ShopItemUtil.create(confirmMaterial, 1, confirmName, confirmLoreColored.isEmpty() ? null : confirmLoreColored));

        // Sell All button with lore
        if (owned > 0) {
            List<String> sellAllLore = guiCfg.getStringList("buttons.sell-all.lore");
            List<String> sellAllLoreColored = new ArrayList<>();
            for (String line : sellAllLore) {
                sellAllLoreColored.addAll(ShopItemUtil.splitAndColor(line
                        .replace("%shop%", shopName)
                        .replace("%page%", String.valueOf(shopPage))
                        .replace("%max%", String.valueOf(effectiveMax))));
            }
            inv.setItem(sellAllSlot, ShopItemUtil.create(sellAllMaterial, 1, sellAllName, sellAllLoreColored.isEmpty() ? null : sellAllLoreColored));
        }

        // Back button with lore
        List<String> backLore = guiCfg.getStringList("buttons.back.lore");
        List<String> backLoreColored = new ArrayList<>();
        for (String line : backLore) {
            backLoreColored.addAll(ShopItemUtil.splitAndColor(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(backSlot, ShopItemUtil.create(backMaterial, 1, backName, backLoreColored.isEmpty() ? null : backLoreColored));

        // Cancel button with lore
        List<String> cancelLore = guiCfg.getStringList("buttons.cancel.lore");
        List<String> cancelLoreColored = new ArrayList<>();
        for (String line : cancelLore) {
            cancelLoreColored.addAll(ShopItemUtil.splitAndColor(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(cancelSlot, ShopItemUtil.create(cancelMaterial, 1, cancelName, cancelLoreColored.isEmpty() ? null : cancelLoreColored));

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

        if (spawnerItem != null)
            player.setMetadata("sell.spawnerItem", new FixedMetadataValue(plugin, spawnerItem));
        else
            player.removeMetadata("sell.spawnerItem", plugin);

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

        // New fields
        if (itemKey != null) player.setMetadata("sell.itemKey", new FixedMetadataValue(plugin, itemKey));
        player.setMetadata("sell.limit", new FixedMetadataValue(plugin, limit));
        player.setMetadata("sell.globalLimit", new FixedMetadataValue(plugin, globalLimit));
        player.setMetadata("sell.dynamicPricing", new FixedMetadataValue(plugin, dynamicPricing));
        player.setMetadata("sell.minPrice", new FixedMetadataValue(plugin, minPrice));
        player.setMetadata("sell.maxPrice", new FixedMetadataValue(plugin, maxPrice));
        player.setMetadata("sell.priceChange", new FixedMetadataValue(plugin, priceChange));
        player.setMetadata("sell.permission", new FixedMetadataValue(plugin, permission != null ? permission : ""));

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

        if (!(e.getInventory().getHolder() instanceof SellHolder)) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null) return;

        ShopPlugin plugin = ShopPlugin.getInstance();
        String currency = plugin.getCurrencySymbol();

        String materialName = getMeta(player, "sell.material", "DIRT");
        double sellPrice = getMetaDouble(player, "sell.price", 0.0);
        int amount = getMetaInt(player, "sell.amount", 1);
        String spawnerType = getMeta(player, "sell.spawnerType", null);
        String spawnerItem = getMeta(player, "sell.spawnerItem", null);
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

        // New fields
        String itemKey = getMeta(player, "sell.itemKey", null);
        int limit = getMetaInt(player, "sell.limit", 0);
        int globalLimit = getMetaInt(player, "sell.globalLimit", 0);
        boolean dynamicPricing = getMetaBool(player, "sell.dynamicPricing");
        double minPrice = getMetaDouble(player, "sell.minPrice", 0);
        double maxPrice = getMetaDouble(player, "sell.maxPrice", 0);
        double priceChange = getMetaDouble(player, "sell.priceChange", 0);
        String permission = getMeta(player, "sell.permission", "");

        // Restore lore if present
        List<String> customLore = null;
        if (player.hasMetadata("sell.customLore")) {
            String packed = player.getMetadata("sell.customLore").getFirst().asString();
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
                shopName = ShopItemUtil.color(shopData.getGuiName());
            }
        }
        
        String backName = guiCfg.getString("buttons.back.name", "&9BACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancelName = guiCfg.getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Load configured materials
        Material addMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.add.material"), Material.LIME_STAINED_GLASS_PANE);
        Material remMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.remove.material"), Material.RED_STAINED_GLASS_PANE);
        Material setMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.set.material"), Material.YELLOW_STAINED_GLASS_PANE);
        Material confirmMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        Material cancelMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.cancel.material"), Material.RED_STAINED_GLASS);
        Material sellAllMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.sell-all.material"), Material.GOLD_BLOCK);
        Material backMat = ShopItemUtil.getMaterial(guiCfg.getString("buttons.back.material"), Material.ENDER_CHEST);

        int maxAmount = guiCfg.getInt("max-amount", 2304);
        int owned = countPlayerItems(player, material, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, requireName, requireLore);
        if (owned <= 0) {
            String msg = plugin.getMessages().getMessage("no-items-to-sell")
                    .replace("%item%", material.name());
            player.sendMessage(ShopItemUtil.color(msg));
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
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            int newAmount = Math.min(amount + value, Math.min(owned, maxAmount));
                            open(player, material, sellPrice, newAmount, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, permission);
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
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            open(player, material, sellPrice, Math.max(1, amount - value), spawnerType, spawnerItem, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, permission);
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
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            int newAmount = Math.max(1, Math.min(value, Math.min(owned, maxAmount)));
                            open(player, material, sellPrice, newAmount, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, permission);
                            return;
                        }
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        // CONFIRM SELL
        if (clicked.getType() == confirmMat &&
                name.equals(ShopItemUtil.color(confirmName))) {

            sellItems(player, material, spawnerType, spawnerItem, potionType, enchantments, amount, sellPrice, customName, customLore, hideAttr, hideAdd, requireName, requireLore, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, shopKey, permission);
            return;
        }

        // SELL ALL
        if (clicked.getType() == sellAllMat &&
                name.equals(ShopItemUtil.color(sellAllName))) {

            int sellAmount = Math.min(owned, maxAmount);
            sellItems(player, material, spawnerType, spawnerItem, potionType, enchantments, sellAmount, sellPrice, customName, customLore, hideAttr, hideAdd, requireName, requireLore, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, shopKey, permission);
            return;
        }

        // BACK
        if (clicked.getType() == backMat &&
                name.equals(ShopItemUtil.color(backName))) {

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
                name.equals(ShopItemUtil.color(cancelName))) {

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
    private void sellItems(Player player, Material material, String spawnerType, String spawnerItem, String potionType,
                           Map<String, Integer> enchantments, int amount, double sellPrice, String customName,
                           List<String> customLore, boolean hideAttr, boolean hideAdd, boolean requireName, boolean requireLore,
                           String itemKey, int limit, int globalLimit, boolean dynamicPricing, double minPrice, double maxPrice, double priceChange, String shopKey, String permission) {

        int owned = countPlayerItems(player, material, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, requireName, requireLore);
        ShopPlugin plugin = ShopPlugin.getInstance();

        // Safety permission check
        if (permission != null && !permission.isEmpty()) {
            if (!player.hasPermission(permission)) {
                player.sendMessage(plugin.getMessages().getMessage("no-permission"));
                player.closeInventory();
                return;
            }
        }

        // Time restriction check
        if (shopKey != null) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop != null) {
                // Shop availability
                if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes())) {
                    player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                            .replace("%shop%", ShopItemUtil.color(shop.getGuiName()))
                            .replace("%available-times%", ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin)));
                    player.closeInventory();
                    return;
                }
                // Item availability
                if (itemKey != null) {
                    ShopItem si = null;
                    for (ShopItem item : shop.getItems()) {
                        if (item.getUniqueKey().equals(itemKey)) {
                            si = item;
                            break;
                        }
                    }
                    if (si != null && !ShopTimeUtil.isShopAvailable(si.getAvailableTimes())) {
                        player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                                .replace("%shop%", si.getName() != null ? ShopItemUtil.color(si.getName()) : si.getMaterial().name())
                                .replace("%available-times%", ShopTimeUtil.formatAvailableTimes(si.getAvailableTimes(), plugin)));
                        player.closeInventory();
                        return;
                    }
                }
            }
        }

        // Check limit
        if (limit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
            if (current + amount > limit) {
                player.sendMessage(ShopItemUtil.color("&cYou have reached the sale limit for this item! (" + current + "/" + limit + ")"));
                return;
            }
        }

        // Check global limit
        if (globalLimit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getGlobalCount(itemKey);
            // Selling decreases globalCount (adds to stock)
            // But we might want to prevent selling if it exceeds globalLimit? 
            // Usually globalLimit is a BUY limit (stock).
            // If it's a "total transactions" limit, then we check current + amount > globalLimit.
            // If it's "stock", then selling is always fine as long as we don't care about "max stock".
            // The issue description says "global limit per item, for limited items".
            // If it's a hard limit of 1000 items ever sold/bought, then we check:
            // if (current + amount > globalLimit) ...
        }

        plugin.debug("Sell attempt: " + player.getName() + " selling " + amount + "x " + material + " (owns: " + owned + ")");

        if (owned < amount) {
            plugin.debug("Sell failed: Player doesn't have enough items");
            // Re-color the final message so %item% color codes work
            String msg = plugin.getMessages()
                    .getMessage("no-items-to-sell")
                    .replace("%item%", material.name());
            player.sendMessage(ShopItemUtil.color(msg));
            return;
        }

        ShopItem matchedItem = findShopItem(shopKey, itemKey);
        ShopData shopData = shopKey != null ? plugin.getShopManager().getShop(shopKey) : null;
        boolean sellAddsToStock = resolveSellAddsToStock(shopData, matchedItem);
        boolean allowSellStockOverflow = resolveAllowSellStockOverflow(shopData, matchedItem);

        if (itemKey != null && globalLimit > 0 && sellAddsToStock && !allowSellStockOverflow) {
            int current = plugin.getDataManager().getGlobalCount(itemKey);
            int maxCanReplenish = Math.max(0, current);
            if (amount > maxCanReplenish) {
                player.sendMessage(ShopItemUtil.color("&cCannot sell that many: stock is already full."));
                return;
            }
        }

        double total = sellPrice * amount;

        EconomyHook eco = plugin.getEconomy();

        if (eco.isReady()) {
            eco.deposit(player, total);
        }

        removeItems(player, material, spawnerType, spawnerItem, potionType, enchantments, amount, customName, customLore, requireName, requireLore);

        // Update counts
        if (itemKey != null) {
            plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), itemKey, amount);
            boolean adjustForStock = globalLimit > 0 && sellAddsToStock;
            boolean adjustForDynamicPricingOnly = dynamicPricing && globalLimit <= 0;
            if (adjustForStock || adjustForDynamicPricingOnly) {
                plugin.getDataManager().incrementGlobalCount(itemKey, -amount);
            }
        }

        plugin.itemsSold++;
        plugin.debug("Sell successful: " + player.getName() + " sold " + amount + "x " + material + " for $" + total);

        // Fire ShopSellEvent
        if (itemKey != null && shopKey != null) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop != null) {
                for (ShopItem si : shop.getItems()) {
                    if (si.getUniqueKey().equals(itemKey)) {
                        me.dralle.shop.api.events.ShopSellEvent sellEvent = 
                            new me.dralle.shop.api.events.ShopSellEvent(player, si, amount, total, shopKey);
                        Bukkit.getPluginManager().callEvent(sellEvent);
                        break;
                    }
                }
            }
        }

        // Send Discord webhook notification
        String itemDisplayName = customName != null ? customName : material.name();
        plugin.getDiscordWebhook().sendSellNotification(
                player.getName(),
                itemDisplayName,
                amount,
                total,
                plugin.getCurrencySymbol()
        );

        String itemName = customName != null ? ShopItemUtil.color(customName) : material.name();
        String msg = plugin.getMessages().getMessage("sell-success")
                .replace("%amount%", String.valueOf(amount))
                .replace("%item%", itemName)
                .replace("%price%", plugin.formatCurrency(total));

        player.sendMessage(ShopItemUtil.color(msg));

        // Refresh the menu so "You own: X" updates
        // We recalculate amount to ensure it doesn't exceed new owned count
        int newOwned = countPlayerItems(player, material, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, requireName, requireLore);
        int newAmount = Math.min(amount, newOwned);
        if (newAmount <= 0) newAmount = 1; // Default to 1 if they sold everything, just for display

        double nextSellPrice = sellPrice;
        int shopPage = player.hasMetadata("sell.shopPage") ? player.getMetadata("sell.shopPage").getFirst().asInt() : 1;

        if (dynamicPricing && itemKey != null && shopKey != null) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop != null) {
                for (ShopItem si : shop.getItems()) {
                    if (si.getUniqueKey().equals(itemKey)) {
                        nextSellPrice = calculateSellPrice(si);
                        break;
                    }
                }
            }
        }

        open(player, material, nextSellPrice, newAmount, spawnerType, spawnerItem, potionType, enchantments, customName, customLore, hideAttr, hideAdd, requireName, requireLore, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, permission);
    }

    private ShopItem findShopItem(String shopKey, String itemKey) {
        if (shopKey == null || itemKey == null) return null;
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) return null;
        for (ShopItem item : shop.getItems()) {
            if (itemKey.equals(item.getUniqueKey())) {
                return item;
            }
        }
        return null;
    }

    private boolean resolveSellAddsToStock(ShopData shop, ShopItem item) {
        if (item != null && item.getSellAddsToStock() != null) {
            return item.getSellAddsToStock();
        }
        return shop != null && shop.isSellAddsToStock();
    }

    private boolean resolveAllowSellStockOverflow(ShopData shop, ShopItem item) {
        if (item != null && item.getAllowSellStockOverflow() != null) {
            return item.getAllowSellStockOverflow();
        }
        return shop != null && shop.isAllowSellStockOverflow();
    }

    /* ============================================================
     *  UTILITIES
     * ============================================================ */
    private static int countPlayerItems(Player player, Material material, String spawnerType, String spawnerItem, String potionType, Map<String, Integer> enchantments, String customName, List<String> customLore, boolean requireName, boolean requireLore) {
        int count = 0;
        for (ItemStack it : player.getInventory().getContents()) {
            if (it == null || it.getType() != material) continue;

            if (material == Material.SPAWNER) {
                if (spawnerItem != null && !spawnerItem.isEmpty()) {
                    if (!ShopItemUtil.spawnerMatches(it, "ITEM:" + spawnerItem)) continue;
                } else if (spawnerType != null && !spawnerType.isEmpty()) {
                    if (!ShopItemUtil.spawnerMatches(it, spawnerType)) continue;
                }
            }

            if ((material == Material.POTION || material == Material.SPLASH_POTION ||
                 material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW) && potionType != null) {
                if (!ShopItemUtil.potionMatches(it, potionType)) continue;
            }

            if (enchantments != null && !enchantments.isEmpty()) {
                if (!ShopItemUtil.enchantmentsMatch(it, enchantments)) continue;
            }

            // Check custom name if enabled
            if (requireName && customName != null) {
                if (!ShopItemUtil.nameMatches(it, customName)) continue;
            }

            // Check custom lore if enabled
            if (requireLore && customLore != null && !customLore.isEmpty()) {
                if (!ShopItemUtil.loreMatches(it, customLore)) continue;
            }

            count += it.getAmount();
        }
        return count;
    }

    private static boolean spawnerMatches(ItemStack it, String type) {
        return ShopItemUtil.spawnerMatches(it, type);
    }

    private static boolean potionMatches(ItemStack it, String type) {
        return ShopItemUtil.potionMatches(it, type);
    }

    private static boolean enchantmentsMatch(ItemStack it, Map<String, Integer> requiredEnchants) {
        return ShopItemUtil.enchantmentsMatch(it, requiredEnchants);
    }

    private static boolean nameMatches(ItemStack it, String requiredName) {
        return ShopItemUtil.nameMatches(it, requiredName);
    }

    private static boolean loreMatches(ItemStack it, List<String> requiredLore) {
        return ShopItemUtil.loreMatches(it, requiredLore);
    }

    private static void removeItems(Player player, Material material, String spawnerType, String spawnerItem, String potionType, Map<String, Integer> enchantments, int amount, String customName, List<String> customLore, boolean requireName, boolean requireLore) {
        int toRemove = amount;
        for (int i = 0; i < player.getInventory().getSize(); i++) {
            ItemStack it = player.getInventory().getItem(i);
            if (it == null || it.getType() != material) continue;

            if (material == Material.SPAWNER) {
                if (spawnerItem != null && !spawnerItem.isEmpty()) {
                    if (!ShopItemUtil.spawnerMatches(it, "ITEM:" + spawnerItem)) continue;
                } else if (spawnerType != null && !spawnerType.isEmpty()) {
                    if (!ShopItemUtil.spawnerMatches(it, spawnerType)) continue;
                }
            }

            if ((material == Material.POTION || material == Material.SPLASH_POTION ||
                 material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW) && potionType != null) {
                if (!ShopItemUtil.potionMatches(it, potionType)) continue;
            }

            if (enchantments != null && !enchantments.isEmpty()) {
                if (!ShopItemUtil.enchantmentsMatch(it, enchantments)) continue;
            }

            // Check custom name if enabled
            if (requireName && customName != null) {
                if (!ShopItemUtil.nameMatches(it, customName)) continue;
            }

            // Check custom lore if enabled
            if (requireLore && customLore != null && !customLore.isEmpty()) {
                if (!ShopItemUtil.loreMatches(it, customLore)) continue;
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
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asString() : def;
    }
    private int getMetaInt(Player p, String key, int def) {
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asInt() : def;
    }
    private double getMetaDouble(Player p, String key, double def) {
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asDouble() : def;
    }
    private boolean getMetaBool(Player p, String key) {
        return p.hasMetadata(key) && p.getMetadata(key).getFirst().asBoolean();
    }
}
