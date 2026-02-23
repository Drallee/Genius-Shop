import { React } from "../lib/react.js";

export function Button({ onClick, disabled, children, className = "" }) {
    return React.createElement("button", { className: `btn ${className}`.trim(), onClick, disabled }, children);
}

export function StatusBanner({ status }) {
    return React.createElement("p", { className: `status ${status.type}` }, status.text);
}

export function Card({ title, children, className = "" }) {
    return React.createElement(
        "div",
        { className: `card ${className}`.trim() },
        React.createElement("div", { className: "card-head" }, title),
        children
    );
}

export function Tabs({ tabs, active, onChange }) {
    return React.createElement(
        "div",
        { className: "tabs-react" },
        tabs.map((t) =>
            React.createElement(
                "button",
                {
                    key: t.id,
                    className: `tab-react ${active === t.id ? "active" : ""}`,
                    onClick: () => onChange(t.id)
                },
                t.label
            )
        )
    );
}

export function YamlPane({ value, onChange, readOnly = false }) {
    return React.createElement("textarea", {
        className: "yaml",
        value,
        onChange: (e) => onChange && onChange(e.target.value),
        readOnly
    });
}

