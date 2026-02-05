---
name: widget-tts
description: Text-to-speech via MyShell Widget (ElevenLabs)
metadata: {"clawdbot":{"emoji":"🗣️","requires":{"bins":["widget-tts"]}}}
---

# widget-tts

High-quality text-to-speech using ElevenLabs via MyShell Widget.

## Usage

```bash
# Basic usage - generate speech and get audio URL
widget-tts "Hello, this is a test."

# Save to file
widget-tts -o /tmp/speech.mp3 "Hello world"

# Specify voice (Rachel, Domi, Bella, Antoni, Josh, Arnold, Adam, Sam)
widget-tts -v Bella "Hello world"

# Specify model (eleven_multilingual_v2, eleven_flash_v2_5, eleven_turbo_v2_5)
widget-tts -m eleven_flash_v2_5 "Fast speech"
```

## Send audio to user

After generating audio, use MEDIA tag:
```
MEDIA:/tmp/speech.mp3
```

## Voice selection

- **English**: Rachel, Bella, Josh, Adam
- **Multilingual**: Use eleven_multilingual_v2 model
- Default voice: Rachel

## Notes

- Each call consumes user energy
- Confirm user wants voice output before calling
- For long text, consider breaking into chunks
