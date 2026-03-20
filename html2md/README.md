# html2md

> Import Canvas textbox-export HTML files into student Markdown notes for Obsidian.

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

`html2md.py` converts Canvas textbox submission HTML exports into Markdown notes and writes them into existing student folders named `firstname_lastname`.

Matching is name-based and resilient:

- Match by last name first.
- If multiple folders share a last name, try first name.
- If needed, try middle name as preferred first name.
- If no match is found, write to `_UNMATCHED/`.

---

## Features

- Converts HTML to Markdown using `beautifulsoup4` and `markdownify`.
- Extracts submission body and wraps it in a grading template.
- Handles `.html` and `.htm` files.
- Supports recursive scanning (default) and non-recursive mode.
- Optional overwrite behavior for existing notes.

---

## Installation

### Prerequisites

- Python 3.9+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd html2md

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
python html2md.py /path/to/canvas-exports --vault-root /path/to/obsidian-vault
```

### Common Use Cases

**Set a fixed output note name**

```bash
python html2md.py /path/to/canvas-exports \
  --vault-root /path/to/obsidian-vault \
  --note-name waypoint1.md
```

**Disable recursive scanning**

```bash
python html2md.py /path/to/canvas-exports \
  --vault-root /path/to/obsidian-vault \
  --no-recursive
```

**Overwrite existing notes**

```bash
python html2md.py /path/to/canvas-exports \
  --vault-root /path/to/obsidian-vault \
  --overwrite
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `input_dir` | `path` | required | Folder containing Canvas HTML files |
| `--vault-root` | `path` | required | Obsidian vault root with student folders |
| `--note-name` | `string` | source filename + `.md` | Fixed output filename for all generated notes |
| `--overwrite` | `flag` | `false` | Replace existing output notes |
| `--no-recursive` | `flag` | `false` | Only scan top-level input directory |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
