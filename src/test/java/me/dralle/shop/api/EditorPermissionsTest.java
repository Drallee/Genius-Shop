package me.dralle.shop.api;

import org.bukkit.command.CommandSender;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EditorPermissionsTest {
    private EditorPermissions only(String node) {
        CommandSender sender = mock(CommandSender.class);
        when(sender.hasPermission("geniusshop.editor." + node)).thenReturn(true);
        return EditorPermissions.of(sender);
    }

    @Test void noPermissionsFailClosed() {
        var permissions = EditorPermissions.of(null);
        assertFalse(permissions.access());
        assertFalse(permissions.allows("/api/files", "GET"));
        assertFalse(permissions.allows("/api/unknown", "POST"));
    }

    @Test void eachCapabilityIsIndependent() {
        assertTrue(only("analytics").allows("/api/stock-analytics", "GET"));
        assertTrue(only("analytics").allows("/api/sales-analytics", "GET"));
        assertFalse(only("drafts").allows("/api/sales-analytics", "GET"));
        assertFalse(only("analytics").allows("/api/database", "GET"));
        assertTrue(only("database").allows("/api/database", "POST"));
        assertFalse(only("database").allows("/api/file/shops/a.yml", "POST"));
        assertTrue(only("drafts").allows("/api/file/shops/a.yml", "POST"));
        assertFalse(only("drafts").allows("/api/draft/publish", "POST"));
        assertTrue(only("publish").allows("/api/draft/publish", "POST"));
        assertFalse(only("publish").allows("/api/file/shops/a.yml", "POST"));
        assertTrue(only("commands").allows("/api/file/commands.yml", "POST"));
        assertFalse(only("commands").allows("/api/file/shops/a.yml", "POST"));
    }

    @Test void delegatedUsersCannotReadSecretsOrAuditSnapshots() {
        for (String node : new String[]{"analytics", "drafts", "publish", "commands", "database"}) {
            var permissions = only(node);
            for (String path : new String[]{"/api/file/config.yml", "/api/file/discord.yml", "/api/file/languages/en_US.yml",
                    "/api/economy-safety", "/api/activity-log", "/api/activity-log/rollback", "/api/activity-log/clear", "/api/telemetry"}) {
                assertFalse(permissions.allows(path, "GET"), node + ": " + path);
            }
        }
    }

    @Test void embeddedCommandsNeedTheCommandCapabilityEvenWhenDeleting() {
        var permissions = only("drafts");
        String ordinary = "items: [{material: STONE, commands: []}]\n";
        String command = "items: [{material: STONE, commands: ['op %player%'], run-as: console}]\n";
        String custom = "items: {wand: {actions: [{type: command, commands: [say hello]}]}}\n";
        assertTrue(permissions.canWriteContent("shops/a.yml", ordinary, ordinary));
        assertFalse(permissions.canWriteContent("shops/a.yml", ordinary, command));
        assertFalse(permissions.canWriteContent("shops/a.yml", command, ordinary));
        assertFalse(permissions.canWriteContent("shops/a.yml", command, null));
        assertFalse(permissions.canWriteContent("custom-items.yml", ordinary, custom));
        assertTrue(EditorPermissions.containsCommands("buttons: {x: {action: command, command: say hi}}"));
        assertFalse(permissions.canReadFile("shops/../config.yml"));
    }

    @Test void bothAdminAliasesAndOpRetainAllCapabilities() {
        for (String node : new String[]{"geniusshop.admin", "shop.admin", "OP"}) {
            CommandSender sender = mock(CommandSender.class);
            if (node.equals("OP")) when(sender.isOp()).thenReturn(true);
            else when(sender.hasPermission(node)).thenReturn(true);
            var permissions = EditorPermissions.of(sender);
            assertTrue(permissions.analytics() && permissions.drafts() && permissions.commands() && permissions.publish() && permissions.database());
            assertTrue(permissions.canWriteContent("config.yml", "password: secret", "password: new"));
            assertTrue(permissions.allows("/api/activity-log/rollback", "POST"));
        }
    }
}
