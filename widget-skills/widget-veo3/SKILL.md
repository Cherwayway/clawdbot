# widget-veo3

Generate high-quality AI videos using Google's Veo3 model.

**WARNING: This widget costs 120 battery per generation!**

## Usage

```bash
widget-veo3 [options] <prompt>
```

## Options

- `--prompt TEXT`: Video description/prompt
- `--image URL`: Reference image URL (optional, for image-to-video generation)
- `-o, --output FILE`: Save output to local file

## Examples

```bash
# Generate video from text prompt
widget-veo3 "A cute orange cat walking slowly across a sunny garden, realistic style"

# Image-to-video (animate an existing image)
widget-veo3 --image "https://example.com/cat.jpg" "The cat starts walking towards the camera"

# Save to file
widget-veo3 -o video.mp4 "A drone shot over a beautiful mountain landscape at sunset"
```

## Tips for Good Prompts

- Describe the scene, subject, and action clearly
- Include visual style (cinematic, animated, realistic, cartoon)
- Specify camera movement if desired (slow pan, zoom in, tracking shot)
- Keep prompts concise but descriptive

## Notes

- **Cost: 120 battery per generation** - use sparingly!
- Processing time: ~2-3 minutes
- Output is a short video clip (typically 4-8 seconds)
- Veo3 produces high-quality, realistic video content
