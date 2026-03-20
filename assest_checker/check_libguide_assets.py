#!/usr/bin/env python3
"""LibGuides Asset Link Checker

Reads libguide_assets.html (export from LibGuides asset list) and checks each URL for dead links.
Results are saved to a report CSV as it runs, so progress is preserved.

Usage:
    python check_libguide_assets.py

Requirements:
    pip install requests
"""

import csv
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser

import requests

# ── Configuration ────────────────────────────────────────────────────────────
INPUT_FILE     = "libguide_assets.html"         # input file (same folder as script)
OUTPUT_FILE    = "libguide_assets_report.csv"   # full results
DEAD_FILE      = "libguide_dead_links.csv"     # dead links only, with Wayback Machine URLs
MAX_WORKERS    = 20                              # parallel threads
TIMEOUT        = 10                              # seconds to wait per request
RETRY_ON_FAIL  = 1                               # number of retries for connection errors
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class LibGuideAssetsParser(HTMLParser):
    """Extracts rows from the LibGuides asset list table."""

    def __init__(self):
        super().__init__()
        self.rows = []
        self.current_row = []
        self.in_td = False
        self.current_cell = ""

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "td":
            self.in_td = True
            self.current_cell = ""

    def handle_endtag(self, tag):
        if tag.lower() == "td":
            self.in_td = False
            # Strip whitespace and collapse newlines for readability
            cell = " ".join(self.current_cell.split())
            self.current_row.append(cell)
        elif tag.lower() == "tr":
            if self.current_row:
                self.rows.append(self.current_row)
            self.current_row = []

    def handle_data(self, data):
        if self.in_td:
            self.current_cell += data


def check_url(entry):
    url = entry["url"]
    for attempt in range(RETRY_ON_FAIL + 1):
        try:
            resp = requests.head(url, headers=HEADERS, timeout=TIMEOUT,
                                 allow_redirects=True)
            # Some servers reject HEAD; fall back to GET
            if resp.status_code in (405, 403, 400):
                resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT,
                                    allow_redirects=True, stream=True)
                resp.close()
            status = resp.status_code
            is_dead = status >= 400
            return {**entry, "status": status,
                    "dead": "YES" if is_dead else "no",
                    "error": ""}
        except requests.exceptions.ConnectionError:
            err = "Connection error"
        except requests.exceptions.Timeout:
            err = "Timeout"
        except requests.exceptions.TooManyRedirects:
            err = "Too many redirects"
            break
        except Exception as e:
            err = str(e)[:120]
            break
        if attempt < RETRY_ON_FAIL:
            time.sleep(1)
    return {**entry, "status": "", "dead": "YES", "error": err}


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(script_dir, INPUT_FILE)
    output_path = os.path.join(script_dir, OUTPUT_FILE)

    print(f"Parsing {input_path} …")
    with open(input_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()

    parser = LibGuideAssetsParser()
    parser.feed(content)

    # Each row is expected to have at least 6 columns (URL is the 6th)
    assets = []
    for row in parser.rows:
        # Skip header row (contains "ID", "Type", etc.)
        if not row:
            continue
        if row[0].strip().lower() == "id":
            continue
        url = row[5] if len(row) > 5 else ""
        assets.append({
            "id": row[0] if len(row) > 0 else "",
            "type": row[1] if len(row) > 1 else "",
            "name": row[2] if len(row) > 2 else "",
            "description": row[3] if len(row) > 3 else "",
            "subjects": row[4] if len(row) > 4 else "",
            "url": url,
            "owner": row[6] if len(row) > 6 else "",
            "updated": row[7] if len(row) > 7 else "",
            "mapping_count": row[8] if len(row) > 8 else "",
        })

    # Keep only rows with a URL value
    assets = [a for a in assets if a["url"].strip()]
    total = len(assets)
    print(f"Found {total} assets with URLs. Starting checks with {MAX_WORKERS} threads …\n")

    dead_count = 0

    dead_fields = [
        "id",
        "type",
        "name",
        "description",
        "subjects",
        "url",
        "owner",
        "updated",
        "mapping_count",
        "wayback_url",
        "status",
        "error",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as csvfile, \
         open(os.path.join(script_dir, DEAD_FILE), "w", newline="", encoding="utf-8") as deadfile:

        writer = csv.DictWriter(
            csvfile,
            fieldnames=[
                "dead",
                "status",
                "error",
                "id",
                "type",
                "name",
                "description",
                "subjects",
                "url",
                "owner",
                "updated",
                "mapping_count",
            ],
        )
        dead_writer = csv.DictWriter(deadfile, fieldnames=dead_fields)
        writer.writeheader()
        dead_writer.writeheader()

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(check_url, asset): asset for asset in assets}
            done_count = 0
            for future in as_completed(futures):
                result = future.result()
                done_count += 1
                writer.writerow(result)
                csvfile.flush()

                if result["dead"] == "YES":
                    dead_count += 1
                    wayback = f"https://web.archive.org/web/*/{result['url']}"
                    dead_writer.writerow({
                        "id": result.get("id", ""),
                        "type": result.get("type", ""),
                        "name": result.get("name", ""),
                        "description": result.get("description", ""),
                        "subjects": result.get("subjects", ""),
                        "url": result.get("url", ""),
                        "owner": result.get("owner", ""),
                        "updated": result.get("updated", ""),
                        "mapping_count": result.get("mapping_count", ""),
                        "wayback_url": wayback,
                        "status": result.get("status", ""),
                        "error": result.get("error", ""),
                    })
                    deadfile.flush()

                pct = done_count / total * 100
                marker = "💀" if result["dead"] == "YES" else "✓"
                print(f"[{done_count}/{total} {pct:.0f}%] {marker}  "
                      f"{result['status'] or result['error']:>3}  {result['url'][:80]}")

    print(f"\n✅ Done! {dead_count} dead links out of {total} checked.")
    print(f"Full report:  {output_path}")
    print(f"Dead links:   {os.path.join(script_dir, DEAD_FILE)}  (includes Wayback Machine links)")


if __name__ == "__main__":
    main()
