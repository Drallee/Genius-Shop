package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ItemUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.CreatureSpawner;
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
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

public class PurchaseMenu implements Listener {

    public PurchaseMenu(ShopPlugin plugin) {
    }

    /* ============================================================
     * OPEN FROM SHOP ITEM
     * ============================================================ */
    public static void open(Player player, ShopItem item, String shopKey, int shopPage) {
        double currentPrice = calculatePrice(item);
        open(player,
                item.getMaterial(),
                currentPrice,
                item.getAmount(),
                item.getSpawnerType(),
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
                item.isDynamicPricing(),
                item.getMinPrice(),
                item.getMaxPrice(),
                item.getPriceChange()
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
                            boolean dynamicPricing,
                            double minPrice,
                            double maxPrice,
                            double priceChange) {

        ShopPlugin plugin = ShopPlugin.getInstance();
        String currency = plugin.getCurrencySymbol();

        if (price == null || price <= 0) {
            player.sendMessage(plugin.getMessages().getMessage("cannot-buy"));
            return;
        }

        String prefix = plugin.getMenuManager().getPurchaseMenuConfig().getString("title-prefix", "&8Buying ");
        String title = ItemUtil.color(prefix + customName);
        Inventory inv = Bukkit.createInventory(player, 54, title);

        // Lore
        List<String> lore = new ArrayList<>();

        if (customLore != null) {
            for (String line : customLore) lore.addAll(ItemUtil.splitAndColor(line));
            lore.add("");
        }

        String amountLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.amount-line", "&eAmount: &7%amount%");
        String totalLine = plugin.getMenuManager().getGuiSettingsConfig().getString("gui.item-lore.total-line", "&eTotal: &7%total%");
        lore.add(ItemUtil.color(amountLine.replace("%amount%", String.valueOf(amount))));
        lore.add(ItemUtil.color(totalLine.replace("%total%", currency + (price * amount))));

        if (spawnerType != null) {
            lore.add(ItemUtil.color("&7Spawner: &e" + spawnerType));
        }
        if (potionType != null) {
            lore.add(ItemUtil.color("&7Potion: &d" + potionType));
        }

        if (limit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
            lore.add(ItemUtil.color("&eLimit: &7" + current + "/" + limit));
        }

        lore.add("");

        // Display item with a proper count (max 64 for display, actual amount shown in lore)
        int displayAmount = Math.min(amount, 64);
        ItemStack display = ItemUtil.create(material, displayAmount, customName, lore);

        // Apply potion type if this is a potion or tipped arrow
        if (potionType != null && (material == Material.POTION || material == Material.SPLASH_POTION || material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW)) {
            ItemUtil.applyPotionType(display, potionType, potionLevel);
        }

        // Apply enchantments
        if (enchantments != null && !enchantments.isEmpty()) {
            ItemUtil.applyEnchantments(display, enchantments);
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
                shopName = ItemUtil.color(shopData.getGuiName());
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
            Material addMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add.material", "LIME_STAINED_GLASS_PANE"));
            var addSection = plugin.getMenuManager().getPurchaseMenuConfig().getConfigurationSection("buttons.add");
            if (addSection != null) {
                for (String key : addSection.getKeys(false)) {
                    if (key.equals("material")) continue;
                    try {
                        int value = Integer.parseInt(key);
                        String name = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add." + key + ".name", "&aAdd " + value);
                        int slot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.add." + key + ".slot", -1);
                        if (slot >= 0 && slot < 54) {
                            inv.setItem(slot, ItemUtil.create(addMaterial, 1, name, null));
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic remove buttons
        if (amount > 1) {
            Material remMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove.material", "RED_STAINED_GLASS_PANE"));
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
                                inv.setItem(slot, ItemUtil.create(remMaterial, 1, name, null));
                            }
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // Dynamic set buttons
        Material setMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set.material", "YELLOW_STAINED_GLASS_PANE"));
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
                            inv.setItem(slot, ItemUtil.create(setMaterial, 1, name, null));
                        }
                    }
                } catch (NumberFormatException ignored) {
                }
            }
        }

        // Confirm purchase
        Material confirmMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.material", "LIME_STAINED_GLASS"));
        int confirmSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.confirm.slot", 39);
        List<String> confirmLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.confirm.lore");
        List<String> confirmLoreColored = new ArrayList<>();
        for (String line : confirmLore) {
            confirmLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(confirmSlot, ItemUtil.create(confirmMaterial, 1, confirm, confirmLoreColored.isEmpty() ? null : confirmLoreColored));

        // Back
        Material backMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.material", "ENDER_CHEST"));
        int backSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.back.slot", 40);
        List<String> backLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.back.lore");
        List<String> backLoreColored = new ArrayList<>();
        for (String line : backLore) {
            backLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(backSlot, ItemUtil.create(backMaterial, 1, back, backLoreColored.isEmpty() ? null : backLoreColored));

        // Cancel
        Material cancelMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.material", "RED_STAINED_GLASS"));
        int cancelSlot = plugin.getMenuManager().getPurchaseMenuConfig().getInt("buttons.cancel.slot", 41);
        List<String> cancelLore = plugin.getMenuManager().getPurchaseMenuConfig().getStringList("buttons.cancel.lore");
        List<String> cancelLoreColored = new ArrayList<>();
        for (String line : cancelLore) {
            cancelLoreColored.add(ItemUtil.color(line
                    .replace("%shop%", shopName)
                    .replace("%page%", String.valueOf(shopPage))));
        }
        inv.setItem(cancelSlot, ItemUtil.create(cancelMaterial, 1, cancel, cancelLoreColored.isEmpty() ? null : cancelLoreColored));

        player.openInventory(inv);

        // Store metadata
        player.setMetadata("buy.price", new FixedMetadataValue(plugin, price));
        player.setMetadata("buy.material", new FixedMetadataValue(plugin, material.name()));
        player.setMetadata("buy.amount", new FixedMetadataValue(plugin, amount));
        if (spawnerType != null)
            player.setMetadata("buy.spawnerType", new FixedMetadataValue(plugin, spawnerType));
        else
            player.removeMetadata("buy.spawnerType", plugin);

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

        ShopPlugin plugin = ShopPlugin.getInstance();
        String titlePrefix = plugin.getMenuManager().getPurchaseMenuConfig().getString("title-prefix", "&8Buying ");

        if (!e.getView().getTitle().startsWith(ItemUtil.color(titlePrefix))) return;

        e.setCancelled(true);

        ItemStack clicked = e.getCurrentItem();
        if (clicked == null) return;

        // Load metadata
        String matName = meta(player, "buy.material", "DIRT");
        double price = metaDouble(player, "buy.price", 0);
        int amount = metaInt(player, "buy.amount", 1);
        String spawnerType = meta(player, "buy.spawnerType", null);
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
        boolean dynamicPricing = metaBool(player, "buy.dynamicPricing");
        double minPrice = metaDouble(player, "buy.minPrice", 0);
        double maxPrice = metaDouble(player, "buy.maxPrice", 0);
        double priceChange = metaDouble(player, "buy.priceChange", 0);

        // Restore lore if present
        List<String> customLore = null;
        if (player.hasMetadata("buy.customLore")) {
            String packed = player.getMetadata("buy.customLore").getFirst().asString();
            customLore = Arrays.asList(packed.split("\n"));
        }

        // Restore enchantments if present
        Map<String, Integer> enchantments = null;
        if (player.hasMetadata("buy.enchantments")) {
            enchantments = (Map<String, Integer>) player.getMetadata("buy.enchantments").getFirst().value();
        }

        Material material = Material.matchMaterial(matName);
        if (material == null) material = Material.DIRT;

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
                shopName = ItemUtil.color(shopData.getGuiName());
            }
        }

        String back = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.name", "&cBACK")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));
        String cancel = plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.name", "&cCANCEL")
                .replace("%shop%", shopName)
                .replace("%page%", String.valueOf(shopPage));

        // Materials
        Material addMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.add.material", "LIME_STAINED_GLASS_PANE"));
        Material remMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.remove.material", "RED_STAINED_GLASS_PANE"));
        Material setMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.set.material", "YELLOW_STAINED_GLASS_PANE"));
        Material confirmMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.confirm.material", "LIME_STAINED_GLASS"));
        Material backMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.back.material", "ENDER_CHEST"));
        Material cancelMaterial = Material.valueOf(plugin.getMenuManager().getPurchaseMenuConfig().getString("buttons.cancel.material", "RED_STAINED_GLASS"));

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
                        if (name.equals(ItemUtil.color(buttonName))) {
                            amount = Math.min(amount + value, maxAmount);
                            open(player, material, price, amount, spawnerType, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, dynamicPricing, minPrice, maxPrice, priceChange);
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
                        if (name.equals(ItemUtil.color(buttonName))) {
                            amount = Math.max(1, amount - value);
                            open(player, material, price, amount, spawnerType, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, dynamicPricing, minPrice, maxPrice, priceChange);
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
                        if (name.equals(ItemUtil.color(buttonName))) {
                            amount = Math.max(1, Math.min(value, maxAmount));
                            open(player, material, price, amount, spawnerType, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, dynamicPricing, minPrice, maxPrice, priceChange);
                            return;
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }

        // CONFIRM PURCHASE
        if (clicked.getType() == confirmMaterial &&
                name.equals(ItemUtil.color(confirm))) {

            finalizePurchase(player, material, amount, price, spawnerType, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, itemKey, limit, dynamicPricing, minPrice, maxPrice, priceChange);
            return;
        }

        // BACK
        if (clicked.getType() == backMaterial &&
                name.equals(ItemUtil.color(back))) {
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
                name.equals(ItemUtil.color(cancel))) {
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
                                  boolean dynamicPricing,
                                  double minPrice,
                                  double maxPrice,
                                  double priceChange) {

        ShopPlugin plugin = ShopPlugin.getInstance();
        EconomyHook eco = plugin.getEconomy();

        if (!eco.isReady()) {
            player.sendMessage(plugin.getMessages().getMessage("economy-not-ready"));
            return;
        }

        // Check limit
        if (limit > 0 && itemKey != null) {
            int current = plugin.getDataManager().getPlayerCount(player.getUniqueId(), itemKey);
            if (current + amount > limit) {
                player.sendMessage(ItemUtil.color("&cYou have reached the purchase limit for this item! (" + current + "/" + limit + ")"));
                return;
            }
        }

        double total = price * amount;

        // Check balance
        String replacement = customName != null ? customName.replace("&", "§") : material.name();
        double balance = eco.getBalance(player);
        plugin.debug("Purchase attempt: " + player.getName() + " buying " + amount + "x " + material + " for $" + total + " (balance: $" + balance + ")");

        if (!eco.withdraw(player, total)) {
            plugin.debug("Purchase failed: Insufficient funds");
            String msg = plugin.getMessages().getMessage("not-enough-money")
                    .replace("%amount%", String.valueOf(amount))
                    .replace("%item%", replacement)
                    .replace("%price%", String.valueOf(total));
            player.sendMessage(msg);
            return;
        }

        // Deliver item (with overflow dropping)
        // Only apply custom name/lore if their respective require flags are true
        String nameToApply = requireName ? customName : null;
        List<String> loreToApply = requireLore ? customLore : null;

        giveItemSafe(player, material, amount, spawnerType, potionType, potionLevel, nameToApply, loreToApply, enchantments, hideAttr, hideAdd, unstableTnt);

        // Update counts
        if (itemKey != null) {
            plugin.getDataManager().incrementPlayerCount(player.getUniqueId(), itemKey, amount);
            if (dynamicPricing) {
                plugin.getDataManager().incrementGlobalCount(itemKey, amount);
            }
        }

        plugin.itemsBought += amount;
        plugin.debug("Purchase successful: " + player.getName() + " bought " + amount + "x " + material + " for $" + total);

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
                .replace("%price%", String.valueOf(total));

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
            String shopKey = player.hasMetadata("buy.shopKey") ? player.getMetadata("buy.shopKey").getFirst().asString() : null;
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
        String shopKey = player.hasMetadata("buy.shopKey") ? player.getMetadata("buy.shopKey").getFirst().asString() : null;
        int shopPage = player.hasMetadata("buy.shopPage") ? player.getMetadata("buy.shopPage").getFirst().asInt() : 1;
        open(player, material, nextPrice, amount, spawnerType, potionType, potionLevel, customName, customLore, enchantments, hideAttr, hideAdd, requireName, requireLore, unstableTnt, shopKey, shopPage, itemKey, limit, dynamicPricing, minPrice, maxPrice, priceChange);
    }

    /* ============================================================
     * GIVE ITEM (With Overflow Drop)
     * ============================================================ */
    private void giveItemSafe(Player player,
                              Material material,
                              int amount,
                              String spawnerType,
                              String potionType,
                              int potionLevel,
                              String customName,
                              List<String> customLore,
                              Map<String, Integer> enchantments,
                              boolean hideAttr,
                              boolean hideAdd,
                              boolean unstableTnt) {

        int remaining = amount;

        while (remaining > 0) {
            int stackSize = Math.min(remaining, material.getMaxStackSize());
            ItemStack item;

            // Spawner handling (both regular and trial spawners)
            if (material == Material.SPAWNER || material.name().equals("TRIAL_SPAWNER")) {
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
                    } else {
                        // If not CreatureSpawner, just use the item as is
                        // This handles future API changes
                    }
                }
            } else {
                item = new ItemStack(material, stackSize);
            }

            // Apply potion type if this is a potion or tipped arrow
            if (potionType != null && (material == Material.POTION || material == Material.SPLASH_POTION || material == Material.LINGERING_POTION || material == Material.TIPPED_ARROW)) {
                ItemUtil.applyPotionType(item, potionType, potionLevel);
            }

            // Apply enchantments
            if (enchantments != null && !enchantments.isEmpty()) {
                ItemUtil.applyEnchantments(item, enchantments);
            }

            ItemMeta meta = item.getItemMeta();
            if (meta != null) {
                if (customName != null) meta.setDisplayName(ItemUtil.color(customName));
                if (customLore != null && !customLore.isEmpty()) {
                    List<String> coloredLore = new ArrayList<>();
                    for (String line : customLore) {
                        if (line == null) continue;
                        coloredLore.addAll(ItemUtil.splitAndColor(line));
                    }
                    meta.setLore(coloredLore);
                }
                if (hideAttr) meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
                if (hideAdd) meta.addItemFlags(ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
                item.setItemMeta(meta);
            }

            // Apply unstable TNT NBT/Components if enabled
            if (unstableTnt && material == Material.TNT) {
                try {
                    // Method 1: Modern BlockData API (Available since 1.13)
                    // This is the cleanest way and should work on most versions.
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
                                ShopPlugin.getInstance().getLogger().info("[DEBUG] Applied unstable TNT via BlockData (1.13+ API)");
                            }
                        } catch (Throwable ignored) {
                            // Silently fail and try NBT methods
                        }
                    }

                    if (!appliedViaApi) {
                        // Method 2: Modern Components (1.20.5+)
                        // Syntax: item[minecraft:block_state={unstable:"true"}]
                        try {
                            // We try the modern component syntax first as it's what the user requested
                            item = org.bukkit.Bukkit.getUnsafe().modifyItemStack(item, "minecraft:tnt[minecraft:block_state={unstable:\"true\"}]");
                            ShopPlugin.getInstance().getLogger().info("[DEBUG] Applied unstable TNT via Modern Components (1.20.5+)");
                        } catch (Throwable t1) {
                            // Method 3: Legacy NBT (Pre-1.20.5)
                            // Syntax: item{BlockStateTag:{unstable:true}}
                            try {
                                item = org.bukkit.Bukkit.getUnsafe().modifyItemStack(item, "minecraft:tnt{BlockStateTag:{unstable:true}}");
                                ShopPlugin.getInstance().getLogger().info("[DEBUG] Applied unstable TNT via Legacy NBT");
                            } catch (Throwable t2) {
                                ShopPlugin.getInstance().getLogger().warning("Failed to apply unstable TNT via any method.");
                            }
                        }
                    }
                } catch (Exception e) {
                    ShopPlugin.getInstance().getLogger().warning("Error while applying unstable property: " + e.getMessage());
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
