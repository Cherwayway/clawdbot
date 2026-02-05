---
name: widget-stt
description: Speech-to-text via MyShell Widget (Whisper X)
metadata: {"clawdbot":{"emoji":"🎤","requires":{"bins":["widget-stt"]}}}
---

# widget-stt

High-accuracy speech-to-text using Whisper X via MyShell Widget.

## Usage

```bash
# Transcribe from URL
widget-stt "https://example.com/audio.mp3"

# Transcribe from CDN URL
widget-stt "https://cdn.myshell.ai/audio/xxx.mp3"
```

## Output

Returns transcribed text directly to stdout.

## Supported formats

mp3, wav, ogg, m4a, flac, webm and other common audio formats.

## Features

- Multi-language recognition
- Speaker diarization (identifies different speakers)
- Timestamp alignment

## Notes

- Input must be a URL (not local file path)
- For local files, upload to CDN first
- Each call consumes user energy
