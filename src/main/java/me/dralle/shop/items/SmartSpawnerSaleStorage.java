package me.dralle.shop.items;

import me.dralle.shop.commands.SaleStorage;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.Cancellable;
import org.bukkit.event.Event;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

/** Optional, capability-checked bridge to SmartSpawner's consolidated virtual storage. */
public final class SmartSpawnerSaleStorage implements SaleStorage, AutoCloseable {
    private final Object spawner;
    private final Object virtualInventory;
    private final Object manager;
    private final Object viewers;
    private final Player player;
    private final Location location;
    private final Lock lock;
    private final Lock legacySellLock;
    private final boolean listStorage;
    private final Method startSelling, stopSelling, getItems, removeItems, addItems;
    private final Method closeViewers, updateViewers, markModified, recalculate, updateCapacity, updateHologram;
    private final Constructor<?> sellEvent;
    private final Method getMoney;
    private final List<Object> signatures = new ArrayList<>();
    private final List<Long> counts = new ArrayList<>();
    private ItemStack[] contents;
    private Map<Object, Long> removed = Map.of();
    private boolean acquired;
    private boolean changed;

    private SmartSpawnerSaleStorage(Object spawner, Object manager, Object viewers, Player player,
                                    Location location, Class<? extends Event> eventType) throws ReflectiveOperationException {
        this.spawner = spawner;
        this.manager = manager;
        this.viewers = viewers;
        this.player = player;
        this.location = location;
        virtualInventory = call(spawner, "getVirtualInventory");
        Object inventoryLock = call(spawner, "getInventoryLock");
        if (!(inventoryLock instanceof Lock storageLock)) throw new IllegalStateException("Missing SmartSpawner inventory lock");
        lock = storageLock;
        Class<?> dataType = spawner.getClass();
        Method start = null, stop = null;
        Lock legacy = null;
        try {
            start = dataType.getMethod("startSelling");
            stop = dataType.getMethod("stopSelling");
        } catch (NoSuchMethodException ex) {
            start = null;
            stop = null;
            Object sellLock = call(spawner, "getSellLock");
            if (!(sellLock instanceof Lock oldLock)) throw new IllegalStateException("Missing legacy SmartSpawner sell lock");
            legacy = oldLock;
        }
        startSelling = start;
        stopSelling = stop;
        legacySellLock = legacy;
        getItems = virtualInventory.getClass().getMethod("getConsolidatedItems");
        Method remove, add;
        boolean lists = false;
        try {
            remove = virtualInventory.getClass().getMethod("removeItems", Map.class);
            add = virtualInventory.getClass().getMethod("addItems", Map.class);
        } catch (NoSuchMethodException ex) {
            remove = virtualInventory.getClass().getMethod("removeItems", List.class);
            add = virtualInventory.getClass().getMethod("addItems", List.class);
            lists = true;
        }
        removeItems = remove;
        addItems = add;
        listStorage = lists;
        closeViewers = viewers.getClass().getMethod("closeAllViewersInventory", dataType);
        updateViewers = viewers.getClass().getMethod("updateSpawnerMenuViewers", dataType);
        markModified = manager.getClass().getMethod("markSpawnerModified", String.class);
        recalculate = dataType.getMethod("recalculateSellValue");
        updateCapacity = dataType.getMethod("updateCapacityStatus");
        updateHologram = dataType.getMethod("updateHologramData");
        dataType.getMethod("getSpawnerId");
        sellEvent = eventType.getConstructor(Player.class, Location.class, List.class, double.class);
        getMoney = eventType.getMethod("getMoneyAmount");
        if (!Cancellable.class.isAssignableFrom(eventType)) throw new IllegalStateException("Spawner sale event must be cancellable");
    }

    public static boolean hasOpenedStorage(Player player, Block block) {
        if (block == null || block.getType() != Material.SPAWNER || findPlugin() == null) return false;
        try { return openedSpawner(player, block.getLocation()) != null; }
        catch (ReflectiveOperationException | RuntimeException | LinkageError ex) { return false; }
    }

