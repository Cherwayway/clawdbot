---
name: browser
description: "Browse the web: open pages, click, type, extract content with headless Chromium"
metadata: {"openclaw":{"emoji":"🌐","os":["linux"],"requires":{"bins":["browser"]}}}
---

# browser

Control a headless Chromium browser via Playwright. Navigate pages, interact with elements, and extract content using accessibility snapshots.

## Usage

```bash
# Open a URL (starts browser if needed, returns accessibility snapshot)
browser open "https://example.com"

# Get current page snapshot
browser snapshot

# Take a screenshot
browser screenshot [/tmp/page.png]

# Click an element by ref from snapshot
browser click e3

# Type text into an input element
browser type e5 "hello world"

# Select a dropdown option
browser select e7 "option-value"

# Hover over an element
browser hover e2

# Execute JavaScript in page context
browser evaluate "document.title"

# Navigation history
browser back
browser forward

# Tab management
browser tabs
browser tab 1

# Close browser and cleanup
browser close
```

## Element References

After `open` or `snapshot`, each interactive element is labeled with a ref like `[ref=e3]`. Use these refs with `click`, `type`, `select`, and `hover` commands.

## Notes

- Browser persists across calls (reuses running Chromium instance)
- Each action returns an updated accessibility snapshot
- Screenshots default to `/tmp/browser-screenshot.png`
