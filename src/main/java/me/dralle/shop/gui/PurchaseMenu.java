package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.CreatureSpawner;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.BlockStateMeta;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.metadata.FixedMetadataValue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

public class PurchaseMenu implements Listener {

    public static class PurchaseHolder implements InventoryHolder {
        @Override
        public Inventory getInventory() {
            return null;
        }
    }

    public PurchaseMenu(ShopPlugin plugin) {
    }

    /* ============================================================
     * OPEN FROM SHOP ITEM
     * ============================================================ */
    public static void open(Player player, ShopItem item, String shopKey, int shopPage) {
        ShopPlugin plugin = ShopPlugin.getInstance();

        if (item.getHeadTexture() != null && !item.getHeadTexture().isEmpty()) {
            player.setMetadata("buy.headTexture", new FixedMetadataValue(plugin, item.getHeadTexture()));
        } else {
            player.removeMetadata("buy.headTexture", plugin);
        }

        if (item.getHeadOwner() != null && !item.getHeadOwner().isEmpty()) {
            player.setMetadata("buy.headOwner", new FixedMetadataValue(plugin, item.getHeadOwner()));
        } else {
            player.removeMetadata("buy.headOwner", plugin);
        }

        double currentPrice = calculatePrice(item);
        open(player,
                item.getMaterial(),
                currentPrice,
                item.getAmount(),
                item.getSpawnerType(),
                item.getSpawnerItem(),
                item.getPotionType(),
                item.getPotionLevel(),
                item.getName(),
                item.getLore(),
                item.getEnchantments(),
                item.shouldHideAttributes(),
                item.shouldHideAdditional(),
                item.requiresName(),
                item.requiresLore(),
                item.isUnstableTnt(),
                shopKey,
                shopPage,
                item.getUniqueKey(),
                item.getLimit(),
                item.getGlobalLimit(),
                item.isDynamicPricing(),
                item.getMinPrice(),
                item.getMaxPrice(),
                item.getPriceChange(),
                item.getCommands(),
                item.getRunAs(),
                item.isRunCommandOnly(),
                item.getPermission()
        );
    }

    private static double calculatePrice(ShopItem item) {
        if (!item.isDynamicPricing()) return item.getPrice();

        int globalCount = ShopPlugin.getInstance().getDataManager().getGlobalCount(item.getUniqueKey());
        double currentPrice = item.getPrice() + (globalCount * item.getPriceChange());

        if (item.getMinPrice() > 0 && currentPrice < item.getMinPrice()) currentPrice = item.getMinPrice();
        if (item.getMaxPrice() > 0 && currentPrice > item.getMaxPrice()) currentPrice = item.getMaxPrice();

        return currentPrice;
    }

