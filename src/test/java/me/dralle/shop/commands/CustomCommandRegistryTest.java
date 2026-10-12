package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.Server;
import org.bukkit.command.Command;
import org.bukkit.command.CommandMap;
import org.bukkit.command.SimpleCommandMap;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitScheduler;
import org.bukkit.scheduler.BukkitTask;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CustomCommandRegistryTest {
    public interface CommandMapAccess { CommandMap getCommandMap(); }

    @Test
    void reloadRefreshesOnlyAfterRegistrationAndCoalescesRepeatedReloads() throws Exception {
        ShopPlugin plugin = mock(ShopPlugin.class);
        when(plugin.getName()).thenReturn("GeniusShop");
        when(plugin.isEnabled()).thenReturn(true);
        Server server = mock(Server.class, withSettings().extraInterfaces(CommandMapAccess.class));
        SimpleCommandMap commandMap = mock(SimpleCommandMap.class);
        when(((CommandMapAccess) server).getCommandMap()).thenReturn(commandMap);
        var known = new LinkedHashMap<String, Command>();
        var field = SimpleCommandMap.class.getDeclaredField("knownCommands");
        field.setAccessible(true);
        field.set(commandMap, known);
        when(commandMap.register(anyString(), any(Command.class))).thenAnswer(invocation -> {
            Command command = invocation.getArgument(1);
            known.put(command.getName(), command);
            return true;
        });
        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        BukkitTask task = mock(BukkitTask.class);
        when(scheduler.runTask(eq(plugin), any(Runnable.class))).thenReturn(task);
        Player player = mock(Player.class);
        try (var bukkit = mockStatic(Bukkit.class)) {
            bukkit.when(Bukkit::getServer).thenReturn(server);
            bukkit.when(Bukkit::getScheduler).thenReturn(scheduler);
            bukkit.when(Bukkit::getOnlinePlayers).thenReturn(List.of(player));
            var registry = new CustomCommandRegistry(plugin, mock(CustomSellAllService.class));
            var definition = new CustomCommandDefinition("market", true, List.of(), "", "", "", "", "",
                    new CustomCommandAction(CustomCommandActionType.OPEN_SHOP, "main", "", CustomCommandMenuMode.BOTH));

            assertEquals(1, registry.reload(List.of(definition)));
            assertEquals(1, registry.reload(List.of(definition)));
            verify(player, never()).updateCommands();
            var runnable = ArgumentCaptor.forClass(Runnable.class);
            verify(scheduler).runTask(eq(plugin), runnable.capture());
            assertEquals(1, known.size());
            runnable.getValue().run();
            verify(player).updateCommands();

            registry.reload(List.of(definition));
            registry.unregisterAll();
            verify(task).cancel();
            assertEquals(0, known.size());
        }
    }
}
