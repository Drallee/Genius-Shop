package me.dralle.shop.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import me.dralle.shop.api.RevisionedFileStore;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Function;

/** Persistent per-user workspaces. Call publish on the server thread, including its reload callback. */
public final class ConfigurationDraftStore {
    private static final Gson JSON = new GsonBuilder().serializeNulls().create();
    private static final Set<String> ROOT_FILES = Set.of("config.yml", "discord.yml", "gui.yml",
            "campaigns.yml", "commands.yml", "custom-items.yml");
    private static final Set<String> MENUS = Set.of("main-menu.yml", "purchase-menu.yml", "sell-menu.yml",
            "bulk-sell-menu.yml", "gui-settings.yml");
    private final Path root;
    private final Function<Map<String, String>, List<String>> validator;

    private static final class Draft {
        Map<String, String> base = new TreeMap<>();
        Map<String, String> changes = new TreeMap<>();
    }

    public record Change(String file, String kind, String before, String after) {}
    public record Status(String revision, int changedFiles) {}
    public record Workspace(Map<String, String> files, Status draft) {}
    public record Review(String token, Status draft, List<Change> changes, List<String> errors) {}
    @FunctionalInterface public interface Reload { void run() throws Exception; }

    public ConfigurationDraftStore(Path root, Function<Map<String, String>, List<String>> validator) {
        this.root = root.toAbsolutePath().normalize();
        this.validator = validator;
    }

    public static boolean allowed(String name) {
        if (name == null || name.contains("..") || name.contains("\\") || name.contains(":")) return false;
        if (ROOT_FILES.contains(name)) return true;
        String[] parts = name.split("/", -1);
        if (parts.length != 2 || !parts[1].matches("[a-zA-Z0-9_][a-zA-Z0-9_.-]*\\.yml")) return false;
        return parts[0].equals("shops") || parts[0].equals("languages") ||
                (parts[0].equals("menus") && MENUS.contains(parts[1]));
    }

    private Path safePath(String name) throws IOException {
        if (!allowed(name)) throw new IllegalArgumentException("Invalid configuration path: " + name);
        Path path = root.resolve(name).normalize();
        for (Path node = path; node != null && !node.equals(root); node = node.getParent()) {
            if (Files.isSymbolicLink(node)) throw new IOException("Symbolic links are not editable: " + name);
        }
        if (Files.isSymbolicLink(root)) throw new IOException("Configuration root must not be a symbolic link");
        Path existing = path;
        while (!Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) existing = existing.getParent();
        if (!existing.toRealPath().startsWith(root.toRealPath())) throw new IOException("Configuration path leaves the data directory: " + name);
        return path;
    }

    private Map<String, String> live() throws IOException {
        Map<String, String> files = new TreeMap<>();
        for (String file : ROOT_FILES) readLive(files, file);
        for (String folder : List.of("shops", "menus", "languages")) {
            Path directory = root.resolve(folder);
            if (Files.isSymbolicLink(directory)) throw new IOException("Configuration directory is a symbolic link: " + folder);
            if (!Files.isDirectory(directory)) continue;
            try (var entries = Files.list(directory)) {
                for (Path path : entries.toList()) {
                    String name = folder + "/" + path.getFileName();
                    if (allowed(name)) readLive(files, name);
                }
            }
        }
        return files;
    }

    private void readLive(Map<String, String> files, String name) throws IOException {
        Path path = safePath(name);
        if (Files.exists(path)) files.put(name, Files.readString(path, StandardCharsets.UTF_8));
    }

    private Path draftPath(String user) throws IOException {
        if (user == null || user.isBlank()) throw new IllegalArgumentException("A draft owner is required");
        Path directory = root.resolve("editor-drafts");
        if (Files.isSymbolicLink(directory)) throw new IOException("Draft directory must not be a symbolic link");
        Files.createDirectories(directory);
        if (!directory.toRealPath().startsWith(root.toRealPath())) throw new IOException("Draft directory leaves the data directory");
        Path path = directory.resolve(digest(user.toLowerCase(Locale.ROOT)) + ".json");
        if (Files.isSymbolicLink(path)) throw new IOException("Draft file must not be a symbolic link");
        return path;
    }

    private Draft load(String user) throws IOException {
        Path path = draftPath(user);
        if (!Files.exists(path)) {
            Draft draft = new Draft();
            draft.base.putAll(live());
            return draft;
        }
        try {
            Draft draft = JSON.fromJson(Files.readString(path, StandardCharsets.UTF_8), Draft.class);
            if (draft == null || draft.base == null || draft.changes == null) throw new IllegalArgumentException("Missing draft data");
            for (String name : draft.base.keySet()) safePath(name);
            for (String name : draft.changes.keySet()) safePath(name);
            return draft;
        } catch (RuntimeException e) { throw new IOException("Cannot read saved draft; it has not been discarded", e); }
    }

    private void persist(String user, Draft draft) throws IOException {
        atomicWrite(draftPath(user), JSON.toJson(draft));
    }

    private static String revision(Draft draft) { return digest(JSON.toJson(draft)); }
    private static Status status(Draft draft) { return new Status(revision(draft), draft.changes.size()); }

