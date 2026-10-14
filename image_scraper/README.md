# image_scraper

> Save a tutorial as an offline HTML package with local images, stylesheets, and fonts for Canvas.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)]()

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [License](#license)

---

## About

`image_scraper.py` prompts for a webpage URL, downloads its visual dependencies, saves a rewritten HTML copy with local references, and writes a CSV mapping source URLs to local paths.

Output names are based on the page title, sanitized for filesystem safety.

---

## Features

- Rewrites image and media references, including `srcset` and common lazy-loading attributes.
- Downloads linked stylesheets, nested CSS imports, fonts, and CSS background assets, then rewrites their references locally.
- Removes scripts, embeds, and external navigation so the saved page does not depend on or call back to the source site.
- Resolves relative URLs against the page's effective base URL and downloads each unique resource once.
- Sends requests sequentially with at least a one-second interval and backs off when the server responds with `429` or `503`.
- Uses unique local filenames to avoid collisions between images with the same source filename.
- Exports original URLs, local paths, alt text, resource type, and download status to a title-based CSV.

---

## Installation

### Prerequisites

- Python 3.8+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd image_scraper

# 2. (Optional) create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install requests beautifulsoup4
```

---

## Usage

### Basic Example

```bash
python image_scraper.py
```

When prompted, paste the target webpage URL.

### Output

- `PAGE_TITLE/` folder containing all outputs for the tutorial
- `PAGE_TITLE/PAGE_TITLE.html` containing the fetched page with successful image references changed to local paths
- `PAGE_TITLE/PAGE_TITLE.csv` mapping original resource URLs to local paths, with alt text, type, and download status
- `PAGE_TITLE/images/` folder containing downloaded images
- `PAGE_TITLE/styles/` and `PAGE_TITLE/assets/` folders containing stylesheets, fonts, and CSS assets

Upload the entire `PAGE_TITLE/` folder to Canvas and preserve its subfolder structure. Open its HTML file so all relative resource paths resolve.

---

## Configuration

The script has no command-line options. Resources that fail to download are omitted from the saved page and marked as failed in the CSV rather than left pointing to the original site.

Scripts, embedded frames, external hyperlinks, and form actions are disabled or removed to prevent source-site connections. Pages that rely on JavaScript-generated content may therefore not be fully reproduced. Check font licenses before redistributing downloaded font files. To customize behavior, edit values directly in `image_scraper.py`.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
