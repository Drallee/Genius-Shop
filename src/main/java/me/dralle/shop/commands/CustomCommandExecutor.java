package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.gui.PurchaseMenu;
import me.dralle.shop.gui.SellMenu;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ItemConditionUtil;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.Collections;
import java.util.List;

public class CustomCommandExecutor implements TabExecutor {
    private final ShopPlugin plugin;
    private final CustomCommandDefinition definition;
    private final CustomSellAllService sellAllService;

    public CustomCommandExecutor(ShopPlugin plugin, CustomCommandDefinition definition, CustomSellAllService sellAllService) {
        this.plugin = plugin;
        this.definition = definition;
        this.sellAllService = sellAllService;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length > 0) {
            String usage = definition.getUsage().isEmpty() ? "/" + label : definition.getUsage();
            sender.sendMessage(ShopItemUtil.color(usage));
            return true;
        }

        if (!definition.getPermission().isBlank() && !sender.hasPermission(definition.getPermission())) {
            String msg = definition.getNoPermissionMessage().isBlank()
                    ? plugin.getMessages().getMessage("custom-command-no-permission")
                    : definition.getNoPermissionMessage();
            sender.sendMessage(ShopItemUtil.color(msg));
            return true;
        }

        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.getMessages().getMessage("custom-command-player-only"));
            return true;
        }

        CustomCommandAction action = definition.getAction();
        if (action == null || action.getType() == null) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-invalid-config"));
            return true;
        }

        switch (action.getType()) {
            case OPEN_SHOP -> openShop(player, action.getShopKey());
            case OPEN_ITEM -> openItem(player, action);
            case SELL_ALL -> sellAllService.sellAll(player, action.getShopKey());
        }
        return true;
    }

    private void openShop(Player player, String shopKey) {
        if (!canAccessShop(player, shopKey)) return;
        Bukkit.getScheduler().runTask(plugin, () -> plugin.getGenericShopGui().openShop(player, shopKey, 1, hasShopBypass(player)));
    }

    private void openItem(Player player, CustomCommandAction action) {
        String shopKey = action.getShopKey();
        if (!canAccessShop(player, shopKey)) return;

        ShopData shop = plugin.getShopManager().getShop(shopKey);
        ShopItem item = shop != null ? shop.getItemByUniqueKey(action.getItemKey()) : null;
        if (item == null) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-item-not-found")
                    .replace("%shop%", shopKey == null ? "" : shopKey)
                    .replace("%item%", action.getItemKey() == null ? "" : action.getItemKey()));
            return;
        }

        if (item.getPermission() != null && !item.getPermission().isEmpty() && !player.hasPermission(item.getPermission())) {
            player.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return;
        }
        if (!ShopTimeUtil.isShopAvailable(item.getAvailableTimes())) {
            player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                    .replace("%shop%", item.getName() != null ? ShopItemUtil.color(item.getName()) : item.getMaterial().name())
                    .replace("%available-times%", ShopTimeUtil.formatAvailableTimes(item.getAvailableTimes(), plugin)));
            return;
        }
        ItemConditionUtil.ConditionResult condition = ItemConditionUtil.check(plugin, player, item);
        if (!condition.allowed()) {
            player.sendMessage(condition.message());
            return;
        }

        Bukkit.getScheduler().runTask(plugin, () -> {
            if (action.getMenuMode() == CustomCommandMenuMode.BUY) {
                if (item.getPrice() <= 0) {
                    player.sendMessage(plugin.getMessages().getMessage("custom-command-buy-unavailable"));
                    return;
                }
                PurchaseMenu.open(player, item, shopKey, 1);
            } else if (action.getMenuMode() == CustomCommandMenuMode.SELL) {
                if (item.getSellPrice() == null || item.getSellPrice() <= 0) {
                    player.sendMessage(plugin.getMessages().getMessage("custom-command-sell-unavailable"));
                    return;
                }
                SellMenu.open(player, item, shopKey, 1);
            } else {
                plugin.getGenericShopGui().openItemMenu(player, item, shopKey, 1);
            }
        });
    }

    private boolean canAccessShop(Player player, String shopKey) {
        ShopData shop = plugin.getShopManager().getShop(shopKey);
        if (shop == null) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-shop-not-found").replace("%shop%", shopKey == null ? "" : shopKey));
            return false;
        }
        if (shop.getPermission() != null && !shop.getPermission().isEmpty() && !player.hasPermission(shop.getPermission()) && !hasShopBypass(player)) {
            player.sendMessage(plugin.getMessages().getMessage("custom-command-no-shop-access").replace("%shop%", ShopItemUtil.color(shop.getGuiName())));
            return false;
        }
        if (!ShopTimeUtil.isShopAvailable(shop.getAvailableTimes()) && !hasShopBypass(player)) {
            player.sendMessage(plugin.getMessages().getMessage("shop-not-available")
                    .replace("%shop%", ShopItemUtil.color(shop.getGuiName()))
                    .replace("%available-times%", ShopTimeUtil.formatAvailableTimes(shop.getAvailableTimes(), plugin)));
            return false;
        }
        return true;
    }

    private boolean hasShopBypass(Player player) {
        return !definition.getShopBypassPermission().isBlank() && player.hasPermission(definition.getShopBypassPermission());
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        return Collections.emptyList();
    }
}
