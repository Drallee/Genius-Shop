package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;
import org.bukkit.ChatColor;

import java.io.File;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.SimpleFormatter;

/**
 * Writes plugin diagnostics and warning/error summaries to support log files.
 */
public final class ErrorFileLogger {
    private final ShopPlugin plugin;
    private volatile boolean enabled;
    private Path logPath;
    private Path debugLogPath;
    private Handler logHandler;
    private final Object writeLock = new Object();

    public ErrorFileLogger(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void startOrReload() {
        stop();

        boolean debugEnabled = plugin.getConfig().getBoolean("debug", false);
        this.enabled = debugEnabled;
        if (!this.enabled) {
            return;
        }

        logPath = plugin.getConfig().getBoolean("debug-error-log.enabled", true)
                ? initializePath("debug-error-log.file", "debug/error.log") : null;
        debugLogPath = plugin.getConfig().getBoolean("debug-log.enabled", true)
                ? initializePath("debug-log.file", "debug/debug.log") : null;
        if (logPath == null && debugLogPath == null) {
            enabled = false;
            return;
        }

        this.logHandler = new Handler() {
            private final SimpleFormatter formatter = new SimpleFormatter();

            @Override
            public void publish(LogRecord record) {
                if (record == null || !isLoggable(record)) return;
                log(record.getLevel(), "LOGGER", formatter.formatMessage(record), record.getThrown());
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
        this.logHandler.setLevel(Level.ALL);
        plugin.getLogger().addHandler(this.logHandler);

        logDiagnostic("SYSTEM", "Debug file logging initialized");
    }

    private Path initializePath(String configKey, String defaultPath) {
        String configuredPath = plugin.getConfig().getString(configKey, defaultPath);
        File resolved = new File(configuredPath == null ? defaultPath : configuredPath);
        if (!resolved.isAbsolute()) {
            resolved = new File(plugin.getDataFolder(), resolved.getPath());
        }
        Path path = resolved.toPath().toAbsolutePath().normalize();

        try {
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            if (Files.notExists(path)) {
                Files.createFile(path);
            }
            return path;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to initialize log file " + path + ": " + e.getMessage());
            return null;
        }
    }

    public void stop() {
        this.enabled = false;
        if (this.logHandler != null) {
            plugin.getLogger().removeHandler(this.logHandler);
            this.logHandler = null;
        }
        logPath = null;
        debugLogPath = null;
    }

    public void logError(String source, String message, Throwable throwable) {
        log(Level.SEVERE, source, message, throwable);
    }

    public void logDiagnostic(String source, String message) {
        log(Level.INFO, source, message, null);
    }

    public void logMessage(Level level, String source, String message) {
        log(level, source, message, null);
    }

    private void log(Level level, String source, String message, Throwable throwable) {
        if (!enabled) {
            return;
        }

        StringBuilder line = new StringBuilder(256);
        line.append('[')
                .append(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .append("] [").append(level.getName()).append("] [")
                .append(source == null || source.isBlank() ? "GENERAL" : source)
                .append("] ")
                .append(message == null ? "(no message)" : ChatColor.stripColor(ChatColor.translateAlternateColorCodes('&', message)))
                .append(System.lineSeparator());

        if (throwable != null) {
            StringWriter sw = new StringWriter();
            try (PrintWriter pw = new PrintWriter(sw)) {
                throwable.printStackTrace(pw);
            }
            line.append(sw).append(System.lineSeparator());
        }

        synchronized (writeLock) {
            if (!enabled) return;
            Path generalPath = debugLogPath;
            write(generalPath, line.toString());
            if (level.intValue() >= Level.WARNING.intValue() && !java.util.Objects.equals(logPath, generalPath)) {
                write(logPath, line.toString());
            }
        }
    }

    private void write(Path path, String line) {
        if (path == null) return;
        try {
            Files.writeString(path, line, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.WRITE, StandardOpenOption.APPEND);
        } catch (Exception failure) {
            if (path.equals(debugLogPath)) debugLogPath = null;
            if (path.equals(logPath)) logPath = null;
            plugin.getLogger().warning("Disabled failed log file " + path + ": " + failure.getMessage());
        }
    }

    public File getLogFile() {
        return logPath == null ? null : logPath.toFile();
    }
}
