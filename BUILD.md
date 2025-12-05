# Building Perplexity Overlay

This guide explains how to build the Perplexity Overlay as a standalone macOS application (.dmg).

## Prerequisites

1. **macOS** (required for building macOS apps)
2. **Node.js** v18 or later
3. **npm** (comes with Node.js)

## Quick Build

### Option 1: Use the build script (Recommended)

```bash
cd prplx-overlay
./scripts/build-mac.sh
```

This script will:
- Clean previous builds
- Install dependencies
- Rebuild native modules for Electron
- Build the TypeScript and React code
- Create the DMG installer

### Option 2: Manual build

```bash
cd prplx-overlay

# Install dependencies
npm install

# Build for your current architecture
npm run dist

# Or build for specific architecture:
npm run dist:arm64    # Apple Silicon (M1/M2/M3)
npm run dist:x64      # Intel Macs
```

## Output

After building, you'll find the following in the `release/` folder:

- `Perplexity Overlay-1.0.0-arm64.dmg` - Apple Silicon installer
- `Perplexity Overlay-1.0.0-x64.dmg` - Intel Mac installer
- `Perplexity Overlay-1.0.0-arm64.zip` - Apple Silicon portable zip
- `Perplexity Overlay-1.0.0-x64.zip` - Intel Mac portable zip

## Installation

1. Open the `.dmg` file
2. Drag "Perplexity Overlay" to the Applications folder
3. **First launch**: Right-click the app → Open (to bypass Gatekeeper for unsigned apps)

## Required Permissions

On first launch, you'll need to grant the following permissions:

### 1. Screen Recording
Required for taking screenshots.

1. Open **System Settings** → **Privacy & Security** → **Screen Recording**
2. Click the `+` button
3. Navigate to Applications and select **Perplexity Overlay**
4. Enable the toggle next to **Perplexity Overlay**
5. Restart the app if prompted

### 2. Accessibility
Required for overlay functionality.

1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Click the `+` button
3. Navigate to Applications and select **Perplexity Overlay**
4. Enable the toggle next to **Perplexity Overlay**

### 3. Safari JavaScript from Apple Events
Required for Safari automation.

1. Open **Safari**
2. Go to **Safari** → **Settings** (or press `⌘,`)
3. Click on **Advanced**
4. Enable **Show Develop menu in menu bar**
5. In the menu bar, click **Develop** → **Allow JavaScript from Apple Events**

## Usage

1. Open Safari and navigate to [perplexity.ai](https://perplexity.ai)
2. Log in to your Perplexity account
3. Launch Perplexity Overlay from Applications

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + Shift + H` | Toggle overlay visibility |
| `⌘ + Shift + S` | Take screenshot |
| `⌘ + Shift + C` | Cut/crop screenshot selection |
| `⌘ + Shift + Enter` | Send prompt to Perplexity |
| `⌘ + Shift + R` | Reset/clear queue |
| Arrow keys + `⌘ + Shift` | Move overlay window |

## Troubleshooting

### "Perplexity Overlay can't be opened because it is from an unidentified developer"

Right-click the app → Open → Open again. This only needs to be done once.

### "Screen recording permission denied"

1. Go to System Settings → Privacy & Security → Screen Recording
2. Remove Perplexity Overlay if listed
3. Add it again
4. Restart the app

### "Safari tab not found" or "input editor not found"

1. Make sure Safari is open with perplexity.ai in a tab
2. Make sure you're logged in
3. Make sure no CAPTCHA is showing
4. Try enabling JavaScript from Apple Events in Safari's Develop menu

### Native module errors (sharp, screenshot-desktop)

Try rebuilding native modules:
```bash
npm run rebuild
```

## Development

To run in development mode:

```bash
npm run start
```

This will start both the Vite dev server and Electron with hot-reload.

## Architecture

- **Electron** - Desktop app framework
- **React** - UI framework
- **Vite** - Build tool and dev server
- **JXA (JavaScript for Automation)** - Safari automation scripts
- **Sharp** - Image processing
- **screenshot-desktop** - Screen capture

The app uses JXA scripts to communicate with Safari and send prompts to Perplexity AI. This is why Safari must have "Allow JavaScript from Apple Events" enabled.
