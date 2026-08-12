import { React, useMemo, useState } from "../lib/react.js";
import { Card, YamlPane, Button } from "./ui.js";
import { parseShopItems } from "../utils.js";

const TYPES = ["OPEN_SHOP", "OPEN_ITEM", "SELL_ALL"];
const MODES = ["BOTH", "BUY", "SELL"];
const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function emptyCommand(name = "new-command") {
    return {
        name,
        enabled: false,
        aliases: [],
        description: "Custom shop command",
        usage: `/${name}`,
        permission: "",
        noPermissionMessage: "",
        shopBypassPermission: "",
        action: { type: "OPEN_SHOP", shop: "", item: "", menu: "BOTH" }
    };
}

export function CommandsFeature({ value, onChange, shops, commandCatalog }) {
    const [rawMode, setRawMode] = useState(false);
    const shopNames = useMemo(() => {
        const catalogNames = Object.keys(commandCatalog || {});
        if (catalogNames.length) return catalogNames.sort();
        return Object.keys(shops || {}).sort().map((n) => n.replace(/\.yml$/i, ""));
    }, [shops, commandCatalog]);
    const shopItems = useMemo(() => {
        const out = {};
        for (const [shop, data] of Object.entries(commandCatalog || {})) {
            out[shop] = (data.items || []).map((item) => ({
                key: item.key,
                label: `${item.name || item.material} (${item.key})`,
                material: item.material
            }));
        }
        if (Object.keys(out).length) return out;
        for (const [file, yaml] of Object.entries(shops || {})) {
            out[file.replace(/\.yml$/i, "")] = parseShopItems(yaml);
        }
        return out;
    }, [shops, commandCatalog]);
    const commands = useMemo(() => parseCommands(value), [value]);
    const errors = useMemo(() => validateCommands(commands, shopNames, shopItems), [commands, shopNames, shopItems]);

    const updateCommands = (next) => onChange(serializeCommands(next));
    const update = (index, patch) => {
        const next = commands.map((cmd, i) => i === index ? { ...cmd, ...patch } : cmd);
        updateCommands(next);
    };
    const updateAction = (index, patch) => {
        const next = commands.map((cmd, i) => i === index ? { ...cmd, action: { ...cmd.action, ...patch } } : cmd);
        updateCommands(next);
    };
    const add = () => {
        let base = "new-command";
        let name = base;
        let n = 2;
        const used = new Set(commands.map((c) => c.name));
        while (used.has(name)) name = `${base}-${n++}`;
        updateCommands([...commands, emptyCommand(name)]);
    };
    const duplicate = (index) => {
        const source = commands[index];
        let name = `${source.name}-copy`;
        let n = 2;
        const used = new Set(commands.map((c) => c.name));
        while (used.has(name)) name = `${source.name}-copy-${n++}`;
        updateCommands([...commands, { ...source, name, aliases: [], usage: `/${name}` }]);
    };
    const remove = (index) => updateCommands(commands.filter((_, i) => i !== index));

    if (rawMode) {
        return React.createElement(
            Card,
            { title: "Custom Commands YAML" },
            React.createElement("div", { className: "command-toolbar" }, React.createElement(Button, { onClick: () => setRawMode(false) }, "Form Editor")),
            React.createElement(YamlPane, { value, onChange, readOnly: false })
        );
    }

    return React.createElement(
        "div",
        { className: "commands-layout" },
        React.createElement(
            Card,
            { title: `Custom Commands (${commands.length})` },
            React.createElement(
                "div",
                { className: "command-toolbar" },
                React.createElement(Button, { onClick: add }, "Create"),
                React.createElement(Button, { onClick: () => setRawMode(true) }, "YAML")
            ),
            errors.length
                ? React.createElement("div", { className: "command-errors" }, errors.map((e) => React.createElement("div", { key: e }, e)))
                : React.createElement("div", { className: "command-ok" }, "No client-side validation errors."),
            commands.map((cmd, index) => React.createElement(CommandCard, {
                key: `${cmd.name}-${index}`,
                cmd,
                index,
                shopNames,
                items: shopItems[cmd.action.shop] || [],
                update,
                updateAction,
                duplicate,
                remove
            }))
        )
    );
}