    /* ============================================================
     * MAIN OPEN METHOD
     * ============================================================ */
    public static void open(Player player,
                            Material material,
                            Double price,
                            int amount,
                            String spawnerType,
                            String spawnerItem,
                            String potionType,
                            int potionLevel,
                            String customName,
                            List<String> customLore,
                            Map<String, Integer> enchantments,
                            boolean hideAttributes,
                            boolean hideAdditional,
                            boolean requireName,
                            boolean requireLore,
                            boolean unstableTnt,
                            String shopKey,
                            int shopPage,
                            String itemKey,
                            int limit,
                            int globalLimit,
                            boolean dynamicPricing,
                            double minPrice,
                            double maxPrice,
                            double priceChange,
                            List<String> commands,
                            String commandRunAs,
                            boolean runCommandOnly,
                            String permission) {

        ShopPlugin plugin = ShopPlugin.getInstance();
        String currency = plugin.getCurrencySymbol();

        if (price == null || price <= 0) {
            player.sendMessage(plugin.getMessages().getMessage("cannot-buy"));
            return;
        }

        String prefix = plugin.getMenuManager().getPurchaseMenuConfig().getString("title-prefix", "&8Buying ");
        String title = me.dralle.shop.util.BedrockUtil.formatTitle(player, ShopItemUtil.color(prefix + customName));
        Inventory inv = Bukkit.createInventory(new PurchaseHolder(), 54, title);

        // Lore
        List<String> lore = new ArrayList<>();

        if (customLore != null) {
            for (String line : customLore) lore.addAll(ShopItemUtil.splitAndColor(line));
            lore.add("");
        }

        String amountLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.amount-line", "&eAmount: &7%amount%");
        String totalLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.total-line", "&eTotal: &7%total%");
        lore.add(ShopItemUtil.color(amountLine.replace("%amount%", String.valueOf(amount))));
        lore.add(ShopItemUtil.color(totalLine.replace("%total%", plugin.formatCurrency(price * amount))));

        if (spawnerType != null) {
            String line = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-type-line", "&7Spawner Type: &e%type%");
            lore.addAll(ShopItemUtil.splitAndColor(line.replace("%type%", spawnerType)));
        }
        if (spawnerItem != null) {
            String line = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.spawner-item-line", "&7Spawner Item: &e%item%");
            lore.addAll(ShopItemUtil.splitAndColor(line.replace("%item%", spawnerItem)));
        }
        if (potionType != null) {
            String line = plugin.getMenuManager().getGuiSettingsConfig()
                    .getString("gui.item-lore.potion-type-line", "&7Potion Type: &d%type%");
            lore.addAll(ShopItemUtil.splitAndColor(line.replace("%type%", potionType)));
        }

        if (limit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
            lore.add(ShopItemUtil.color("&eLimit: &7" + current + "/" + limit));
        }

        lore.add("");

        // Display item with a proper count (max 64 for display, actual amount shown in lore)
        int displayAmount = Math.min(amount, 64);
        String headTexture = player.hasMetadata("buy.headTexture") ? player.getMetadata("buy.headTexture").getFirst().asString() : null;
        String headOwner = player.hasMetadata("buy.headOwner") ? player.getMetadata("buy.headOwner").getFirst().asString() : null;
        ItemStack display;
        if (material == Material.SPAWNER && ((spawnerType != null && !spawnerType.isEmpty()) || (spawnerItem != null && !spawnerItem.isEmpty()))) {
            if (spawnerItem != null && !spawnerItem.isEmpty()) {
                display = ShopItemUtil.getSpawnerItem(spawnerItem, displayAmount, true);
            } else {
                display = ShopItemUtil.getSpawnerItem(spawnerType, displayAmount, false);
            }
            display = ShopItemUtil.create(display, customName, lore);
        } else {
            display = ShopItemUtil.create(material, displayAmount, customName, lore);
        }

        // Apply potion type if this is a potion or tipped arrow
        if (potionType != null && (material == Material.POTION || material == Material.SPLASH_POTION || material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW)) {
            ShopItemUtil.applyPotionType(display, potionType, potionLevel);
        }

        if (material == Material.PLAYER_HEAD) {
            ShopItemUtil.applyHeadTexture(display, headTexture, headOwner);
        }

        // Apply enchantments
        if (enchantments != null && !enchantments.isEmpty()) {
            ShopItemUtil.applyEnchantments(display, enchantments);
        }

        ItemMeta meta = display.getItemMeta();

        if (meta != null) {
            if (hideAttributes) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            if (hideAdditional) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            display.setItemMeta(meta);
        }

        int displaySlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("display-slot", 22);
        inv.setItem(displaySlot, display);

        String confirm = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.name", "&aCONFIRM PURCHASE");

        // Get shop name for placeholders
        String shopName = "Categories";
        if (shopKey != null && !shopKey.isEmpty()) {
            ShopData shopData = plugin.getShopManager().getShop(shopKey);
            if (shopData != null) {
                shopName = ShopItemUtil.color(shopData.getGuiName());
            }
        }

        String back = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.name", "&9BACK TO CATEGORIES")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancel = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.name", "&cCANCEL PURCHASE")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        int maxAmount = plugin.getMenuManager().getPurchaseMenuConfig().getInt("max-amount", 2304);

