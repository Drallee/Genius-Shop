package me.dralle.shop;

import org.bukkit.Server;
import org.bukkit.scheduler.BukkitScheduler;
import org.junit.jupiter.api.Test;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ShopPluginReloadThreadTest {
    @Test
    void httpThreadReloadsAreScheduledOnTheServerThread() {
        ShopPlugin plugin = mock(ShopPlugin.class);
        Server server = mock(Server.class);
        BukkitScheduler scheduler = mock(BukkitScheduler.class);
        when(plugin.getServer()).thenReturn(server);
        when(server.getScheduler()).thenReturn(scheduler);
        when(server.isPrimaryThread()).thenReturn(false);
        when(scheduler.callSyncMethod(eq(plugin), any(Callable.class))).thenReturn(CompletableFuture.completedFuture(null));
        doCallRealMethod().when(plugin).reloadPlugin();
        doCallRealMethod().when(plugin).reloadCustomCommands();
        doCallRealMethod().when(plugin).reloadPublishedConfiguration();

        plugin.reloadPlugin();
        plugin.reloadCustomCommands();
        plugin.reloadPublishedConfiguration();

        verify(scheduler, times(3)).callSyncMethod(eq(plugin), any(Callable.class));
        verify(plugin, never()).reloadConfig();
        verify(plugin, never()).getCustomCommandRepository();
    }
}
