# widget-deoldify

Colorize old black & white photos using AI (Deoldify model).

## Usage

```bash
widget-deoldify [options] <image_url>
```

## Options

- `--input_image URL`: Input black & white image URL
- `--model_name MODEL`: `Artistic` or `Stable` (default: Artistic)
  - **Artistic**: More vibrant colors, better for portraits
  - **Stable**: More conservative coloring, better for landscapes
- `--render_factor NUM`: Quality factor (default: 35)
- `-o, --output FILE`: Save output to local file

## Examples

```bash
# Colorize an old photo (uses Artistic model by default)
widget-deoldify "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg"

# Use Stable model for landscape
widget-deoldify --model_name Stable "https://example.com/old-landscape.jpg"

# Save to file
widget-deoldify -o colorized.jpg "https://example.com/bw-photo.jpg"
```

## Notes

- Model name must be capitalized: `Artistic` or `Stable`
- Some image sources (Wikipedia, Unsplash) may be blocked by the API
- **Recommended**: Use Pexels images for best compatibility
- Processing time: ~5-10 seconds
