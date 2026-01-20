# Genius Shop v1.4.1-BETA

A powerful, data-driven economy shop plugin with GUI, permissions, and Vault integration for Paper/Spigot servers.

## ✨ Features

🛒 Flexible Shop System
- Data-driven configuration - Create unlimited shops with YAML files in `shops/` directory
- Buy & sell functionality - Players can both purchase and sell items
- Permission-based access - Control who can open specific shops
- Multi-page support - Shops automatically paginate based on content
- Time restrictions - Create limited-time or scheduled shops with natural language display
- Customizable GUI - Full control over titles, colors, and layouts via `menus/` configuration
- Potion & Spawner support - Full support for potions, tipped arrows, and mob spawners
- Player Limits - Set per-item purchase limits for players
- Dynamic Pricing - Prices that change based on supply and demand
- Item Guard - Require specific names or lore for selling items
- Unstable TNT - Special handling for TNT that ignites on placement

🎨 Modern User Interface
- Interactive main menu - Centralized hub for all your shops
- Color-coded formatting - Rich text with Minecraft color codes
- Custom lore support - Add descriptions and tooltips to items
- Purchase confirmation - Prevent accidental transactions with a dedicated confirmation GUI
- Sell menu - Dedicated interface for selling inventory items

🌐 Web-Based Editor
- Live GUI preview - See changes in real-time with Minecraft textures
- Intuitive interface - Easily arrange main menu items and shop contents
- Visual shop builder - No YAML knowledge required
- Secure authentication - UUID-based login system with IP verification
- IP Bypass System - Securely access the editor from different IPs via in-game confirmation
- Auto-save - Changes sync directly to server files and reload instantly
- RESTful API - Built-in HTTP server for remote management

💰 Economy Integration
- Vault support - Works with any economy plugin
- Configurable prices - Set buy and sell prices independently
- Transaction logging - Track all purchases and sales
- Discord webhooks - Send transaction notifications to Discord
- Economy statistics - Monitor server-wide shop activity

📊 Admin Features
- Live reload - Update shops without restarting the server (`/shop reload`)
- Shop statistics - Track items bought, sold, and shop usage
- Update checker - Automatic notifications for new versions in-game and console
- Smart Config Updater - Automatically merges new config keys while preserving your changes
- Permission system - Granular control over features, items, and administrative commands

🎮 Player-Friendly
- Simple commands - `/shop` to access shops instantly
- Clickable links - Quick access to the web editor via chat links
- Stack purchasing - Buy/sell items in bulk
- Visual feedback - Clear success/error messages

## 📋 Requirements

- Minecraft: 1.20.6+ (Paper recommended)
- Java: 21+
- Vault: Required for economy functionality
- Economy Plugin: Any Vault-compatible economy plugin (e.g., EssentialsX)

## 🚀 Quick Start

1. Install Vault and an economy plugin
2. Drop Genius-Shop.jar into your plugins folder
3. Restart the server
4. Configure shops in `plugins/Genius-Shop/shops/`
5. Configure menus in `plugins/Genius-Shop/menus/`
6. Enable the web editor in `config.yml` (optional)
7. Run `/shop reload` to apply changes
8. Use `/shop` in-game to open the main menu

## 🔧 Configuration

Shop Files  
Create individual `.yml` files in `plugins/Genius-Shop/shops/`. See the `README.md` in that folder for a detailed guide.

Menu Files  
Customize the look and feel of GUIs in `plugins/Genius-Shop/menus/`.

Web Editor  
Access the visual editor at `http://your-server:8080` after enabling the API in `config.yml`. Or use `/shop editor` in-game for a secure one-click login link.

## 📝 Commands

- `/shop` - Open the main shop menu
- `/shop reload` - Reload all configurations
- `/shop editor` - Generate a secure web editor login link
- `/shop confirmlogin <token>` - Confirm a login attempt from a new IP

## 🔐 Permissions

- `geniusshop.use` - Access shops (default: true)
- `geniusshop.reload` - Reload the plugin configuration
- `geniusshop.admin` - Full administrative access (reload, editor, etc.)
- `geniusshop.login.ip.bypass` - Permission to authorize new IPs for the web editor
- `custom.permission` - Lock any shop behind a permission of your choice

## 📈 Features at a Glance

✅ Multi-shop support with unlimited items  
✅ Web-based configuration editor with live preview  
✅ Modular configuration (shops/ and menus/ folders)  
✅ Buy and sell mechanics with Dynamic Pricing  
✅ Potion, Spawner, and Tipped Arrow support  
✅ Player purchase limits and item-specific restrictions  
✅ Permission-based shop restrictions  
✅ Time-restricted shops with scheduling  
✅ Discord webhook integration  
✅ Automatic config migration and smart updates  
✅ Update notifications (In-game & Console)  

## BStats Metrics

![BStats Metrics](https://bstats.org/signatures/bukkit/Genius-Shop.svg)
