# image_scraper

> Scrape images from a webpage, download them, and export filename/alt-text metadata to CSV.

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

`image_scraper.py` prompts for a webpage URL, finds image tags, downloads image files, and writes a CSV containing downloaded filenames and alt text.

Output names are based on the page title, sanitized for filesystem safety.

---

## Features

- Parses webpage HTML and collects image `src` and `alt` data.
- Resolves relative image URLs to absolute URLs.
- Downloads images into a title-based folder.
- Exports image metadata to a title-based CSV.
- Uses the collection order found on the page.

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

- `PAGE_TITLE.csv` containing:
	- `Filename`
	- `Alt Text`
- `PAGE_TITLE_images/` folder containing downloaded images

Both are written to the directory where you run the script.

---

## Configuration

This script has no command-line options.

To customize behavior (for example, naming or request handling), edit values directly in `image_scraper.py`.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
