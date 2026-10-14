# tutorial_builder

> Turn a narrated screen recording into an editable step-by-step tutorial, with pictures and a transcript.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)]()

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [License](#license)

---

## About

`tutorial-builder.html` is a single page that runs in the browser. Open a screen recording with your narration, and it writes out what you said, splits the recording into steps where you paused and the screen changed, and takes a picture for each step. You then edit the steps and export a tutorial page.

Transcription runs on your computer with a Whisper speech model, so the recording is never uploaded. The exported tutorial works with [tutorial_presenter](../tutorial_presenter/).

---

## Features

- Transcribes narration in the browser (Whisper via transformers.js).
- Starts a new step where a pause in the narration lines up with a change on screen.
- Picks a picture for each step from the moment the screen settles.
- Editor: rewrite, split, merge, reorder, add and delete steps, with undo.
- Choose any frame of the recording as a step's picture, and crop it.
- Transcript beside the video; click a time to play from there.
- Optional rewording by Claude with your own API key, which can also see each step's picture. Without a key, it copies a prompt to paste into a Claude chat.
- Exports a tutorial `.html` with pictures built in, captions (`.vtt`) and a transcript (`.txt`).
- Autosaves in the browser, and saves project files to reopen later.
- Can use an existing `.vtt` / `.srt` caption file instead of transcribing, or skip the transcript entirely.

---

## Installation

### Prerequisites

- A desktop browser. Built for Firefox; also works in Chrome.
- An internet connection: the speech library loads from jsDelivr each time, and the speech model downloads from Hugging Face on first use (about 80 MB for "More accurate", 40 MB for "Faster"). The model is kept in the browser after that.

### Steps

Download `tutorial-builder.html` and open it in your browser. There is nothing to install.

---

## Usage

### Basic Example

1. Record your screen with narration. On a Mac: ⌘ Shift 5 › Record Entire Screen › Options › pick your microphone (it starts as None) › Record.
2. Drop the `.mov` onto the builder and wait while it reads, transcribes and drafts the steps. Keep the tab in front; it slows down in a background tab.
3. Edit the steps. Put `**double asterisks**` around menu and button names to make them bold.
4. Click **Export** › **Tutorial page**.

### Common Use Cases

**Tidy the wording with Claude**

Click **Tidy wording with Claude** and enter your Claude API key once. It rewrites every step as a short instruction; **Undo** puts your wording back. Each run costs a few cents on your API account.

**Captions for the video in Canvas**

**Export** › **Captions for the video** saves a `.vtt` file to attach to the video.

**Continue later**

Work autosaves in the browser. **Save project** writes a `.tutorial.json` file; open it from the start page. To change pictures in a reopened project, open the same recording again.

### Output

Files go to Downloads, named after the tutorial title:

- `TITLE.html`: the tutorial, with pictures embedded and an optional transcript section
- `TITLE.vtt`: captions
- `TITLE-transcript.txt`: transcript with times
- `TITLE.tutorial.json`: project file

---

## Configuration

Choose the transcription mode on the start page: **More accurate** (`whisper-base.en`), **Faster** (`whisper-tiny.en`) or **No transcript**.

The Claude model (Sonnet 5.5 by default) is chosen in the Tidy dialog. The API key is stored only in that browser's local storage, never in project or tutorial files, and is sent only to Anthropic.

---

## Development

`tutorial-builder.html` is generated. Edit the files in `src/`, then rebuild:

```bash
cd tutorial_builder
npm install --ignore-scripts
npm run build
```

To run the tests, install Chromium for Playwright once (`npx playwright install chromium`) and make sure `ffmpeg` is installed (`brew install ffmpeg`), then:

```bash
npm run make-test-video   # builds a 53-second synthetic QGIS recording in test/material/
npm test                  # 55 browser checks
```

The tests serve the speech library and a small Whisper model from `node_modules`, so they run offline. Claude API calls are answered by a stand-in.

| File | Description |
| --- | --- |
| `src/builder.html`, `src/builder.css`, `src/builder.js` | The tool, inlined into one file by `build.js` |
| `test/make-material.js` | Generates the synthetic narrated recording (git-ignored) |
| `test/e2e.js` | Processing, editing, exports, reopening |
| `test/e2e-more.js` | Caption-file and no-transcript routes |
| `test/e2e-api.js` | Claude API rewording |
| `test/routes.js` | Serves the library and model locally during tests |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
