package me.dralle.shop.api;

import org.bukkit.entity.Player;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConfigApiServerAddressTest {
    @Test
    void missingAndUnresolvedAddressesAreRejected() {
        Player player = mock(Player.class);
        assertNull(ConfigApiServer.getPlayerIp(player));
        when(player.getAddress()).thenReturn(InetSocketAddress.createUnresolved("invalid.example", 25565));
        assertNull(ConfigApiServer.getPlayerIp(player));
    }

    @Test
    void resolvedAddressUsesHostAddressWithoutPort() {
        Player player = mock(Player.class);
        when(player.getAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 25565));
        assertEquals("127.0.0.1", ConfigApiServer.getPlayerIp(player));
    }
}
