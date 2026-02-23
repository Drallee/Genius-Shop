import { React } from "../lib/react.js";
import { Card, YamlPane } from "./ui.js";

export function FeatureYamlEditor({ title, description, value, onChange }) {
    return React.createElement(
        Card,
        { title },
        React.createElement(
            "div",
            { className: "feature-wrap" },
            React.createElement("p", { className: "sub feature-sub" }, description),
            React.createElement(YamlPane, { value: value || "", onChange: onChange || (() => {}), readOnly: !onChange })
        )
    );
}

