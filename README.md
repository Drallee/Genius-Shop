**🛍️ Genius-Shop**  
A powerful, configurable economy shop plugin for Minecraft servers.

**Genius-Shop adds a fully GUI-based item shop where players can buy and sell items using your server’s economy.**  
It replaces command-based shops with a clean, visual interface and lets server owners customize categories, items, prices, and messages through simple YAML files.

Genius-Shop works on any **Spigot / Paper 1.21+** server and supports all Vault-compatible economy plugins.  
It’s built for smooth player interaction and deep admin customization — no databases required, and no confusing setup.

---

**✨ Features**

**🖼️ Intuitive GUI**  
- Interactive menus with category icons and item displays.  
- Every title, name, and lore line is configurable in `gui.yml`.  
- Fits any server theme or language.

**💰 Buy & Sell System**  
- **Left-click → Buy**, **Right-click → Sell** — all within the GUI.  
- Individual buy and sell prices per item.  
- Works instantly with **Vault-based economies** (EssentialsX, CMI, etc.).

**⚙️ Fully Data-Driven**  
- Define everything in simple YAML — no in-game setup required.  
- Item options include:  
  - `material`, `name`, `price`, `sell-price`, `amount`, `lore`  
  - `spawner-type` for mob spawners  
  - `hide-attributes` and `hide-additional` to remove vanilla tooltips  
  - Per-shop `permission` nodes for restricted categories

**📦 Smart Config Updater**  
- Automatically merges new defaults into configs when updating.  
- Keeps user edits intact and prevents missing keys or messages.

**💬 Fully Custom Messages**  
- All chat text is in `messages.yml`.  
- Use color codes (`&`) and placeholders like `%item%`, `%price%`, `%amount%`.  
- Supports a configurable prefix via `%prefix%`.

**🧍 Player-Friendly Experience**  
- Overflow items automatically drop on the ground if inventory is full.  
- Smooth pagination and category navigation.  
- Built-in support for **Spawner items** with correct entity type.

**🔒 Permission Control**  
- Define per-shop access like `shop.premium`, `shop.spawners`, etc.  
- Global permissions:  
  - `geniusshop.use` → Access `/shop`  
  - `geniusshop.reload` → Reload all configs  

**⚡ Instant Reloads**  
Edit your configs and apply changes instantly with: `/shop reload`

---

**🗂️ Configuration Overview**

| File | Purpose |
|------|----------|
| **config.yml** | General plugin settings and metrics toggle |
| **messages.yml** | All player-facing text |
| **gui.yml** | GUI layout, buttons, and navigation names |
| **shops.yml** | Defines each shop, its items, and permissions |


**📝 Example Configuration (YAML Preview)**
_A quick look at how simple Genius-Shop’s config files are._


```yml
# shops.yml
shops:
  blocks:
    gui-name: "&8Blocks Shop"
    rows: 3
    permission: ""
    items:
      - material: STONE
        name: "&fStone"
        price: 5
        sell-price: 2
        amount: 16

      - material: DIRT
        name: "&6Dirt"
        price: 2
        sell-price: 1
        amount: 32
        hide-attributes: true
```



```yml
# gui.yml
gui:
  main:
    title: "&8Shop Menu"
    size: 27
    items:
      blocks:
        slot: 11
        material: GRASS_BLOCK
        name: "&aBlocks"
        lore:
          - "&7Building materials"
        shop-key: blocks
```
```yml
# messages.yml
messages:
  prefix: "&8&l| &cSHOP &8&l| "
  buy-success: "%prefix%&eYou bought &7%amount%x %item% &efor &6$%price%."
  sell-success: "%prefix%&aYou sold &7%amount%x %item% &afor &6$%price%."
```


---

**⚡ Highlights**

- ✔️ Supports **Minecraft 1.21+**  
- ⚡ Lightweight — no database required  
- 🔁 Reload-safe — no restarts needed  
- 🎨 Fully colorized, customizable GUIs  
- 💸 Vault economy support  

---

**💬 Commands**

| Command | Description |
|----------|-------------|
| `/shop` | Opens the main shop menu |
| `/shop reload` | Reloads all configuration files |

---

**🧰 Ideal For**

Server owners who want a **modern, professional, and customizable shop system** that “just works.”  
Perfect for **Survival**, **Skyblock**, or **Economy** servers where clean design and flexibility matter most.

---

**🔗 Requirements**
- Spigot / Paper 1.21+  
- [Vault](https://www.spigotmc.org/resources/vault.34315/) (for economy support)
