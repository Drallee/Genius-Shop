# Web Editor Guide

The Genius Shop Web Editor provides a modern web interface for managing your shops directly from your browser.

## Features

✨ **Live Visual Editor** - Edit shops with a visual Minecraft-style preview
🔐 **Secure Authentication** - Token-based login system
💾 **Direct File Editing** - Changes are saved directly to YAML files
🎨 **Color Code Support** - Preview Minecraft color codes in real-time
📱 **Responsive Design** - Works on desktop, tablet, and mobile

---

## Getting Started

### Step 1: Enable the Web Editor

In `config.yml`:

```yaml
api:
  enabled: true
  port: 8080
  api-key: "change-this-to-a-secure-random-key"
```

**Important**:
- The web editor automatically binds to `0.0.0.0` (all network interfaces) so it can be accessed from your local network
- Change the `api-key` to a secure random value for security
- The default port is `8080` - make sure it's not blocked by your firewall

Reload the plugin: `/shop reload`

### Step 2: Generate Login Token

The web editor uses an auto-login token system for secure authentication.

**In-game command:**
```
/shop editor
```

This will:
1. Generate a one-time use token (valid for 5 minutes)
2. Display a clickable link with the token embedded
3. The token automatically logs you in when you click the link

**Example output:**
```
§a§l[Shop Editor]
§7Click the link below to open the shop editor:
http://192.168.1.100:8080/?token=abc123...
§7This token expires in 5 minutes
```

### Step 3: Access the Editor

**Option A: Click the link** (recommended)
- Click the link shown in-game
- You'll be automatically logged in with the token

**Option B: Manual login**
- Navigate to `http://your-server-ip:8080`
- Enter your Minecraft username
- Enter your player UUID as password
- Click "LOGIN"

**How to get your UUID:**
- Check at https://mcuuid.net/
- The login page provides a link to check your UUID

---

## Authentication System

### Auto-Login Tokens

When you run `/shop editor`:
- A unique one-time token is created
- Token expires after 5 minutes
- Token is tied to your IP address
- Token is consumed after first use (one-time only)
- Creates a session that lasts 1 hour

### Session Management

- Sessions last for 1 hour after login
- You must be online in-game to use the editor
- Sessions are validated on each API request
- Logging out invalidates your session immediately

### Security Features

✅ **IP Verification**: Tokens are tied to your IP address
✅ **Permission Check**: Requires `geniusshop.admin` or `shop.admin` permission
✅ **Online Verification**: Player must be online in-game
✅ **One-Time Tokens**: Each token can only be used once
✅ **Time Expiration**: Tokens expire after 5 minutes, sessions after 1 hour
✅ **Local Network Support**: Works with localhost and local network IPs

---

## Network Access

### Accessing from Different Devices

The web editor binds to `0.0.0.0` (all interfaces), which means:

