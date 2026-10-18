package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.Bukkit;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ErrorFileLoggerTest {
    @TempDir
    Path folder;
    private ShopPlugin plugin;
    private YamlConfiguration config;
    private Logger logger;
    private ErrorFileLogger files;

    @BeforeEach
    void setUp() {
        plugin = mock(ShopPlugin.class);
        config = new YamlConfiguration();
        config.set("debug", true);
        logger = Logger.getLogger("shop-file-test-" + UUID.randomUUID());
        logger.setUseParentHandlers(false);
        logger.setLevel(Level.ALL);
        when(plugin.getConfig()).thenReturn(config);
        when(plugin.getDataFolder()).thenReturn(folder.toFile());
        when(plugin.getLogger()).thenReturn(logger);
        files = new ErrorFileLogger(plugin);
        when(plugin.getErrorFileLogger()).thenReturn(files);
    }

    @AfterEach
    void stop() {
        files.stop();
    }

    private String read(String name) throws Exception {
        return Files.readString(folder.resolve("debug/" + name));
    }

    @Test
    void generalLogIncludesDiagnosticsWhileErrorLogContainsWarningsAndErrors() throws Exception {
        files.startOrReload();
        logger.info("Purchase attempt");
        logger.warning("Transaction REJECTED PAYMENT_FAILED");
        logger.log(Level.SEVERE, "Transaction COMPENSATION_FAILED", new IllegalStateException("refund refused"));
        files.logDiagnostic("CONFIG_PATH", "Loaded configuration");
        files.logError("API", "Request failed", new IllegalArgumentException("bad request"));
        logger.log(Level.INFO, "Player {0}", new Object[]{"Drallee"});

        String general = read("debug.log");
        String errors = read("error.log");
        assertTrue(general.contains("[INFO] [LOGGER] Purchase attempt"));
        assertTrue(general.contains("Loaded configuration"));
        assertTrue(general.contains("Player Drallee"));
        assertFalse(errors.contains("Purchase attempt"));
        assertFalse(errors.contains("Loaded configuration"));
        for (String text : new String[]{"REJECTED PAYMENT_FAILED", "COMPENSATION_FAILED", "IllegalStateException: refund refused", "IllegalArgumentException: bad request"}) {
            assertTrue(general.contains(text));
            assertTrue(errors.contains(text));
        }
    }

    @Test
    void consoleDebugAttemptsAndInsufficientFundsAreCapturedOnce() throws Exception {
        files.startOrReload();
        doCallRealMethod().when(plugin).debug(anyString());
        try (var bukkit = mockStatic(Bukkit.class); var colors = mockStatic(ShopItemUtil.class)) {
            bukkit.when(Bukkit::getConsoleSender).thenReturn(mock(ConsoleCommandSender.class));
            colors.when(() -> ShopItemUtil.color(anyString())).thenAnswer(call -> call.getArgument(0));
            plugin.debug("Purchase attempt: Drallee buying 16x STONE for $80.0 (balance: $0.0)");
            plugin.debug("Purchase failed: Insufficient funds");
            ConsoleLog.success(plugin, "Sale completed");
            ConsoleLog.warn(plugin, "Sale warning");
            ConsoleLog.error(plugin, "Sale error");
            ConsoleLog.apiInfo(plugin, "API request");
            ConsoleLog.apiSuccess(plugin, "API success");
            ConsoleLog.apiWarn(plugin, "API warning");
            ConsoleLog.apiError(plugin, "API error");
        }
        String general = read("debug.log");
        String errors = read("error.log");
        assertEquals(1, general.split("Purchase failed: Insufficient funds", -1).length - 1);
        assertTrue(general.contains("buying 16x STONE for $80.0"));
        assertTrue(general.contains("Sale completed"));
        assertFalse(errors.contains("Insufficient funds"));
        for (String text : new String[]{"Sale warning", "Sale error", "API warning", "API error"}) {
            assertEquals(1, general.split(text, -1).length - 1);
            assertEquals(1, errors.split(text, -1).length - 1);
        }
        assertTrue(general.contains("API request"));
        assertTrue(general.contains("API success"));
    }

    @Test
    void reloadAppendsWithoutDuplicateHandlersAndStopDisablesWrites() throws Exception {
        files.startOrReload();
        logger.info("Before reload");
        files.startOrReload();
        logger.info("After reload");
        assertEquals(1, logger.getHandlers().length);
        String general = read("debug.log");
        assertEquals(1, general.split("Before reload", -1).length - 1);
        assertEquals(1, general.split("After reload", -1).length - 1);
        files.stop();
        logger.severe("After stop");
        files.logDiagnostic("TEST", "After stop");
        assertEquals(general, read("debug.log"));
        assertEquals(0, logger.getHandlers().length);
    }

    @Test
    void debugOffCreatesNoFilesAndRemovesAnExistingHandler() {
        config.set("debug", false);
        files.startOrReload();
        assertFalse(Files.exists(folder.resolve("debug")));
        assertEquals(0, logger.getHandlers().length);
        config.set("debug", true);
        files.startOrReload();
        config.set("debug", false);
        files.startOrReload();
        assertEquals(0, logger.getHandlers().length);
        assertNull(files.getLogFile());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void filesCanBeEnabledIndependently(boolean generalEnabled) throws Exception {
        config.set("debug-log.enabled", generalEnabled);
        config.set("debug-error-log.enabled", !generalEnabled);
        files.startOrReload();
        logger.severe("Failure");
        assertEquals(generalEnabled, Files.exists(folder.resolve("debug/debug.log")));
        assertEquals(!generalEnabled, Files.exists(folder.resolve("debug/error.log")));
        assertTrue(read(generalEnabled ? "debug.log" : "error.log").contains("Failure"));
    }

    @Test
    void customSharedPathDoesNotDuplicateErrorsAndStripsColors() throws Exception {
        config.set("debug-log.file", "support/all.log");
        config.set("debug-error-log.file", "support/./all.log");
        files.startOrReload();
        files.logError("TEST", "&cFailure \u00a7aexample", null);
        String contents = Files.readString(folder.resolve("support/all.log"));
        assertEquals(1, contents.split("Failure example", -1).length - 1);
        assertFalse(contents.contains("&c"));
        assertFalse(contents.contains("\u00a7"));
    }

    @Test
    void failedGeneralFileIsDisabledWithoutRecursionAndErrorLoggingContinues() throws Exception {
        files.startOrReload();
        Path path = folder.resolve("debug/debug.log");
        Files.delete(path);
        Files.createDirectory(path);
        logger.warning("Original warning");
        logger.severe("Still logged");
        String errors = read("error.log");
        assertTrue(errors.contains("Disabled failed log file"));
        assertTrue(errors.contains("Original warning"));
        assertTrue(errors.contains("Still logged"));
    }
}
