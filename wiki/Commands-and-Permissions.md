# Commands and Permissions

Complete reference for all Genius Shop commands and permission nodes.

## Commands

### Player Commands

#### `/shop`
Opens the main shop menu.

**Usage:** `/shop`
**Permission:** `geniusshop.use`
**Aliases:** None

### Admin Commands

#### `/shop reload`
Reloads all configuration files without restarting the server.

**Usage:** `/shop reload`
**Permission:** `geniusshop.reload` or `shop.admin`
**Note:** Reloads shops, menus, messages, and settings

#### `/shop editor`
Generates a clickable auto-login link for the web editor.

**Usage:** `/shop editor`
**Permission:** `geniusshop.admin` or `shop.admin`
**Note:** Links expire after 5 minutes. Opens directly in browser with one click.

## Permissions

### User Permissions

#### `geniusshop.use`
**Default:** All players
**Description:** Basic permission to use shops
**Grants:**
- Open main shop menu with `/shop`
- View available shops
- Buy and sell items (if prices are set)

### Admin Permissions

#### `geniusshop.admin` or `shop.admin`
**Default:** Operators
**Description:** Full admin access
**Grants:**
- All user permissions
- Reload configurations
- Generate web editor access links
- Bypass shop restrictions

#### `geniusshop.reload`
**Default:** Operators
**Description:** Permission to reload configs
**Grants:**
- `/shop reload` command only

### Shop-Specific Permissions

You can set custom permissions for individual shops in the shop YAML file:

```yaml
# In shops/yourshop.yml
shop:
  permission: "myserver.vip"
```

This requires players to have the `myserver.vip` permission to access the shop.

**Example:** Make a VIP-only shop that only players with `rank.vip` can access:

```yaml
shop:
  gui-name: "&d&lVIP Shop"
  rows: 6
  permission: "rank.vip"
```

## Permission Setup Examples

### Basic Setup (LuckPerms)

```bash
# Give all players basic shop access
lp group default permission set geniusshop.use true

# Give admins full access
lp group admin permission set geniusshop.admin true

# Give VIP players access to VIP shop (custom permission)
lp group vip permission set rank.vip true
```

### PermissionsEx

```yaml
groups:
  default:
    permissions:
      - geniusshop.use

  vip:
    permissions:
      - geniusshop.use
      - rank.vip

  admin:
    permissions:
      - geniusshop.admin
```

## Usage Examples

### For Players

```bash
# Open main shop menu
/shop
```

### For Admins

```bash
# Reload after config changes
/shop reload

# Get web editor access link
/shop editor
```

## Tips

💡 **Custom Permissions**: Use any permission node for shop access (e.g., `rank.vip`, `donor.tier1`)
💡 **Web Editor**: The `/shop editor` command gives a clickable link that auto-logs you in
💡 **Reload**: Use `/shop reload` after making changes to avoid server restart
💡 **Multiple Shops**: Create different shops with different permission requirements

## Troubleshooting

### "You don't have permission"

**Problem:** Players can't access shops

**Solutions:**
- Verify they have `geniusshop.use` permission
- Check shop-specific permissions in shop YAML file
- Ensure permission plugin is loaded
- Reload permissions: `/lp reload` or equivalent

### Admin commands not working

**Problem:** Can't use admin commands

**Solutions:**
- Verify `geniusshop.admin` or `shop.admin` permission
- Check if you're OP: `/op YourName`
- Try `/shop reload` specifically with `geniusshop.reload`

### Web editor access denied

**Problem:** Can't access web editor

**Solutions:**
- Verify `geniusshop.admin` permission
- Ensure you're online in-game when using link
- Check API is enabled in `config.yml`
- Generate new link: `/shop editor`

## Next Steps

- **[Configuration](Configuration)** - Learn to configure shops
- **[Web Editor](Web-Editor)** - Use the web interface
- **[Examples](Examples)** - See configuration examples

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
