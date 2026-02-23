export function parseYamlItemCount(yamlText) {
    if (!yamlText) return 0;
    const lines = String(yamlText).split("\n");
    let inItems = false;
    let count = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!inItems && trimmed === "items:") {
            inItems = true;
            continue;
        }
        if (inItems && /^-\s+material:/i.test(trimmed)) count++;
        if (inItems && !trimmed) continue;
        if (inItems && !line.startsWith("  ") && trimmed !== "items:") break;
    }
    return count;
}

export function parseShopMeta(yamlText) {
    const text = String(yamlText || "");
    const rowsMatch = text.match(/^\s*rows:\s*(\d+)/m);
    const rows = rowsMatch ? parseInt(rowsMatch[1], 10) : 0;
    const itemCount = parseYamlItemCount(text);
    return { rows, itemCount };
}

export function getUrlToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
}

