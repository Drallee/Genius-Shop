package me.dralle.shop.items;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.commands.CustomSellAllService;
import org.bukkit.Bukkit;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.block.Container;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataContainer;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class CustomItemManagerTest {
    @Test
    void nativeSpawnerOpeningRoutesContainerActionDespiteSmartSpawnersCancelledClick() throws Exception {
        Fixture f = new Fixture();
        f.definition(CustomItemDefinition.ActionType.SELL_CONTAINER, "right-click-container");
        Block block = mock(Block.class);
        SmartSpawnerSaleStorage storage = mock(SmartSpawnerSaleStorage.class);
        when(f.event.getAction()).thenReturn(Action.RIGHT_CLICK_BLOCK);
        when(f.event.getClickedBlock()).thenReturn(block);
        when(f.event.useInteractedBlock()).thenReturn(Event.Result.DENY);
        when(f.event.useItemInHand()).thenReturn(Event.Result.DENY);
        when(f.selling.sellStorage(f.player, storage, "", 1.5, false, "wand")).thenReturn(true);
        try (var bukkit = mockStatic(Bukkit.class); var smart = mockStatic(SmartSpawnerSaleStorage.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            smart.when(() -> SmartSpawnerSaleStorage.hasOpenedStorage(f.player, block)).thenReturn(true);
            smart.when(() -> SmartSpawnerSaleStorage.open(f.plugin, f.player, block)).thenReturn(storage);
            f.manager.onInteract(f.event);
            assertEquals(1, f.tasks.size());
            f.tasks.getFirst().run();
            verify(f.selling).sellStorage(f.player, storage, "", 1.5, false, "wand");
            verify(storage).close();
            verify(f.inventory).setItemInMainHand(f.updated);
        }
    }

    @Test
    void partiallyFullInventoryRestoresContentsInsteadOfPartiallyGivingItems() throws Exception {
        Fixture f = new Fixture();
        CustomItemManager manager = spy(f.manager);
        CommandSender sender = mock(CommandSender.class);
        when(sender.hasPermission("geniusshop.giveitem")).thenReturn(true);
        doReturn(f.stack).when(manager).create("wand");
        when(f.stack.getMaxStackSize()).thenReturn(64);
        when(f.inventory.getStorageContents()).thenReturn(new ItemStack[]{f.stack});
        when(f.inventory.addItem(f.stack)).thenReturn(new java.util.HashMap<>(Map.of(0, f.stack)));
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(() -> Bukkit.getPlayerExact("Player")).thenReturn(f.player);
            assertTrue(manager.give(sender, new String[]{"giveitem", "Player", "wand", "1"}));
            verify(f.inventory).setStorageContents(new ItemStack[]{f.original});
        }
    }

    @Test
    void offHandAndDeniedBlockInteractionsDoNotQueueActions() throws Exception {
        Fixture f = new Fixture();
        try (var bukkit = mockStatic(Bukkit.class)) {
            when(f.event.getHand()).thenReturn(EquipmentSlot.OFF_HAND);
            f.manager.onInteract(f.event);
            when(f.event.getHand()).thenReturn(EquipmentSlot.HAND);
            f.definition(CustomItemDefinition.ActionType.COMMAND, "right-click-block");
            when(f.event.getAction()).thenReturn(Action.RIGHT_CLICK_BLOCK);
            when(f.event.useItemInHand()).thenReturn(Event.Result.DENY);
            f.manager.onInteract(f.event);
            bukkit.verifyNoInteractions();
        }
    }

    @Test
    void missingPermissionDoesNotQueueOrConsume() throws Exception {
        Fixture f = new Fixture();
        when(f.player.hasPermission("wand.use")).thenReturn(false);
        try (var bukkit = mockStatic(Bukkit.class)) {
            f.manager.onInteract(f.event);
            bukkit.verifyNoInteractions();
            verify(f.inventory, never()).setItemInMainHand(any());
        }
    }

    @Test
    void successfulActionConsumesOneUseAndStartsCooldown() throws Exception {
        Fixture f = new Fixture();
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            bukkit.when(() -> Bukkit.dispatchCommand(f.player, "shop")).thenReturn(true);
            f.manager.onInteract(f.event);
            f.manager.onInteract(f.event);
            assertEquals(1, f.tasks.size());
            f.tasks.getFirst().run();
            bukkit.verify(() -> Bukkit.dispatchCommand(f.player, "shop"));
            verify(f.pdc).set(any(NamespacedKey.class), eq(PersistentDataType.INTEGER), eq(1));
            verify(f.inventory).setItemInMainHand(f.updated);
            f.manager.onInteract(f.event);
            assertEquals(1, f.tasks.size());
        }
    }

    @Test
    void changedHeldItemCancelsQueuedAction() throws Exception {
        Fixture f = new Fixture();
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            f.manager.onInteract(f.event);
            when(f.inventory.getItemInMainHand()).thenReturn(mock(ItemStack.class));
            f.tasks.getFirst().run();
            bukkit.verify(() -> Bukkit.dispatchCommand(any(), anyString()), never());
            verify(f.inventory, never()).setItemInMainHand(any());
        }
    }

    @Test
    void unrecognizedCommandDoesNotConsumeUses() throws Exception {
        Fixture f = new Fixture();
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            f.manager.onInteract(f.event);
            f.tasks.getFirst().run();
            verify(f.inventory, never()).setItemInMainHand(any());
            f.manager.onInteract(f.event);
            assertEquals(2, f.tasks.size());
        }
    }

    @Test
    void cancelledInventoryOpeningCannotSellOrConsume() throws Exception {
        Fixture f = new Fixture();
        f.definition(CustomItemDefinition.ActionType.SELL_CONTAINER, "right-click-container");
        Block block = mock(Block.class);
        Container container = mock(Container.class, RETURNS_DEEP_STUBS);
        Inventory contents = mock(Inventory.class);
        when(f.event.getAction()).thenReturn(Action.RIGHT_CLICK_BLOCK);
        when(f.event.getClickedBlock()).thenReturn(block);
        when(block.getState()).thenReturn(container);
        when(container.getInventory()).thenReturn(contents);
        when(container.getWorld().isChunkLoaded(anyInt(), anyInt())).thenReturn(true);
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            f.manager.onInteract(f.event);
            f.tasks.getFirst().run();
            verify(f.player).openInventory(contents);
            verifyNoInteractions(f.selling);
            verify(f.inventory, never()).setItemInMainHand(any());
        }
    }

    @Test
    void lockedContainerCannotBeOpenedOrSold() throws Exception {
        Fixture f = new Fixture();
        f.definition(CustomItemDefinition.ActionType.SELL_CONTAINER, "right-click-container");
        Block block = mock(Block.class);
        Container container = mock(Container.class);
        Inventory contents = mock(Inventory.class);
        when(f.event.getAction()).thenReturn(Action.RIGHT_CLICK_BLOCK);
        when(f.event.getClickedBlock()).thenReturn(block);
        when(block.getState()).thenReturn(container);
        when(container.getInventory()).thenReturn(contents);
        when(contents.getHolder()).thenReturn(container);
        when(container.isLocked()).thenReturn(true);
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getScheduler).thenReturn(f.scheduler);
            f.manager.onInteract(f.event);
            f.tasks.getFirst().run();
            verify(f.player, never()).openInventory(any(Inventory.class));
            verifyNoInteractions(f.selling);
            verify(f.inventory, never()).setItemInMainHand(any());
        }
    }

    private static final class Fixture {
        final ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        final CustomSellAllService selling = mock(CustomSellAllService.class);
        final Player player = mock(Player.class);
        final PlayerInventory inventory = mock(PlayerInventory.class);
        final PlayerInteractEvent event = mock(PlayerInteractEvent.class);
        final ItemStack stack = mock(ItemStack.class), original = mock(ItemStack.class), updated = mock(ItemStack.class);
        final ItemMeta meta = mock(ItemMeta.class);
        final PersistentDataContainer pdc = mock(PersistentDataContainer.class);
        final BukkitScheduler scheduler = mock(BukkitScheduler.class);
        final List<Runnable> tasks = new ArrayList<>();
        final CustomItemManager manager;

        Fixture() throws Exception {
            when(plugin.getName()).thenReturn("GeniusShop");
            when(plugin.getMessages().getMessage(anyString())).thenReturn("message");
            manager = new CustomItemManager(plugin, selling);
            definition(CustomItemDefinition.ActionType.COMMAND, "right-click-air");
            when(player.getUniqueId()).thenReturn(UUID.randomUUID());
            when(player.getName()).thenReturn("Player");
            when(player.isOnline()).thenReturn(true);
            when(player.hasPermission(anyString())).thenReturn(true);
            when(player.getInventory()).thenReturn(inventory);
            when(inventory.getItemInMainHand()).thenReturn(stack);
            when(stack.hasItemMeta()).thenReturn(true);
            when(stack.getItemMeta()).thenReturn(meta);
            when(updated.getItemMeta()).thenReturn(meta);
            when(meta.getPersistentDataContainer()).thenReturn(pdc);
            when(pdc.has(any(NamespacedKey.class), eq(PersistentDataType.STRING))).thenReturn(true);
            when(pdc.get(any(NamespacedKey.class), eq(PersistentDataType.STRING))).thenReturn("wand");
            when(pdc.get(any(NamespacedKey.class), eq(PersistentDataType.INTEGER))).thenReturn(2);
            when(stack.getAmount()).thenReturn(1);
            when(original.getAmount()).thenReturn(1);
            when(stack.clone()).thenReturn(original, updated);
            when(stack.isSimilar(original)).thenReturn(true);
            when(event.getHand()).thenReturn(EquipmentSlot.HAND);
            when(event.getAction()).thenReturn(Action.RIGHT_CLICK_AIR);
            when(event.getItem()).thenReturn(stack);
            when(event.getPlayer()).thenReturn(player);
            doAnswer(call -> { tasks.add(call.getArgument(1)); return null; }).when(scheduler).runTask(eq(plugin), any(Runnable.class));
        }

        void definition(CustomItemDefinition.ActionType type, String trigger) throws Exception {
            var action = new CustomItemDefinition.ItemAction(type, "", 1.5, false, List.of("shop"), false);
            var definition = new CustomItemDefinition("wand", true, org.bukkit.Material.STICK, "Wand",
                    List.of(), Map.of(), "wand.use", 60000, 2, Map.of(trigger, action));
            var field = CustomItemManager.class.getDeclaredField("definitions");
            field.setAccessible(true);
            field.set(manager, Map.of("wand", definition));
        }
    }
}