function CommandCard({ cmd, index, shopNames, items, update, updateAction, duplicate, remove }) {
    const actionType = cmd.action.type || "OPEN_SHOP";
    return React.createElement(
        "div",
        { className: "command-card" },
        React.createElement(
            "div",
            { className: "command-card-head" },
            React.createElement("strong", null, cmd.name || "(unnamed)"),
            React.createElement(
                "div",
                { className: "command-actions" },
                React.createElement(Button, { onClick: () => duplicate(index) }, "Duplicate"),
                React.createElement(Button, { onClick: () => remove(index) }, "Delete")
            )
        ),
        row("Enabled", checkbox(cmd.enabled, (v) => update(index, { enabled: v }))),
        row("Command Name", input(cmd.name, (v) => update(index, { name: normalizeName(v), usage: cmd.usage === `/${cmd.name}` ? `/${normalizeName(v)}` : cmd.usage }))),
        row("Aliases", input(cmd.aliases.join(", "), (v) => update(index, { aliases: v.split(",").map((x) => normalizeName(x)).filter(Boolean) }))),
        row("Description", input(cmd.description, (v) => update(index, { description: v }))),
        row("Usage", input(cmd.usage, (v) => update(index, { usage: v }))),
        row("Permission", input(cmd.permission, (v) => update(index, { permission: v }))),
        row("No Permission Message", input(cmd.noPermissionMessage, (v) => update(index, { noPermissionMessage: v }))),
        row("Shop Bypass Permission", input(cmd.shopBypassPermission, (v) => update(index, { shopBypassPermission: v }))),
        row("Action", select(actionType, TYPES, (v) => updateAction(index, { type: v, item: v === "OPEN_ITEM" ? cmd.action.item : "", menu: v === "OPEN_ITEM" ? cmd.action.menu : "BOTH" }))),
        actionType === "OPEN_SHOP" || actionType === "OPEN_ITEM" || actionType === "SELL_ALL"
            ? row(actionType === "SELL_ALL" ? "Shop Scope" : "Shop", select(cmd.action.shop || "", actionType === "SELL_ALL" ? ["", ...shopNames] : shopNames, (v) => updateAction(index, { shop: v, item: items.some((it) => it.key === cmd.action.item) ? cmd.action.item : "" })))
            : null,
        actionType === "OPEN_ITEM"
            ? row("Item", select(cmd.action.item || "", items.map((it) => it.key), (v) => updateAction(index, { item: v }), !cmd.action.shop))
            : null,
        actionType === "OPEN_ITEM"
            ? row("Menu Mode", select(cmd.action.menu || "BOTH", MODES, (v) => updateAction(index, { menu: v })))
            : null
    );
}

function row(label, child) {
    if (!child) return null;
    return React.createElement("label", { className: "command-row" }, React.createElement("span", null, label), child);
}

function input(value, onInput) {
    return React.createElement("input", { value: value || "", onInput: (e) => onInput(e.target.value) });
}

function checkbox(value, onInput) {
    return React.createElement("input", { type: "checkbox", checked: !!value, onChange: (e) => onInput(e.target.checked) });
}

function select(value, options, onInput, disabled = false) {
    return React.createElement(
        "select",
        { value: value || "", disabled, onChange: (e) => onInput(e.target.value) },
        options.map((option) => React.createElement("option", { key: option || "__empty", value: option }, option || "All shops"))
    );
}

function normalizeName(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
}

