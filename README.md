# Genius Shop

A powerful, data-driven economy shop plugin with GUI, permissions, and Vault integration for Paper/Spigot servers.

## ✨ Features

🛒 Flexible Shop System
- Data-driven configuration - Create unlimited shops with YAML files
- Buy & sell functionality - Players can both purchase and sell items
- Permission-based access - Control who can open specific shops
- Multi-page support - Shops automatically paginate based on content
- Time restrictions - Create limited-time or scheduled shops
- Customizable GUI - Full control over titles, colors, and layouts

🎨 Modern User Interface
- Interactive main menu - Centralized hub for all your shops
- Color-coded formatting - Rich text with Minecraft color codes
- Custom lore support - Add descriptions and tooltips to items
- Purchase confirmation - Prevent accidental transactions
- Sell menu - Dedicated interface for selling inventory items

🌐 Web-Based Editor
- Live GUI preview - See changes in real-time with Minecraft textures
- Intuitive interface - Easily arrange main menu items
- Visual shop builder - No YAML knowledge required
- Secure authentication - UUID-based login system
- Auto-save - Changes sync directly to server files
- RESTful API - Built-in HTTP server for remote management

💰 Economy Integration
- Vault support - Works with any economy plugin
- Configurable prices - Set buy and sell prices independently
- Transaction logging - Track all purchases and sales
- Discord webhooks - Send transaction notifications to Discord
- Economy statistics - Monitor server-wide shop activity

📊 Admin Features
- Live reload - Update shops without restarting the server (/shop reload)
- Shop statistics - Track items bought, sold, and shop usage
- Update checker - Automatic notifications for new versions
- Permission system - Granular control over features and items
- Auto-migration - Seamlessly upgrades from older config formats

🎮 Player-Friendly
- Simple commands - /shop to access shops instantly
- Stack purchasing - Buy/sell items in bulk
- Visual feedback - Clear success/error messages
- Spawner support - Special handling for mob spawners with entity types

## 📋 Requirements

- Minecraft: 1.21+ (Paper recommended)
- Java: 21+
- Vault: Required for economy functionality
- Economy Plugin: Any Vault-compatible economy plugin (e.g., EssentialsX)

## 🚀 Quick Start

1. Install Vault and an economy plugin
2. Drop Genius-Shop.jar into your plugins folder
3. Restart the server
4. Configure shops in plugins/Genius-Shop/shops/
5. Enable the web editor in config.yml (optional)
6. Run /shop reload to apply changes
7. Use /shop in-game to open the main menu

## 🔧 Configuration

Shop Files  
Create individual .yml files in plugins/Genius-Shop/shops/

Web Editor  
Access the visual editor at http://your-server:8080 after enabling the API in config.yml.

## 📝 Commands

- /shop - Open the main shop menu
- /shop reload - Reload all configurations
- /shop editor - Access web editor info

## 🔐 Permissions

- geniusshop.use - Access shops (default: true)
- geniusshop.admin - Reload and manage shops
- custom.permission - Lock any shop behind a permission of your choice

## 📈 Features at a Glance

✅ Multi-shop support with unlimited items  
✅ Web-based configuration editor  
✅ Buy and sell mechanics  
✅ Permission-based shop restrictions  
✅ Time-restricted shops  
✅ Discord webhook integration  
✅ Automatic config migration  
✅ Spawner entity type support  
✅ Update notifications  

## BStats Metrics

![BStats Metrics](https://bstats.org/signatures/bukkit/Genius-Shop.svg)
