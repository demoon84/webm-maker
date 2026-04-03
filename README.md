# webm-maker

Convert a PNG frame sequence or an MP4 video into `.webm` from the command line or from Node.js.

The package bundles `ffmpeg`, so npm users do not need a separate system install by default.

## Install

```bash
npm install webm-maker
```

Check the CLI:

```bash
npx webm-maker --help
```

## Quick Start

Run the default auto-detect command without naming a subcommand:

```bash
webm-maker --from ./frames --to ./output/sequence.webm --fps 24 --json true
```

Create `.webm` from a PNG sequence:

```bash
webm-maker frames2webm --from ./frames --to ./output/sequence.webm --fps 24 --crf 30
```

Convert MP4 to `.webm`:

```bash
webm-maker video2webm --from ./input/video.mp4 --to ./output/video.webm --crf 32
```

Let the CLI auto-detect the source type:

```bash
webm-maker convert --from ./input/video.mp4 --to ./output/video.webm --json
```

Inspect the input first:

```bash
webm-maker inspect --from ./frames --json
```

## CLI

The CLI is non-interactive and uses explicit long option names only, which makes it easy to call from scripts, CI, and AI agents.

### Commands

#### Default commandless mode

If the first argument starts with `--`, the CLI treats the call as `convert`.

```bash
webm-maker --from ./input/video.mp4 --to ./output/video.webm --mute true --json true
```

This is useful for AI agents that prefer one stable command shape.

#### `frames2webm`

Create a `.webm` file from a directory of `png` frames.

```bash
webm-maker frames2webm --from ./frames --to ./output/sequence.webm --fps 24 --crf 30 --bitrate 0
```

| Option | Required | Default | Description |
|------|----------|---------|-------------|
| `--from` | yes |  | source directory containing `png` frames |
| `--to` | yes |  | output `.webm` file |
| `--fps` | no | `30` | frame rate for the output video |
| `--crf` | no | `32` | VP9 quality value from `0` to `63` (lower is higher quality) |
| `--bitrate` | no | `0` | target bitrate, use `0` for constant-quality mode |
| `--speed` | no | `1` | ffmpeg `cpu-used` value from `0` to `8` |
| `--scale` | no |  | optional ffmpeg scale expression such as `1280:-2` |
| `--ffmpeg-path` | no |  | override the ffmpeg binary path for this command |
| `--config` | no |  | JSON config file, or `-` to read JSON from stdin |
| `--json` | no | `false` | print machine-readable JSON, accepts `--json true/false` |

#### `video2webm`

Convert an MP4 video file to `.webm`.

```bash
webm-maker video2webm --from ./input/video.mp4 --to ./output/video.webm --crf 32 --audio-bitrate 128k
```

| Option | Required | Default | Description |
|------|----------|---------|-------------|
| `--from` | yes |  | source video file |
| `--to` | yes |  | output `.webm` file |
| `--crf` | no | `32` | VP9 quality value from `0` to `63` |
| `--bitrate` | no | `0` | target bitrate, use `0` for constant-quality mode |
| `--speed` | no | `1` | ffmpeg `cpu-used` value from `0` to `8` |
| `--scale` | no |  | optional ffmpeg scale expression such as `1280:-2` |
| `--audio-bitrate` | no | `128k` | output audio bitrate when audio is present |
| `--mute` | no | `false` | drop audio in the output, accepts `--mute` or `--mute true/false` |
| `--ffmpeg-path` | no |  | override the ffmpeg binary path for this command |
| `--config` | no |  | JSON config file, or `-` to read JSON from stdin |
| `--json` | no | `false` | print machine-readable JSON, accepts `--json true/false` |

#### `convert`

Auto-detect whether `--from` is a PNG-frame directory or a video file and run the correct conversion flow.

```bash
webm-maker convert --from ./frames --to ./output/sequence.webm --fps 24 --json
```

#### `inspect`

Return machine-friendly metadata about the source path without converting anything.

```bash
webm-maker inspect --from ./frames --json true
```

Typical output tells an agent whether the path is convertible, what source type was detected, and which ffmpeg binary will be used.

### AI-Friendly CLI Contract

These rules are intended to make agent usage predictable:

- The CLI is non-interactive.
- Long option names only.
- `webm-maker --from ... --to ...` defaults to `convert`.
- `--json` returns structured output on success and structured errors on failure.
- Boolean flags accept explicit values: `--json true`, `--mute false`.
- `--config -` reads JSON config from stdin.
- `inspect` can be used before conversion to decide which flow to run.

