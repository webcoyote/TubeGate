# TubeGate

A Chrome extension that filters your YouTube feed by title and channel based on keywords you choose.

No politics! No sports! No Faux News!

## Features

- Filter videos by channels and custom keywords
- Sync settings across Chrome browsers

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

## Privacy

TubeGate respects your privacy. All filtering happens locally in your browser, and no data is collected or transmitted. Your filter keywords and settings are stored only on your device (or optionally synced via Chrome Sync if you choose).

For more details, see our [Privacy Policy](PRIVACY.md).

## License

Apache License, Version 2.0

TubeGate Copyright © 2025 Patrick Wyatt

See [LICENSE](LICENSE.md) for details.
