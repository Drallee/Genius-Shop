import { React } from "../lib/react.js";
import { FeatureYamlEditor } from "./feature-yaml.js";
import { Card } from "./ui.js";

export function MainMenuFeature({ value, onChange }) {
    return React.createElement(
        FeatureYamlEditor,
        {
            title: "Main Menu",
            description: "Reusable component for main menu YAML editing.",
            value,
            onChange
        }
    );
}

export function PurchaseFeature({ value, onChange }) {
    return React.createElement(
        FeatureYamlEditor,
        {
            title: "Purchase Menu",
            description: "Reusable component for purchase menu YAML editing.",
            value,
            onChange
        }
    );
}

export function SellFeature({ value, onChange }) {
    return React.createElement(
        FeatureYamlEditor,
        {
            title: "Sell Menu",
            description: "Reusable component for sell menu YAML editing.",
            value,
            onChange
        }
    );
}

export function GuiSettingsFeature({ value, onChange }) {
    return React.createElement(
        FeatureYamlEditor,
        {
            title: "GUI Settings",
            description: "Reusable component for shared GUI settings YAML.",
            value,
            onChange
        }
    );
}

export function CampaignsFeature({ value, onChange }) {
    return React.createElement(
        FeatureYamlEditor,
        {
            title: "Campaigns",
            description: "Reusable component for campaign config YAML.",
            value,
            onChange
        }
    );
}

export function StockFeature({ value }) {
    return React.createElement(
        Card,
        { title: "Stock Analytics" },
        React.createElement("p", { className: "sub feature-sub" }, "Read-only JSON view from /api/files stock payload (if available)."),
        React.createElement("pre", { className: "json-view" }, value || "{}")
    );
}

export function DataFeature({ value }) {
    return React.createElement(
        Card,
        { title: "Data Editor" },
        React.createElement("p", { className: "sub feature-sub" }, "Read-only JSON view from /api/files database payload (if available)."),
        React.createElement("pre", { className: "json-view" }, value || "{}")
    );
}

