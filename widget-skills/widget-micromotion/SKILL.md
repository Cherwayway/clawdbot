# widget-micromotion

Create animated facial expression changes from a portrait image. Generates a short video showing the face transitioning to the selected expression.

## Usage

```bash
widget-micromotion [options] <image_url>
```

## Options

- `--image URL`: Input portrait image URL (must have visible face)
- `--micromotion EXPR`: Expression type (default: smile)
  - `smile` - Make the face smile
  - `angry` - Show angry expression
  - `aging` - Age progression effect
  - `eyesClose` - Close the eyes
  - `headsTurn` - Turn the head slightly
- `-o, --output FILE`: Save output to local file

## Examples

```bash
# Make a portrait smile
widget-micromotion --micromotion smile "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg"

# Age progression effect
widget-micromotion --micromotion aging "https://example.com/portrait.jpg"

# Save to file
widget-micromotion -o smile.mp4 --micromotion smile "https://example.com/face.jpg"
```

## Notes

- Image must contain a clear, frontal view of a human face
- Output is a short video/GIF showing the expression transition
- Processing time: 2-4 minutes
- Only the 5 listed expressions are supported
