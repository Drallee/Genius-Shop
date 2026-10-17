package me.dralle.shop.api;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.function.UnaryOperator;

/** One compare-and-write lock for every configuration mutation made through this API. */
public final class RevisionedFileStore {
    public static final String MISSING = "missing";
    private final Path root;

    public record Snapshot(String content, String revision) {}
    public record Change(Snapshot before, Snapshot after) {}
    @FunctionalInterface public interface AfterWrite { void run(Change change) throws IOException; }

    public static final class RevisionRequired extends IOException {
        public RevisionRequired() { super("Reload the editor before saving: the originally loaded file revision is required."); }
    }

    public static final class Conflict extends IOException {
        private final String fileName;
        private final Snapshot latest;
        public Conflict(String fileName, Snapshot latest) {
            super("This file changed since it was loaded. Your local edits have not been saved or discarded.");
            this.fileName = fileName;
            this.latest = latest;
        }
        public String fileName() { return fileName; }
        public Snapshot latest() { return latest; }
    }

    public RevisionedFileStore(File root) { this.root = root.toPath().toAbsolutePath().normalize(); }

    public String name(File file) { return root.relativize(file.toPath().toAbsolutePath().normalize()).toString().replace(File.separatorChar, '/'); }

    private Path path(File file) throws IOException {
        Path path = file.toPath().toAbsolutePath().normalize();
        if (!path.startsWith(root) || path.equals(root)) throw new IOException("File is outside the configuration directory");
        for (Path node = path; !node.equals(root); node = node.getParent()) {
            if (Files.isSymbolicLink(node)) throw new IOException("Symbolic links are not editable");
        }
        Path existing = path;
        while (!Files.exists(existing, LinkOption.NOFOLLOW_LINKS)) existing = existing.getParent();
        if (!existing.toRealPath().startsWith(root.toRealPath())) throw new IOException("File leaves the configuration directory");
        return path;
    }

    public synchronized Snapshot read(File file) throws IOException {
        Path path = path(file);
        if (!Files.exists(path)) return new Snapshot(null, MISSING);
        byte[] bytes = Files.readAllBytes(path);
        return new Snapshot(new String(bytes, StandardCharsets.UTF_8), digest(bytes));
    }

    public synchronized Change update(File file, String expected, UnaryOperator<String> edit, AfterWrite afterWrite) throws IOException {
        if (expected == null || expected.isBlank()) throw new RevisionRequired();
        Snapshot before = read(file);
        if (!expected.equals(before.revision())) throw new Conflict(name(file), before);
        String content = edit.apply(before.content());
        Path path = path(file);
        if (content == null) Files.deleteIfExists(path);
        else {
            Files.createDirectories(path.getParent());
            Path temp = Files.createTempFile(path.getParent(), ".editor-", ".tmp");
            try {
                Files.writeString(temp, content, StandardCharsets.UTF_8);
                try { Files.move(temp, path, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
                catch (AtomicMoveNotSupportedException e) { Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING); }
            } finally { Files.deleteIfExists(temp); }
        }
        Snapshot after = content == null ? new Snapshot(null, MISSING) : new Snapshot(content, digest(content.getBytes(StandardCharsets.UTF_8)));
        Change change = new Change(before, after);
        afterWrite.run(change);
        return change;
    }

    private static String digest(byte[] value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
