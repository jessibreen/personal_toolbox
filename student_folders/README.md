# student_folders

> Generate one folder per student from a roster CSV.

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

`student_folders.py` reads a class roster CSV and creates filesystem-safe student folders named `firstname_lastname`.

It is designed for roster exports where names appear as `lastname, firstname` in a configurable CSV column.

---

## Features

- Reads CSV files with UTF-8 BOM support.
- Converts `lastname, firstname` into `firstname_lastname`.
- Normalizes names for filesystem-safe folder names.
- Supports dry-run mode before writing anything.
- Can skip existing folders with `--exist-ok`.
- Optionally preserves original case with `--keep-case`.

---

## Installation

### Prerequisites

- Python 3.9+
- `pip`

### Steps

```bash
# 1. Move into this project folder
cd student_folders

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
python student_folders.py roster.csv -o /path/to/classfolder
```

### Common Use Cases

**Preview folder creation only**

```bash
python student_folders.py roster.csv -o /path/to/classfolder --dry-run
```

**Skip folders that already exist**

```bash
python student_folders.py roster.csv -o /path/to/classfolder --exist-ok
```

**Use a different CSV column name**

```bash
python student_folders.py roster.csv -o /path/to/classfolder --column "Student"
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `csv_path` | `path` | required | Input roster CSV file |
| `-o, --out-dir` | `path` | required | Directory where folders are created |
| `--column` | `string` | `Student Name` | CSV column containing roster names |
| `--exist-ok` | `flag` | `false` | Skip targets that already exist |
| `--dry-run` | `flag` | `false` | Print planned folder names without creating |
| `--keep-case` | `flag` | `false` | Keep original letter case in output names |

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