✅ **Same Computer**: `http://localhost:8080`
✅ **Local Network**: `http://192.168.1.XXX:8080` (use your server's IP)
✅ **Other Devices**: Any device on your local network can access it

### Firewall Configuration

If you can't connect:
1. Check if port 8080 is open on your server
2. Allow port 8080 in Windows Firewall / Linux iptables
3. Check your router's firewall settings if accessing from another device

### Remote Access (Advanced)

⚠️ **Not Recommended**: Exposing the editor to the internet is not recommended without additional security measures (VPN, reverse proxy with HTTPS, etc.)

If you need remote access:
- Use a VPN to connect to your local network
- Set up a reverse proxy with HTTPS (nginx, Apache)
- Use SSH port forwarding: `ssh -L 8080:localhost:8080 user@server`

---

## Using the Editor

### Interface Overview

The web editor consists of:

**Left Panel:**
- Shop selector dropdown
- File selector (shops, main menu, settings)
- Edit forms for items and settings

**Right Panel:**
- Live Minecraft-style GUI preview
- Shows exactly how the shop looks in-game
- Updates in real-time as you edit

**Top Bar:**
- Current user and session info
- Save button
- Logout button

### Editing Shop Items

1. Select a shop from the dropdown
2. The shop items will load in the editor
3. Edit item properties:
   - Material (Minecraft item type)
   - Display name (supports `&` color codes)
   - Lore (description lines)
   - Price (buy price - omit, set to 0, or -1 to disable buying)
   - Sell Price (sell price - omit, set to 0, or -1 to disable selling)
   - Amount (default quantity)
   - Enchantments (for enchanted items)
   - Spawner Type (for spawners)
   - Potion Type (for potions)

4. Click "SAVE" to write changes to disk
5. Changes take effect immediately (no reload needed for most changes)

### Editing Shop Settings

Modify global shop properties:
- GUI Name (shop title)
- Rows (GUI size, 1-6)
- Permission (required permission, leave empty for none)
- Available Times (time restrictions for shop availability)

### Editing Main Menu

Configure the shop selection menu:
- Add/remove shop buttons
- Set button positions
- Configure button icons and text
- Link buttons to shop files

---

## Color Codes

Use Minecraft color codes in names and lore:

| Code | Color | Code | Format |
|------|-------|------|--------|
| `&0` | Black | `&l` | **Bold** |
| `&1` | Dark Blue | `&o` | *Italic* |
| `&2` | Dark Green | `&n` | <u>Underline</u> |
| `&3` | Dark Aqua | `&m` | ~~Strikethrough~~ |
| `&4` | Dark Red | `&r` | Reset |
| `&5` | Purple |
| `&6` | Gold |
| `&7` | Gray |
| `&8` | Dark Gray |
| `&9` | Blue |
| `&a` | Green |
| `&b` | Aqua |
| `&c` | Red |
| `&d` | Pink |
| `&e` | Yellow |
| `&f` | White |

**Example:**
```
&6&lDiamond Sword
&7A legendary weapon
&aBuy: &6$1,000
```

---

## Troubleshooting

### Can't Connect to Web Editor

**Problem**: Browser shows "Can't reach this page"

**Solutions:**
1. Verify API is enabled: `api.enabled: true` in config.yml
2. Check the server console for "Web config API started on port 8080"
3. Ensure port 8080 is not blocked by firewall
4. Try accessing from the server itself first: `http://localhost:8080`
5. Check if another program is using port 8080

### Token Expired

**Problem**: "Invalid or expired token" error

**Solutions:**
- Tokens expire after 5 minutes
- Run `/shop editor` again to generate a new token
- Click the link immediately after generating it

### Authentication Failed

**Problem**: Login page shows "Authentication failed"

**Solutions:**
- Ensure you're online on the Minecraft server
- Verify you have `geniusshop.admin` or `shop.admin` permission
- Double-check your UUID is correct (use https://mcuuid.net/)
- Username is case-sensitive - use exact Minecraft username

### Player Not Online Error

**Problem**: "Player is no longer online" error

**Solutions:**
- You must remain logged into the Minecraft server while using the editor
- If you disconnect from the server, your session is invalidated
- Log back into Minecraft and run `/shop editor` again

### IP Address Mismatch

**Problem**: "IP address mismatch" error

**Solutions:**
- Tokens are tied to your IP address for security
- If your IP changes (VPN, network switch), generate a new token
- Make sure you're accessing from the same device/network where you ran the command

### Changes Not Saving

**Problem**: Edits don't persist after clicking save

**Solutions:**
- Check server console for error messages
- Verify file permissions (server must be able to write to plugins/GeniusShop/)
- Ensure your session hasn't expired (sessions last 1 hour)
- Try logging out and back in

---

## Best Practices

💡 **Test Changes**: Preview your changes in the live preview before saving
💡 **Stay Online**: Keep your Minecraft client connected while editing
💡 **Save Frequently**: Click save after making important changes
💡 **Check Console**: Monitor server console for errors
💡 **Backup First**: Backup your config files before major changes
💡 **Use HTTPS**: If exposing remotely, use a reverse proxy with HTTPS

---

## Technical Details

### API Endpoints

The web editor uses these API endpoints:

- `POST /api/login` - Username/UUID authentication
- `POST /api/auto-login` - Token-based auto-login
- `GET /api/shops` - List all shop files
- `GET /api/shop/{name}` - Get shop configuration
- `POST /api/shop/{name}` - Save shop configuration
- `GET /api/main-menu` - Get main menu config
- `POST /api/main-menu` - Save main menu config
- `GET /api/gui-settings` - Get GUI settings
- `POST /api/gui-settings` - Save GUI settings

### File Locations

The web editor directly modifies these files:

- `plugins/GeniusShop/shops/*.yml` - Shop definitions
- `plugins/GeniusShop/menus/main-menu.yml` - Main menu layout
- `plugins/GeniusShop/menus/gui-settings.yml` - GUI text/lore settings
- `plugins/GeniusShop/menus/purchase-menu.yml` - Purchase GUI (read-only)
- `plugins/GeniusShop/menus/sell-menu.yml` - Sell GUI (read-only)

---

## Next Steps

- **[Configuration](Configuration)** - Learn about all config files
- **[Examples](Examples)** - See example shop configurations
- **[Commands & Permissions](Commands-and-Permissions)** - Admin commands reference

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
