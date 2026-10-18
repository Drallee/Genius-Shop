package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.api.events.ShopOpenEvent;
import me.dralle.shop.discovery.ItemDiscoveryService;
import me.dralle.shop.discovery.ItemDiscoveryService.Entry;
import me.dralle.shop.discovery.ItemDiscoveryService.Mode;
import me.dralle.shop.discovery.ItemReference;
import me.dralle.shop.util.ShopItemUtil;
import me.dralle.shop.util.ShopTimeUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.inventory.InventoryOpenEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ItemDiscoveryMenu implements Listener {
    public record State(Mode mode, String query, int page) { }
    public static final class ResultsHolder extends MenuInventoryHolder {
        final State state;
        final List<ItemReference> items;
        final int pages;
        final ShopLayout layout;
        public ResultsHolder(State state, List<ItemReference> items, int pages) {
            this(state, items, pages, null);
        }
        public ResultsHolder(State state, List<ItemReference> items, int pages, ShopLayout layout) {
            this.state = state; this.items = List.copyOf(items); this.pages = pages;
            this.layout = layout;
        }
    }
    public static final class DetailHolder extends MenuInventoryHolder {
        final ItemReference item;
        final State back;
        public DetailHolder(ItemReference item, State back) { this.item = item; this.back = back; }
    }
    private record Prompt(UUID token, State back) { }
    private final ShopPlugin plugin;
    private final ItemDiscoveryService service;
    private final Map<UUID, Prompt> prompts = new ConcurrentHashMap<>();
    private final Map<UUID, UUID> intents = new ConcurrentHashMap<>();

    public ItemDiscoveryMenu(ShopPlugin plugin, ItemDiscoveryService service) { this.plugin = plugin; this.service = service; }

    public void shutdown() { prompts.clear(); intents.clear(); }

    public void open(Player player, Mode mode, String query, int requestedPage) {
        prompts.remove(player.getUniqueId());
        intents.remove(player.getUniqueId());
        if (!ItemDiscoveryService.canUse(player)) { service.unavailable(player); return; }
        String search = query == null ? "" : query.strip();
        if (search.length() > 64) { player.sendMessage(service.text("query-too-long")); return; }
        List<Entry> all = service.list(player, mode, search);
        ShopLayout layout = ShopLayout.forDiscovery(plugin.getMenuManager().getGuiSettingsConfig(), mode);
        int capacity = layout.capacity();
        int pages = Math.max(1, (all.size() + capacity - 1) / capacity);
        int page = Math.max(1, Math.min(requestedPage, pages));
        List<Entry> visible = all.subList((page - 1) * capacity, Math.min(page * capacity, all.size()));
        State state = new State(mode, search, page);
        Inventory inventory = new ResultsHolder(state, visible.stream().map(Entry::reference).toList(), pages, layout)
                .createInventory(layout.size(), service.text(mode.name().toLowerCase(Locale.ROOT)) + " " + page + "/" + pages);
        layout.fill(plugin, inventory);
        for (int i = 0; i < visible.size(); i++) {
            ItemStack icon = icon(player, visible.get(i));
            ItemMeta meta = icon.getItemMeta();
            if (meta != null) {
                List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
                lore.add(service.text("shop-line").replace("%shop%", ShopItemUtil.color(visible.get(i).shop().getGuiName())));
                lore.add(service.text("open-hint"));
                meta.setLore(lore); icon.setItemMeta(meta);
            }
            inventory.setItem(layout.contentSlots().get(i), icon);
        }
        if (visible.isEmpty()) inventory.setItem(layout.contentSlots().get(capacity / 2), button(Material.GRAY_STAINED_GLASS_PANE, "empty"));
        for (var entry : layout.controls().entrySet()) {
            if (entry.getKey() == ShopLayout.Control.PREVIOUS && page == 1 || entry.getKey() == ShopLayout.Control.NEXT && page == pages) continue;
            ItemStack control = layout.configuredButton(plugin, entry.getKey());
            if (entry.getKey() == ShopLayout.Control.FAVORITES && mode == Mode.FAVORITES || entry.getKey() == ShopLayout.Control.RECENT && mode == Mode.RECENT) {
                var meta = control.getItemMeta();
                if (meta != null) {
                    List<String> lore = meta.hasLore() ? new ArrayList<>(meta.getLore()) : new ArrayList<>();
                    lore.add(service.text("clear-hint"));
                    meta.setLore(lore); control.setItemMeta(meta);
                }
            }
            inventory.setItem(entry.getValue(), control);
        }
        int information = layout.size() - 1;
        if (!layout.contentSlots().contains(information) && !layout.emptySlots().contains(information) && layout.controlAt(information) == null) {
            inventory.setItem(information, ShopItemUtil.create(Material.PAPER, 1, service.text("results").replace("%count%", String.valueOf(all.size())),
                    search.isEmpty() ? List.of() : List.of(ShopItemUtil.color("&7" + search))));
        }
        player.openInventory(inventory);
    }

    private ItemStack icon(Player player, Entry entry) {
        return plugin.getGenericShopGui().createGuiItem(player, entry.item(), entry.shop().getKey(),
                ShopTimeUtil.formatAvailableTimes(entry.shop().getAvailableTimes(), plugin), plugin.getCurrencySymbol(), entry.shop());
    }

    private ItemStack button(Material material, String title, String... hints) {
        return ShopItemUtil.create(material, 1, service.text(title), Arrays.stream(hints).map(service::text).toList());
    }

    public void detail(Player player, ItemReference reference, State back) {
        Entry entry = service.resolve(player, reference);
        if (entry == null) { service.unavailable(player); open(player, back.mode(), back.query(), back.page()); return; }
        service.recordRecent(player, entry.shop().getKey(), entry.item());
        Inventory inventory = new DetailHolder(reference, back).createInventory(27, service.text("item-title"));
        inventory.setItem(4, icon(player, entry));
        inventory.setItem(10, button(Material.NETHER_STAR, service.favoriteReference(player, entry) == null ? "add-favorite" : "remove-favorite"));
        if (entry.item().getPrice() > 0) inventory.setItem(12, button(Material.EMERALD, "buy"));
        if (entry.item().getSellPrice() != null && entry.item().getSellPrice() > 0) inventory.setItem(14, button(Material.GOLD_INGOT, "sell"));
        inventory.setItem(16, button(Material.CHEST, "open-shop"));
        inventory.setItem(22, button(Material.ARROW, "back"));
        player.openInventory(inventory);
    }

    public void beginSearch(Player player, State back) {
        if (!ItemDiscoveryService.canUse(player)) { service.unavailable(player); return; }
        Prompt prompt = new Prompt(UUID.randomUUID(), back);
        prompts.put(player.getUniqueId(), prompt);
        intents.put(player.getUniqueId(), prompt.token());
        player.closeInventory();
        player.sendMessage(service.text("prompt"));
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (prompts.remove(player.getUniqueId(), prompt)) {
                intents.remove(player.getUniqueId(), prompt.token());
                if (player.isOnline()) player.sendMessage(service.text("search-expired"));
            }
        }, 1200L);
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent event) {
        Player player = event.getPlayer();
        UUID uuid = player.getUniqueId();
        Prompt prompt = prompts.remove(uuid);
        if (prompt == null) return;
        event.setCancelled(true);
        String query = event.getMessage().strip();
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!intents.remove(uuid, prompt.token()) || !player.isOnline()) return;
            if (query.equalsIgnoreCase("cancel")) open(player, prompt.back().mode(), prompt.back().query(), prompt.back().page());
            else if (query.length() > 64) player.sendMessage(service.text("query-too-long"));
            else open(player, Mode.SEARCH, query, 1);
        });
    }

    @EventHandler public void onQuit(PlayerQuitEvent event) {
        UUID uuid = event.getPlayer().getUniqueId();
        prompts.remove(uuid); intents.remove(uuid); service.clearTrade(uuid);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onInventoryOpen(InventoryOpenEvent event) {
        UUID uuid = event.getPlayer().getUniqueId();
        prompts.remove(uuid);
        intents.remove(uuid);
    }

    private void defer(Player player, Runnable action) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (!player.isOnline()) return;
            if (!ItemDiscoveryService.canUse(player)) { service.unavailable(player); player.closeInventory(); return; }
            action.run();
        });
    }

    @EventHandler public void onDrag(InventoryDragEvent event) {
        if (event.getInventory().getHolder() instanceof ResultsHolder || event.getInventory().getHolder() instanceof DetailHolder) event.setCancelled(true);
    }

    @EventHandler public void onClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) return;
        Object holder = event.getInventory().getHolder();
        if (!(holder instanceof ResultsHolder) && !(holder instanceof DetailHolder)) return;
        event.setCancelled(true);
        int slot = event.getRawSlot();
        if (slot < 0 || slot >= event.getInventory().getSize()) return;
        if (event.getClick() != ClickType.LEFT && event.getClick() != ClickType.RIGHT && event.getClick() != ClickType.SHIFT_RIGHT) return;
        ClickType click = event.getClick();
        if (!ItemDiscoveryService.canUse(player)) {
            service.unavailable(player);
            Bukkit.getScheduler().runTask(plugin, () -> player.closeInventory());
            return;
        }
        if (holder instanceof ResultsHolder results) {
            State state = results.state;
            ShopLayout layout = ShopLayout.forDiscovery(plugin.getMenuManager().getGuiSettingsConfig(), state.mode());
            if (results.layout != null && !results.layout.equals(layout)) {
                defer(player, () -> open(player, state.mode(), state.query(), state.page()));
                return;
            }
            int index = layout.contentSlots().indexOf(slot);
            ShopLayout.Control control = layout.controlAt(slot);
            if (index >= 0 && index < results.items.size()) {
                ItemReference reference = results.items.get(index);
                defer(player, () -> {
                    if (click == ClickType.SHIFT_RIGHT) { service.toggleFavorite(player, reference); open(player, state.mode(), state.query(), state.page()); }
                    else detail(player, reference, state);
                });
            } else if (control == ShopLayout.Control.SEARCH) defer(player, () -> beginSearch(player, state));
            else if (control == ShopLayout.Control.FAVORITES || control == ShopLayout.Control.RECENT) defer(player, () -> {
                Mode mode = control == ShopLayout.Control.FAVORITES ? Mode.FAVORITES : Mode.RECENT;
                if (state.mode() == mode && click == ClickType.SHIFT_RIGHT) {
                    if (!plugin.getDataManager().clearPersonalItems(player.getUniqueId(), mode == Mode.FAVORITES)) player.sendMessage(service.text("save-failed"));
                }
                open(player, mode, "", 1);
            });
            else if (control == ShopLayout.Control.PREVIOUS && state.page() > 1) defer(player, () -> open(player, state.mode(), state.query(), state.page() - 1));
            else if (control == ShopLayout.Control.BACK) defer(player, () -> MainMenu.open(player));
            else if (control == ShopLayout.Control.NEXT && state.page() < results.pages) defer(player, () -> open(player, state.mode(), state.query(), state.page() + 1));
        } else if (holder instanceof DetailHolder detail) {
            defer(player, () -> {
                if (slot == 22) { open(player, detail.back.mode(), detail.back.query(), detail.back.page()); return; }
                Entry entry = service.resolve(player, detail.item);
                if (entry == null) { service.unavailable(player); open(player, detail.back.mode(), detail.back.query(), detail.back.page()); return; }
                if (slot == 10) { service.toggleFavorite(player, detail.item); detail(player, detail.item, detail.back); }
                else if (slot == 16) plugin.getGenericShopGui().openItemMenu(player, entry.item(), entry.shop().getKey(), 1);
                else if (slot == 12 || slot == 14) {
                    ShopOpenEvent open = new ShopOpenEvent(player, entry.shop());
                    Bukkit.getPluginManager().callEvent(open);
                    if (open.isCancelled()) return;
                    Entry latest = service.resolve(player, detail.item);
                    if (latest == null) { service.unavailable(player); player.closeInventory(); return; }
                    int usable = ShopLayout.forShop(plugin.getMenuManager().getGuiSettingsConfig(), latest.shop(), true).capacity();
                    int displaySlot = latest.item().isVariantMenuEnabled() && latest.item().getVariantGroupSlot() != null
                            ? latest.item().getVariantGroupSlot() : latest.item().getSlot();
                    int page = Math.max(1, displaySlot / usable + 1);
                    if (slot == 12 && latest.item().getPrice() > 0) PurchaseMenu.open(player, latest.item(), latest.shop().getKey(), page);
                    else if (slot == 14 && latest.item().getSellPrice() != null && latest.item().getSellPrice() > 0) SellMenu.open(player, latest.item(), latest.shop().getKey(), page);
                }
            });
        }
    }
}
