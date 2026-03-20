# bookmark_checker

> Check exported bookmarks for dead links and build a cleaned bookmark HTML file.

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

This toolset has two scripts:

- `check_bookmarks.py` parses bookmark HTML, checks each URL, and writes reports.
- `build_clean_bookmarks.py` reads the report and generates a clean bookmark file with dead links removed.

It is useful for large bookmark exports where manual cleanup would be slow.

---

## Features

- Parallel URL checking with retries and timeout controls.
- Full CSV report plus dead-links-only CSV with Wayback Machine URLs.
- Progress is saved continuously during checks.
- Clean bookmark export in standard Netscape bookmark format.
- Removes empty folders in the cleaned output.

---

## Installation

### Prerequisites

- Python 3.8+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd bookmark_checker

# 2. (Optional) create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install requests
```

---

## Usage

### Step 1: Check bookmark links

```bash
python check_bookmarks.py
```

This script reads `dirty_bookmarks.html` and writes:

- `bookmark_report.csv` (all checked links)
- `dead_links.csv` (dead links with `wayback_url`)

### Step 2: (Optional) Keep selected dead links

Edit `bookmark_report.csv` and change `dead` from `YES` to `no` for any URLs you want to keep.

### Step 3: Build clean bookmark export

```bash
python build_clean_bookmarks.py
```

This script reads `bookmark_report.csv` and `combined_bookmarks.html`, then writes `bookmarks_clean.html`.

---

## Configuration

### Checker (`check_bookmarks.py`)

| Option | Default | Description |
|---|---|---|
| `BOOKMARK_FILE` | `dirty_bookmarks.html` | Input bookmark export HTML |
| `OUTPUT_FILE` | `bookmark_report.csv` | Full URL check report |
| `DEAD_FILE` | `dead_links.csv` | Dead-links-only report |
| `MAX_WORKERS` | `20` | Number of parallel URL checks |
| `TIMEOUT` | `10` | Request timeout in seconds |
| `RETRY_ON_FAIL` | `1` | Retries for connection errors |

### Builder (`build_clean_bookmarks.py`)

| Option | Default | Description |
|---|---|---|
| `REPORT_FILE` | `bookmark_report.csv` | Checker output used for filtering |
| `BOOKMARK_FILE` | `combined_bookmarks.html` | Source bookmark HTML to clean |
| `OUTPUT_FILE` | `bookmarks_clean.html` | Final cleaned bookmark file |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
