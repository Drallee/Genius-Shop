package me.dralle.shop.items;

import me.dralle.shop.ShopManager;
import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.CustomSellAllService;
import me.dralle.shop.economy.EconomyHook;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.CampaignUtil;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.event.HandlerList;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SmartSpawnerSaleStorageTest {
    @Test
    void onlyNativeGuiForExactClickedSpawnerIsAcceptedAsAccessProof() {
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        Block block = mock(Block.class);
        Plugin smartPlugin = mock(Plugin.class);
        FakeSpawner data = new FakeSpawner();
        when(block.getType()).thenReturn(Material.SPAWNER);
        when(block.getLocation()).thenReturn(data.getSpawnerLocation());
        when(smartPlugin.isEnabled()).thenReturn(true);
        var inventory = player.getOpenInventory().getTopInventory();
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS)) {
            var plugins = Bukkit.getPluginManager();
            when(plugins.getPlugin("SmartSpawner")).thenReturn(smartPlugin);
            assertFalse(SmartSpawnerSaleStorage.hasOpenedStorage(player, block));
            when(inventory.getHolder()).thenReturn(new NativeHolder(data));
            assertTrue(SmartSpawnerSaleStorage.hasOpenedStorage(player, block));
            when(block.getLocation()).thenReturn(new Location(null, 9, 9, 9));
            assertFalse(SmartSpawnerSaleStorage.hasOpenedStorage(player, block));
        }
    }

    @Test
    void missingNativeSellPermissionNeverTouchesStorage() {
        Player player = mock(Player.class);
        Block block = mock(Block.class);
        when(block.getType()).thenReturn(Material.SPAWNER);
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            assertNull(SmartSpawnerSaleStorage.open(mock(Plugin.class), player, block));
            bukkit.verify(Bukkit::getPluginManager, never());
        }
    }

    @Test
    void sellUsesShopMultiplierCampaignAndRealLimits() throws Exception {
        sale(true, true, 420D);
    }

    @Test
    void campaignBypassAndFailedPaymentRestoreVirtualLoot() throws Exception {
        sale(false, false, 210D);
    }

    @Test
    void nativeSaleCancellationAndPriceOverridePreventRemoval() throws Exception {
        Fixture f = new Fixture();
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS);
             var storage = f.open()) {
            assertNotNull(storage);
            storage.getStorageContents();
            var pluginManager = Bukkit.getPluginManager();
            doAnswer(call -> { ((NativeSaleEvent) call.getArgument(0)).cancelled = true; return null; })
                    .when(pluginManager).callEvent(any(Event.class));
            assertFalse(storage.approveSale(Map.of(0, 2), 100D));
            doAnswer(call -> { ((NativeSaleEvent) call.getArgument(0)).moneyAmount = Double.NaN; return null; })
                    .when(pluginManager).callEvent(any(Event.class));
            assertFalse(storage.approveSale(Map.of(0, 2), 100D));
            assertEquals(100L, f.data.inventory.items.get(f.stone));
        }
        assertFalse(f.data.selling);
        assertFalse(f.data.lock.isLocked());
    }

    @Test
    void concurrentSaleIsRejectedWithoutTakingOrReleasingItsLock() throws Exception {
        Fixture f = new Fixture();
        f.data.selling = true;
        assertNull(f.open());
        assertTrue(f.data.selling);
        assertEquals(0, f.viewers.closed);
        assertFalse(f.data.lock.isLocked());
    }

    @Test
    void hugeStorageIsNotExpandedIntoPhysicalStacksOrTruncatedOnRollback() throws Exception {
        Fixture f = new Fixture();
        f.data.inventory.items.put(f.stone, Long.MAX_VALUE);
        try (var storage = f.open()) {
            ItemStack[] snapshot = storage.getStorageContents();
            assertEquals(2, snapshot.length);
            assertEquals(Integer.MAX_VALUE, snapshot[0].getAmount());
            assertTrue(storage.removeItems(snapshot, Map.of(0, 2)));
            assertEquals(Long.MAX_VALUE - 2, f.data.inventory.items.get(f.stone));
            storage.restoreItems(snapshot);
            storage.restoreItems(snapshot);
            assertEquals(Long.MAX_VALUE, f.data.inventory.items.get(f.stone));
        }
    }

    @Test
    void staleQuantitiesFailWithoutRemovingAnyLoot() throws Exception {
        Fixture f = new Fixture();
        try (var storage = f.open()) {
            ItemStack[] snapshot = storage.getStorageContents();
            f.data.inventory.items.put(f.stone, 99L);
            assertFalse(storage.removeItems(snapshot, Map.of(0, 2)));
            assertEquals(99L, f.data.inventory.items.get(f.stone));
            assertEquals(64L, f.data.inventory.items.get(f.bone));
        }
        assertEquals(0, f.manager.saved);
    }

    @Test
    void unsupportedStorageOrViewerFailureReleasesGuardBeforeAnyMutation() throws Exception {
        Fixture f = new Fixture();
        assertThrows(NoSuchMethodException.class, () -> SmartSpawnerSaleStorage.acquire(f.data,
                new Object(), f.viewers, f.player, null, NativeSaleEvent.class));
        assertFalse(f.data.selling);
        f.viewers.fail = true;
        assertThrows(ReflectiveOperationException.class, f::open);
        assertFalse(f.data.selling);
        assertFalse(f.data.lock.isLocked());
        assertEquals(100L, f.data.inventory.items.get(f.stone));
    }

    private void sale(boolean campaigns, boolean paid, double payout) throws Exception {
        Fixture f = new Fixture();
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        ShopItem item = mock(ShopItem.class);
        var config = new org.bukkit.configuration.file.YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getMessages().getMessage(anyString())).thenReturn("%amount% %price%");
        when(plugin.formatCurrency(anyDouble())).thenReturn("price");
        when(item.getMaterial()).thenReturn(Material.STONE);
        when(item.getUniqueKey()).thenReturn("stone");
        when(item.getSellPrice()).thenReturn(40D);
        when(item.getAmount()).thenReturn(1);
        when(item.isDynamicPricing()).thenReturn(true);
        when(item.getPriceChange()).thenReturn(2D);
        when(item.getSellPriceFormula()).thenReturn("dynamic + 10");
        when(item.getLimit()).thenReturn(2);
        when(plugin.getStateRepository().getGlobalCount("stone")).thenReturn(10);
        when(item.calculateSellTotal(anyDouble(), anyInt())).thenAnswer(call ->
                (double) call.getArgument(0) * (int) call.getArgument(1));
        when(plugin.getShopManager().getSellInfos(eq(f.player), any(ItemStack.class), isNull()))
                .thenAnswer(call -> ((ItemStack) call.getArgument(1)).getType() == Material.STONE
                        ? List.of(new ShopManager.SellInfo(item, "blocks")) : List.of());
        when(plugin.getEconomy().tryDeposit(f.player, payout)).thenReturn(new EconomyHook.EconomyOperationResult(paid, "failure"));
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS);
             var campaign = mockStatic(CampaignUtil.class);
             var storage = f.open()) {
            bukkit.when(Bukkit::isPrimaryThread).thenReturn(true);
            campaign.when(() -> CampaignUtil.applySellCampaign(any(), eq(item), anyDouble()))
                    .thenAnswer(call -> (double) call.getArgument(2) * 2D);
            campaign.when(() -> CampaignUtil.getActiveSellMultiplier(any(), eq(item))).thenReturn(2D);
            assertEquals(paid, new CustomSellAllService(plugin).sellStorage(f.player, storage, null, 1.5, campaigns, "wand"));
            assertEquals(paid ? 98L : 100L, f.data.inventory.items.get(f.stone));
            assertEquals(64L, f.data.inventory.items.get(f.bone));
            verify(plugin.getEconomy()).tryDeposit(f.player, payout);
            if (paid) {
                verify(plugin.getDataManager()).incrementPlayerCount(f.player.getUniqueId(), "stone", 2);
                verify(plugin.getDataManager()).incrementGlobalCount("stone", -2);
            } else {
                verify(plugin.getDataManager(), never()).incrementPlayerCount(any(), anyString(), anyInt());
            }
            if (!campaigns) campaign.verifyNoInteractions();
        }
        assertFalse(f.data.selling);
        assertFalse(f.data.lock.isLocked());
        assertEquals(1, f.manager.saved);
        assertEquals(1, f.data.refreshed);
        assertEquals(1, f.viewers.updated);
    }

    private static ItemStack stack(Material material, int amount) {
        ItemStack stack = mock(ItemStack.class);
        AtomicInteger count = new AtomicInteger(amount);
        when(stack.getType()).thenReturn(material);
        when(stack.getAmount()).thenAnswer(call -> count.get());
        doAnswer(call -> { count.set(call.getArgument(0)); return null; }).when(stack).setAmount(anyInt());
        when(stack.clone()).thenAnswer(call -> stack(material, count.get()));
        when(stack.isSimilar(any())).thenAnswer(call -> ((ItemStack) call.getArgument(0)).getType() == material);
        return stack;
    }

    private static class Fixture {
        final FakeSpawner data = new FakeSpawner();
        final FakeManager manager = new FakeManager();
        final FakeViewers viewers = new FakeViewers();
        final Player player = mock(Player.class);
        final Signature stone = new Signature(Material.STONE), bone = new Signature(Material.BONE);
        Fixture() {
            data.inventory.items.put(stone, 100L);
            data.inventory.items.put(bone, 64L);
            when(player.getUniqueId()).thenReturn(UUID.randomUUID());
        }
        SmartSpawnerSaleStorage open() throws ReflectiveOperationException {
            return SmartSpawnerSaleStorage.acquire(data, manager, viewers, player, null, NativeSaleEvent.class);
        }
    }

    public static class Signature {
        final Material material;
        Signature(Material material) { this.material = material; }
        public ItemStack getTemplate() { return stack(material, 1); }
    }

    public static class FakeInventory {
        final Map<Signature, Long> items = new java.util.LinkedHashMap<>();
        public Map<Signature, Long> getConsolidatedItems() { return new java.util.LinkedHashMap<>(items); }
        public boolean removeItems(Map<Signature, Long> removed) {
            for (var entry : removed.entrySet()) if (items.getOrDefault(entry.getKey(), 0L) < entry.getValue()) return false;
            removed.forEach((key, count) -> items.compute(key, (k, current) -> current == count.longValue() ? null : current - count));
            return true;
        }
        public void addItems(Map<Signature, Long> restored) { restored.forEach((key, count) -> items.merge(key, count, Long::sum)); }
    }

    public static class FakeSpawner {
        final FakeInventory inventory = new FakeInventory();
        final ReentrantLock lock = new ReentrantLock();
        boolean selling;
        int refreshed;
        public FakeInventory getVirtualInventory() { return inventory; }
        public ReentrantLock getInventoryLock() { return lock; }
        public boolean startSelling() { if (selling) return false; selling = true; return true; }
        public void stopSelling() { selling = false; }
        public String getSpawnerId() { return "spawner"; }
        public Location getSpawnerLocation() { return new Location(null, 1, 2, 3); }
        public void recalculateSellValue() { refreshed++; }
        public boolean updateCapacityStatus() { return false; }
        public void updateHologramData() {}
    }

    public static class NativeHolder implements InventoryHolder {
        final FakeSpawner data;
        public NativeHolder(FakeSpawner data) { this.data = data; }
        public FakeSpawner getSpawnerData() { return data; }
        public Inventory getInventory() { return null; }
    }

    public static class FakeManager {
        int saved;
        public void markSpawnerModified(String id) { saved++; }
    }

    public static class FakeViewers {
        int closed, updated;
        boolean fail;
        public void closeAllViewersInventory(FakeSpawner data) {
            closed++;
            if (fail) throw new IllegalStateException("viewer failure");
        }
        public void updateSpawnerMenuViewers(FakeSpawner data) { updated++; }
    }

    public static class NativeSaleEvent extends Event implements Cancellable {
        private static final HandlerList HANDLERS = new HandlerList();
        boolean cancelled;
        double moneyAmount;
        final Location location;
        final List<ItemStack> items;
        public NativeSaleEvent(Player player, Location location, List<ItemStack> items, double moneyAmount) {
            this.moneyAmount = moneyAmount;
            this.location = location;
            this.items = items;
        }
        public Location getLocation() { return location; }
        public List<ItemStack> getItems() { return items; }
        public double getMoneyAmount() { return moneyAmount; }
        public boolean isCancelled() { return cancelled; }
        public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }
        public HandlerList getHandlers() { return HANDLERS; }
    }
}
