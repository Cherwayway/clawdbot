---
name: widget-image
description: AI image generation via MyShell Widget (Gemini)
metadata: {"clawdbot":{"emoji":"🎨","requires":{"bins":["widget-image"]}}}
---

# widget-image

AI-powered image generation using Gemini via MyShell Widget.

## Usage

```bash
# Generate image from prompt
widget-image "a cute cat wearing sunglasses"

# Save to file
widget-image -o /tmp/cat.png "a cute cat wearing sunglasses"

# Generate multiple images (specify in prompt)
widget-image -o /tmp/cats.png "generate 4 different cute cats"
```

## Send image to user

After generating, use MEDIA tag:
```
MEDIA:/tmp/cat.png
```

## Prompt tips

- Be specific and descriptive
- Specify style: photorealistic, cartoon, watercolor, oil painting, etc.
- Supports both English and Chinese prompts
- Can request multiple images in one prompt

## Features

- Text-to-image generation
- Image-to-image editing (with image_urls parameter)
- Excellent instruction following
- Good for text-rich images, posters, comics

## Notes

- Each call consumes user energy
- Confirm user wants image generation before calling
