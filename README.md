# image_scraper
A tool to scrape and organize images.

## Usage

``` bash
# install dependencies (once)
pip install requests beautifulsoup4

# run the scraper
python image_scraper.py
```

Paste the webpage URL when prompted.

**Output:**

-   `PAGE_TITLE.csv` → image filenames + alt text\
-   `PAGE_TITLE_images/` → downloaded images

Both are saved to the folder you ran the script from.

------------------------------------------------------------------------

## Quick tip

Run it from a fresh folder to keep things organized:

``` bash
mkdir scrape_run && cd scrape_run
python ../image_scraper.py
```
