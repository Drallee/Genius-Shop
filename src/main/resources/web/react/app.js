import { React, createRoot, useEffect, useState } from "./lib/react.js";
import { autoLogin, fetchFiles, saveFile } from "./api.js";
import { getUrlToken } from "./utils.js";
import { Button, StatusBanner, Tabs } from "./components/ui.js";
import { ShopFeature } from "./components/feature-shop.js";
import {
    MainMenuFeature,
    PurchaseFeature,
    SellFeature,
    GuiSettingsFeature,
    CampaignsFeature,
    StockFeature,
    DataFeature
} from "./components/features.js";

const TABS = [
    { id: "mainmenu", label: "Main Menu" },
    { id: "shop", label: "Shop" },
    { id: "campaigns", label: "Campaigns" },
    { id: "stock", label: "Stock" },
    { id: "data", label: "Data" },
    { id: "purchase", label: "Purchase" },
    { id: "sell", label: "Sell" },
    { id: "guisettings", label: "GUI Settings" }
];

function App() {
    const [sessionToken, setSessionToken] = useState(localStorage.getItem("sessionToken") || "");
    const [username, setUsername] = useState(localStorage.getItem("username") || "unknown");
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: "ok", text: "Loading..." });
    const [activeTab, setActiveTab] = useState("shop");

    const [files, setFiles] = useState({
        shops: {},
        mainMenu: "",
        purchaseMenu: "",
        sellMenu: "",
        guiSettings: "",
        campaignsFile: "",
        stockJson: "",
        dataJson: ""
    });
    const [selectedShop, setSelectedShop] = useState("");
    const [currentShopYaml, setCurrentShopYaml] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const token = getUrlToken();
                if (token) {
                    const result = await autoLogin(token);
                    if (!result.ok) {
                        if (!cancelled) {
                            setStatus({ type: "err", text: result.data?.message || "Auto-login failed." });
                            setLoading(false);
                        }
                        return;
                    }
                }

                const effectiveToken = (localStorage.getItem("sessionToken") || "").trim();
                const user = localStorage.getItem("username") || "unknown";
                if (!effectiveToken) {
                    window.location.href = "login.html";
                    return;
                }
                if (!cancelled) {
                    setSessionToken(effectiveToken);
                    setUsername(user);
                }

                const data = await fetchFiles(effectiveToken);
                if (cancelled) return;
                hydrateFromFiles(data);
                setStatus({ type: "ok", text: "Loaded configuration files." });
            } catch (error) {
                if (!cancelled) {
                    setStatus({ type: "err", text: error.message || "Failed to load files." });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const hydrateFromFiles = (data) => {
        const shops = data?.shops || {};
        const names = Object.keys(shops).sort();
        const first = names[0] || "";
        setFiles({
            shops,
            mainMenu: data?.mainMenu || "",
            purchaseMenu: data?.purchaseMenu || "",
            sellMenu: data?.sellMenu || "",
            guiSettings: data?.guiSettings || "",
            campaignsFile: data?.campaignsFile || "",
            stockJson: JSON.stringify(data?.stockAnalytics || {}, null, 2),
            dataJson: JSON.stringify(data?.database || {}, null, 2)
        });
        setSelectedShop(first);
        setCurrentShopYaml(first ? shops[first] : "");
    };

    const reload = async () => {
        try {
            setLoading(true);
            const data = await fetchFiles(sessionToken);
            hydrateFromFiles(data);
            setStatus({ type: "ok", text: "Reloaded files from API." });
        } catch (error) {
            setStatus({ type: "err", text: error.message || "Reload failed." });
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("username");
        window.location.href = "login.html";
    };

    const onPickShop = (name) => {
        setSelectedShop(name);
        setCurrentShopYaml(files.shops[name] || "");
    };

    const saveCurrentTab = async () => {
        try {
            setLoading(true);
            if (activeTab === "shop") {
                if (!selectedShop) throw new Error("No shop selected.");
                await saveFile(sessionToken, `shops/${selectedShop}`, currentShopYaml);
                setFiles((prev) => ({ ...prev, shops: { ...prev.shops, [selectedShop]: currentShopYaml } }));
            } else if (activeTab === "mainmenu") {
                await saveFile(sessionToken, "menus/main-menu.yml", files.mainMenu);
            } else if (activeTab === "purchase") {
                await saveFile(sessionToken, "menus/purchase-menu.yml", files.purchaseMenu);
            } else if (activeTab === "sell") {
                await saveFile(sessionToken, "menus/sell-menu.yml", files.sellMenu);
            } else if (activeTab === "guisettings") {
                await saveFile(sessionToken, "menus/gui-settings.yml", files.guiSettings);
            } else if (activeTab === "campaigns") {
                await saveFile(sessionToken, "campaigns.yml", files.campaignsFile);
            } else {
                setStatus({ type: "warn", text: "This tab is read-only in React beta." });
                return;
            }
            setStatus({ type: "ok", text: "Saved successfully." });
        } catch (error) {
            setStatus({ type: "err", text: error.message || "Save failed." });
        } finally {
            setLoading(false);
        }
    };

    const renderActiveTab = () => {
        if (activeTab === "shop") {
            return React.createElement(ShopFeature, {
                shops: files.shops,
                selectedShop,
                onPickShop,
                yamlText: currentShopYaml,
                onYamlChange: setCurrentShopYaml
            });
        }
        if (activeTab === "mainmenu") {
            return React.createElement(MainMenuFeature, {
                value: files.mainMenu,
                onChange: (v) => setFiles((p) => ({ ...p, mainMenu: v }))
            });
        }
        if (activeTab === "purchase") {
            return React.createElement(PurchaseFeature, {
                value: files.purchaseMenu,
                onChange: (v) => setFiles((p) => ({ ...p, purchaseMenu: v }))
            });
        }
        if (activeTab === "sell") {
            return React.createElement(SellFeature, {
                value: files.sellMenu,
                onChange: (v) => setFiles((p) => ({ ...p, sellMenu: v }))
            });
        }
        if (activeTab === "guisettings") {
            return React.createElement(GuiSettingsFeature, {
                value: files.guiSettings,
                onChange: (v) => setFiles((p) => ({ ...p, guiSettings: v }))
            });
        }
        if (activeTab === "campaigns") {
            return React.createElement(CampaignsFeature, {
                value: files.campaignsFile,
                onChange: (v) => setFiles((p) => ({ ...p, campaignsFile: v }))
            });
        }
        if (activeTab === "stock") {
            return React.createElement(StockFeature, { value: files.stockJson });
        }
        if (activeTab === "data") {
            return React.createElement(DataFeature, { value: files.dataJson });
        }
        return null;
    };

    return React.createElement(
        "div",
        { className: "wrap" },
        React.createElement(
            "div",
            { className: "top" },
            React.createElement(
                "div",
                null,
                React.createElement("h1", { className: "title" }, "Genius Shop React Editor"),
                React.createElement("div", { className: "sub" }, `Componentized beta editor. Logged in as ${username}.`)
            ),
            React.createElement(
                "div",
                { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
                React.createElement(Button, { onClick: reload, disabled: loading }, loading ? "Loading..." : "Reload"),
                React.createElement(Button, { onClick: saveCurrentTab, disabled: loading }, "Save Tab"),
                React.createElement(Button, { onClick: () => (window.location.href = "/") }, "Legacy Editor"),
                React.createElement(Button, { onClick: logout }, "Logout")
            )
        ),
        React.createElement(Tabs, { tabs: TABS, active: activeTab, onChange: setActiveTab }),
        React.createElement(StatusBanner, { status }),
        renderActiveTab()
    );
}

createRoot(document.getElementById("root")).render(React.createElement(App));

