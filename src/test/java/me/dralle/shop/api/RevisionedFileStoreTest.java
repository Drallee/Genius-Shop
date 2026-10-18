package me.dralle.shop.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RevisionedFileStoreTest {
    @TempDir Path root;
    private File file() { return root.resolve("shop.yml").toFile(); }
    private RevisionedFileStore store() { return new RevisionedFileStore(root.toFile()); }

    @Test void revisionsDescribeActualBytesAndDetectExternalEditsWithUnchangedMetadata() throws Exception {
        Files.writeString(file().toPath(), "old");
        var store = store();
        var original = store.read(file());
        var time = Files.getLastModifiedTime(file().toPath());
        Files.writeString(file().toPath(), "new");
        Files.setLastModifiedTime(file().toPath(), time);
        var conflict = assertThrows(RevisionedFileStore.Conflict.class, () -> store.update(file(), original.revision(),
                ignored -> "lost update", saved -> fail("Must not reload")));
        assertEquals("new", conflict.latest().content());
        assertEquals("new", Files.readString(file().toPath()));
        assertEquals("shop.yml", conflict.fileName());
    }

    @Test void missingRevisionCannotWriteOrDelete() throws Exception {
        Files.writeString(file().toPath(), "old");
        var store = store();
        for (String revision : new String[] { null, "", " " }) {
            assertThrows(RevisionedFileStore.RevisionRequired.class, () -> store.update(file(), revision, ignored -> null, saved -> fail()));
        }
        assertEquals("old", Files.readString(file().toPath()));
    }

    @Test void successfulSaveReturnsTheNewRevisionAndRejectsOlderSaves() throws Exception {
        Files.writeString(file().toPath(), "old");
        var store = store();
        String original = store.read(file()).revision();
        var change = store.update(file(), original, ignored -> "new", saved -> assertEquals("new", Files.readString(file().toPath())));
        assertEquals("old", change.before().content());
        assertEquals(store.read(file()), change.after());
        assertThrows(RevisionedFileStore.Conflict.class, () -> store.update(file(), original, ignored -> "stale", saved -> fail()));
    }

    @Test void absenceIsVersionedForCreationDeletionAndRecreation() throws Exception {
        var store = store();
        assertEquals("missing", store.read(file()).revision());
        var created = store.update(file(), "missing", ignored -> "one", saved -> {});
        assertThrows(RevisionedFileStore.Conflict.class, () -> store.update(file(), "missing", ignored -> "overwrite", saved -> fail()));
        Files.delete(file().toPath());
        var conflict = assertThrows(RevisionedFileStore.Conflict.class, () -> store.update(file(), created.after().revision(), ignored -> "stale", saved -> fail()));
        assertNull(conflict.latest().content());
        assertEquals("missing", conflict.latest().revision());
        var recreated = store.update(file(), "missing", ignored -> "two", saved -> {});
        store.update(file(), recreated.after().revision(), ignored -> null, saved -> {});
        assertFalse(file().exists());
    }

    @Test void simultaneousWritersCannotBothPassTheSameRevision() throws Exception {
        Files.writeString(file().toPath(), "old");
        var store = store();
        String revision = store.read(file()).revision();
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger writes = new AtomicInteger();
        AtomicInteger conflicts = new AtomicInteger();
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Callable<Void> save = () -> {
                start.await();
                try { store.update(file(), revision, ignored -> Thread.currentThread().getName(), saved -> writes.incrementAndGet()); }
                catch (RevisionedFileStore.Conflict expected) { conflicts.incrementAndGet(); }
                return null;
            };
            Future<Void> first = executor.submit(save);
            Future<Void> second = executor.submit(save);
            start.countDown();
            first.get(5, TimeUnit.SECONDS);
            second.get(5, TimeUnit.SECONDS);
        }
        assertEquals(1, writes.get());
        assertEquals(1, conflicts.get());
    }

    @Test void editsAndReloadCallbacksShareTheSameWriteLock() throws Exception {
        Files.writeString(file().toPath(), "old");
        var store = store();
        var revision = store.read(file()).revision();
        store.update(file(), revision, previous -> {
            assertTrue(Thread.holdsLock(store));
            return previous + " edited";
        }, saved -> assertTrue(Thread.holdsLock(store)));
        assertEquals("old edited", store.read(file()).content());
    }

    @Test void pathsOutsideTheDataDirectoryCannotBeReadOrWritten() {
        var store = store();
        assertThrows(java.io.IOException.class, () -> store.read(root.resolve("../outside.yml").toFile()));
        assertThrows(java.io.IOException.class, () -> store.update(root.toFile(), "missing", ignored -> "bad", saved -> fail()));
    }
}
