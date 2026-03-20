#!/usr/bin/env python3
"""
Import Canvas textbox-submission HTML exports into an Obsidian vault that already
contains per-student folders named as: firstname_lastname

Matching strategy (name-only):
1) Match by last name across existing folders.
2) If multiple matches, try first name.
3) If still no match and a middle name exists, try middle-as-first (preferred-name case).
4) Otherwise route to _UNMATCHED/

Dependencies:
  pip install beautifulsoup4 markdownify
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup
from markdownify import markdownify as md


# ---------- parsing helpers ----------

def slug(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[’'`]", "", text)
    text = re.sub(r"[^a-z0-9 _-]", "", text)
    text = re.sub(r"[\s\-]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "unnamed"


def extract_canvas_display_name(html_text: str) -> str:
    """Extract the name at the end of the Canvas-export heading/title (after final ':')."""
    soup = BeautifulSoup(html_text, "html.parser")

    h1 = soup.find("h1")
    raw = h1.get_text(" ", strip=True) if h1 and h1.get_text(strip=True) else ""
    if not raw:
        raw = soup.title.get_text(" ", strip=True) if soup.title else ""

    raw = (raw or "").strip()
    if not raw:
        return ""

    if ":" in raw:
        tail = raw.split(":")[-1].strip()
        return tail or raw

    return raw


def parse_person_name(display_name: str) -> Tuple[str, str, Optional[str]]:
    """
    Convert something like "First Middle Last" -> (first, last, middle_or_None)

    If we only have 2 tokens, middle is None.
    """
    parts = [p for p in re.split(r"\s+", display_name.strip()) if p]
    if len(parts) >= 3:
        first, middle, last = parts[0], parts[1], parts[-1]
        # normalize middle initial like "A." or "A"
        if re.fullmatch(r"[A-Za-z]\.?", middle):
            middle = ""  # treat as absent for preferred-name fallback
        return slug(first), slug(last), (slug(middle) if middle else None)

    if len(parts) == 2:
        return slug(parts[0]), slug(parts[1]), None

    if len(parts) == 1:
        return slug(parts[0]), "unnamed", None

    return "unnamed", "unnamed", None


def extract_submission_html(html_text: str) -> str:
    """Canvas textbox export: first top-level <div> inside <body> is typically the submission."""
    soup = BeautifulSoup(html_text, "html.parser")
    body = soup.body
    if not body:
        return html_text

    divs = body.find_all("div", recursive=False)
    if divs:
        return str(divs[0])

    div_any = body.find("div")
    if div_any:
        return str(div_any)

    return str(body)


def html_to_markdown(html_fragment: str) -> str:
    out = md(
        html_fragment,
        heading_style="ATX",
        bullets="-",
        strip=["script", "style", "noscript"],
    ).strip()
    return (out + "\n") if out else ""


# ---------- vault folder index + matching ----------

def build_lastname_index(vault_root: Path) -> Dict[str, List[Path]]:
    """
    Index folders by last name based on folder naming convention: firstname_lastname
    """
    idx: Dict[str, List[Path]] = {}
    for p in vault_root.iterdir():
        if not p.is_dir():
            continue
        if p.name.startswith("_"):
            continue

        # Expect firstname_lastname, but be tolerant
        parts = p.name.split("_")
        last = parts[-1] if len(parts) >= 2 else p.name
        last = slug(last)
        idx.setdefault(last, []).append(p)

    return idx


def choose_folder_for_name(
    first: str,
    last: str,
    middle: Optional[str],
    last_idx: Dict[str, List[Path]],
    used: Optional[set] = None,
) -> Tuple[Optional[Path], str]:
    """
    Your requested logic:
    - match by last name first
    - if >1 match, try first name
    - if still ambiguous, try middle-as-first
    - also prefer a folder not matched-with-yet (used set) when picking among ties
    """
    used = used or set()

    candidates = last_idx.get(last, [])
    if not candidates:
        return None, f"no folder with last name '{last}'"

    if len(candidates) == 1:
        return candidates[0], "matched by last name"

    # More than one person shares last name. Try matching first name in folder basename.
    def folder_first(folder: Path) -> str:
        parts = folder.name.split("_")
        return slug(parts[0]) if parts else ""

    # Prefer unused matches
    first_matches = [c for c in candidates if folder_first(c) == first and c not in used]
    if first_matches:
        return first_matches[0], "matched by last+first (unused)"

    # If all are used, still allow match
    first_matches_all = [c for c in candidates if folder_first(c) == first]
    if first_matches_all:
        return first_matches_all[0], "matched by last+first"

    # Preferred-name case: try middle as folder first
    if middle:
        mid_matches = [c for c in candidates if folder_first(c) == middle and c not in used]
        if mid_matches:
            return mid_matches[0], "matched by last+middle-as-first (unused)"

        mid_matches_all = [c for c in candidates if folder_first(c) == middle]
        if mid_matches_all:
            return mid_matches_all[0], "matched by last+middle-as-first"

    return None, f"ambiguous last name '{last}' (no first/middle match)"


# ---------- note writing ----------

def build_note(submission_md: str, source_file: str) -> str:
    submission_md = submission_md.strip()
    if submission_md:
        submission_md += "\n"

    return f"""---