    public static SmartSpawnerSaleStorage open(Plugin owner, Player player, Block block) {
        if (!Bukkit.isPrimaryThread() || block == null || block.getType() != Material.SPAWNER
                || !player.hasPermission("smartspawner.sellall")) return null;
        Plugin plugin = findPlugin();
        if (plugin == null || !block.getWorld().isChunkLoaded(block.getX() >> 4, block.getZ() >> 4)) return null;
        try {
            ClassLoader loader = plugin.getClass().getClassLoader();
            Class<?> protection = Class.forName("github.nighter.smartspawner.hooks.protections.CheckOpenMenu", true, loader);
            if (!Boolean.TRUE.equals(protection.getMethod("CanPlayerOpenMenu", Player.class, Location.class)
                    .invoke(null, player, block.getLocation()))) return null;
            Object manager = component(plugin, "getSpawnerManager",
                    Class.forName("github.nighter.smartspawner.spawner.data.SpawnerManager", false, loader));
            Object spawner = manager.getClass().getMethod("getSpawnerByLocation", Location.class).invoke(manager, block.getLocation());
            // Native interaction and GUI-open events must already have granted access to this exact spawner.
            if (spawner == null || openedSpawner(player, block.getLocation()) != spawner) return null;
            Object viewers = component(plugin, "getSpawnerGuiViewManager",
                    Class.forName("github.nighter.smartspawner.spawner.gui.synchronization.SpawnerGuiViewManager", false, loader));
            Class<? extends Event> eventType = Class.forName("github.nighter.smartspawner.api.events.SpawnerSellEvent", true, loader)
                    .asSubclass(Event.class);
            SmartSpawnerSaleStorage storage = new SmartSpawnerSaleStorage(spawner, manager, viewers, player, block.getLocation(), eventType);
            if (storage.legacySellLock != null) {
                LegacySpawnerSaleGuard.install(owner, plugin, manager, eventType);
            }
            return storage.acquire();
        } catch (ReflectiveOperationException | LinkageError ex) {
            throw new IllegalStateException("SmartSpawner " + plugin.getDescription().getVersion()
                    + " does not expose compatible protected storage selling: " + ex.getMessage(), ex);
        }
    }

    static SmartSpawnerSaleStorage acquire(Object spawner, Object manager, Object viewers, Player player,
                                          Location location, Class<? extends Event> eventType) throws ReflectiveOperationException {
        SmartSpawnerSaleStorage storage = new SmartSpawnerSaleStorage(spawner, manager, viewers, player, location, eventType);
        return storage.acquire();
    }

    private SmartSpawnerSaleStorage acquire() throws ReflectiveOperationException {
        if (startSelling != null && !Boolean.TRUE.equals(startSelling.invoke(spawner))) return null;
        if (!lock.tryLock()) {
            if (stopSelling != null) stopSelling.invoke(spawner);
            return null;
        }
        // Legacy versions acquire inventoryLock first, then sellLock. Reject reentrant native sales.
        if (legacySellLock != null && ((legacySellLock instanceof ReentrantLock r && r.isHeldByCurrentThread())
                || !legacySellLock.tryLock())) {
            lock.unlock();
            return null;
        }
        acquired = true;
        try {
            closeViewers.invoke(viewers, spawner);
            player.closeInventory();
            return this;
        } catch (ReflectiveOperationException | RuntimeException ex) {
            close();
            throw ex;
        }
    }

    private static Plugin findPlugin() {
        Plugin plugin = Bukkit.getPluginManager().getPlugin("SmartSpawner");
        if (plugin == null || !plugin.isEnabled()) plugin = Bukkit.getPluginManager().getPlugin("SmartSpawners");
        return plugin != null && plugin.isEnabled() ? plugin : null;
    }

    private static Object openedSpawner(Player player, Location location) throws ReflectiveOperationException {
        Object holder = player.getOpenInventory().getTopInventory().getHolder();
        if (holder == null) return null;
        Object spawner = call(holder, "getSpawnerData");
        return spawner != null && location.equals(call(spawner, "getSpawnerLocation")) ? spawner : null;
    }

    @Override
    public ItemStack[] getStorageContents() {
        requireAcquired();
        if (contents == null) {
            Map<?, ?> items = currentItems();
            List<ItemStack> templates = new ArrayList<>();
            for (var entry : items.entrySet()) {
                if (!(entry.getValue() instanceof Long count) || count <= 0) continue;
                Object template = invokeMethod(entry.getKey(), "getTemplate");
                if (!(template instanceof ItemStack item)) throw new IllegalStateException("Invalid virtual item template");
                ItemStack stack = item.clone();
                stack.setAmount((int) Math.min(count, Integer.MAX_VALUE));
                templates.add(stack);
                signatures.add(entry.getKey());
                counts.add(count);
            }
            contents = templates.toArray(ItemStack[]::new);
        }
        return java.util.Arrays.stream(contents).map(ItemStack::clone).toArray(ItemStack[]::new);
    }

