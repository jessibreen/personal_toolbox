# asset_checker

> Check URLs in a LibGuides asset HTML export and report dead links.

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

`check_libguide_assets.py` reads a LibGuides asset export HTML file, checks each URL, and writes CSV reports for all links and dead links.

The dead-link report includes Wayback Machine lookup URLs to help with link recovery.

---

## Features

- Parses asset rows from LibGuides export HTML.
- Checks URLs using `HEAD` with `GET` fallback for servers that block `HEAD`.
- Processes links in parallel for faster runs.
- Writes a full report and a dead-links-only report.
- Flushes output as it runs so progress is preserved.

---

## Installation

### Prerequisites

- Python 3.8+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd asset_checker

# 2. (Optional) create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install requests
```

---

## Usage

### Basic Example

```bash
python check_libguide_assets.py
```

### Inputs and Outputs

- Input HTML file: `libguide_assets.html` (same folder as the script)
- Full output CSV: `libguide_assets_report.csv`
- Dead-links CSV: `libguide_dead_links.csv` (includes `wayback_url`)

---

## Configuration

Edit constants at the top of `check_libguide_assets.py` as needed.

| Option | Default | Description |
|---|---|---|
| `INPUT_FILE` | `libguide_assets.html` | Input LibGuides asset export HTML |
| `OUTPUT_FILE` | `libguide_assets_report.csv` | Full results CSV |
| `DEAD_FILE` | `libguide_dead_links.csv` | Dead-links-only CSV |
| `MAX_WORKERS` | `20` | Number of parallel URL checks |
| `TIMEOUT` | `10` | Request timeout in seconds |
| `RETRY_ON_FAIL` | `1` | Retries for connection errors |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
