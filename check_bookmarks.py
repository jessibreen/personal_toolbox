#!/usr/bin/env python3
"""
Bookmark Dead Link Checker
Reads dirty_bookmarks.html and checks each URL for dead links.
Results are saved to bookmark_report.csv as it runs, so progress is preserved.

Usage:
    python check_bookmarks.py

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
BOOKMARK_FILE   = "dirty_bookmarks.html"   # input file (same folder as script)
OUTPUT_FILE     = "bookmark_report.csv"        # full results saved here
DEAD_FILE       = "dead_links.csv"             # dead links only, with Wayback Machine URLs
MAX_WORKERS     = 20       # parallel threads (increase for speed, decrease if you get rate-limited)
TIMEOUT         = 10       # seconds to wait per request
RETRY_ON_FAIL   = 1        # number of retries for connection errors
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class BookmarkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.bookmarks = []
        self.in_a = self.in_h3 = False
        self.current_attrs = {}
        self.current_title = ""
        self.folder_stack = []

    def handle_starttag(self, tag, attrs):
        attrs_d = dict(attrs)
        if tag == "h3":
            self.folder_stack.append("")
            self.in_h3 = True
        elif tag == "a":
            self.in_a = True
            self.current_attrs = attrs_d
            self.current_title = ""

    def handle_endtag(self, tag):
        if tag == "dl":
            if self.folder_stack:
                self.folder_stack.pop()
        elif tag == "a":
            if self.in_a and self.current_attrs.get("href"):
                folder = " > ".join(self.folder_stack) if self.folder_stack else "Bookmarks"
                self.bookmarks.append({
                    "url":    self.current_attrs["href"],
                    "title":  self.current_title or self.current_attrs["href"],
                    "folder": folder,
                })
            self.in_a = False
        elif tag == "h3":
            self.in_h3 = False

    def handle_data(self, data):
        if self.in_a:
            self.current_title += data
        elif self.in_h3 and self.folder_stack:
            self.folder_stack[-1] += data


def check_url(bm):
    url = bm["url"]
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
            return {**bm, "status": status,
                    "dead": "YES" if is_dead else "no",
                    "error": ""}
        except requests.exceptions.ConnectionError as e:
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
    return {**bm, "status": "", "dead": "YES", "error": err}


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_path  = os.path.join(script_dir, BOOKMARK_FILE)
    output_path = os.path.join(script_dir, OUTPUT_FILE)

    print(f"Parsing {input_path} …")
    with open(input_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()
    parser = BookmarkParser()
    parser.feed(content)
    bookmarks = parser.bookmarks
    total = len(bookmarks)
    print(f"Found {total} bookmarks. Starting checks with {MAX_WORKERS} threads …\n")

    dead_count = 0
    done_count = 0
    dead_results = []

    dead_path = os.path.join(script_dir, DEAD_FILE)
    dead_fields = ["title", "url", "wayback_url", "status", "error", "folder"]

    with open(output_path, "w", newline="", encoding="utf-8") as csvfile, \
         open(dead_path,   "w", newline="", encoding="utf-8") as deadfile:

        writer      = csv.DictWriter(csvfile, fieldnames=["dead", "status", "error", "title", "url", "folder"])
        dead_writer = csv.DictWriter(deadfile, fieldnames=dead_fields)
        writer.writeheader()
        dead_writer.writeheader()

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(check_url, bm): bm for bm in bookmarks}
            for future in as_completed(futures):
                result = future.result()
                done_count += 1
                writer.writerow(result)
                csvfile.flush()

                if result["dead"] == "YES":
                    dead_count += 1
                    wayback = f"https://web.archive.org/web/*/{result['url']}"
                    dead_writer.writerow({
                        "title":      result["title"],
                        "url":        result["url"],
                        "wayback_url": wayback,
                        "status":     result["status"],
                        "error":      result["error"],
                        "folder":     result["folder"],
                    })
                    deadfile.flush()

                # Progress line
                pct = done_count / total * 100
                marker = "💀" if result["dead"] == "YES" else "✓"
                print(f"[{done_count}/{total} {pct:.0f}%] {marker}  "
                      f"{result['status'] or result['error']:>3}  {result['url'][:80]}")

    print(f"\n✅ Done! {dead_count} dead links out of {total} checked.")
    print(f"Full report:  {output_path}")
    print(f"Dead links:   {dead_path}  (includes Wayback Machine links)")


if __name__ == "__main__":
    main()