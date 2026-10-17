package me.dralle.shop.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConfigurationDraftStoreTest {
    @TempDir Path root;

    private ConfigurationDraftStore store() { return new ConfigurationDraftStore(root, files -> List.of()); }
    private void write(String file, String value) throws IOException {
        Files.createDirectories(root.resolve(file).getParent());
        Files.writeString(root.resolve(file), value);
    }

    @Test void persistsPrivateDraftsWithoutChangingLiveAndSurvivesRestart() throws Exception {
        write("shops/blocks.yml", "old");
        var store = store();
        var baseline = store.files("Alice");
        store.save("Alice", "shops/blocks.yml", "draft", store.status("Alice").revision());
        assertEquals("old", Files.readString(root.resolve("shops/blocks.yml")));
        assertEquals("draft", store().files("ALICE").get("shops/blocks.yml"));
        assertEquals(baseline, store.files("Bob"));
    }

    @Test void reviewIncludesAdditionsChangesAndDeletions() throws Exception {
        write("shops/blocks.yml", "old");
        write("shops/remove.yml", "gone");
        var store = store();
        store.save("a", "shops/blocks.yml", "new", null);
        store.save("a", "shops/remove.yml", null, null);
        store.save("a", "shops/add.yml", "added", null);
        var review = store.review("a");
        assertEquals(Set.of("added", "modified", "deleted"), new HashSet<>(review.changes().stream().map(ConfigurationDraftStore.Change::kind).toList()));
        assertEquals("old", review.changes().stream().filter(c -> c.kind().equals("modified")).findFirst().orElseThrow().before());
        assertTrue(Files.exists(root.resolve("shops/remove.yml")));
    }

    @Test void validationSeesWholeProposedSetIncludingUnchangedFiles() throws Exception {
        write("shops/a.yml", "live shop");
        write("menus/main-menu.yml", "menu");
        var store = new ConfigurationDraftStore(root, files -> {
            assertEquals("menu", files.get("menus/main-menu.yml"));
            assertEquals("new shop", files.get("shops/b.yml"));
            assertFalse(files.containsKey("shops/a.yml"));
            return List.of("Broken reference");
        });
        store.save("a", "shops/a.yml", null, null);
        store.save("a", "shops/b.yml", "new shop", null);
        var review = store.review("a");
        assertThrows(IllegalArgumentException.class, () -> store.publish("a", review.token(), () -> fail("Must not reload")));
        assertEquals("live shop", Files.readString(root.resolve("shops/a.yml")));
        assertEquals(2, store.status("a").changedFiles());
    }

    @Test void rejectsStaleDraftWritesReviewsAndDiscards() throws Exception {
        var store = store();
        store.files("a");
        String old = store.status("a").revision();
        store.save("a", "shops/a.yml", "one", old);
        var review = store.review("a");
        store.save("a", "shops/a.yml", "two", null);
        assertThrows(ConcurrentModificationException.class, () -> store.save("a", "shops/a.yml", "lost", old));
        assertThrows(ConcurrentModificationException.class, () -> store.discard("a", old));
        assertThrows(ConcurrentModificationException.class, () -> store.publish("a", review.token(), () -> fail("Must not reload")));
        assertEquals("two", store.files("a").get("shops/a.yml"));
    }

    @Test void rejectsExternalLiveEditsAndOtherAdministratorsPublishing() throws Exception {
        write("shops/a.yml", "old");
        var store = store();
        store.files("a");
        store.files("b");
        store.save("a", "shops/a.yml", "from a", null);
        store.save("b", "shops/a.yml", "from b", null);
        store.publish("b", store.review("b").token(), () -> {});
        assertFalse(store.review("a").errors().isEmpty());
        assertThrows(IllegalArgumentException.class, () -> store.publish("a", store.review("a").token(), () -> {}));
        assertEquals("from b", Files.readString(root.resolve("shops/a.yml")));
        store.discard("a", store.status("a").revision());
        store.save("a", "shops/a.yml", "draft", null);
        var reviewed = store.review("a");
        write("shops/a.yml", "manual change");
        assertThrows(ConcurrentModificationException.class, () -> store.publish("a", reviewed.token(), () -> {}));
    }

    @Test void publishesAllFilesTogetherAndOnlyThenClearsDraft() throws Exception {
        write("shops/a.yml", "old");
        var store = store();
        store.save("a", "shops/a.yml", null, null);
        store.save("a", "shops/b.yml", "new shop", null);
        store.save("a", "menus/main-menu.yml", "new menu", null);
        AtomicInteger reloads = new AtomicInteger();
        store.publish("a", store.review("a").token(), () -> {
            assertFalse(Files.exists(root.resolve("shops/a.yml")));
            assertEquals("new shop", Files.readString(root.resolve("shops/b.yml")));
            assertEquals("new menu", Files.readString(root.resolve("menus/main-menu.yml")));
            reloads.incrementAndGet();
        });
        assertEquals(1, reloads.get());
        assertEquals(0, store.status("a").changedFiles());
    }

    @Test void reloadFailureRestoresAllLiveFilesAndRetainsDraft() throws Exception {
        write("shops/a.yml", "old");
        write("menus/main-menu.yml", "old menu");
        var store = store();
        store.save("a", "shops/a.yml", null, null);
        store.save("a", "shops/b.yml", "draft", null);
        AtomicInteger reloads = new AtomicInteger();
        IOException failure = assertThrows(IOException.class, () -> store.publish("a", store.review("a").token(), () -> {
            if (reloads.incrementAndGet() == 1) {
                write("menus/main-menu.yml", "reload side effect");
                throw new IOException("reload failed");
            }
            assertEquals("old", Files.readString(root.resolve("shops/a.yml")));
            assertEquals("old menu", Files.readString(root.resolve("menus/main-menu.yml")));
            assertFalse(Files.exists(root.resolve("shops/b.yml")));
        }));
        assertTrue(failure.getMessage().contains("previous live configuration was restored"));
        assertEquals(2, reloads.get());
        assertEquals(2, store().status("a").changedFiles());
        assertEquals("draft", store.files("a").get("shops/b.yml"));
    }

    @Test void revertingToBaselineRemovesDraftChangesAndDiscardResetsToLive() throws Exception {
        write("shops/a.yml", "old");
        var store = store();
        store.save("a", "shops/a.yml", "new", null);
        store.save("a", "shops/a.yml", "old", null);
        assertEquals(0, store.status("a").changedFiles());
        store.save("a", "shops/a.yml", "draft", null);
        write("shops/a.yml", "external");
        store.discard("a", store.status("a").revision());
        assertEquals(Map.of("shops/a.yml", "external"), store.files("a"));
    }

    @Test void aWriteFailureRollsBackAlreadyInstalledFiles() throws Exception {
        write("shops/a.yml", "old");
        var store = spy(store());
        store.save("a", "shops/a.yml", "draft a", null);
        store.save("a", "shops/b.yml", "draft b", null);
        doThrow(new IOException("disk failure")).when(store).writeLive("shops/b.yml", "draft b");
        AtomicInteger reloads = new AtomicInteger();
        assertThrows(IOException.class, () -> store.publish("a", store.review("a").token(), () -> {
            reloads.incrementAndGet();
            assertEquals("old", Files.readString(root.resolve("shops/a.yml")));
            assertFalse(Files.exists(root.resolve("shops/b.yml")));
        }));
        assertEquals(1, reloads.get());
        assertEquals(2, store.status("a").changedFiles());
    }

    @Test void rollbackFailureIsReportedExplicitlyAndKeepsRecoveryData() throws Exception {
        write("shops/a.yml", "old");
        var store = store();
        store.save("a", "shops/a.yml", "draft", null);
        IOException error = assertThrows(IOException.class, () -> store.publish("a", store.review("a").token(),
                () -> { throw new IOException("reload unavailable"); }));
        assertTrue(error.getMessage().contains("administrator intervention"));
        assertEquals("old", Files.readString(root.resolve("shops/a.yml")));
        assertEquals("draft", store().files("a").get("shops/a.yml"));
    }

    @Test void rejectsTraversalProtectedDeletionAndCorruptDraftData() throws Exception {
        var store = store();
        for (String path : List.of("../config.yml", "shops/../../x.yml", "shops/x.txt", "C:/x.yml", "shops/x\\y.yml", "editor-drafts/a.yml")) {
            assertThrows(IllegalArgumentException.class, () -> store.save("a", path, "bad", null), path);
        }
        assertThrows(IllegalArgumentException.class, () -> store.save("a", "config.yml", null, null));
        store.files("a");
        try (var files = Files.list(root.resolve("editor-drafts"))) { Files.writeString(files.findFirst().orElseThrow(), "{broken"); }
        assertThrows(IOException.class, () -> store.files("a"));
    }
}
