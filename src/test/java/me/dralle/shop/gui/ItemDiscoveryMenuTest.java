package me.dralle.shop.gui;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.discovery.ItemDiscoveryService;
import me.dralle.shop.discovery.ItemDiscoveryService.Entry;
import me.dralle.shop.discovery.ItemDiscoveryService.Mode;
import me.dralle.shop.discovery.ItemReference;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.*;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.*;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.PluginManager;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.*;
import org.mockito.MockedStatic;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ItemDiscoveryMenuTest {
    private ShopPlugin plugin;
    private ItemDiscoveryService service;
    private ItemDiscoveryMenu menu;
    private Player player;
    private MockedStatic<Bukkit> bukkit;
    private MockedStatic<ShopItemUtil> icons;
    private final List<Inventory> inventories = new ArrayList<>();
    private final Deque<Runnable> tasks = new ArrayDeque<>();
    private final List<Runnable> timers = new ArrayList<>();

    @BeforeEach void setup() {
        plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        when(plugin.getMenuManager().getGuiSettingsConfig()).thenReturn(new org.bukkit.configuration.file.YamlConfiguration());
        when(plugin.getMessages().resolveConfigString(any(), anyString(), anyString())).thenAnswer(call -> call.getArgument(2));
        when(plugin.getMessages().resolveConfigStringList(any(), anyString())).thenReturn(List.of());
        service = mock(ItemDiscoveryService.class);
        when(service.text(anyString())).thenAnswer(call -> call.getArgument(0));
        when(service.list(any(), any(), anyString())).thenReturn(List.of());
        player = mock(Player.class);
        when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        when(player.isOnline()).thenReturn(true);
        when(player.hasPermission("geniusshop.use")).thenReturn(true);
        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        when(scheduler.runTask(eq(plugin), any(Runnable.class))).thenAnswer(call -> { tasks.add(call.getArgument(1)); return null; });
        when(scheduler.runTaskLater(eq(plugin), any(Runnable.class), anyLong())).thenAnswer(call -> { timers.add(call.getArgument(1)); return null; });
        bukkit = mockStatic(Bukkit.class);
        bukkit.when(Bukkit::getScheduler).thenReturn(scheduler);
        bukkit.when(Bukkit::getPluginManager).thenReturn(mock(PluginManager.class));
        bukkit.when(() -> Bukkit.createInventory(any(InventoryHolder.class), anyInt(), anyString())).thenAnswer(call -> {
            Inventory inventory = mock(Inventory.class);
            when(inventory.getHolder()).thenReturn(call.getArgument(0));
            when(inventory.getSize()).thenReturn(call.getArgument(1));
            inventories.add(inventory);
            return inventory;
        });
        icons = mockStatic(ShopItemUtil.class);
        Material buttonMaterial = mock(Material.class);
        when(buttonMaterial.isItem()).thenReturn(true);
        icons.when(() -> ShopItemUtil.getMaterial(any(), any(Material.class))).thenReturn(buttonMaterial);
        icons.when(() -> ShopItemUtil.create(any(Material.class), anyInt(), anyString(), anyList())).thenAnswer(call -> icon(call.getArgument(0)));
        icons.when(() -> ShopItemUtil.color(anyString())).thenAnswer(call -> call.getArgument(0));
        ItemStack preview = icon(Material.STONE);
        when(plugin.getGenericShopGui().createGuiItem(any(), any(), anyString(), anyString(), any(), any())).thenReturn(preview);
        menu = new ItemDiscoveryMenu(plugin, service);
    }
    @AfterEach void cleanup() { icons.close(); bukkit.close(); }
    private ItemStack icon(Material material) {
        ItemStack item = mock(ItemStack.class);
        when(item.getType()).thenReturn(material);
        when(item.getItemMeta()).thenReturn(mock(ItemMeta.class));
        return item;
    }
    private Entry entry(int slot) {
        ShopData shop = mock(ShopData.class);
        when(shop.getKey()).thenReturn("blocks");
        when(shop.getRows()).thenReturn(3);
        when(shop.getGuiName()).thenReturn("Blocks");
        ShopItem item = mock(ShopItem.class);
        when(item.getMaterial()).thenReturn(Material.STONE);
        when(item.getSlot()).thenReturn(slot);
        when(item.getPrice()).thenReturn(10D);
        return new Entry(shop, item, new ItemReference("blocks", "%064x".formatted(slot), slot));
    }
    private Inventory latest() { return inventories.getLast(); }
    private InventoryClickEvent click(Inventory inventory, int rawSlot, ClickType click) {
        InventoryClickEvent event = mock(InventoryClickEvent.class);
        when(event.getWhoClicked()).thenReturn(player);
        when(event.getInventory()).thenReturn(inventory);
        when(event.getRawSlot()).thenReturn(rawSlot);
        when(event.getClick()).thenReturn(click);
        menu.onClick(event);
        return event;
    }
    private AsyncPlayerChatEvent chat(String text) {
        AsyncPlayerChatEvent event = mock(AsyncPlayerChatEvent.class);
        when(event.getPlayer()).thenReturn(player);
        when(event.getMessage()).thenReturn(text);
        menu.onChat(event);
        return event;
    }

    @Test void resultsArePagedAndSelectionsKeepTheirOriginalReference() {
        List<Entry> entries = java.util.stream.IntStream.range(0, 50).mapToObj(this::entry).toList();
        when(service.list(player, Mode.SEARCH, "stone")).thenReturn(entries);
        menu.open(player, Mode.SEARCH, "stone", 999);
        ItemDiscoveryMenu.ResultsHolder holder = (ItemDiscoveryMenu.ResultsHolder) latest().getHolder();
        assertEquals(2, holder.state.page());
        assertEquals(5, holder.items.size());
        assertEquals(entries.get(45).reference(), holder.items.getFirst());
        when(service.resolve(player, entries.get(45).reference())).thenReturn(entries.get(45));
        click(latest(), 0, ClickType.LEFT);
        assertEquals(1, tasks.size()); tasks.remove().run();
        assertInstanceOf(ItemDiscoveryMenu.DetailHolder.class, latest().getHolder());
        assertEquals(entries.get(45).reference(), ((ItemDiscoveryMenu.DetailHolder) latest().getHolder()).item);
        verify(service).recordRecent(player, "blocks", entries.get(45).item());
    }

    @Test void customContentSlotsPageAndSelectUsingLogicalReferences() {
        var config = plugin.getMenuManager().getGuiSettingsConfig();
        config.set("gui.discovery.search.rows", 3);
        config.set("gui.discovery.search.content-slots", List.of(10, 11));
        config.set("gui.discovery.search.buttons.next-button.slot", 26);
        List<Entry> entries = java.util.stream.IntStream.range(0, 5).mapToObj(this::entry).toList();
        when(service.list(player, Mode.SEARCH, "stone")).thenReturn(entries);
        menu.open(player, Mode.SEARCH, "stone", 1);
        verify(latest()).setItem(eq(10), any(ItemStack.class));
        verify(latest()).setItem(eq(11), any(ItemStack.class));
        click(latest(), 0, ClickType.LEFT);
        assertTrue(tasks.isEmpty(), "Filler cannot select an item");
        click(latest(), 26, ClickType.LEFT);
        tasks.remove().run();
        var holder = (ItemDiscoveryMenu.ResultsHolder) latest().getHolder();
        assertEquals(2, holder.state.page());
        assertEquals(entries.get(2).reference(), holder.items.getFirst());
        when(service.resolve(player, entries.get(3).reference())).thenReturn(entries.get(3));
        click(latest(), 11, ClickType.LEFT);
        tasks.remove().run();
        assertEquals(entries.get(3).reference(), ((ItemDiscoveryMenu.DetailHolder) latest().getHolder()).item);
    }

    @Test void removedSelectionsDoNotOpenATransactionOrThrow() {
        Entry entry = entry(0);
        when(service.list(player, Mode.SEARCH, "")).thenReturn(List.of(entry));
        menu.open(player, Mode.SEARCH, "", 1);
        click(latest(), 0, ClickType.LEFT); tasks.remove().run();
        verify(service).unavailable(player);
        assertInstanceOf(ItemDiscoveryMenu.ResultsHolder.class, latest().getHolder());
        verify(service, never()).recordRecent(any(), anyString(), any());
    }

    @Test void bottomOutsideAndHotbarClicksCannotTriggerAnyMenuActions() {
        for (MenuInventoryHolder holder : List.of(new ItemDiscoveryMenu.ResultsHolder(new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1), List.of(), 1),
                new ItemDiscoveryMenu.DetailHolder(entry(0).reference(), new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1)))) {
            Inventory inventory = mock(Inventory.class);
            when(inventory.getHolder()).thenReturn(holder);
            when(inventory.getSize()).thenReturn(27);
            for (int slot : new int[]{-999, 27, 40}) {
                var event = click(inventory, slot, ClickType.SHIFT_RIGHT);
                verify(event).setCancelled(true);
            }
            for (ClickType click : List.of(ClickType.NUMBER_KEY, ClickType.DOUBLE_CLICK, ClickType.SWAP_OFFHAND, ClickType.SHIFT_LEFT)) click(inventory, 10, click);
        }
        assertTrue(tasks.isEmpty());
        verifyNoInteractions(service);
    }

    @Test void draggingCannotRemoveOrInsertIcons() {
        menu.open(player, Mode.SEARCH, "", 1);
        InventoryDragEvent event = mock(InventoryDragEvent.class);
        when(event.getInventory()).thenReturn(latest());
        menu.onDrag(event);
        verify(event).setCancelled(true);
    }

    @Test void searchChatIsPrivateAndMenusOnlyOpenOnTheServerTask() {
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.FAVORITES, "", 2));
        AsyncPlayerChatEvent event = chat("diamond sword");
        verify(event).setCancelled(true);
        verify(service, never()).list(any(), any(), anyString());
        tasks.remove().run();
        verify(service).list(player, Mode.SEARCH, "diamond sword");
        assertEquals("diamond sword", ((ItemDiscoveryMenu.ResultsHolder) latest().getHolder()).state.query());
        verify(chat("ordinary chat"), never()).setCancelled(true);
    }

    @Test void cancellationTimeoutAndNewerNavigationInvalidatePendingSearch() {
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.FAVORITES, "", 2));
        chat("cancel"); tasks.remove().run();
        verify(service).list(player, Mode.FAVORITES, "");
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        chat("stone");
        menu.open(player, Mode.RECENT, "", 1);
        tasks.remove().run();
        verify(service, never()).list(player, Mode.SEARCH, "stone");
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        timers.getLast().run();
        verify(player).sendMessage("search-expired");
        verify(chat("normal chat"), never()).setCancelled(true);
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        menu.onQuit(new PlayerQuitEvent(player, ""));
        verify(chat("after quit"), never()).setCancelled(true);
        verify(service).clearTrade(player.getUniqueId());
    }

    @Test void searchLengthIsBoundedAndWhitespaceDoesNotCrash() {
        menu.open(player, Mode.SEARCH, "x".repeat(65), 1);
        verify(player).sendMessage("query-too-long");
        verify(service, never()).list(any(), any(), anyString());
        menu.open(player, Mode.SEARCH, "  ", 0);
        verify(service).list(player, Mode.SEARCH, "");
    }

    @Test void openingAnotherInventoryCancelsSearchWithoutConsumingTheNextChatMessage() {
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        InventoryOpenEvent opened = mock(InventoryOpenEvent.class);
        when(opened.getPlayer()).thenReturn(player);
        menu.onInventoryOpen(opened);
        verify(chat("normal message"), never()).setCancelled(true);
        menu.beginSearch(player, new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        chat("stone");
        menu.onInventoryOpen(opened);
        tasks.remove().run();
        verify(service, never()).list(player, Mode.SEARCH, "stone");
    }

    @Test void detailPurchaseOpensTheExactVariantThroughTheNormalPurchaseMenu() {
        Entry entry = entry(91);
        when(service.resolve(player, entry.reference())).thenReturn(entry);
        menu.detail(player, entry.reference(), new ItemDiscoveryMenu.State(Mode.SEARCH, "", 1));
        try (var purchase = mockStatic(PurchaseMenu.class)) {
            click(latest(), 12, ClickType.LEFT); tasks.remove().run();
            purchase.verify(() -> PurchaseMenu.open(player, entry.item(), "blocks", 4));
        }
    }

    @Test void permissionRevocationAfterRenderingBlocksFavoriteWrites() {
        menu.open(player, Mode.FAVORITES, "", 1);
        when(player.hasPermission("geniusshop.use")).thenReturn(false);
        click(latest(), 46, ClickType.SHIFT_RIGHT); tasks.remove().run();
        verify(service).unavailable(player);
        verify(plugin.getDataManager(), never()).clearPersonalItems(any(), anyBoolean());
    }
}
