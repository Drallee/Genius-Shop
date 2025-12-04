# Web Editor Guide

The Genius Shop Web Editor provides a powerful, modern interface for managing your shops with live preview.

![Web Editor Screenshot](https://via.placeholder.com/800x400?text=Web+Editor+Screenshot)

## Features

✨ **Live Preview** - See changes in real-time with Minecraft-style GUI
🔄 **Undo/Redo** - Easily revert mistakes
💾 **Auto-save** - Changes saved automatically
🎨 **Visual Editor** - No YAML knowledge required
📱 **Responsive** - Works on desktop and mobile

## Getting Started

### Step 1: Enable the Web Editor

In `config.yml`:

```yaml
api:
  enabled: true
  port: 8080
  bind-address: "localhost"  # Change to 0.0.0.0 for remote access
```

Reload the plugin: `/shop reload`

### Step 2: Get Authentication Token

1. Join your Minecraft server
2. Run `/shop editor` in-game
3. Copy the generated token (valid for 5 minutes)

```
[GeniusShop] Web editor token: abc123xyz
[GeniusShop] Access at: http://localhost:8080
[GeniusShop] Token expires in 5 minutes
```

### Step 3: Login

1. Open your browser to `http://your-server-ip:8080`
2. Enter your Minecraft username
3. Paste your UUID as password (get it with `/uuid` in-game)
4. Or use the token for auto-login

> **Note**: The web editor only works while you're online in-game for security

## Interface Overview

### Header Bar

- **User Info** - Shows your username and online status
- **Auto-save Toggle** - Enable/disable automatic saving
- **Animations Toggle** - Enable/disable UI animations
- **Activity Log** - View recent changes
- **Sync** - Reload from server
- **Save** - Manually save changes
- **Logout** - End your session

### Tabs

#### 1. Shop Items

Manage items in the currently selected shop.

**Features:**
- Add new items with the "+" button
- Edit item properties (material, name, lore, prices)
- Drag items to reposition in GUI slots
- Remove items with the "×" button
- Search and filter materials

**Item Properties:**
- **Material**: Minecraft item type
- **Slot**: Position in GUI (0-53 for 6-row menu)
- **Name**: Display name (supports color codes)
- **Lore**: Description lines
- **Buy Price**: Purchase cost (negative = can't buy)
- **Sell Price**: Sell value (negative = can't sell)
- **Amount**: Default quantity
- **Enchantments**: Add enchantments
- **Special**: Potion types, spawner types

#### 2. Shop Settings

Configure global shop properties.

- **GUI Name**: Shop menu title
- **Rows**: Number of inventory rows (1-6)
- **Permission**: Required permission node
- **Available Times**: Time restrictions

**Price Display Settings:**
- Show/hide buy prices
- Customize buy price format
- Show/hide sell prices
- Customize sell price format

#### 3. Main Menu

Configure the shop selection menu.

- **Title**: Main menu title
- **Rows**: Menu size
- **Shop Buttons**: Add shops to main menu
  - Button position
  - Icon material
  - Display name and lore
  - Linked shop file

#### 4. Transaction Menus

Configure purchase and sell quantity menus.

- **Title Prefix**: Menu title format
- **Max Amount**: Maximum transaction size
- **Quick Buy Slots**: Preset quantity buttons

### Live Preview Panel

The right panel shows a live Minecraft-style preview.

**Features:**
- Real-time updates as you edit
- Hover over items to see tooltips
- Visual representation of GUI layout
- Page navigation for multi-page shops

## Common Tasks

### Creating a New Shop

1. Go to **Shop Settings** tab
2. Set GUI name and rows
3. Go to **Shop Items** tab
4. Click "**+ ADD ITEM**"
5. Fill in item details
6. Click slot in preview to place item
7. Save changes

### Editing an Item

1. Go to **Shop Items** tab
2. Find the item card
3. Edit any property (material, name, prices, etc.)
4. Changes appear instantly in preview
5. Auto-save will save automatically

### Adding to Main Menu

1. Go to **Main Menu** tab
2. Click "**ADD NEW SHOP**"
3. Set button key (identifier)
4. Choose slot position
5. Set material, name, and lore
6. Link to shop file
7. Save changes

### Setting Time Restrictions

1. Go to **Shop Settings** tab
2. Find "**Available Times**"
3. Format: `DAY HH:MM-HH:MM, DAY HH:MM-HH:MM`
4. Example: `MON 00:00-23:59, SAT 00:00-23:59`
5. Leave empty for always available

### Using Undo/Redo

- Click **Activity Log** button in header
- View list of recent changes
- Click "**↶ ROLLBACK**" to undo a change
- Supports multiple levels of undo

## Color Codes

Use Minecraft color codes in names and lore:

| Code | Color | Code | Format |
|------|-------|------|--------|
| `&0` | Black | `&l` | **Bold** |
| `&1` | Dark Blue | `&o` | *Italic* |
| `&2` | Dark Green | `&n` | <u>Underline</u> |
| `&3` | Dark Aqua | `&m` | ~~Strikethrough~~ |
| `&4` | Dark Red | `&r` | Reset |
| `&5` | Purple | | |
| `&6` | Gold | | |
| `&7` | Gray | | |
| `&8` | Dark Gray | | |
| `&9` | Blue | | |
| `&a` | Green | | |
| `&b` | Aqua | | |
| `&c` | Red | | |
| `&d` | Pink | | |
| `&e` | Yellow | | |
| `&f` | White | | |

**Example:**
```
&6&lSuper Sword
&7A powerful weapon!
&a&lBuy: &6$100
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save changes |
| `Ctrl+Z` | Undo (via activity log) |
| `Ctrl+R` | Reload from server |
| `Esc` | Close modal dialogs |

## Security & Best Practices

### Security

✅ **DO:**
- Keep `bind-address: localhost` for local access only
- Use strong passwords (UUIDs)
- Regenerate tokens regularly
- Only give admin permissions to trusted users

❌ **DON'T:**
- Expose to public internet without proper security
- Share your authentication tokens
- Leave sessions open on shared computers

### Best Practices

1. **Test Changes**: Preview before saving
2. **Use Auto-save**: Enable for convenience
3. **Regular Backups**: Backup configs before major changes
4. **Activity Log**: Review changes before rollback
5. **Mobile Friendly**: Works on tablets for on-the-go editing

## Troubleshooting

### Can't Connect to Web Editor

**Problem**: Browser shows "Can't reach this page"

**Solutions:**
- Check if API is enabled in `config.yml`
- Verify port 8080 is not blocked by firewall
- Try `http://localhost:8080` if on same machine
- Check server console for errors

### Token Expired

**Problem**: "Token has expired" error

**Solutions:**
- Tokens expire after 5 minutes
- Run `/shop editor` again for a new token
- Login with username/UUID instead

### Authentication Failed

**Problem**: "Authentication failed" error

**Solutions:**
- Ensure you're logged into Minecraft server
- Verify you have `geniusshop.admin` permission
- Check username and UUID are correct
- Get UUID with `/uuid` command in-game

### Changes Not Saving

**Problem**: Edits don't persist after reload

**Solutions:**
- Click "**SAVE**" button manually
- Check auto-save is enabled
- Verify you have write permissions on config files
- Check server console for errors

### Preview Not Updating

**Problem**: Live preview doesn't show changes

**Solutions:**
- Refresh the page
- Check browser console for errors (F12)
- Verify WebSocket connection is active
- Try a different browser

## Tips & Tricks

💡 **Quick Material Search**: Type to filter the material dropdown
💡 **Drag & Drop**: Drag items in preview to reposition
💡 **Copy Slots**: Duplicate items across slots
💡 **Bulk Edit**: Use YAML export for mass changes
💡 **Mobile Editing**: Use tablet for comfortable mobile editing

## Advanced Features

### Activity Log

Track all changes with timestamps:
- View who made changes
- See before/after values
- Rollback unwanted changes
- Audit trail for multi-admin setups

### Export/Import

Export configurations as YAML:
1. Make your edits in web editor
2. Save changes
3. Access files in `plugins/GeniusShop/`
4. Share with other servers

## Next Steps

- **[Examples](Examples)** - See example shop configurations
- **[Configuration](Configuration)** - Learn YAML structure
- **[Commands & Permissions](Commands-and-Permissions)** - Admin commands

---

Need help? [Create an issue](https://github.com/Drallee/Genius-Shop/issues) on GitHub!
