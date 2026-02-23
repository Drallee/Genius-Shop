import { React, useMemo } from "../lib/react.js";
import { Card, YamlPane } from "./ui.js";
import { parseShopMeta } from "../utils.js";

export function ShopFeature({ shops, selectedShop, onPickShop, yamlText, onYamlChange }) {
    const shopNames = useMemo(() => Object.keys(shops || {}).sort(), [shops]);
    const selectedMeta = useMemo(() => parseShopMeta(yamlText), [yamlText]);

    return React.createElement(
        "div",
        { className: "grid" },
        React.createElement(
            Card,
            { title: `Shop Files (${shopNames.length})` },
            React.createElement(
                "div",
                { className: "shops" },
                shopNames.map((name) => {
                    const meta = parseShopMeta(shops[name]);
                    return React.createElement(
                        "button",
                        {
                            key: name,
                            className: `shop-row ${selectedShop === name ? "active" : ""}`,
                            onClick: () => onPickShop(name)
                        },
                        React.createElement("div", null, name),
                        React.createElement("div", { className: "meta" }, `${meta.itemCount} item(s), ${meta.rows || "?"} rows`)
                    );
                })
            )
        ),
        React.createElement(
            Card,
            {
                title: selectedShop
                    ? `${selectedShop} (${selectedMeta.itemCount} item(s), ${selectedMeta.rows || "?"} rows)`
                    : "No shop selected"
            },
            React.createElement(YamlPane, { value: yamlText, onChange: onYamlChange, readOnly: false })
        )
    );
}

