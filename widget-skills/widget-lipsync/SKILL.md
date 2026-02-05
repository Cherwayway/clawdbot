# widget-lipsync

Create lip-sync videos by synchronizing a face image/video with audio. The output shows the face "speaking" the audio content.

## Usage

```bash
widget-lipsync --face <face_url> --audio <audio_url>
```

## Options

- `--face URL`: Face image or video URL (required, must show clear frontal face)
- `--audio URL`: Audio file URL (required, speech audio to sync)
- `-o, --output FILE`: Save output to local file

## Examples

```bash
# Create lip-sync video
widget-lipsync --face "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg" \
               --audio "https://example.com/speech.mp3"

# Save to file
widget-lipsync -o lipsync.mp4 \
               --face "https://example.com/face.jpg" \
               --audio "https://example.com/audio.wav"
```

## Notes

- Face image must have a clear, frontal view of a human face
- Audio should be clear speech audio
- Some image sources (Wikipedia, Unsplash) may be blocked
- **Recommended**: Use Pexels images for best compatibility
- Processing time: 10-30 seconds
