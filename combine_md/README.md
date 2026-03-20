# combinemdbyfolder

> Combine date-named Markdown notes in each folder into one ordered `combined.md` file.

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

`combinemdbyfolder.py` scans each immediate subfolder of a root directory, finds Markdown files named like `MM-DD-YY.md`, sorts them by date, and writes a single combined output file per subfolder.

It is useful for teachers who keep dated notes in student folders and want one chronological file for grading or review.

---

## Features

- Parses files matching the date pattern `MM-DD-YY.md`.
- Sorts files by real date, not lexical filename order.
- Creates one section per source file with configurable heading level.
- Supports dry-run mode and no-overwrite mode.
- Ignores selected folder names (default includes `.obsidian`).

---

## Installation

### Prerequisites

- Python 3.9+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd combinemdbyfolder

# 2. (Optional) create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

---

## Usage

### Basic Example

```bash
python combinemdbyfolder.py --root /path/to/vault
```

### Common Use Cases

**Custom output filename and heading level**

```bash
python combinemdbyfolder.py \
  --root /path/to/vault \
  --output-name all-notes.md \
  --heading-level 2
```

**Preview without writing files**

```bash
python combinemdbyfolder.py --root /path/to/vault --dry-run
```

**Skip existing outputs**

```bash
python combinemdbyfolder.py --root /path/to/vault --no-overwrite
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `--root` | `path` | required | Top-level folder containing student subfolders |
| `--output-name` | `string` | `combined.md` | Output file created in each subfolder |
| `--heading-level` | `int` | `1` | Markdown heading level for section titles |
| `--dry-run` | `flag` | `false` | Print planned writes without creating files |
| `--no-overwrite` | `flag` | `false` | Skip subfolders where output already exists |
| `--ignore` | `list[str]` | `.obsidian` | Subfolder names to exclude from processing |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
