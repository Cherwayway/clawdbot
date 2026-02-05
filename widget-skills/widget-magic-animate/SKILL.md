# widget-magic-animate

Animate a person image using motion from a reference video. The person in the image will perform the same motions as shown in the reference video.

## Usage

```bash
widget-magic-animate --image <image_url> --video <video_url>
```

## Options

- `--image URL`: Person image URL (required, full body or upper body recommended)
- `--video URL`: Motion reference video URL (required, dancing, walking, etc.)
- `-o, --output FILE`: Save output to local file

## Examples

```bash
# Animate a person with dancing motion
widget-magic-animate --image "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg" \
                     --video "https://videos.pexels.com/video-files/3015510/3015510-sd_640_360_24fps.mp4"

# Save to file
widget-magic-animate -o animated.mp4 \
                     --image "https://example.com/person.jpg" \
                     --video "https://example.com/dance.mp4"
```

## Notes

- Image should show a person (full body works best for motion transfer)
- Video should contain clear human motion to transfer
- **Processing time: 8-10 minutes** (this is normal due to complex computation)
- Some sources (Wikipedia) may be blocked; **Pexels recommended**
- Both image and video parameters are required
