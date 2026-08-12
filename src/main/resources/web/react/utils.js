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

export function parseShopItems(yamlText) {
    const lines = String(yamlText || "").split("\n");
    const items = [];
    let inItems = false;
    let current = null;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!inItems && trimmed === "items:") {
            inItems = true;
            continue;
        }
        if (!inItems) continue;
        if (trimmed.startsWith("- ")) {
            if (current) items.push(current);
            current = {};
            const rest = trimmed.substring(2);
            const kv = rest.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
            if (kv) current[kv[1]] = unquoteYaml(kv[2]);
            continue;
        }
        if (current && line.startsWith("    ")) {
            const kv = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
            if (kv) current[kv[1]] = unquoteYaml(kv[2]);
            continue;
        }
        if (current && trimmed && !line.startsWith("  ")) break;
    }
    if (current) items.push(current);
    return items.map((item) => {
        const material = item.material || "UNKNOWN";
        const name = item.name || material;
        const key = item["item-key"] || buildApproxItemKey(item);
        return { key, label: `${name} (${key})`, material };
    });
}

function unquoteYaml(value) {
    return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function buildApproxItemKey(item) {
    let key = item.material || "";
    if (item["spawner-type"]) key += "_" + item["spawner-type"];
    if (item["spawner-item"]) key += "_ITEM_" + item["spawner-item"];
    if (item["potion-type"]) key += "_" + item["potion-type"] + "_" + (item["potion-level"] || "0");
    if (item["variant-key"]) key += "_VARIANT_" + item["variant-key"];
    return key;
}

export function getUrlToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get("token");
}