    public synchronized Status status(String user) throws IOException { return status(load(user)); }

    public synchronized Map<String, String> files(String user) throws IOException {
        return workspace(user).files();
    }

    public synchronized Workspace workspace(String user) throws IOException {
        Draft draft = load(user);
        // Persist even the initial baseline so other admins cannot silently change a loaded workspace.
        if (!Files.exists(draftPath(user))) persist(user, draft);
        return new Workspace(Collections.unmodifiableMap(proposed(draft)), status(draft));
    }

    private static Map<String, String> proposed(Draft draft) {
        Map<String, String> files = new TreeMap<>(draft.base);
        draft.changes.forEach((name, content) -> { if (content == null) files.remove(name); else files.put(name, content); });
        return files;
    }

    public synchronized Status save(String user, String name, String content, String expectedRevision) throws IOException {
        safePath(name);
        if (content == null && !name.startsWith("shops/")) throw new IllegalArgumentException("Only shop files can be deleted");
        Draft draft = load(user);
        checkRevision(draft, expectedRevision);
        if (Objects.equals(draft.base.get(name), content)) draft.changes.remove(name);
        else draft.changes.put(name, content);
        persist(user, draft);
        return status(draft);
    }

    public synchronized Status saveFile(String user, String name, String content, String expected) throws IOException {
        safePath(name);
        if (expected == null || expected.isBlank()) throw new RevisionedFileStore.RevisionRequired();
        Draft draft = load(user);
        var latest = RevisionedFileStore.snapshot(proposed(draft).get(name));
        if (!expected.equals(latest.revision())) throw new RevisionedFileStore.Conflict(name, latest);
        return save(user, name, content, revision(draft));
    }

    private static void checkRevision(Draft draft, String expected) {
        if (expected != null && !expected.equals(revision(draft))) {
            throw new ConcurrentModificationException("This draft changed in another browser tab. Reload before saving.");
        }
    }

    public synchronized Status discard(String user, String expected) throws IOException {
        checkRevision(load(user), expected);
        Draft clean = new Draft();
        clean.base.putAll(live());
        persist(user, clean);
        return status(clean);
    }

    public synchronized Review review(String user) throws IOException {
        Draft draft = load(user);
        Map<String, String> live = live();
        List<String> errors = new ArrayList<>(validator.apply(Collections.unmodifiableMap(proposed(draft))));
        if (!draft.base.equals(live)) errors.add("Live configuration changed since this draft was opened. Discard the draft and reload before publishing.");
        List<Change> changes = new ArrayList<>();
        for (var entry : draft.changes.entrySet()) {
            String before = draft.base.get(entry.getKey());
            String after = entry.getValue();
            changes.add(new Change(entry.getKey(), after == null ? "deleted" : before == null ? "added" : "modified", before, after));
        }
        return new Review(digest(revision(draft) + JSON.toJson(live)), status(draft), List.copyOf(changes), List.copyOf(errors));
    }

    public synchronized Review publish(String user, String token, Reload reload) throws Exception {
        Review review = review(user);
        if (token == null || !token.equals(review.token())) throw new ConcurrentModificationException("The reviewed configuration changed. Review it again before publishing.");
        if (!review.errors().isEmpty()) throw new IllegalArgumentException(String.join("; ", review.errors()));
        if (review.changes().isEmpty()) return review;
        Draft draft = load(user);
        Map<String, String> before = live();
        try {
            for (Change change : review.changes()) writeLive(change.file(), change.after());
            reload.run();
            Draft clean = new Draft();
            clean.base.putAll(live());
            persist(user, clean);
        } catch (Exception failure) {
            Exception rollbackFailure = null;
            // Reload can also update files; restore the complete managed baseline, not only changed files.
            Set<String> names = new TreeSet<>(before.keySet());
            names.addAll(draft.changes.keySet());
            for (String name : names) {
                try { writeLive(name, before.get(name)); }
                catch (Exception e) { if (rollbackFailure == null) rollbackFailure = e; else rollbackFailure.addSuppressed(e); }
            }
            try { reload.run(); } catch (Exception e) { if (rollbackFailure == null) rollbackFailure = e; else rollbackFailure.addSuppressed(e); }
            if (rollbackFailure != null) {
                failure.addSuppressed(rollbackFailure);
                throw new IOException("Publish failed and rollback could not finish. Server administrator intervention is required; your draft is retained.", failure);
            }
            throw new IOException("Publish failed. The previous live configuration was restored; your draft is retained. " + failure.getMessage(), failure);
        }
        return review;
    }

    void writeLive(String name, String content) throws IOException {
        Path path = safePath(name);
        if (content == null) Files.deleteIfExists(path);
        else atomicWrite(path, content);
    }

    private static void atomicWrite(Path path, String content) throws IOException {
        Files.createDirectories(path.getParent());
        Path temp = Files.createTempFile(path.getParent(), ".editor-", ".tmp");
        try {
            Files.writeString(temp, content, StandardCharsets.UTF_8);
            try { Files.move(temp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
            catch (AtomicMoveNotSupportedException e) { Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING); }
        } finally { Files.deleteIfExists(temp); }
    }

    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
