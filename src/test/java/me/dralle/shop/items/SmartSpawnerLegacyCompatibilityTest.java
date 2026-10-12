package me.dralle.shop.items;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SmartSpawnerLegacyCompatibilityTest {
    @Test
    void exactComponentLookupDoesNotResolveMissingOptionalMethodTypes() throws Exception {
        String fixture = GetterFixture.class.getName();
        String missing = MissingOptionalType.class.getName();
        ClassLoader loader = new ClassLoader(getClass().getClassLoader()) {
            @Override
            protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
                if (name.equals(missing)) throw new ClassNotFoundException("Optional integration is not installed");
                if (!name.equals(fixture)) return super.loadClass(name, resolve);
                Class<?> loaded = findLoadedClass(name);
                if (loaded != null) return loaded;
                try (var stream = getParent().getResourceAsStream(name.replace('.', '/') + ".class")) {
                    byte[] bytes = stream.readAllBytes();
                    return defineClass(name, bytes, 0, bytes.length);
                } catch (java.io.IOException ex) { throw new ClassNotFoundException(name, ex); }
            }
        };
        Class<?> type = Class.forName(fixture, true, loader);
        Object instance = type.getConstructor().newInstance();
        assertThrows(NoClassDefFoundError.class, () -> type.getMethod("getComponent"));
        assertEquals("available", SmartSpawnerSaleStorage.component(instance, "getComponent", String.class));
    }

    @Test
    void legacyLocksAndListStorageRemoveAndRestoreExactQuantities() throws Exception {
        LegacyData data = new LegacyData();
        data.inventory.items.put(Material.STONE, 100L);
        data.inventory.items.put(Material.BONE, 64L);
        Manager manager = new Manager();
        try (var storage = SmartSpawnerSaleStorage.acquire(data, manager, new Viewers(), mock(Player.class), null,
                SmartSpawnerSaleStorageTest.NativeSaleEvent.class)) {
            assertNotNull(storage);
            assertTrue(data.inventoryLock.isHeldByCurrentThread());
            assertTrue(data.sellLock.isHeldByCurrentThread());
            ItemStack[] snapshot = storage.getStorageContents();
            assertTrue(storage.removeItems(snapshot, Map.of(0, 2)));
            assertEquals(98L, data.inventory.items.get(Material.STONE));
            assertEquals(64L, data.inventory.items.get(Material.BONE));
            storage.restoreItems(snapshot);
            assertEquals(100L, data.inventory.items.get(Material.STONE));
        }
        assertFalse(data.sellLock.isLocked());
        assertFalse(data.inventoryLock.isLocked());
        assertEquals(1, manager.saved);
    }

    @Test
    void legacyReentrantNativeSaleIsRejectedWithoutUnlockingItsSellLock() throws Exception {
        LegacyData data = new LegacyData();
        data.sellLock.lock();
        try {
            assertNull(SmartSpawnerSaleStorage.acquire(data, new Manager(), new Viewers(), mock(Player.class), null,
                    SmartSpawnerSaleStorageTest.NativeSaleEvent.class));
            assertTrue(data.sellLock.isHeldByCurrentThread());
            assertFalse(data.inventoryLock.isLocked());
        } finally { data.sellLock.unlock(); }
    }

    @Test
    void legacyNativeSnapshotGuardRejectsStaleOrDuplicatedQuantities() throws Exception {
        LegacyData data = new LegacyData();
        data.inventory.items.put(Material.STONE, 98L);
        assertFalse(LegacySpawnerSaleGuard.hasStoredItems(data, List.of(stack(Material.STONE, 100))));
        assertFalse(LegacySpawnerSaleGuard.hasStoredItems(data,
                List.of(stack(Material.STONE, 60), stack(Material.STONE, 60))));
        assertTrue(LegacySpawnerSaleGuard.hasStoredItems(data, List.of(stack(Material.STONE, 98))));
        assertFalse(data.inventoryLock.isLocked());
        assertEquals(98L, data.inventory.items.get(Material.STONE));
    }

    @Test
    void nativeSaleListenerIsInstalledOnceAndCancelsStalePayment() throws Exception {
        LegacyData data = new LegacyData();
        data.inventory.items.put(Material.STONE, 98L);
        Manager manager = new Manager();
        manager.data = data;
        Plugin owner = mock(Plugin.class), smartSpawner = mock(Plugin.class);
        try (var bukkit = mockStatic(Bukkit.class, RETURNS_DEEP_STUBS)) {
            var plugins = Bukkit.getPluginManager();
            LegacySpawnerSaleGuard.install(owner, smartSpawner, manager, SmartSpawnerSaleStorageTest.NativeSaleEvent.class);
            LegacySpawnerSaleGuard.install(owner, smartSpawner, manager, SmartSpawnerSaleStorageTest.NativeSaleEvent.class);
            var executor = ArgumentCaptor.forClass(EventExecutor.class);
            verify(plugins).registerEvent(eq(SmartSpawnerSaleStorageTest.NativeSaleEvent.class), any(Listener.class),
                    eq(EventPriority.HIGHEST), executor.capture(), eq(owner), eq(true));
            var stale = new SmartSpawnerSaleStorageTest.NativeSaleEvent(mock(Player.class), null,
                    List.of(stack(Material.STONE, 100)), 100D);
            executor.getValue().execute(mock(Listener.class), stale);
            assertTrue(stale.isCancelled());
            var current = new SmartSpawnerSaleStorageTest.NativeSaleEvent(mock(Player.class), null,
                    List.of(stack(Material.STONE, 98)), 98D);
            executor.getValue().execute(mock(Listener.class), current);
            assertFalse(current.isCancelled());
            assertEquals(98L, data.inventory.items.get(Material.STONE));
        }
    }

    public static class GetterFixture {
        public String getComponent() { return "available"; }
        public MissingOptionalType unrelatedIntegration() { return null; }
    }
    public static class MissingOptionalType {}

    private static ItemStack stack(Material material, int amount) {
        ItemStack item = mock(ItemStack.class);
        AtomicInteger count = new AtomicInteger(amount);
        when(item.getType()).thenReturn(material);
        when(item.getAmount()).thenAnswer(call -> count.get());
        when(item.clone()).thenAnswer(call -> stack(material, count.get()));
        doAnswer(call -> { count.set(call.getArgument(0)); return null; }).when(item).setAmount(anyInt());
        when(item.isSimilar(any())).thenAnswer(call -> ((ItemStack) call.getArgument(0)).getType() == material);
        return item;
    }

    public static class Signature {
        final Material material;
        Signature(Material material) { this.material = material; }
        public ItemStack getTemplate() { return stack(material, 1); }
        @Override public boolean equals(Object other) { return other instanceof Signature signature && material == signature.material; }
        @Override public int hashCode() { return material.hashCode(); }
    }

    public static class ListInventory {
        final Map<Material, Long> items = new LinkedHashMap<>();
        public Map<Signature, Long> getConsolidatedItems() {
            Map<Signature, Long> copy = new LinkedHashMap<>();
            items.forEach((material, count) -> copy.put(new Signature(material), count));
            return copy;
        }
        public boolean removeItems(List<ItemStack> removed) {
            Map<Material, Long> amounts = new LinkedHashMap<>();
            removed.forEach(item -> amounts.merge(item.getType(), (long) item.getAmount(), Long::sum));
            if (amounts.entrySet().stream().anyMatch(entry -> items.getOrDefault(entry.getKey(), 0L) < entry.getValue())) return false;
            amounts.forEach((material, amount) -> items.compute(material, (key, current) -> current - amount));
            return true;
        }
        public void addItems(List<ItemStack> restored) {
            restored.forEach(item -> items.merge(item.getType(), (long) item.getAmount(), Long::sum));
        }
    }

    public static class LegacyData {
        final ListInventory inventory = new ListInventory();
        final ReentrantLock inventoryLock = new ReentrantLock(), sellLock = new ReentrantLock();
        public ListInventory getVirtualInventory() { return inventory; }
        public ReentrantLock getInventoryLock() { return inventoryLock; }
        public ReentrantLock getSellLock() { return sellLock; }
        public String getSpawnerId() { return "legacy"; }
        public void recalculateSellValue() {}
        public boolean updateCapacityStatus() { return false; }
        public void updateHologramData() {}
    }

    public static class Manager {
        int saved;
        LegacyData data;
        public LegacyData getSpawnerByLocation(Location location) { return data; }
        public void markSpawnerModified(String id) { saved++; }
    }
    public static class Viewers {
        public void closeAllViewersInventory(LegacyData data) {}
        public void updateSpawnerMenuViewers(LegacyData data) {}
    }
}