tags: [grading, canvas-textbox]
source_file: {source_file}
---

# Submission

{submission_md}
---

# Feedback

## What you did well


## Suggestions / next steps


## Questions for you


"""


def main() -> int:
    p = argparse.ArgumentParser(description="Import Canvas textbox HTML into existing firstname_lastname folders.")
    p.add_argument("input_dir", type=Path, help="Folder containing Canvas .html/.htm files")
    p.add_argument("--vault-root", type=Path, required=True, help="Obsidian vault root containing student folders")
    p.add_argument("--note-name", default=None, help='Fixed note name like "waypoint1.md" (else uses HTML filename)')
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing notes")
    p.add_argument("--no-recursive", action="store_true", help="Do not scan subfolders")

    args = p.parse_args()

    if not args.input_dir.is_dir():
        raise SystemExit(f"Input must be a folder: {args.input_dir}")
    if not args.vault_root.is_dir():
        raise SystemExit(f"Vault root must be a folder: {args.vault_root}")

    last_idx = build_lastname_index(args.vault_root)

    pattern = "**/*" if not args.no_recursive else "*"
    html_files = sorted([*args.input_dir.glob(f"{pattern}.html"), *args.input_dir.glob(f"{pattern}.htm")])
    if not html_files:
        print("No .html/.htm files found.")
        return 0

    unmatched_dir = args.vault_root / "_UNMATCHED"
    unmatched_dir.mkdir(parents=True, exist_ok=True)

    used_folders = set()

    ok = skip = unmatched = 0

    for src in html_files:
        html_text = src.read_text(encoding="utf-8", errors="replace")

        display_name = extract_canvas_display_name(html_text)
        first, last, middle = parse_person_name(display_name)

        folder, why = choose_folder_for_name(first, last, middle, last_idx, used=used_folders)

        # Choose output filename
        out_name = args.note_name.strip() if args.note_name else f"{src.stem}.md"
        if not out_name.lower().endswith(".md"):
            out_name += ".md"

        if folder is None:
            out_path = unmatched_dir / out_name
            status_prefix = "UNMATCHED"
        else:
            out_path = folder / out_name
            status_prefix = "OK"

        if out_path.exists() and not args.overwrite:
            print(f"{status_prefix}:SKIP (exists): {src.name} -> {out_path} ({why})")
            skip += 1
            if folder is not None:
                used_folders.add(folder)
            continue

        submission_html = extract_submission_html(html_text)
        submission_md = html_to_markdown(submission_html)
        note = build_note(submission_md, source_file=src.name)
        out_path.write_text(note, encoding="utf-8")

        print(f"{status_prefix}:WROTE: {src.name} -> {out_path} ({why})")

        if folder is None:
            unmatched += 1
        else:
            ok += 1
            used_folders.add(folder)

    print(f"\nDone. OK wrote {ok}, skipped {skip}, unmatched {unmatched}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())