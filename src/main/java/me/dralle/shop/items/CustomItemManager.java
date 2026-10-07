package me.dralle.shop.items;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.CustomSellAllService;
import me.dralle.shop.gui.MainMenu;
import me.dralle.shop.util.ConsoleLog;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Container;
import org.bukkit.block.DoubleChest;
import org.bukkit.block.Lockable;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class CustomItemManager implements Listener {
    private final ShopPlugin plugin;
    private final CustomSellAllService selling;
    private final CustomItemRepository repository;
    private final NamespacedKey idKey;
    private final NamespacedKey usesKey;
    private Map<String, CustomItemDefinition> definitions = Map.of();
    private final Map<UUID, Map<String, Long>> cooldowns = new HashMap<>();
    private final Set<UUID> running = new java.util.HashSet<>();

    public CustomItemManager(ShopPlugin plugin, CustomSellAllService selling) {
        this.plugin = plugin;
        this.selling = selling;
        repository = new CustomItemRepository(plugin);
        idKey = new NamespacedKey(plugin, "custom-item-id");
        usesKey = new NamespacedKey(plugin, "custom-item-uses");
    }

    public void reload() {
        try { definitions = repository.load(); }
        catch (RuntimeException ex) { ConsoleLog.warn(plugin, "Custom items were not reloaded: " + ex.getMessage()); }
    }

    public Set<String> getIds() { return definitions.keySet(); }

    public boolean isCustomItem(ItemStack stack) {
        return stack != null && stack.hasItemMeta() && stack.getItemMeta().getPersistentDataContainer().has(idKey, PersistentDataType.STRING);
    }

    public ItemStack create(String id) {
        CustomItemDefinition definition = definitions.get(id);
        if (definition == null || !definition.enabled()) return null;
        ItemStack stack = ShopItemUtil.create(definition.material(), 1, definition.name(), definition.lore());
        ShopItemUtil.applyEnchantments(stack, definition.enchantments());
        ItemMeta meta = stack.getItemMeta();
        meta.getPersistentDataContainer().set(idKey, PersistentDataType.STRING, id);
        if (definition.maxUses() > 0) meta.getPersistentDataContainer().set(usesKey, PersistentDataType.INTEGER, definition.maxUses());
        stack.setItemMeta(meta);
        return stack;
    }

    public boolean give(CommandSender sender, String[] args) {
        if (!sender.hasPermission("geniusshop.giveitem")) {
            sender.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return true;
        }
        if (args.length < 3 || args.length > 4) {
            sender.sendMessage(ShopItemUtil.color("&c/shop giveitem <player> <item-id> [amount]"));
            return true;
        }
        Player target = Bukkit.getPlayerExact(args[1]);
        ItemStack stack = create(args[2]);
        if (target == null || stack == null) {
            sender.sendMessage(ShopItemUtil.color("&cUnknown online player or enabled custom item."));
            return true;
        }
        int amount;
        try { amount = args.length == 4 ? Integer.parseInt(args[3]) : 1; }
        catch (NumberFormatException ex) { amount = 0; }
        if (amount < 1 || amount > stack.getMaxStackSize() || (definitions.get(args[2]).maxUses() > 0 && amount != 1)) {
            sender.sendMessage(ShopItemUtil.color("&cInvalid amount. Limited-use items must be given one at a time."));
            return true;
        }
        stack.setAmount(amount);
        ItemStack[] before = target.getInventory().getStorageContents();
        for (int slot = 0; slot < before.length; slot++) {
            if (before[slot] != null) before[slot] = before[slot].clone();
        }
        if (!target.getInventory().addItem(stack).isEmpty()) {
            target.getInventory().setStorageContents(before);
            sender.sendMessage(ShopItemUtil.color("&cThe player's inventory could not hold all of the items."));
            return true;
        }
        sender.sendMessage(ShopItemUtil.color("&aGave " + amount + " " + args[2] + " to " + target.getName() + "."));
        return true;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getHand() != EquipmentSlot.HAND
                || (event.getAction() != Action.RIGHT_CLICK_AIR && event.getAction() != Action.RIGHT_CLICK_BLOCK)) return;
        ItemStack stack = event.getItem();
        if (!isCustomItem(stack)) return;
        String id = stack.getItemMeta().getPersistentDataContainer().get(idKey, PersistentDataType.STRING);
        CustomItemDefinition definition = definitions.get(id);
        if (definition == null || !definition.enabled()) return;
        boolean spawnerClick = SmartSpawnerSaleStorage.hasOpenedStorage(event.getPlayer(), event.getClickedBlock());
        boolean containerClick = spawnerClick || (event.getClickedBlock() != null && event.getClickedBlock().getState() instanceof Container);
        String trigger = containerClick ? "right-click-container"
                : event.getAction() == Action.RIGHT_CLICK_AIR ? "right-click-air" : "right-click-block";
        CustomItemDefinition.ItemAction action = definition.actions().get(trigger);
        if (action == null && containerClick) action = definition.actions().get("right-click-block");
        if (action == null) return;
        // Air interactions may already be cancelled by vanilla; denied block use must be respected.
        // SmartSpawner cancels its native click after opening a protected GUI; that verified opening is required above.
        if (!spawnerClick && event.getAction() == Action.RIGHT_CLICK_BLOCK
                && (event.useInteractedBlock() == Event.Result.DENY || event.useItemInHand() == Event.Result.DENY)) return;
        Player player = event.getPlayer();
        event.setCancelled(true);
        if (!definition.permission().isBlank() && !player.hasPermission(definition.permission())) {
            player.sendMessage(plugin.getMessages().getMessage("no-permission"));
            return;
        }
        long now = System.currentTimeMillis();
        long readyAt = cooldowns.getOrDefault(player.getUniqueId(), Map.of()).getOrDefault(id, 0L);
        if (readyAt > now) {
            player.sendMessage(ShopItemUtil.color("&cThis item is on cooldown for " + ((readyAt - now + 999L) / 1000L) + "s."));
            return;
        }
        ItemMeta meta = stack.getItemMeta();
        Integer storedUses = meta.getPersistentDataContainer().get(usesKey, PersistentDataType.INTEGER);
        int uses = storedUses == null ? definition.maxUses() : storedUses;
        if ((storedUses != null || definition.maxUses() > 0) && (uses <= 0 || stack.getAmount() != 1)) return;
        if (!running.add(player.getUniqueId())) return;
        CustomItemDefinition.ItemAction selectedAction = action;
        ItemStack original = stack.clone();
        Bukkit.getScheduler().runTask(plugin, () -> {
          try {
            ItemStack held = player.getInventory().getItemInMainHand();
            if (!player.isOnline() || !held.isSimilar(original) || held.getAmount() != original.getAmount()) return;
            if (!execute(player, event, selectedAction, id)) return;
            cooldowns.computeIfAbsent(player.getUniqueId(), ignored -> new HashMap<>()).put(id, now + definition.cooldownMillis());
            if (storedUses != null || definition.maxUses() > 0) {
                ItemStack current = player.getInventory().getItemInMainHand();
                if (!current.isSimilar(original) || current.getAmount() != original.getAmount()) return;
                ItemStack updated = current.clone();
                if (uses == 1) updated.setAmount(0);
                else {
                    ItemMeta updatedMeta = updated.getItemMeta();
                    updatedMeta.getPersistentDataContainer().set(usesKey, PersistentDataType.INTEGER, uses - 1);
                    updated.setItemMeta(updatedMeta);
                }
                player.getInventory().setItemInMainHand(updated);
            }
          } finally { running.remove(player.getUniqueId()); }
        });
    }

    private boolean execute(Player player, PlayerInteractEvent event, CustomItemDefinition.ItemAction action, String id) {
        switch (action.type()) {
            case SELL_CONTAINER -> {
                if (!player.hasPermission("geniusshop.sell") || event.getClickedBlock() == null) return false;
                if (SmartSpawnerSaleStorage.hasOpenedStorage(player, event.getClickedBlock())) {
                    boolean sold = false;
                    try (SmartSpawnerSaleStorage storage = SmartSpawnerSaleStorage.open(plugin, player, event.getClickedBlock())) {
                        sold = storage != null && selling.sellStorage(player, storage, action.shop(), action.multiplier(), action.useCampaigns(), id);
                        return sold;
                    } catch (RuntimeException ex) {
                        ConsoleLog.warn(plugin, "SmartSpawner wand sale failed: " + ex.getMessage());
                        if (!sold) player.sendMessage(ShopItemUtil.color("&cSmartSpawner storage could not be sold. Check the server log for compatibility details."));
                        return sold;
                    }
                }
                if (!(event.getClickedBlock().getState() instanceof Container container)) return false;
                Inventory inventory = container.getInventory();
                if (locked(inventory.getHolder()) || !container.getWorld().isChunkLoaded(container.getX() >> 4, container.getZ() >> 4)) return false;
                // Use the real opening path so protection plugins receive the normal server event.
                var view = player.openInventory(inventory);
                if (view == null || !inventory.equals(view.getTopInventory())) return false;
                player.closeInventory();
                return selling.sellContainer(player, inventory, action.shop(), action.multiplier(), action.useCampaigns(), id);
            }
            case OPEN_MAIN_MENU -> {
                if (!player.hasPermission("geniusshop.use")) return false;
                Inventory previous = player.getOpenInventory().getTopInventory();
                MainMenu.open(player);
                return player.getOpenInventory().getTopInventory() != previous;
            }
            case OPEN_SHOP -> {
                var shop = plugin.getShopManager().getShop(action.shop());
                if (!player.hasPermission("geniusshop.use") || shop == null
                        || (shop.getPermission() != null && !shop.getPermission().isBlank() && !player.hasPermission(shop.getPermission()))) return false;
                Inventory previous = player.getOpenInventory().getTopInventory();
                plugin.getGenericShopGui().openShop(player, action.shop(), 1);
                return player.getOpenInventory().getTopInventory() != previous;
            }
            case OPEN_BULK_SELL_MENU -> {
                if (!player.hasPermission("geniusshop.sell")) return false;
                Inventory previous = player.getOpenInventory().getTopInventory();
                plugin.getBulkSellMenu().open(player);
                return player.getOpenInventory().getTopInventory() != previous;
            }
            case COMMAND -> {
                boolean executed = false;
                for (String raw : action.commands()) {
                    String command = raw.replace("%player%", player.getName()).replaceFirst("^/", "");
                    executed |= Bukkit.dispatchCommand(action.console() ? Bukkit.getConsoleSender() : player, command);
                }
                return executed;
            }
        }
        return false;
    }

    private boolean locked(InventoryHolder holder) {
        if (holder instanceof Lockable lockable && lockable.isLocked()) return true;
        return holder instanceof DoubleChest chest && (locked(chest.getLeftSide()) || locked(chest.getRightSide()));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) { cooldowns.remove(event.getPlayer().getUniqueId()); }

}
