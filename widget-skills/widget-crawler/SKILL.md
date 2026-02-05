---
name: widget-crawler
description: Web page crawler via MyShell Widget
metadata: {"clawdbot":{"emoji":"🕷️","requires":{"bins":["widget-crawler"]}}}
---

# widget-crawler

Crawl and extract content from web pages using MyShell Widget.

## Usage

```bash
# Crawl a webpage and extract text content
widget-crawler "https://example.com/article"

# Crawl with custom extraction prompt
widget-crawler -p "Extract only the main article text" "https://news.example.com/story"
```

## Output

Returns extracted text content from the webpage in Markdown format.

## Use cases

- Extract article content from news sites
- Scrape product information from e-commerce pages
- Gather documentation from technical sites
- Research competitor websites

## Notes

- Each call consumes user energy
- Works best with public web pages
- Respects robots.txt and rate limits
