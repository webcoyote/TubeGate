# Release Process

## 1. Bump version

```
scripts/bump-version patch   # or minor, major
```

This updates the version in `package.json`, `public/manifest.json`, and `src/popup/popup.html`, then commits and pushes.

## 2. Build production zip

```
scripts/build-production
```

This creates `releases/tubegate-v{VERSION}.zip`.

## 3. Upload to Chrome Web Store

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Select "TubeGate"
3. Click **Package** → **Upload new package**
4. Upload the zip from `releases/tubegate-v{VERSION}.zip`
5. Click **Submit for review**

Review typically takes a few hours to a few days.
