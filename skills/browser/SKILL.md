---
name: browser
description: "Browse the web: open pages, click, type, extract content with headless Chromium"
metadata:
  { "openclaw": { "emoji": "🌐", "os": ["linux"], "requires": { "bins": ["browser"] } } }
---

# browser Skill (OpenClaw)

Control a headless Chromium browser via Playwright. Navigate pages, interact with elements, and extract structured content using accessibility snapshots.

## Commands

```bash
browser open <url>              # Navigate to URL, return accessibility snapshot
browser snapshot                # Return current page snapshot
browser screenshot [path]       # Take screenshot (default: /tmp/browser-screenshot.png)
browser click <ref>             # Click element by ref
browser type <ref> "text"       # Type text into input element
browser select <ref> "value"    # Select dropdown option
browser hover <ref>             # Hover over element
browser evaluate "js code"      # Execute JavaScript in page context
browser back                    # Go back in history
browser forward                 # Go forward in history
browser tabs                    # List open tabs
browser tab <index>             # Switch to tab by index
browser close                   # Close browser and cleanup
```

## Quickstart

```bash
# Open a page
browser open "https://example.com"

# Click a link from the snapshot (use ref from output)
browser click e3

# Fill a form field and submit
browser type e5 "search query"
browser click e8
```

## Element References

After `open` or `snapshot`, each interactive element is labeled with a ref like `[ref=e3]`.
Use these refs with `click`, `type`, `select`, and `hover`.

**Important:** Refs are regenerated on each snapshot. Always use refs from the most recent snapshot output.

## How It Works

- **Persistent browser**: Chromium runs as a background process, reused across calls.
- **Auto-snapshot**: Every action returns an updated accessibility snapshot so you always see the latest page state.
- **Token-bounded**: Snapshots are truncated at 50K characters to avoid context overflow.

## Typical Workflow

1. `browser open <url>` — navigate and read the snapshot
2. Identify the target element ref from the snapshot (e.g., `[ref=e5]`)
3. `browser click e5` / `browser type e5 "text"` — interact
4. Read the new snapshot from output, repeat as needed
5. `browser close` — cleanup when done

## Tips

- Use `browser evaluate "document.title"` to extract specific data via JS.
- Use `browser screenshot /tmp/page.png` for visual debugging.
- If the page snapshot is truncated, use `browser evaluate` to extract specific content.
- The browser persists until `browser close` is called or the sandbox terminates.