        // Dynamic add buttons (show only if not at max)
        if (amount < maxAmount) {
            Material addMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add.material"), Material.LIME_STAINED_GLASS_PANE);
            var addSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.add");
            if (addSection != null) {
                for (String key : addSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String name = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add." + key + ".name", "&aAdd " + value);
                        int slot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.add." + key + ".slot", -1);
                        if (slot >= 0 && slot < 54) {
                            inv.setItem(slot, ShopItemUtil.create(addMaterial, 1, name, null));
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic remove buttons
        if (amount > 1) {
            Material remMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove.material"), Material.RED_STAINED_GLASS_PANE);
            var removeSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.remove");
            if (removeSection != null) {
                for (String key : removeSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String name = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove." + key + ".name", "&cRemove " + value);
                        int slot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.remove." + key + ".slot", -1);
                        if (slot >= 0 && slot < 54) {
                            if (amount > value) {
                                inv.setItem(slot, ShopItemUtil.create(remMaterial, 1, name, null));
                            }
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic set buttons
        Material setMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set.material"), Material.YELLOW_STAINED_GLASS_PANE);
        var setSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.set");
        if (setSection != null) {
            for (String key : setSection.getKeys(false)) {
                if (key.equals("material")) continue;
                try {
                    int value = Integer.parseInt(key);
                    String name = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set." + key + ".name", "&aSet to " + value);
                    int slot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.set." + key + ".slot", -1);
                    if (slot >= 0 && slot < 54) {
                        if (value != amount && value <= maxAmount) {
                            inv.setItem(slot, ShopItemUtil.create(setMaterial, 1, name, null));
                        }
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }

        // Confirm purchase
        Material confirmMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        int confirmSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.confirm.slot", 39);
        List<String> confirmLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.confirm.lore");
        List<String> confirmLoreColored = new ArrayList<>();
        for (String line : confirmLore) {
            confirmLoreColored.add(ShopItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(confirmSlot, ShopItemUtil.create(confirmMaterial, 1, confirm, confirmLoreColored.isEmpty() ? null : confirmLoreColored));

        // Back
        Material backMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.material"), Material.ENDER_CHEST);
        int backSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.back.slot", 40);
        List<String> backLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.back.lore");
        List<String> backLoreColored = new ArrayList<>();
        for (String line : backLore) {
            backLoreColored.add(ShopItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(backSlot, ShopItemUtil.create(backMaterial, 1, back, backLoreColored.isEmpty() ? null : backLoreColored));

        // Cancel
        Material cancelMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.material"), Material.RED_STAINED_GLASS);
        int cancelSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.cancel.slot", 41);
        List<String> cancelLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.cancel.lore");
        List<String> cancelLoreColored = new ArrayList<>();
        for (String line : cancelLore) {
            cancelLoreColored.add(ShopItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(cancelSlot, ShopItemUtil.create(cancelMaterial, 1, cancel, cancelLoreColored.isEmpty() ? null : cancelLoreColored));

        player.openInventory(inv);

        // Store metadata
        player.setMetadata("buy.price", new FixedMetadataValue(plugin, price));
        player.setMetadata("buy.material", new FixedMetadataValue(plugin, material.name()));
        player.setMetadata("buy.amount", new FixedMetadataValue(plugin, amount));
        if (spawnerType != null)
            player.setMetadata("buy.spawnerType", new FixedMetadataValue(plugin, spawnerType));
        else
            player.removeMetadata("buy.spawnerType", plugin);

        if (spawnerItem != null)
            player.setMetadata("buy.spawnerItem", new FixedMetadataValue(plugin, spawnerItem));
        else
            player.removeMetadata("buy.spawnerItem", plugin);

        if (potionType != null)
            player.setMetadata("buy.potionType", new FixedMetadataValue(plugin, potionType));
        else
            player.removeMetadata("buy.potionType", plugin);

        player.setMetadata("buy.potionLevel", new FixedMetadataValue(plugin, potionLevel));

        if (customName != null)
            player.setMetadata("buy.customName", new FixedMetadataValue(plugin, customName));
        else
            player.removeMetadata("buy.customName", plugin);

        player.setMetadata("buy.hideAttr", new FixedMetadataValue(plugin, hideAttributes));
        player.setMetadata("buy.hideAdd", new FixedMetadataValue(plugin, hideAdditional));
        player.setMetadata("buy.requireName", new FixedMetadataValue(plugin, requireName));
        player.setMetadata("buy.requireLore", new FixedMetadataValue(plugin, requireLore));
        player.setMetadata("buy.unstableTnt", new FixedMetadataValue(plugin, unstableTnt));

        // New fields
        if (itemKey != null) player.setMetadata("buy.itemKey", new FixedMetadataValue(plugin, itemKey));
        player.setMetadata("buy.limit", new FixedMetadataValue(plugin, limit));
        player.setMetadata("buy.globalLimit", new FixedMetadataValue(plugin, globalLimit));
        player.setMetadata("buy.dynamicPricing", new FixedMetadataValue(plugin, dynamicPricing));
        player.setMetadata("buy.minPrice", new FixedMetadataValue(plugin, minPrice));
        player.setMetadata("buy.maxPrice", new FixedMetadataValue(plugin, maxPrice));
        player.setMetadata("buy.priceChange", new FixedMetadataValue(plugin, priceChange));

        if (customLore != null && !customLore.isEmpty()) {
            player.setMetadata("buy.customLore",
                    new FixedMetadataValue(plugin, String.join("\n", customLore)));
        }

        if (enchantments != null && !enchantments.isEmpty()) {
            player.setMetadata("buy.enchantments", new FixedMetadataValue(plugin, enchantments));
        } else {
            player.removeMetadata("buy.enchantments", plugin);
        }

        if (commands != null && !commands.isEmpty()) {
            player.setMetadata("buy.commands", new FixedMetadataValue(plugin, String.join("||", commands)));
        } else {
            player.removeMetadata("buy.commands", plugin);
        }
        player.setMetadata("buy.commandRunAs", new FixedMetadataValue(plugin,
                commandRunAs != null ? commandRunAs : "console"));

        player.setMetadata("buy.runCommandOnly", new FixedMetadataValue(plugin, runCommandOnly));
        player.setMetadata("buy.permission", new FixedMetadataValue(plugin, permission != null ? permission : ""));

        // Store shop context for back button
        if (shopKey != null && !shopKey.isEmpty()) {
            player.setMetadata("buy.shopKey", new FixedMetadataValue(plugin, shopKey));
            player.setMetadata("buy.shopPage", new FixedMetadataValue(plugin, shopPage));
        }
    }

    /* ============================================================
     * CLICK HANDLER
     * ============================================================ */
    @EventHandler
    public void onClick(InventoryClickEvent e) {
        if (!(e.getWhoClicked() instanceof Player player)) return;
        if (!(e.getInventory().getHolder() instanceof PurchaseHolder)) return;

        ShopPlugin plugin = ShopPlugin.getInstance();

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null) return;

        // Load metadata
        String matName = meta(player, "buy.material", "DIRT");
        double price = metaDouble(player, "buy.price", 0);
        int amount = metaInt(player, "buy.amount", 1);
        String spawnerType = meta(player, "buy.spawnerType", null);
        String spawnerItem = meta(player, "buy.spawnerItem", null);
        String potionType = meta(player, "buy.potionType", null);
        int potionLevel = player.hasMetadata("buy.potionLevel") ? player.getMetadata("buy.potionLevel").get(0).asInt() : 0;
        String customName = meta(player, "buy.customName", null);
        boolean hideAttr = metaBool(player, "buy.hideAttr");
        boolean hideAdd = metaBool(player, "buy.hideAdd");
        boolean requireName = metaBool(player, "buy.requireName");
        boolean requireLore = metaBool(player, "buy.requireLore");
        boolean unstableTnt = metaBool(player, "buy.unstableTnt");

        // New fields
        String itemKey = meta(player, "buy.itemKey", null);
        int limit = metaInt(player, "buy.limit", 0);
        int globalLimit = metaInt(player, "buy.globalLimit", 0);
        boolean dynamicPricing = metaBool(player, "buy.dynamicPricing");
        double minPrice = metaDouble(player, "buy.minPrice", 0);
        double maxPrice = metaDouble(player, "buy.maxPrice", 0);
        double priceChange = metaDouble(player, "buy.priceChange", 0);
        boolean runCommandOnly = metaBool(player, "buy.runCommandOnly");
        String commandRunAs = meta(player, "buy.commandRunAs", "console");
        String permission = meta(player, "buy.permission", "");

        final List<String> customLore = player.hasMetadata("buy.customLore") ?
                Arrays.asList(player.getMetadata("buy.customLore").getFirst().asString().split("\n")) : null;

        final List<String> commands = player.hasMetadata("buy.commands") ?
                Arrays.asList(player.getMetadata("buy.commands").getFirst().asString().split("\\|\\|")) : null;

        final Map<String, Integer> enchantments = player.hasMetadata("buy.enchantments") ?
                (Map<String, Integer>) player.getMetadata("buy.enchantments").getFirst().value() : null;

        Material tempMaterial = Material.matchMaterial(matName);
        if (tempMaterial == null) tempMaterial = Material.DIRT;
        final Material material = tempMaterial;

        String name = clicked.getItemMeta() != null ?
                clicked.getItemMeta().getDisplayName() : "";

        // Config strings
        String confirm = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.name", "&aCONFIRM PURCHASE");

        // Get shop name for placeholders
        String shopKey = player.hasMetadata("buy.shopKey") ? player.getMetadata("buy.shopKey").getFirst().asString() : null;
        int shopPage = player.hasMetadata("buy.shopPage") ? player.getMetadata("buy.shopPage").getFirst().asInt() : 1;
        String shopName = "Categories";
        if (shopKey != null && !shopKey.isEmpty()) {
            ShopData shopData = plugin.getShopManager().getShop(shopKey);
            if (shopData != null) {
                shopName = ShopItemUtil.color(shopData.getGuiName());
            }
        }

        String back = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.name", "&cBACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancel = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Materials
        Material addMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add.material"), Material.LIME_STAINED_GLASS_PANE);
        Material remMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove.material"), Material.RED_STAINED_GLASS_PANE);
        Material setMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set.material"), Material.YELLOW_STAINED_GLASS_PANE);
        Material confirmMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.material"), Material.LIME_STAINED_GLASS);
        Material backMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.material"), Material.ENDER_CHEST);
        Material cancelMaterial = ShopItemUtil.getMaterial(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.material"), Material.RED_STAINED_GLASS);

        int maxAmount = plugin.getMenuManager().getPurchaseMenuConfig().getInt("max-amount", 2304);

        // Dynamic add buttons
        if (clicked.getType() == addMaterial) {
            var addSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.add");
            if (addSection != null) {
                for (String key : addSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add." + key + ".name", "&aAdd " + value);
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            amount = Math.min(amount + value, maxAmount);
                            open(player, material, price, amount, spawnerType, spawnerItem, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, commands, commandRunAs, runCommandOnly, permission);
                            return;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic remove buttons
        if (clicked.getType() == remMaterial) {
            var removeSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.remove");
            if (removeSection != null) {
                for (String key : removeSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove." + key + ".name", "&cRemove " + value);
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            amount = Math.max(1, amount - value);
                            open(player, material, price, amount, spawnerType, spawnerItem, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, commands, commandRunAs, runCommandOnly, permission);
                            return;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic set buttons
        if (clicked.getType() == setMaterial) {
            var setSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.set");
            if (setSection != null) {
                for (String key : setSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String buttonName = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set." + key + ".name", "&aSet to " + value);
                        if (name.equals(ShopItemUtil.color(buttonName))) {
                            amount = Math.max(1, Math.min(value, maxAmount));
                            open(player, material, price, amount, spawnerType, spawnerItem, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, commands, commandRunAs, runCommandOnly, permission);
                            return;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // CONFIRM PURCHASE
        if (clicked.getType() == confirmMaterial &&
                name.equals(ShopItemUtil.color(confirm))) {

            final int finalAmount = amount;
            Bukkit.getScheduler().runTask(plugin, () -> finalizePurchase(player, material, finalAmount, price, spawnerType, spawnerItem, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, commands, commandRunAs, runCommandOnly, permission));
            return;
        }

        // BACK
        if (clicked.getType() == backMaterial &&
                name.equals(ShopItemUtil.color(back))) {
            // Return to shop if context exists, otherwise main menu
            if (shopKey != null) {
                plugin.getGenericShopGui().openShop(player, shopKey, shopPage);
            } else {
                MainMenu.open(player);
            }
            return;
        }

        // CANCEL
        if (clicked.getType() == cancelMaterial &&
                name.equals(ShopItemUtil.color(cancel))) {
            // Return to shop if context exists, otherwise close
            if (shopKey != null) {
                plugin.getGenericShopGui().openShop(player, shopKey, shopPage);
            } else {
                player.closeInventory();
            }
        }
    }

    /* ============================================================
     * FINAL PURCHASE LOGIC
     * ============================================================ */
    private void finalizePurchase(Player player,
                                  Material material,
                                  int amount,
                                  double price,
                                  String spawnerType,
                                  String spawnerItem,
                                  String potionType,
                                  int potionLevel,
                                  String customName,
                                  List<String> customLore,
                                  Map<String, Integer> enchantments,
                                  boolean hideAttr,
                                  boolean hideAdd,
                                  boolean requireName,
                                  boolean requireLore,
                                  boolean unstableTnt,
                                  String itemKey,
                                  int limit,
                                  int globalLimit,
                                  boolean dynamicPricing,
                                  double minPrice,
                                  double maxPrice,
                                  double priceChange,
                                  List<String> commands,
                                  String commandRunAs,
                                  boolean runCommandOnly,
                                  String permission) {

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
        String shopKey = player.hasMetadata("buy.shopKey") ? player.getMetadata("buy.shopKey").get(0).asString() : null;
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

        EconomyHook eco = plugin.getEconomy();

              if (!eco.isReady()) {
                  player.sendMessage(plugin.getMessages().getMessage("economy-not-ready"));
                  return;
              }

              // Check limit
              if (limit > 0 && itemKey != null) {
                  int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
                  if (current + amount > limit) {
                      player.sendMessage(ShopItemUtil.color("&cYou have reached the purchase limit for this item! (" + current + "/" + limit + ")"));
                      return;
                  }
              }

              // Check global limit
              if (globalLimit > 0 && itemKey != null) {
                  int current = plugin.getDataManager().getGlobalCount(itemKey);
                  if (current + amount > globalLimit) {
                      player.sendMessage(ShopItemUtil.color("&cThe global limit for this item has been reached! (" + current + "/" + globalLimit + ")"));
                      return;
                  }
              }

              double total = price * amount;

              // Check balance
              String replacement = customName != null ? ShopItemUtil.color(customName) : material.name();
              double balance = eco.getBalance(player);
              plugin.debug("Purchase attempt: " + player.getName() + " buying " + amount + "x " + material + " for $" + total + " (balance: $" + balance + ")");

              if (!eco.withdraw(player, total)) {
                  plugin.debug("Purchase failed: Insufficient funds");
                  String msg = plugin.getMessages().getMessage("not-enough-money")
                          .replace("%amount%", String.valueOf(amount))
                          .replace("%item%", replacement)
                          .replace("%price%", plugin.formatPrice(total));
                  player.sendMessage(msg);
                  return;
              }

              // Deliver item (with overflow dropping)
              // Only apply custom name/lore if their respective require flags are true
              String nameToApply = requireName ? customName : null;
              List<String> loreToApply = requireLore ? customLore : null;

              // Execute commands if present
              if (commands != null && !commands.isEmpty()) {
                  for (String cmd : commands) {
                      String finalCmd = cmd.replace("%player%", player.getName())
                              .replace("%amount%", String.valueOf(amount))
                              .replace("%item%", replacement)
                              .replace("%price%", String.valueOf(total));
                
                      // Strip leading / if present for console execution
                      if (finalCmd.startsWith("/")) {
                          finalCmd = finalCmd.substring(1);
                      }
                
                      if ("player".equalsIgnoreCase(commandRunAs)) {
                          Bukkit.dispatchCommand(player, finalCmd);
                      } else {
                          Bukkit.dispatchCommand(Bukkit.getConsoleSender(), finalCmd);
                      }
                  }
              }

              // Give item if not run-command-only OR if there are no commands
              boolean shouldGiveItem = !runCommandOnly || commands == null || commands.isEmpty();
              if (shouldGiveItem) {
                  String headTexture = player.hasMetadata("buy.headTexture") ? player.getMetadata("buy.headTexture").getFirst().asString() : null;
                  String headOwner = player.hasMetadata("buy.headOwner") ? player.getMetadata("buy.headOwner").getFirst().asString() : null;
                  giveItemSafe(player, material, amount, spawnerType, spawnerItem, potionType, potionLevel, nameToApply, loreToApply, enchantments, hideAttr, hideAdd, unstableTnt, headTexture, headOwner);
              }

        // Update counts
        if (itemKey != null) {
            plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), itemKey, amount);
            if (dynamicPricing || globalLimit > 0) {
                plugin.getDataManager().incrementGlobalCount(itemKey, amount);
            }
        }

        plugin.itemsBought += amount;
        plugin.debug("Purchase successful: " + player.getName() + " bought " + amount + "x " + material + " for $" + total);

        // Fire ShopPurchaseEvent
        if (itemKey != null && shopKey != null) {
            ShopData shop = plugin.getShopManager().getShop(shopKey);
            if (shop != null) {
                for (ShopItem si : shop.getItems()) {
                    if (si.getUniqueKey().equals(itemKey)) {
                        me.dralle.shop.api.events.ShopPurchaseEvent purchaseEvent = 
                            new me.dralle.shop.api.events.ShopPurchaseEvent(player, si, amount, total, shopKey);
                        Bukkit.getPluginManager().callEvent(purchaseEvent);
                        break;
                    }
                }
            }
        }

        // Send Discord webhook notification
        String itemDisplayName = customName != null ? customName : material.name();
        plugin.getDiscordWebhook().sendPurchaseNotification(
                player.getName(),
                itemDisplayName,
                amount,
                total,
                plugin.getCurrencySymbol()
        );

        // Success message
        String msg = plugin.getMessages().getMessage("buy-success")
                .replace("%amount%", String.valueOf(amount))
                .replace("%item%", replacement)
                .replace("%price%", plugin.formatPrice(total));

        player.sendMessage(msg);

        // Recalculate price for next open
        double nextPrice = price;
        if (dynamicPricing && itemKey != null) {
            int globalCount = plugin.getDataManager().getGlobalCount(itemKey);
            // This is a simplified recalculation. In a real scenario, we might want to look up the original base price.
            // But since we have all the info here:
            // We assume 'price' was the current dynamic price.
            // Actually, we should use the same formula as in open()
            // We don't have the original base price here easily unless we look it up.
            // Let's try to look it up if we have shopKey
            if (shopKey != null) {
                ShopData shop = plugin.getShopManager().getShop(shopKey);
                if (shop != null) {
                    for (ShopItem si : shop.getItems()) {
                        if (si.getUniqueKey().equals(itemKey)) {
                            double p = si.getPrice() + (globalCount * si.getPriceChange());
                            if (si.getMinPrice() > 0 && p < si.getMinPrice()) p = si.getMinPrice();
                            if (si.getMaxPrice() > 0 && p > si.getMaxPrice()) p = si.getMaxPrice();
                            nextPrice = p;
                            break;
                        }
                    }
                }
            }
        }

        // Instead of closing, we just re-open the menu to refresh it (e.g., update lore if we had dynamic lore)
        // or simply do nothing to keep it open. reopening is safer to ensure state consistency if we add dynamic elements later.
        int shopPage = player.hasMetadata("buy.shopPage") ? player.getMetadata("buy.shopPage").getFirst().asInt() : 1;
        open(player, material, nextPrice, amount, spawnerType, spawnerItem, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, globalLimit, dynamicPricing, minPrice, maxPrice, priceChange, commands, commandRunAs, runCommandOnly, permission);
    }

    /* ============================================================
     * GIVE ITEM (With Overflow Drop)
     * ============================================================ */
    private static void giveItemSafe(Player player,
                                     Material material,
                                     int amount,
                                     String spawnerType,
                                     String spawnerItem,
                                     String potionType,
                                     int potionLevel,
                                     String customName,
                                     List<String> customLore,
                                     Map<String, Integer> enchantments,
                                     boolean hideAttr,
                                     boolean hideAdd,
                                     boolean unstableTnt,
                                     String headTexture,
                                     String headOwner) {

        ShopPlugin plugin = ShopPlugin.getInstance();

        // SmartSpawner Command Integration
        if (material == Material.SPAWNER && plugin.getConfig().getBoolean("smart-spawner-support", true) &&
                (org.bukkit.Bukkit.getPluginManager().isPluginEnabled("SmartSpawner") || org.bukkit.Bukkit.getPluginManager().isPluginEnabled("SmartSpawners"))) {

            String cmd = null;
            if (spawnerItem != null && !spawnerItem.isEmpty()) {
                cmd = "ss give item_spawner " + player.getName() + " " + spawnerItem + " " + amount;
            } else if (spawnerType != null && !spawnerType.isEmpty()) {
                cmd = "ss give spawner " + player.getName() + " " + spawnerType + " " + amount;
            }

            if (cmd != null) {
                org.bukkit.Bukkit.dispatchCommand(org.bukkit.Bukkit.getConsoleSender(), cmd);
                return;
            }
        }

        int remaining = amount;

        while (remaining > 0) {
            int stackSize = Math.min(remaining, material.getMaxStackSize());
            ItemStack item;

            // Spawner handling (both regular and trial spawners)
            if (material == Material.SPAWNER) {
                if (spawnerItem != null && !spawnerItem.isEmpty()) {
                    item = ShopItemUtil.getSpawnerItem(spawnerItem, stackSize, true);
                } else if (spawnerType != null && !spawnerType.isEmpty()) {
                    item = ShopItemUtil.getSpawnerItem(spawnerType, stackSize, false);
                } else {
                    item = new ItemStack(material, stackSize);
                }
            } else if (material.name().equals("TRIAL_SPAWNER")) {
                item = new ItemStack(material, stackSize);

                if (item.getItemMeta() instanceof BlockStateMeta) {
                    BlockStateMeta meta = (BlockStateMeta) item.getItemMeta();

                    // Try to handle as CreatureSpawner (works for both SPAWNER and TRIAL_SPAWNER)
                    if (meta.getBlockState() instanceof CreatureSpawner) {
                        CreatureSpawner cs = (CreatureSpawner) meta.getBlockState();

                        if (spawnerType != null) {
                            try {
                                cs.setSpawnedType(EntityType.valueOf(spawnerType.toUpperCase()));
                            } catch (Exception ignored) {
                            }
                        }

                        meta.setBlockState(cs);
                        item.setItemMeta(meta);
                    }
                }
            } else {
                item = new ItemStack(material, stackSize);
            }

            // Apply potion type if this is a potion or tipped arrow
            if (potionType != null && (material == Material.POTION || material == Material.SPLASH_POTION || material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW)) {
                ShopItemUtil.applyPotionType(item, potionType, potionLevel);
            }

            if (material == Material.PLAYER_HEAD) {
                ShopItemUtil.applyHeadTexture(item, headTexture, headOwner);
            }

            // Apply enchantments
            if (enchantments != null && !enchantments.isEmpty()) {
                ShopItemUtil.applyEnchantments(item, enchantments);
            }

            ItemMeta meta = item.getItemMeta();
            if (meta != null) {
                if (customName != null) meta.setDisplayName(ShopItemUtil.color(customName));
                if (customLore != null && !customLore.isEmpty()) {
                    List<String> coloredLore = new ArrayList<>();
                    for (String line : customLore) {
                        if (line == null) continue;
                        coloredLore.addAll(ShopItemUtil.splitAndColor(line));
                    }
                    meta.setLore(coloredLore);
                }
                if (hideAttr) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
                if (hideAdd) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
                item.setItemMeta(meta);
            }

            // Apply unstable TNT components if enabled
            if (unstableTnt && material == Material.TNT) {
                try {
                    // Method 1: Modern BlockData API (Available since 1.13)
                    ItemMeta currentMeta = item.getItemMeta();
                    boolean appliedViaApi = false;

                    if (currentMeta instanceof BlockStateMeta) {
                        BlockStateMeta bsm = (BlockStateMeta) currentMeta;
                        org.bukkit.block.BlockState state = bsm.getBlockState();
                        try {
                            org.bukkit.block.data.BlockData data = org.bukkit.Bukkit.createBlockData(Material.TNT);
                            if (data instanceof org.bukkit.block.data.type.TNT) {
                                ((org.bukkit.block.data.type.TNT) data).setUnstable(true);
                                state.setBlockData(data);
                                bsm.setBlockState(state);
                                item.setItemMeta(bsm);
                                appliedViaApi = true;
                                me.dralle.shop.util.ConsoleLog.info(ShopPlugin.getInstance(), "[DEBUG] Applied unstable TNT via BlockData API");
                            }
                        } catch (Throwable ignored) {
                        }
                    }

                    if (!appliedViaApi) {
                        // Method 2: Modern Components (1.21 / 1.20.5+)
                        try {
                            item = org.bukkit.Bukkit.getUnsafe().modifyItemStack(item, "minecraft:tnt[minecraft:block_state={unstable:\"true\"}]");
                            me.dralle.shop.util.ConsoleLog.info(ShopPlugin.getInstance(), "[DEBUG] Applied unstable TNT via Data Components");
                        } catch (Throwable t1) {
                            me.dralle.shop.util.ConsoleLog.warn(ShopPlugin.getInstance(), "Failed to apply unstable TNT property.");
                        }
                    }
                } catch (Exception e) {
                    me.dralle.shop.util.ConsoleLog.warn(ShopPlugin.getInstance(), "Error while applying unstable property: " + e.getMessage());
                }
            }

            // Try to add to inventory
            HashMap<Integer, ItemStack> leftovers = player.getInventory().addItem(item);

            // Drop leftover items
            leftovers.values().forEach(leftover ->
                    player.getWorld().dropItem(player.getLocation(), leftover));

            remaining -= stackSize;
        }
    }

    /* ============================================================
     * METADATA HELPERS
     * ============================================================ */
    private static String meta(Player p, String key, String def) {
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asString() : def;
    }

    private static int metaInt(Player p, String key, int def) {
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asInt() : def;
    }

    private static double metaDouble(Player p, String key, double def) {
        return p.hasMetadata(key) ? p.getMetadata(key).getFirst().asDouble() : def;
    }

    private static boolean metaBool(Player p, String key) {
        return p.hasMetadata(key) && p.getMetadata(key).getFirst().asBoolean();
    }
}
