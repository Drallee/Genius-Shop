package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.gui.PurchaseMenu;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import me.dralle.shop.util.ShopItemUtil;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PriceSimulationCommandTest {
    @TempDir Path folder;

    @Test
    void parsesExplicitTimeQuantitiesCountersAndPlayer() {
        var options = PriceSimulationCommand.parse(new String[]{"validate-prices", "player=Alice", "at=2026-10-12T12:00:00Z", "quantities=64,1,16,1", "stock=100", "mode=sequential"});
        assertEquals("Alice", options.player());
        assertEquals(Instant.parse("2026-10-12T12:00:00Z"), options.at());
        assertEquals(List.of(1, 16, 64), options.quantities());
        assertEquals("100", options.stock());
    }

    @ParameterizedTest
    @ValueSource(strings = {"unknown=x", "quantities=0", "quantities=1025", "quantities=1,", "quantities=1,2,3,4,5,6,7,8,9", "stock=-1", "stock=2147483648", "mode=bad", "at=bad", "player="})
    void rejectsInvalidOptions(String option) {
        assertThrows(IllegalArgumentException.class, () -> PriceSimulationCommand.parse(new String[]{"validate-prices", option}));
    }

    @Test
    void rejectsRepeatedOptions() {
        assertThrows(IllegalArgumentException.class, () -> PriceSimulationCommand.parse(new String[]{"validate-prices", "stock=0", "stock=1"}));
    }

    @Test
    void unauthorizedSendersCannotSnapshotOrScheduleWork() {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        when(plugin.getMessages().getMessage("no-permission")).thenReturn("denied");
        new PriceSimulationCommand(plugin).execute(sender, new String[]{"validate-prices"});
        verify(sender).sendMessage("denied");
        verify(plugin, never()).getShopManager();
        verify(plugin, never()).getStateRepository();
        verify(plugin, never()).getServer();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void usesActualItemMatchingAndNeverChangesLiveState(boolean matches) throws Exception {
        executeAudit(matches, true);
    }

    @Test
    void selectedPlayersPermissionsCanExcludeRoutes() throws Exception {
        executeAudit(true, false);
    }

    private void executeAudit(boolean matches, boolean permitted) throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class, RETURNS_DEEP_STUBS);
        CommandSender sender = mock(CommandSender.class);
        Player player = mock(Player.class, RETURNS_DEEP_STUBS);
        when(sender.hasPermission("geniusshop.validateprices")).thenReturn(true);
        when(plugin.getServer().getPlayerExact("Alice")).thenReturn(player);
        when(player.hasPermission("premium.access")).thenReturn(permitted);
        var config = new YamlConfiguration();
        config.set("economy-safety.enabled", false);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getDataFolder()).thenReturn(folder.toFile());
        when(plugin.getStateRepository().getAllGlobalCounts()).thenReturn(Map.of("buy", 4, "sell", 5));
        ShopItem buy = mock(ShopItem.class), sell = mock(ShopItem.class);
        when(buy.getMaterial()).thenReturn(Material.STONE);
        when(sell.getMaterial()).thenReturn(Material.STONE);
        when(buy.getUniqueKey()).thenReturn("buy");
        when(sell.getUniqueKey()).thenReturn("sell");
        when(buy.getPrice()).thenReturn(10D);
        when(buy.getAmount()).thenReturn(1);
        when(sell.getAmount()).thenReturn(1);
        when(sell.getSellPrice()).thenReturn(30D);
        when(buy.calculateBuyTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1));
        when(sell.calculateSellTotal(anyDouble(), anyInt())).thenAnswer(call -> (double) call.getArgument(0) * (int) call.getArgument(1));
        ShopData cheap = mock(ShopData.class), premium = mock(ShopData.class);
        when(cheap.getKey()).thenReturn("cheap");
        when(premium.getKey()).thenReturn("premium");
        when(premium.getPermission()).thenReturn("premium.access");
        when(cheap.getItems()).thenReturn(List.of(buy));
        when(premium.getItems()).thenReturn(List.of(sell));
        when(plugin.getShopManager().getShopKeys()).thenReturn(Set.of("cheap", "premium"));
        when(plugin.getShopManager().getShop("cheap")).thenReturn(cheap);
        when(plugin.getShopManager().getShop("premium")).thenReturn(premium);
        var scheduler = plugin.getServer().getScheduler();
        doAnswer(call -> { ((Runnable) call.getArgument(1)).run(); return mock(org.bukkit.scheduler.BukkitTask.class); })
                .when(scheduler).runTaskAsynchronously(eq(plugin), any(Runnable.class));
        doAnswer(call -> { ((Runnable) call.getArgument(1)).run(); return mock(org.bukkit.scheduler.BukkitTask.class); })
                .when(scheduler).runTask(eq(plugin), any(Runnable.class));
        ItemStack stack = mock(ItemStack.class);
        when(stack.getType()).thenReturn(Material.STONE);
        try (var purchases = mockStatic(PurchaseMenu.class, call -> call.getMethod().getName().equals("createDeliveryTemplate") ? stack : call.callRealMethod());
             var items = mockStatic(ShopItemUtil.class)) {
            items.when(() -> ShopItemUtil.isSameItem(stack, sell)).thenReturn(matches);
            assertTrue(new PriceSimulationCommand(plugin).execute(sender, new String[]{"validate-prices", "player=Alice", "at=2026-10-12T12:00:00Z", "quantities=1", "stock=live"}));
        }
        String report;
        try (var reports = Files.list(folder.resolve("price-validation"))) { report = Files.readString(reports.findFirst().orElseThrow()); }
        assertEquals(matches && permitted, report.contains("REVIEW cheap:buy->premium:sell"));
        verify(plugin, never()).getEconomy();
        verify(player, never()).getInventory();
        verify(plugin.getStateRepository(), never()).incrementGlobalCount(anyString(), anyInt());
        verify(plugin.getStateRepository(), never()).incrementPlayerCount(any(), anyString(), anyInt());
        verify(plugin.getStateRepository(), never()).save();
    }
}
