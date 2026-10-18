package me.dralle.shop.api;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class PackagedWebAssetsTest {
    @Test
    void packagedWebAssetsPreserveSourceBytesIncludingJavaScriptTemplates() throws Exception {
        Path root = Path.of("src/main/resources/web");
        try (var paths = Files.walk(root)) {
            for (Path path : paths.filter(Files::isRegularFile).toList()) {
                String resource = "/web/" + root.relativize(path).toString().replace('\\', '/');
                try (var stream = getClass().getResourceAsStream(resource)) {
                    assertNotNull(stream, resource);
                    assertArrayEquals(Files.readAllBytes(path), stream.readAllBytes(), resource);
                }
            }
        }
    }

    @Test
    void pluginDescriptorStillReceivesTheBuildVersion() throws Exception {
        try (var stream = getClass().getResourceAsStream("/plugin.yml")) {
            assertNotNull(stream);
            String descriptor = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            assertFalse(descriptor.contains("${project.version}"));
            assertTrue(descriptor.matches("(?s).*\nversion: [0-9][^\r\n]*\r?\n.*"));
        }
    }
}
