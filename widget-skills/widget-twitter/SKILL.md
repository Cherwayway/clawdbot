# widget-twitter

Twitter Search - Search/scrape Twitter

## Usage

```bash
widget-twitter [options] "search_tweets, scrape_tweets, or scrape_profile"
```

## Options

- `--action`: search_tweets, scrape_tweets, or scrape_profile
- `--query`: Search query (for search_tweets)
- `--twitter_handle`: Twitter handle (for scrape)

## Examples

```bash
# Basic usage
widget-twitter "your input here"

# Save to file
widget-twitter -o output.txt "your input here"
```
