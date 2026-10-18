package me.dralle.shop.commands;

import me.dralle.shop.ShopPlugin;
import me.dralle.shop.economy.PriceSimulation;
import me.dralle.shop.model.ShopData;
import me.dralle.shop.model.ShopItem;
import net.md_5.bungee.api.chat.BaseComponent;
import net.md_5.bungee.api.chat.ClickEvent;
import net.md_5.bungee.api.chat.hover.content.Text;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PriceSimulationDisplayTest {
    private final ShopPlugin plugin = mock(ShopPlugin.class);
    private final Player player = mock(Player.class, RETURNS_DEEP_STUBS);
    private final PriceSimulationCommand command = new PriceSimulationCommand(plugin);
    private final PriceSimulationCommand.Options options = new PriceSimulationCommand.Options(null,
            Instant.parse("2026-10-18T12:00:00Z"), List.of(1, 16, 64), "live", "both");
    private final Path output = Path.of("plugins/GeniusShop/price-validation/price-validation-test.txt");
    private final ZoneId timezone = ZoneId.of("Europe/Copenhagen");

    @BeforeEach
    void setUp() {
        when(player.isOnline()).thenReturn(true);
        when(player.hasPermission("geniusshop.validateprices")).thenReturn(true);
        when(plugin.formatCurrency(anyDouble())).thenAnswer(call -> String.format(Locale.ROOT, "$%.2f", (double) call.getArgument(0)));
    }

    private PriceSimulation.Result finding() {
        ShopData cheap = mock(ShopData.class), premium = mock(ShopData.class);
        ShopItem item = mock(ShopItem.class);
        when(cheap.getKey()).thenReturn("farming");
        when(premium.getKey()).thenReturn("premium");
        when(item.getMaterial()).thenReturn(Material.CARROT);
        when(item.getUniqueKey()).thenReturn("CARROT_199118451_FULL_IDENTIFIER");
        var route = new PriceSimulation.Route(new PriceSimulation.Offer(cheap, item), new PriceSimulation.Offer(premium, item));
        return new PriceSimulation.Result(route, 64, options.at(), PriceSimulation.Mode.BATCH, 4, 5, 640, 768);
    }

    private List<BaseComponent> messages() {
        var captured = ArgumentCaptor.forClass(BaseComponent.class);
        verify(player.spigot(), atLeastOnce()).sendMessage(captured.capture());
        return captured.getAllValues();
    }

    private String hover(BaseComponent message) {
        return BaseComponent.toPlainText((BaseComponent[]) ((Text) message.getHoverEvent().getContents().getFirst()).getValue());
    }

    @Test
    void compactRouteUsesColorsAndKeepsPreciseDetailsAndCopyKeyInHover() {
        var finding = finding();
        var report = new PriceSimulationCommand.Report(List.of("full report"), List.of(finding), 640, false);
        command.displayReport(player, report, options, Set.of(), List.of(), output, 61, timezone);
        var messages = messages();
        BaseComponent route = messages.get(1);
        assertTrue(route.toPlainText().contains("REVIEW"));
        assertTrue(route.toPlainText().contains("CARROT"));
        assertTrue(route.toPlainText().contains("64x"));
        assertTrue(route.toPlainText().contains("+$128.00"));
        assertFalse(route.toPlainText().contains(finding.route().key()));
        assertTrue(route.toLegacyText().contains("\u00a7eREVIEW"));
        String details = hover(route);
        assertTrue(details.contains("farming:CARROT_199118451_FULL_IDENTIFIER"));
        assertTrue(details.contains("premium:CARROT_199118451_FULL_IDENTIFIER"));
        assertTrue(details.contains("$640.00"));
        assertTrue(details.contains("$768.00"));
        assertTrue(details.contains("2026-10-18 12:00:00 UTC"));
        assertTrue(details.contains("4 / 5"));
        assertTrue(details.contains("Conditions:"));
        assertEquals(ClickEvent.Action.COPY_TO_CLIPBOARD, route.getClickEvent().getAction());
        assertEquals(finding.route().key(), route.getClickEvent().getValue());
        assertTrue(hover(messages.getFirst()).contains("Europe/Copenhagen"));
        assertTrue(hover(messages.getFirst()).contains("No findings does not guarantee"));
        BaseComponent file = messages.getLast();
        assertFalse(file.toPlainText().contains(output.getFileName().toString()));
        assertTrue(hover(file).contains(output.toString()));
        assertEquals(output.getFileName().toString(), file.getClickEvent().getValue());
    }

    @Test
    void manyFindingsAndWarningsStayBoundedAndIntentionalRoutesAreGreen() {
        var finding = finding();
        var report = new PriceSimulationCommand.Report(List.of("full report"), Collections.nCopies(12, finding), 640, false);
        var warnings = IntStream.range(0, 30).mapToObj(index -> "Skipped external delivery " + index).toList();
        command.displayReport(player, report, options, Set.of(finding.route().key()), warnings, output, 61, timezone);
        var messages = messages();
        assertEquals(8, messages.size());
        assertEquals(5, messages.stream().filter(message -> message.toPlainText().startsWith("INTENTIONAL")).count());
        assertTrue(messages.get(1).toLegacyText().contains("\u00a7aINTENTIONAL"));
        BaseComponent warning = messages.get(6);
        assertEquals("30 skipped / warnings [hover]", warning.toPlainText());
        assertTrue(hover(warning).contains("Skipped external delivery 4"));
        assertFalse(hover(warning).contains("Skipped external delivery 5"));
        assertTrue(hover(warning).contains("25 more"));
        verify(player).sendMessage(contains("7"));
    }

    @Test
    void incompleteEmptyReportDoesNotClaimAllRoutesAreSafe() {
        var report = new PriceSimulationCommand.Report(List.of("INCOMPLETE"), List.of(), 1000, true);
        command.displayReport(player, report, options, Set.of(), List.of(), output, 61, timezone);
        assertTrue(messages().stream().anyMatch(message -> message.toPlainText().contains("INCOMPLETE")));
        verify(player).sendMessage(contains("No profitable routes found in the sampled scenarios."));
    }

    @Test
    void consoleRetainsEveryDetailedReportLineAndWarning() {
        CommandSender console = mock(CommandSender.class);
        var report = new PriceSimulationCommand.Report(List.of("route details", "conditions", "assumptions"), List.of(), 10, false);
        command.displayReport(console, report, options, Set.of(), List.of("skipped item"), output, 61, timezone);
        for (String line : List.of("route details", "conditions", "assumptions", "skipped item")) verify(console).sendMessage(line);
        verify(console).sendMessage("Full price simulation report: " + output);
    }

    @Test
    void revokedPermissionsOrOfflinePlayersDoNotReceiveQueuedReports() {
        var report = new PriceSimulationCommand.Report(List.of("private"), List.of(), 10, false);
        when(player.hasPermission("geniusshop.validateprices")).thenReturn(false);
        command.displayReport(player, report, options, Set.of(), List.of(), output, 61, timezone);
        when(player.hasPermission("geniusshop.validateprices")).thenReturn(true);
        when(player.isOnline()).thenReturn(false);
        command.displayReport(player, report, options, Set.of(), List.of(), output, 61, timezone);
        verify(player, never()).sendMessage(anyString());
        verify(player, never()).spigot();
    }
}
