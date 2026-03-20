import requests
from bs4 import BeautifulSoup
import csv
import os
import re
from urllib.parse import urljoin

# Prompt user for URL
url = input("Enter the URL of the webpage: ")

# Fetch and parse the page
response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')

# Get and sanitize page title
title = soup.title.string.strip() if soup.title else 'image_metadata'
safe_title = re.sub(r'[\\/*?:"<>|]', '', title)
safe_title = re.sub(r'\s+', '_', safe_title)

# Set filenames and folder
csv_filename = f"{safe_title}.csv"
download_folder = f"{safe_title}_images"

# Create folder for images
os.makedirs(download_folder, exist_ok=True)

# Collect image data and download images
image_data = []
for img in soup.find_all('img'):
    src = img.get('src')
    alt = img.get('alt', '')
    if src:
        img_url = urljoin(url, src)
        filename = os.path.basename(src)
        filepath = os.path.join(download_folder, filename)
        
        try:
            img_data = requests.get(img_url).content
            with open(filepath, 'wb') as f:
                f.write(img_data)
            image_data.append([filename, alt])
            print(f"Downloaded: {filename}")
        except Exception as e:
            print(f"Failed to download {img_url}: {e}")

# Write CSV
with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Filename', 'Alt Text'])
    writer.writerows(image_data)

print(f"\n✅ Saved {len(image_data)} image records to {csv_filename}")
print(f"📁 Images downloaded to: {download_folder}")