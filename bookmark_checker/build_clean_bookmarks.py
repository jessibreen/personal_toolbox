#!/usr/bin/env python3
"""
Clean Bookmark Builder
Reads bookmark_report.csv and combined_bookmarks.html, then produces a new
bookmarks_clean.html containing only links that passed the dead-link check.

Usage:
    python3 build_clean_bookmarks.py

Requirements:
    No external dependencies — standard library only.
"""

import csv
import os
import html as html_module
from html.parser import HTMLParser
from collections import OrderedDict

# ── Configuration ─────────────────────────────────────────────────────────────
REPORT_FILE   = "bookmark_report.csv"     # output from check_bookmarks.py
BOOKMARK_FILE = "combined_bookmarks.html" # the combined bookmark file
OUTPUT_FILE   = "bookmarks_clean.html"    # clean output
# ─────────────────────────────────────────────────────────────────────────────


def load_good_urls(report_path):
    """Return a set of URLs that are NOT dead."""
    good = set()
    with open(report_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["dead"].strip().upper() != "YES":
                good.add(row["url"].strip().rstrip("/"))
    print(f"  {len(good)} good URLs in report")
    return good


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
                folder = tuple(self.folder_stack) if self.folder_stack else ("Bookmarks",)
                self.bookmarks.append({
                    "url":      self.current_attrs["href"],
                    "title":    self.current_title or self.current_attrs["href"],
                    "folder":   folder,
                    "add_date": self.current_attrs.get("add_date", ""),
                    "icon":     self.current_attrs.get("icon", ""),
                })
            self.in_a = False
        elif tag == "h3":
            self.in_h3 = False

    def handle_data(self, data):
        if self.in_a:
            self.current_title += data
        elif self.in_h3 and self.folder_stack:
            self.folder_stack[-1] += data


class FolderNode:
    def __init__(self, name):
        self.name = name
        self.children = OrderedDict()
        self.bookmarks = []


def build_tree(bookmarks):
    root = FolderNode("root")
    for bm in bookmarks:
        node = root
        for part in bm["folder"]:
            if part not in node.children:
                node.children[part] = FolderNode(part)
            node = node.children[part]
        node.bookmarks.append(bm)
    return root


def render_node(node, indent=0):
    lines = []
    pad = "    " * indent
    for bm in node.bookmarks:
        title    = html_module.escape(bm["title"])
        url      = html_module.escape(bm["url"])
        add_date = f' ADD_DATE="{bm["add_date"]}"' if bm["add_date"] else ""
        icon     = f' ICON="{bm["icon"]}"' if bm["icon"] else ""
        lines.append(f'{pad}<DT><A HREF="{url}"{add_date}{icon}>{title}</A>')
    for fname, child in node.children.items():
        # Skip empty folders
        if not has_content(child):
            continue
        fname_esc = html_module.escape(fname)
        lines.append(f'{pad}<DT><H3>{fname_esc}</H3>')
        lines.append(f'{pad}<DL><p>')
        lines.extend(render_node(child, indent + 1))
        lines.append(f'{pad}</DL><p>')
    return lines


def has_content(node):
    """Recursively check if a folder has any bookmarks."""
    if node.bookmarks:
        return True
    return any(has_content(child) for child in node.children.values())


def main():
    script_dir    = os.path.dirname(os.path.abspath(__file__))
    report_path   = os.path.join(script_dir, REPORT_FILE)
    bookmark_path = os.path.join(script_dir, BOOKMARK_FILE)
    output_path   = os.path.join(script_dir, OUTPUT_FILE)

    print(f"Loading report: {report_path}")
    good_urls = load_good_urls(report_path)

    print(f"Parsing bookmarks: {bookmark_path}")
    with open(bookmark_path, encoding="utf-8", errors="ignore") as f:
        content = f.read()
    parser = BookmarkParser()
    parser.feed(content)
    all_bookmarks = parser.bookmarks
    print(f"  {len(all_bookmarks)} total bookmarks parsed")

    # Filter to only good URLs
    clean = [
        bm for bm in all_bookmarks
        if bm["url"].strip().rstrip("/") in good_urls
    ]
    removed = len(all_bookmarks) - len(clean)
    print(f"  {len(clean)} kept, {removed} removed")

    # Build folder tree and render
    root = build_tree(clean)
    output_lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        "<!-- Clean bookmarks — dead links removed. -->",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ]
    output_lines.extend(render_node(root, indent=1))
    output_lines.append("</DL>")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))

    print(f"\n✅ Done! Clean bookmark file saved to: {output_path}")
    print(f"   {len(clean)} bookmarks across your folders, {removed} dead links removed.")


if __name__ == "__main__":
    main()