#!/usr/bin/env python3
"""
Create one folder per student from a class roster CSV.

Input column: "Student Name" (default)
Expected format: "lastname, firstname" (roster style)
Output folder: "firstname_lastname" (lowercase, filesystem-safe)

Examples:
  python student_folders.py roster.csv -o ./classfolder
  python student_folders.py roster.csv -o ./classfolder --dry-run
  python student_folders.py roster.csv -o ./classfolder --exist-ok
  python student_folders.py roster.csv -o ./classfolder --keep-case
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


def slug(part: str, lowercase: bool = True) -> str:
    part = part.strip()
    if lowercase:
        part = part.lower()

    # Remove apostrophes/backticks; keep hyphens/spaces for now
    part = re.sub(r"[’'`]", "", part)

    # Replace anything not alnum/space/hyphen/underscore with nothing
    part = re.sub(r"[^a-zA-Z0-9 _-]", "", part)

    # Collapse whitespace and hyphens to underscore
    part = re.sub(r"[\s\-]+", "_", part)

    # Collapse multiple underscores
    part = re.sub(r"_+", "_", part).strip("_")

    return part or "unnamed"


def folder_from_roster_name(roster_name: str, lowercase: bool = True) -> str:
    """
    Convert "lastname, firstname" -> "firstname_lastname"
    If extra commas exist, we take everything before first comma as last,
    everything after as first (trimmed).
    """
    if "," not in roster_name:
        # Fallback: treat as single token name
        one = slug(roster_name, lowercase=lowercase)
        return one

    last, first = roster_name.split(",", 1)
    first = slug(first, lowercase=lowercase)
    last = slug(last, lowercase=lowercase)
    return f"{first}_{last}"


def main() -> int:
    p = argparse.ArgumentParser(description="Create folders from a class roster CSV.")
    p.add_argument("csv_path", type=Path, help="Path to roster CSV")
    p.add_argument("-o", "--out-dir", type=Path, required=True, help="Where to create student folders")
    p.add_argument(
        "--column",
        default="Student Name",
        help='CSV column containing the roster-formatted name (default: "Student Name")',
    )
    p.add_argument("--exist-ok", action="store_true", help="Skip folders that already exist")
    p.add_argument("--dry-run", action="store_true", help="Show what would be created without creating anything")
    p.add_argument("--keep-case", action="store_true", help="Do not lowercase folder names")
    args = p.parse_args()

    if not args.csv_path.exists():
        raise SystemExit(f"CSV not found: {args.csv_path}")

    args.out_dir.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    seen = set()

    with args.csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            raise SystemExit("CSV has no header row.")

        if args.column not in reader.fieldnames:
            raise SystemExit(
                f'Missing column "{args.column}". Found headers: {", ".join(reader.fieldnames)}'
            )

        for row in reader:
            roster_name = (row.get(args.column) or "").strip()
            if not roster_name:
                skipped += 1
                continue

            folder = folder_from_roster_name(roster_name, lowercase=not args.keep_case)

            # Avoid duplicates within the same run by appending (2), (3), etc.
            base = folder
            n = 2
            while folder in seen:
                folder = f"{base} ({n})"
                n += 1
            seen.add(folder)

            target = args.out_dir / folder

            if target.exists():
                if args.exist_ok:
                    skipped += 1
                    continue
                else:
                    raise SystemExit(f"Folder already exists: {target} (use --exist-ok to skip)")

            if args.dry_run:
                print(f"Would create: {target}")
            else:
                target.mkdir(parents=True, exist_ok=False)
                print(f"Created: {target}")
            created += 1

    print(f"\nDone. Created {created}; skipped {skipped}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())