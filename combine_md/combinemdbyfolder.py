from pathlib import Path
from datetime import datetime
import re
import argparse

DATE_RX = re.compile(r'^\d{2}-\d{2}-\d{2}\.md$')  # matches 01-14-26.md, etc.

def parse_date_from_stem(stem: str) -> datetime:
    # YY is parsed as 20YY for 00–68 and 19YY for 69–99 per Python rules; matches typical "%y".
    return datetime.strptime(stem, "%m-%d-%y")

def collect_sorted_date_files(directory: Path):
    files = [p for p in directory.iterdir() if p.is_file() and DATE_RX.match(p.name)]
    files.sort(key=lambda p: parse_date_from_stem(p.stem))
    return files

def combine_one_directory(d: Path, output_name: str = "combined.md", heading_level: int = 1,
                          encoding: str = "utf-8", overwrite: bool = True, dry_run: bool = False):
    md_files = collect_sorted_date_files(d)
    if not md_files:
        return 0, "no-date-files"

    out_path = d / output_name
    if out_path.exists() and not overwrite:
        return 0, "skip-existing-output"

    h = "#" * max(1, heading_level)
    parts = []
    for i, f in enumerate(md_files):
        parts.append(f"{h} {f.stem}\n\n")
        parts.append(f.read_text(encoding=encoding))
        if i != len(md_files) - 1:
            parts.append("\n\n")
    combined = "".join(parts)

    if dry_run:
        print(f"[DRY] Would write {len(md_files)} sections to: {out_path}")
        return len(md_files), "dry-run"

    out_path.write_text(combined, encoding=encoding)
    print(f"[OK] {d} -> wrote {out_path.name} ({len(md_files)} sections)")
    return len(md_files), "written"

def main():
    ap = argparse.ArgumentParser(description="Create combined.md in each subfolder from date-named MD files.")
    ap.add_argument("--root", required=True, help="Path to the top-level vault folder")
    ap.add_argument("--output-name", default="combined.md", help="Output file name (default: combined.md)")
    ap.add_argument("--heading-level", type=int, default=1, help="Heading level for section titles (default: 1 => '#')")
    ap.add_argument("--dry-run", action="store_true", help="Preview without writing")
    ap.add_argument("--no-overwrite", action="store_true", help="Skip if output already exists")
    ap.add_argument("--ignore", nargs="*", default=[".obsidian"], help="Subfolder names to ignore")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        raise SystemExit(f"Root is not a directory: {root}")

    overwrite = not args.no_overwrite
    ignore_names = set(args.ignore)

    # Only immediate subfolders (your 24 folders)
    targets = [d for d in root.iterdir() if d.is_dir() and d.name not in ignore_names]

    total_dirs = 0
    total_sections = 0
    skipped_existing = 0

    for d in sorted(targets, key=lambda p: p.name.lower()):
        n, status = combine_one_directory(
            d,
            output_name=args.output_name,
            heading_level=args.heading_level,
            overwrite=overwrite,
            dry_run=args.dry_run,
        )
        if status == "skip-existing-output":
            print(f"[SKIP] {d}: {args.output_name} already exists")
            skipped_existing += 1
        elif status in ("written", "dry-run"):
            total_dirs += 1
            total_sections += n

    print("\nSummary")
    print("-------")
    print(f" Vault root: {root}")
    print(f" Directories processed: {total_dirs} / {len(targets)}")
    print(f" Sections {'to be written' if args.dry_run else 'written'}: {total_sections}")
    if skipped_existing and not overwrite:
        print(f" Skipped (existing output): {skipped_existing}")

if __name__ == "__main__":
    main()