### Config File

CLI flags override values from the config file.

PNG sequence example:

```json
{
  "from": "./frames",
  "to": "./output/sequence.webm",
  "fps": 24,
  "crf": 30,
  "bitrate": "0",
  "speed": 1
}
```

Video example:

```json
{
  "from": "./input/video.mp4",
  "to": "./output/video.webm",
  "crf": 32,
  "bitrate": "0",
  "speed": 1,
  "audioBitrate": "128k"
}
```

Example files in this repository:

- `examples/frames-to-webm.config.json`
- `examples/video-to-webm.config.json`

```bash
webm-maker frames2webm --config ./examples/frames-to-webm.config.json --json
```

```bash
webm-maker video2webm --config ./examples/video-to-webm.config.json --json
```

Read config JSON from stdin:

```bash
cat config.json | webm-maker convert --config - --json true
```

### JSON Output

When `--json` is enabled, the CLI prints structured output and uses exit code `0` on success, `1` on failure.

Success example:

```json
{
  "ok": true,
  "command": "convert",
  "result": {
    "command": "frames2webm",
    "sourceType": "frames",
    "from": "./frames",
    "to": "./output/sequence.webm",
    "fps": 24,
    "crf": 30,
    "bitrate": "0",
    "speed": 1,
    "count": 12
  }
}
```

Inspect example:

```json
{
  "ok": true,
  "command": "inspect",
  "result": {
    "command": "inspect",
    "from": "./frames",
    "absoluteFrom": "/abs/path/frames",
    "ffmpegPath": "/abs/path/ffmpeg",
    "exists": true,
    "convertible": true,
    "sourceType": "frames",
    "frameCount": 12,
    "firstFrame": "./frames/1.png",
    "lastFrame": "./frames/12.png",
    "reason": ""
  }
}
```

Error example:

```json
{
  "ok": false,
  "error": "..."
}
```

## Library

```js
const {frames2webm, video2webm, convert, inspect} = require('webm-maker');

async function run() {
  const input = inspect({
    from: './frames'
  });

  const fromFrames = await frames2webm({
    from: './frames',
    to: './output/sequence.webm',
    fps: 24,
    crf: 30
  });

  const fromVideo = await video2webm({
    from: './input/video.mp4',
    to: './output/video.webm',
    crf: 32
  });

  const auto = await convert({
    from: './frames',
    to: './output/auto.webm',
    fps: 24
  });

  console.log(input.sourceType, fromFrames.count, fromVideo.to, auto.command);
}

run();
```

### `frames2webm(config)`

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `from` | `string` |  | source directory containing `png` frames |
| `to` | `string` |  | output `.webm` file |
| `fps` | `number` | `30` | output frame rate |
| `crf` | `number` | `32` | VP9 quality value |
| `bitrate` | `string \| number` | `"0"` | output video bitrate |
| `speed` | `number` | `1` | ffmpeg `cpu-used` value |
| `scale` | `string` | `""` | optional ffmpeg scale expression |
| `log` | `boolean` | `true` | print progress logs |

Returns a Promise that resolves to a conversion summary object.

### `video2webm(config)`

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `from` | `string` |  | source video file |
| `to` | `string` |  | output `.webm` file |
| `crf` | `number` | `32` | VP9 quality value |
| `bitrate` | `string \| number` | `"0"` | output video bitrate |
| `speed` | `number` | `1` | ffmpeg `cpu-used` value |
| `scale` | `string` | `""` | optional ffmpeg scale expression |
| `audioBitrate` | `string \| number` | `"128k"` | output audio bitrate |
| `mute` | `boolean` | `false` | disable audio output |
| `log` | `boolean` | `true` | print progress logs |

Returns a Promise that resolves to a conversion summary object.

### `convert(config)`

Auto-detect the source type and call either `frames2webm(config)` or `video2webm(config)`.

### `inspect(config)`

Return source metadata without encoding. Useful for automation that wants to branch before conversion.

## ffmpeg Path Override

If you want to force a system or custom ffmpeg binary, either set `FFMPEG_PATH` or pass `--ffmpeg-path`.

```bash
FFMPEG_PATH=/usr/local/bin/ffmpeg webm-maker convert --from ./frames --to ./output/sequence.webm
```

```bash
webm-maker inspect --from ./frames --ffmpeg-path /usr/local/bin/ffmpeg --json
```

## Development

```bash
npm install
npm test
```

Publish from GitHub by pushing a tag that matches `v*`.
