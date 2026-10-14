# tutorial_presenter

> Spotlight, zoom and step through any tutorial web page while you teach, from a bookmark.

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

`tutorial-presenter.html` is an install page for a bookmark (a "bookmarklet"). Click the bookmark on any tutorial page, such as an ArcGIS or QGIS tutorial exported as HTML, and you can spotlight and zoom in on each step while you teach.

The tutorial file is never changed, so there are no separate slides to keep in sync. Re-export the tutorial and the presenter still works on it.

---

## Features

- Click a step, picture or paragraph to spotlight it and zoom in. Click again to widen to the whole step.
- Step through the page with the arrow keys.
- Drag across words to highlight them.
- Spotlight-only mode with no zoom (`Z`), and adjustable zoom (`+` / `−`).
- Records the tab with your microphone in Chrome and Safari (MP4). In Firefox it explains how to use ⌘ Shift 5 instead, since Firefox can only make WebM, which Canvas doesn't accept.
- Leaves nothing behind: quitting removes every highlight and style.
- Offers to open a tutorial in its own tab when a site such as Canvas shows it inside a frame.

---

## Installation

### Prerequisites

- A desktop browser: Chrome, Safari or Firefox.

### Steps

1. Download `tutorial-presenter.html` and open it in your browser.
2. Show the bookmarks bar (Chrome: ⌘ Shift B; Firefox: View › Toolbars › Bookmarks Toolbar; Safari: View › Show Favorites Bar).
3. Drag the orange **Present** button onto the bookmarks bar. Don't click it.

After an update, drag the new button to the bar and delete the old bookmark. A bookmark holds a frozen copy of the code.

---

## Usage

### Basic Example

Open a tutorial page and click the **Present** bookmark. To turn it off, click **Done** in the bottom right corner, press `Esc` twice, or click the bookmark again.

The install page has a sample QGIS tutorial to practise on, and a button to try the presenter there first.

### Keys

| Key | What it does |
| --- | --- |
| Click | Spotlight and zoom on a step or picture |
| Click it again | Widen to the block around it |
| `→` or Space | Next item |
| `←` | Previous item |
| Drag across words | Highlight them |
| `U` / `C` | Undo the last highlight / clear all |
| `Z` | Zoom on or off |
| `+` / `−` | More or less zoom |
| `Esc` | Back to the whole page |
| ⌘-click | Follow a link (links are paused while presenting) |
| `R` | Start or stop a recording |
| `M` | Mute or unmute the microphone while recording |
| `?` | Show the keys on screen |
| `Q`, `Esc` twice, or **Done** | Turn the presenter off |

### Output

Recordings are saved to Downloads, named after the page title and the date. Nothing else is saved or sent anywhere.

---

## Configuration

Zoom on/off and the zoom level are remembered per site. To change colours or behaviour, edit `src/presenter.js` and rebuild (see [Development](#development)).

---

## Development

`tutorial-presenter.html` is generated. Edit the files in `src/`, then rebuild:

```bash
cd tutorial_presenter
npm install
npm run build
```

`npm test` rebuilds and runs 50 browser checks with Playwright against `test/messy.html` and the install page. Run `npx playwright install chromium` once first.

| File | Description |
| --- | --- |
| `src/presenter.js` | The presenter itself |
| `src/install.template.html` | Install page; the bookmark code is inserted at `__HREF__` |
| `build.js` | Minifies the presenter and writes `tutorial-presenter.html` |
| `test/test.js` | End-to-end tests |
| `test/messy.html` | Deliberately awkward test page |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
