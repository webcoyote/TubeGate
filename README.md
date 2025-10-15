# YouTube Video Filter

A Chrome extension that automatically filters YouTube videos from your feed based on title keywords.

## Features

- 🎯 Filter videos by custom keywords
- 📊 Track statistics (videos blocked today)
- 🔄 Sync settings across Chrome browsers
- 🎨 Clean, modern UI
- ⚡ Fast and lightweight

## Installation

### Development Mode

1. Clone this repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Development Watch Mode

To automatically rebuild on file changes:
```bash
pnpm run watch
```

## Usage

1. Click the extension icon in Chrome toolbar
2. Add custom filter keywords in the popup
3. Toggle default filters on/off
4. Browse YouTube - matching videos will be automatically hidden

## Project Structure

```
yt-filter/
├── src/
│   ├── content/
│   │   └── content.ts          # Content script (filters videos)
│   ├── popup/
│   │   ├── popup.html          # Extension popup UI
│   │   ├── popup.ts            # Popup logic
│   │   └── popup.css           # Styling
│   ├── background/
│   │   └── background.ts       # Background service worker
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   └── utils/
│       └── storage.ts          # Chrome storage utilities
├── public/
│   ├── manifest.json           # Extension manifest
│   └── icons/                  # Extension icons
└── dist/                       # Build output (load this in Chrome)
```

## Scripts

- `pnpm run build` - Build for development
- `pnpm run watch` - Build and watch for changes
- `pnpm run build:prod` - Build for production

## Technology Stack

- TypeScript
- Webpack
- Chrome Extension Manifest V3
- pnpm (package manager)

## License

ISC