function parseCommands(yaml) {
    const lines = String(yaml || "").split(/\r?\n/);
    const commands = [];
    let current = null;
    let inAliases = false;
    let inAction = false;
    for (const line of lines) {
        const commandMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
        if (commandMatch) {
            current = emptyCommand(commandMatch[1]);
            commands.push(current);
            inAliases = false;
            inAction = false;
            continue;
        }
        if (!current) continue;
        const trimmed = line.trim();
        if (trimmed === "aliases:") {
            inAliases = true;
            inAction = false;
            continue;
        }
        if (trimmed === "action:") {
            inAction = true;
            inAliases = false;
            continue;
        }
        if (inAliases && trimmed.startsWith("- ")) {
            current.aliases.push(unquote(trimmed.substring(2)));
            continue;
        }
        const kv = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (!kv) continue;
        const key = kv[1];
        const val = unquote(kv[2]);
        if (inAction) {
            if (key === "type") current.action.type = val || "OPEN_SHOP";
            if (key === "shop") current.action.shop = val;
            if (key === "item") current.action.item = val;
            if (key === "menu") current.action.menu = val || "BOTH";
        } else {
            if (key === "enabled") current.enabled = val === "true";
            if (key === "description") current.description = val;
            if (key === "usage") current.usage = val;
            if (key === "permission") current.permission = val;
            if (key === "no-permission-message") current.noPermissionMessage = val;
            if (key === "shop-bypass-permission") current.shopBypassPermission = val;
        }
    }
    return commands;
}

function unquote(value) {
    return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function q(value) {
    return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function serializeCommands(commands) {
    const out = ["commands:"];
    for (const cmd of commands) {
        out.push(`  ${cmd.name || "unnamed"}:`);
        out.push(`    enabled: ${!!cmd.enabled}`);
        if (cmd.aliases.length) {
            out.push("    aliases:");
            cmd.aliases.forEach((alias) => out.push(`      - ${alias}`));
        }
        out.push(`    description: ${q(cmd.description)}`);
        out.push(`    usage: ${q(cmd.usage || "/" + cmd.name)}`);
        out.push(`    permission: ${q(cmd.permission)}`);
        if (cmd.noPermissionMessage) out.push(`    no-permission-message: ${q(cmd.noPermissionMessage)}`);
        if (cmd.shopBypassPermission) out.push(`    shop-bypass-permission: ${q(cmd.shopBypassPermission)}`);
        out.push("    action:");
        out.push(`      type: ${cmd.action.type || "OPEN_SHOP"}`);
        if (cmd.action.shop) out.push(`      shop: ${q(cmd.action.shop)}`);
        if (cmd.action.type === "OPEN_ITEM") {
            out.push(`      item: ${q(cmd.action.item)}`);
            out.push(`      menu: ${cmd.action.menu || "BOTH"}`);
        }
        out.push("");
    }
    return out.join("\n");
}

function validateCommands(commands, shopNames, shopItems) {
    const errors = [];
    const used = new Map();
    for (const cmd of commands) {
        if (!cmd.name) errors.push("Command name is required.");
        if (cmd.name && !NAME_RE.test(cmd.name)) errors.push(`Invalid command name: ${cmd.name}`);
        for (const token of [cmd.name, ...cmd.aliases]) {
            if (!token) continue;
            if (!NAME_RE.test(token)) errors.push(`Invalid alias/name: ${token}`);
            const previous = used.get(token);
            if (previous) errors.push(`Duplicate command or alias '${token}' in ${previous} and ${cmd.name}.`);
            used.set(token, cmd.name);
        }
        if (!TYPES.includes(cmd.action.type)) errors.push(`${cmd.name}: invalid action type.`);
        if (cmd.enabled && (cmd.action.type === "OPEN_SHOP" || cmd.action.type === "OPEN_ITEM") && !shopNames.includes(cmd.action.shop)) {
            errors.push(`${cmd.name}: missing or unknown shop.`);
        }
        if (cmd.enabled && cmd.action.type === "OPEN_ITEM") {
            const items = shopItems[cmd.action.shop] || [];
            if (!items.some((it) => it.key === cmd.action.item)) errors.push(`${cmd.name}: missing or unknown item.`);
            if (!MODES.includes(cmd.action.menu)) errors.push(`${cmd.name}: invalid menu mode.`);
        }
        if (cmd.enabled && cmd.action.type === "SELL_ALL" && cmd.action.shop && !shopNames.includes(cmd.action.shop)) {
            errors.push(`${cmd.name}: unknown SELL_ALL shop scope.`);
        }
    }
    return errors;
}
