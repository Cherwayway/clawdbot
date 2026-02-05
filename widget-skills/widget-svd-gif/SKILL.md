# widget-svd-gif

Stable Video Diffusion GIF - Image to GIF

## Usage

```bash
widget-svd-gif [options] "Input image URL"
```

## Options

- `--input_image`: Input image URL
- `--video_length`: svd(14 frames) or svd_xt(25 frames)
- `--frames_per_second`: FPS (default 6)

## Examples

```bash
# Basic usage
widget-svd-gif "your input here"

# Save to file
widget-svd-gif -o output.mp4 "your input here"
```
