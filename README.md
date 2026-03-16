# LibGuides Asset Link Checker

A small Python tool for checking URLs in a LibGuides asset export (e.g., `libguide_assets.html`) for dead/broken links.

## What it does

1. Parses the LibGuides asset list HTML export and extracts each asset row.
2. Checks the **URL** column for each asset using HTTP HEAD (with a GET fallback).
3. Writes two CSV outputs:
   - `libguide_assets_report.csv` — all checked assets with status and error info.
   - `libguide_dead_links.csv` — only assets determined to be dead, with a Wayback Machine lookup URL.

## Requirements

- Python 3.8+ (tested with 3.13)
- `requests` (install via pip)

## Setup

```bash
cd path/to/repo
python -m venv .venv
source .venv/bin/activate
pip install requests
```

## Usage

1. Export your LibGuides Asset List as `libguide_assets.html` and place it in the repository root.
2. Run:

```bash
.venv/bin/python check_libguide_assets.py
```

### Output

- `libguide_assets_report.csv` — full report of all URLs checked
- `libguide_dead_links.csv` — dead links only (includes a Wayback Machine URL to aid recovery)

## Notes

- The tool uses parallel requests (20 threads by default). You can adjust `MAX_WORKERS` in `check_libguide_assets.py`.
- Timeouts are 10 seconds per URL by default; adjust `TIMEOUT` as needed.