    @Override
    public boolean approveSale(Map<Integer, Integer> quantities, double payout) {
        requireAcquired();
        List<ItemStack> sold = new ArrayList<>();
        quantities.forEach((slot, amount) -> {
            ItemStack item = contents[slot].clone();
            item.setAmount(amount);
            sold.add(item);
        });
        try {
            Event event = (Event) sellEvent.newInstance(player, location, sold, payout);
            Bukkit.getPluginManager().callEvent(event);
            // Native price overrides must not bypass Genius-Shop's already-validated payout.
            return !((Cancellable) event).isCancelled() && Double.compare(((Number) getMoney.invoke(event)).doubleValue(), payout) == 0;
        } catch (ReflectiveOperationException ex) { throw failure(ex); }
    }

    @Override
    public boolean removeItems(ItemStack[] expected, Map<Integer, Integer> quantities) {
        requireAcquired();
        Map<?, ?> current = currentItems();
        Map<Object, Long> requested = new HashMap<>();
        for (var entry : quantities.entrySet()) {
            int slot = entry.getKey();
            int amount = entry.getValue();
            if (amount <= 0 || amount > expected[slot].getAmount()
                    || !counts.get(slot).equals(current.get(signatures.get(slot)))) return false;
            requested.put(signatures.get(slot), (long) amount);
        }
        try {
            if (!Boolean.TRUE.equals(removeItems.invoke(virtualInventory, mutationArgument(requested)))) return false;
            removed = requested;
            changed = true;
            return true;
        } catch (ReflectiveOperationException ex) { throw failure(ex); }
    }

    @Override
    public void restoreItems(ItemStack[] snapshot) {
        requireAcquired();
        if (removed.isEmpty()) return;
        try {
            addItems.invoke(virtualInventory, mutationArgument(removed));
            removed = Map.of();
        } catch (ReflectiveOperationException ex) { throw failure(ex); }
    }

    @Override
    public void close() {
        if (!acquired) return;
        try {
            if (changed) {
                markModified.invoke(manager, call(spawner, "getSpawnerId"));
                recalculate.invoke(spawner);
                updateCapacity.invoke(spawner);
                updateHologram.invoke(spawner);
                updateViewers.invoke(viewers, spawner);
            }
        } catch (ReflectiveOperationException ex) { throw failure(ex); }
        finally {
            acquired = false;
            try {
                try { if (legacySellLock != null) legacySellLock.unlock(); }
                finally { lock.unlock(); }
            }
            finally {
                try { if (stopSelling != null) stopSelling.invoke(spawner); }
                catch (ReflectiveOperationException ex) { throw failure(ex); }
            }
        }
    }

    private Map<?, ?> currentItems() {
        try { return (Map<?, ?>) getItems.invoke(virtualInventory); }
        catch (ReflectiveOperationException ex) { throw failure(ex); }
    }

    private Object mutationArgument(Map<Object, Long> items) {
        if (!listStorage) return items;
        List<ItemStack> stacks = new ArrayList<>(items.size());
        items.forEach((signature, amount) -> {
            ItemStack item = ((ItemStack) invokeMethod(signature, "getTemplate")).clone();
            item.setAmount(Math.toIntExact(amount));
            stacks.add(item);
        });
        return stacks;
    }

    static Object component(Object target, String method, Class<?> returnType) throws ReflectiveOperationException {
        // Exact lookup avoids resolving every plugin method, including optional integration return types.
        var handle = MethodHandles.publicLookup().findVirtual(target.getClass(), method, MethodType.methodType(returnType));
        try { return handle.invoke(target); }
        catch (RuntimeException | Error ex) { throw ex; }
        catch (Throwable ex) { throw new InvocationTargetException(ex); }
    }

    private void requireAcquired() {
        if (!acquired) throw new IllegalStateException("Spawner sale lock is not held");
    }

    private static Object call(Object target, String method) throws ReflectiveOperationException {
        return target.getClass().getMethod(method).invoke(target);
    }

    private static Object invokeMethod(Object target, String method) {
        try { return call(target, method); }
        catch (ReflectiveOperationException ex) { throw failure(ex); }
    }

    private static IllegalStateException failure(Exception ex) {
        Throwable cause = ex.getCause() == null ? ex : ex.getCause();
        return new IllegalStateException("SmartSpawner storage operation failed: " + cause.getMessage(), ex);
    }
}
