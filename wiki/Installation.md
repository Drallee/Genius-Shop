# Installation Guide

## Requirements

Before installing Genius Shop, ensure your server meets these requirements:

- **Minecraft Version**: 1.21 or higher
- **Java Version**: Java 21 or higher
- **Economy Plugin**: Vault (or compatible economy plugin)
- **Server Software**: Spigot, Paper, or compatible fork

## Step 1: Download the Plugin

1. Go to the [Releases page](https://github.com/Drallee/Genius-Shop/releases)
2. Download the latest `GeniusShop-X.X.X.jar` file
3. Alternatively, download from [SpigotMC](https://www.spigotmc.org/) or [Modrinth](https://modrinth.com/)

## Step 2: Install the Plugin

1. Stop your Minecraft server
2. Place `GeniusShop-X.X.X.jar` into your server's `plugins` folder
3. Start your server

The plugin will automatically generate default configuration files:
```
plugins/GeniusShop/
├── config.yml
├── messages.yml
├── discord.yml
├── menus/
│   ├── gui-settings.yml
│   ├── main-menu.yml
│   ├── purchase-menu.yml
│   └── sell-menu.yml
└── shops/
    ├── blocks.yml
    ├── farming.yml
    ├── misc.yml
    └── README.md
```

## Step 3: Configure Economy

Genius Shop requires an economy plugin. Install one of these:

- **Vault** (recommended) - [Download](https://www.spigotmc.org/resources/vault.34315/)
- Any Vault-compatible economy plugin (EssentialsX, etc.)

## Step 4: Grant Permissions

Give yourself admin permissions to access all features:

```yaml
# In your permissions plugin (LuckPerms, PermissionsEx, etc.)
geniusshop.admin  # Full admin access
geniusshop.use    # Use shops
```

## Step 5: Test the Plugin

1. Join your server
2. Run `/shop` to open the main shop menu
3. Try buying/selling items

## Step 6: Access Web Editor (Optional)

The web editor provides a powerful interface for managing shops:

1. Ensure you're logged into your Minecraft server
2. Run `/shop editor` in-game to get your authentication token
3. Open your browser to `http://your-server-ip:8080`
4. Login with your Minecraft username and UUID

> **Security Note**: The web editor is bound to `localhost` by default. To access remotely, configure `api.bind-address` in `config.yml`

## Verification

To verify successful installation:

```
/shop         # Should open the shop menu
/shop reload  # Should reload configs
/shop editor   # Should generate auth token (admins only)
```

## Troubleshooting

### Plugin doesn't load
- Check your Java version: `java -version` (must be 21+)
- Check server logs for errors
- Ensure you're running Minecraft 1.21+

### Economy not working
- Install Vault and an economy plugin
- Check `/plugins` shows both Vault and your economy plugin as green

### Web editor won't connect
- Check if port 8080 is open
- Verify `config.yml` has `api.enabled: true`
- Check firewall settings

### Permission denied errors
- Ensure you have `geniusshop.admin` permission
- Check your permissions plugin configuration

## Next Steps

- **[Configuration](Configuration)** - Configure your shops
- **[Web Editor](Web-Editor)** - Learn to use the web interface
- **[Commands & Permissions](Commands-and-Permissions)** - View all commands

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
