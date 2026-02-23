package me.dralle.shop.util;

import me.dralle.shop.ShopPlugin;

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

/**
 * Writes plugin errors/exceptions to a dedicated file for support diagnostics.
 */
public final class ErrorFileLogger {
    private final ShopPlugin plugin;
    private volatile boolean enabled;
    private Path logPath;
    private Handler severeHandler;
    private final Object writeLock = new Object();

    public ErrorFileLogger(ShopPlugin plugin) {
        this.plugin = plugin;
    }

    public void startOrReload() {
        stop();

        boolean debugEnabled = plugin.getConfig().getBoolean("debug", false);
        boolean fileLoggingEnabled = plugin.getConfig().getBoolean("debug-error-log.enabled", true);
        this.enabled = debugEnabled && fileLoggingEnabled;
        if (!this.enabled) {
            return;
        }

        String configuredPath = plugin.getConfig().getString("debug-error-log.file", "debug/error.log");
        File resolved = new File(configuredPath == null ? "debug/error.log" : configuredPath);
        if (!resolved.isAbsolute()) {
            resolved = new File(plugin.getDataFolder(), resolved.getPath());
        }
        this.logPath = resolved.toPath();

        try {
            Path parent = this.logPath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            if (Files.notExists(this.logPath)) {
                Files.createFile(this.logPath);
            }
        } catch (Exception e) {
            this.enabled = false;
            plugin.getLogger().warning("Failed to initialize error log file: " + e.getMessage());
            return;
        }

        this.severeHandler = new Handler() {
            @Override
            public void publish(LogRecord record) {
                if (!enabled || record == null || record.getLevel().intValue() < Level.SEVERE.intValue()) {
                    return;
                }
                String message = record.getMessage();
                if (message == null || message.isBlank()) {
                    message = "SEVERE log record";
                }
                logError("LOGGER", message, record.getThrown());
            }

            @Override
            public void flush() {
                // No buffering.
            }

            @Override
            public void close() {
                // No resources to release.
            }
        };
        this.severeHandler.setLevel(Level.SEVERE);
        plugin.getLogger().addHandler(this.severeHandler);

        logError("SYSTEM", "Error file logging initialized", null);
    }

    public void stop() {
        this.enabled = false;
        if (this.severeHandler != null) {
            plugin.getLogger().removeHandler(this.severeHandler);
            this.severeHandler = null;
        }
    }

    public void logError(String source, String message, Throwable throwable) {
        if (!enabled || logPath == null) {
            return;
        }

        StringBuilder line = new StringBuilder(256);
        line.append('[')
                .append(OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .append("] [")
                .append(source == null || source.isBlank() ? "GENERAL" : source)
                .append("] ")
                .append(message == null ? "(no message)" : message)
                .append(System.lineSeparator());

        if (throwable != null) {
            StringWriter sw = new StringWriter();
            try (PrintWriter pw = new PrintWriter(sw)) {
                throwable.printStackTrace(pw);
            }
            line.append(sw).append(System.lineSeparator());
        }

        synchronized (writeLock) {
            try {
                Files.writeString(
                        logPath,
                        line.toString(),
                        StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.WRITE,
                        StandardOpenOption.APPEND
                );
            } catch (Exception e) {
                plugin.getLogger().warning("Failed writing to error log file: " + e.getMessage());
            }
        }
    }

    public File getLogFile() {
        return logPath == null ? null : logPath.toFile();
    }
}
