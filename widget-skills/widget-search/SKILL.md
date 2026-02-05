---
name: widget-search
description: Real-time web search via MyShell Widget
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["widget-search"]}}}
---

# widget-search

Real-time web search using MyShell Widget.

## Usage

```bash
# Basic search
widget-search "latest news about AI"

# Search with custom summary prompt
widget-search -p "Focus on technical details" "OpenAI GPT-5"
```

## Output

Returns a Markdown-formatted summary of search results.

## Use cases

- Query real-time information
- Get latest news and updates
- Research products, companies, technologies
- Fact-checking and verification

## Notes

- Each call consumes user energy
- Results are summarized by AI for readability
- Use for information that may have changed since training cutoff
