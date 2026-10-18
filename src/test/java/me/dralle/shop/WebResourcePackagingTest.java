package me.dralle.shop;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class WebResourcePackagingTest {
    @Test
    void packagedWebAssetsAreNotChangedByMavenPropertyFiltering() throws Exception {
        Path web = Path.of("src/main/resources/web");
        try (var paths = Files.walk(web)) {
            var files = paths.filter(Files::isRegularFile).toList();
            assertFalse(files.isEmpty());
            for (Path source : files) {
                String resource = "/web/" + web.relativize(source).toString().replace('\\', '/');
                try (var packaged = getClass().getResourceAsStream(resource)) {
                    assertNotNull(packaged, resource);
                    assertArrayEquals(Files.readAllBytes(source), packaged.readAllBytes(),
                            "Web assets must be copied verbatim: " + resource);
                }
            }
        }
    }
}
