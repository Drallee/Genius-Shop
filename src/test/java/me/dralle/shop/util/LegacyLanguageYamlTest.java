package me.dralle.shop.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LegacyLanguageYamlTest {
    @TempDir Path folder;

    @Test void loadsLegacyTranslationsWithoutRewritingTheFile() throws Exception {
        Path languages = Files.createDirectory(folder.resolve("languages"));
        Path file = languages.resolve("es_ES.yml");
        String original = "title: \"CONSEJOS R\u00c3\u0081PIDOS\"\n";
        Files.writeString(file, original);
        assertEquals("CONSEJOS R\u00c1PIDOS", YamlUtil.loadUtf8(file.toFile()).getString("title"));
        assertEquals(original, Files.readString(file));
    }
}
