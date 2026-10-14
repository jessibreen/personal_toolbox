import requests
from bs4 import BeautifulSoup
import csv
import os
import posixpath
import re
import mimetypes
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urldefrag, urljoin, urlparse

REQUEST_INTERVAL_SECONDS = 1.0
MAX_RETRIES = 3
last_request_at = 0.0


def get_response(request_url):
    global last_request_at
    for attempt in range(MAX_RETRIES + 1):
        wait_seconds = REQUEST_INTERVAL_SECONDS - (time.monotonic() - last_request_at)
        if wait_seconds > 0:
            time.sleep(wait_seconds)

        response = requests.get(request_url, timeout=30)
        last_request_at = time.monotonic()
        if response.status_code not in (429, 503) or attempt == MAX_RETRIES:
            return response

        retry_after = response.headers.get('Retry-After', '')
        try:
            retry_delay = max(0.0, float(retry_after))
        except ValueError:
            try:
                retry_time = parsedate_to_datetime(retry_after)
                if retry_time.tzinfo is None:
                    retry_time = retry_time.replace(tzinfo=timezone.utc)
                retry_delay = max(0.0, (retry_time - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError, OverflowError):
                retry_delay = float(2 ** attempt)
        time.sleep(retry_delay)


# Prompt user for URL
url = input("Enter the URL of the webpage: ").strip()

# Fetch and parse the page
response = get_response(url)
response.raise_for_status()
url = response.url
soup = BeautifulSoup(response.content, 'html.parser')
base_tag = soup.find('base', href=True)
document_base_url = urljoin(url, base_tag['href']) if base_tag else url

# Get and sanitize page title
title = soup.title.string.strip() if soup.title else 'image_metadata'
safe_title = re.sub(r'[\\/*?:"<>|]', '', title)
safe_title = re.sub(r'\s+', '_', safe_title).strip('._') or 'image_metadata'

# Keep all outputs for this tutorial together.
output_folder = safe_title
csv_filename = os.path.join(output_folder, f"{safe_title}.csv")
html_filename = os.path.join(output_folder, f"{safe_title}.html")
download_folder = os.path.join(output_folder, 'images')
asset_folder = os.path.join(output_folder, 'assets')
stylesheet_folder = os.path.join(output_folder, 'styles')
os.makedirs(output_folder, exist_ok=True)

for folder in (download_folder, asset_folder, stylesheet_folder):
    os.makedirs(folder, exist_ok=True)

resources = {}
stylesheet_cache = {}

def absolute_reference(reference, base_url):
    reference = reference.strip()
    if not reference or reference.startswith('#') or urlparse(reference).scheme:
        return reference
    return urljoin(base_url, reference)


def local_extension(resource_url, headers):
    content_type = headers.get('Content-Type', '').split(';')[0].strip().lower()
    source_extension = os.path.splitext(urlparse(resource_url).path)[1].lower()
    if content_type in ('', 'application/octet-stream', 'binary/octet-stream'):
        if re.fullmatch(r'\.[a-z0-9]{1,8}', source_extension):
            return source_extension
    known_extensions = {
        'font/woff': '.woff',
        'font/woff2': '.woff2',
        'application/font-woff': '.woff',
        'application/font-woff2': '.woff2',
        'font/ttf': '.ttf',
        'font/otf': '.otf',
        'image/svg+xml': '.svg',
    }
    extension = known_extensions.get(content_type) or mimetypes.guess_extension(content_type)
    if extension:
        return extension.lower()
    return source_extension if re.fullmatch(r'\.[a-z0-9]{1,8}', source_extension) else '.bin'


def download_asset(resource_url, resource_type='asset', alt_text=''):
    resource_url = urldefrag(urljoin(document_base_url, resource_url))[0]
    if urlparse(resource_url).scheme not in ('http', 'https'):
        return None

    if resource_url in resources:
        record = resources[resource_url]
        if not record['alt_text'] and alt_text:
            record['alt_text'] = alt_text
        return record['local_path'] or None

    folder = 'images' if resource_type == 'image' else 'assets'
    record = {
        'original_url': resource_url,
        'local_path': '',
        'alt_text': alt_text,
        'type': resource_type,
        'status': 'Failed',
    }
    resources[resource_url] = record
    try:
        asset_response = get_response(resource_url)
        asset_response.raise_for_status()
        extension = local_extension(resource_url, asset_response.headers)
        filename = f"{resource_type}_{len(resources):04d}{extension}"
        local_path = f"{folder}/{filename}"
        filepath = os.path.join(output_folder, local_path)
        with open(filepath, 'wb') as asset_file:
            asset_file.write(asset_response.content)
        record['local_path'] = local_path
        record['status'] = 'Downloaded'
        print(f"Downloaded {resource_type}: {filepath}")
    except Exception as error:
        record['status'] = f"Failed: {error}"
        print(f"Failed to download {resource_url}: {error}")
    return record['local_path'] or None


def read_css_url(css_text, start):
    opening = css_text.find('(', start)
    quote = None
    escaped = False
    for index in range(opening + 1, len(css_text)):
        character = css_text[index]
        if escaped:
            escaped = False
        elif character == '\\':
            escaped = True
        elif quote:
            if character == quote:
                quote = None
        elif character in ('"', "'"):
            quote = character
        elif character == ')':
            raw_value = css_text[opening + 1:index].strip()
            if len(raw_value) >= 2 and raw_value[0] in ('"', "'") and raw_value[-1] == raw_value[0]:
                return index + 1, raw_value[1:-1], raw_value[0]
            return index + 1, raw_value, ''
    return len(css_text), '', ''


def find_css_rule_end(css_text, start):
    quote = None
    escaped = False
    depth = 0
    for index in range(start, len(css_text)):
        character = css_text[index]
        if escaped:
            escaped = False
        elif character == '\\':
            escaped = True
        elif quote:
            if character == quote:
                quote = None
        elif character in ('"', "'"):
            quote = character
        elif character == '(':
            depth += 1
        elif character == ')':
            depth = max(0, depth - 1)
        elif character == ';' and depth == 0:
            return index + 1
    return len(css_text)


def relative_local_path(local_path, from_path):
    return posixpath.relpath(local_path, posixpath.dirname(from_path) or '.')


def localize_stylesheet(stylesheet_url):
    stylesheet_url = urldefrag(urljoin(document_base_url, stylesheet_url))[0]
    if urlparse(stylesheet_url).scheme not in ('http', 'https'):
        return None
    if stylesheet_url in stylesheet_cache:
        cached = stylesheet_cache[stylesheet_url]
        return cached['local_path'] if cached['status'] in ('Processing', 'Downloaded') else None

    local_path = f"styles/stylesheet_{len(stylesheet_cache) + 1:04d}.css"
    record = {
        'original_url': stylesheet_url,
        'local_path': local_path,
        'alt_text': '',
        'type': 'stylesheet',
        'status': 'Processing',
    }
    stylesheet_cache[stylesheet_url] = record
    resources[stylesheet_url] = record
    try:
        stylesheet_response = get_response(stylesheet_url)
        stylesheet_response.raise_for_status()
        css_text = stylesheet_response.text
        rewritten_css = localize_css(css_text, stylesheet_response.url, local_path)
        with open(os.path.join(output_folder, local_path), 'w', encoding='utf-8') as css_file:
            css_file.write(rewritten_css)
        record['status'] = 'Downloaded'
        print(f"Downloaded stylesheet: {os.path.join(output_folder, local_path)}")
        return local_path
    except Exception as error:
        record['local_path'] = ''
        record['status'] = f"Failed: {error}"
        print(f"Failed to download stylesheet {stylesheet_url}: {error}")
        return None


def localize_css(css_text, base_url, css_path):
    rewritten = []
    index = 0
    while index < len(css_text):
        if css_text.startswith('/*', index):
            comment_end = css_text.find('*/', index + 2)
            comment_end = len(css_text) if comment_end == -1 else comment_end + 2
            rewritten.append(css_text[index:comment_end])
            index = comment_end
            continue

        if css_text[index:index + 7].lower() == '@import' and (index + 7 == len(css_text) or not css_text[index + 7].isalnum()):
            rule_end = find_css_rule_end(css_text, index)
            rule = css_text[index:rule_end]
            prefix_match = re.match(r'@import\s+', rule, flags=re.IGNORECASE)
            if not prefix_match:
                index = rule_end
                continue
            reference_start = prefix_match.end()
            if rule[reference_start:reference_start + 4].lower() == 'url(':
                token_end, reference, quote = read_css_url(rule, reference_start)
                replacement_start = reference_start
                replacement_end = token_end
                token_format = 'url'
            elif reference_start < len(rule) and rule[reference_start] in ('"', "'"):
                quote = rule[reference_start]
                token_end = rule.find(quote, reference_start + 1)
                if token_end == -1:
                    index = rule_end
                    continue
                reference = rule[reference_start + 1:token_end]
                replacement_start = reference_start
                replacement_end = token_end + 1
                token_format = 'string'
            else:
                index = rule_end
                continue

            if urlparse(reference).scheme == 'data':
                rewritten.append(rule)
            else:
                imported_path = localize_stylesheet(urljoin(base_url, reference))
                if imported_path:
                    local_reference = relative_local_path(imported_path, css_path)
                    local_token = f'url("{local_reference}")' if token_format == 'url' else f'{quote}{local_reference}{quote}'
                    rewritten.append(rule[:replacement_start] + local_token + rule[replacement_end:])
            index = rule_end
            continue

        if css_text[index:index + 4].lower() == 'url(' and (index == 0 or not (css_text[index - 1].isalnum() or css_text[index - 1] in ('-', '_'))):
            token_end, reference, quote = read_css_url(css_text, index)
            if reference.startswith('#') or reference.lower().startswith('data:') or reference.lower().startswith('var('):
                rewritten.append(css_text[index:token_end])
            else:
                absolute_url = urljoin(base_url, reference)
                local_path = download_asset(absolute_url)
                if local_path:
                    local_reference = relative_local_path(local_path, css_path)
                    rewritten.append(f'url("{local_reference}")')
            index = token_end
            continue

        if css_text[index] in ('"', "'"):
            quote = css_text[index]
            end = index + 1
            escaped = False
            while end < len(css_text):
                if escaped:
                    escaped = False
                elif css_text[end] == '\\':
                    escaped = True
                elif css_text[end] == quote:
                    end += 1
                    break
                end += 1
            rewritten.append(css_text[index:end])
            index = end
            continue

        rewritten.append(css_text[index])
        index += 1
    return ''.join(rewritten)


def localize_html_url(reference, resource_type='asset', alt_text=''):
    if not reference or reference.startswith('#') or reference.lower().startswith('data:'):
        return reference
    absolute_url = absolute_reference(reference, document_base_url)
    if urlparse(absolute_url).scheme not in ('http', 'https'):
        return None
    return download_asset(absolute_url, resource_type, alt_text)


def rewrite_srcset(srcset, alt_text=''):
    rewritten = []
    for candidate in srcset.split(','):
        candidate = candidate.strip()
        if not candidate:
            continue
        parts = candidate.split(None, 1)
        local_path = localize_html_url(parts[0], 'image', alt_text)
        if local_path:
            parts[0] = local_path
            rewritten.append(' '.join(parts))
    return ', '.join(rewritten)


for script in soup.find_all('script'):
    script.decompose()
for element in soup.find_all(['iframe', 'object', 'embed', 'applet']):
    element.decompose()
for meta in soup.find_all('meta'):
    if meta.get('http-equiv', '').lower() == 'refresh':
        meta.decompose()
for base_tag in soup.find_all('base'):
    base_tag.decompose()

for link in soup.find_all('link'):
    rel = [value.lower() for value in link.get('rel', [])]
    if 'stylesheet' not in rel or not link.get('href'):
        link.decompose()
        continue
    local_path = localize_stylesheet(absolute_reference(link['href'], document_base_url))
    if local_path:
        link['href'] = local_path
    else:
        link.decompose()

page_relative_path = f"{safe_title}.html"
for element in soup.find_all(True):
    for attribute in list(element.attrs):
        if attribute.lower().startswith('on') or attribute.lower() in ('ping', 'srcdoc'):
            del element[attribute]
    if element.get('style'):
        element['style'] = localize_css(element['style'], document_base_url, page_relative_path)
    if element.name == 'style' and element.string:
        element.string.replace_with(localize_css(element.string, document_base_url, page_relative_path))

for element in soup.find_all(['img', 'source', 'video', 'audio', 'track', 'input', 'image']):
    alt_text = element.get('alt', '')
    for attribute in ('src', 'poster', 'data-src', 'data-original', 'data-lazy-src'):
        reference = element.get(attribute)
        if not reference:
            continue
        local_path = localize_html_url(reference, 'image' if attribute == 'poster' or element.name in ('img', 'image') else 'asset', alt_text)
        if local_path:
            if attribute in ('data-src', 'data-original', 'data-lazy-src'):
                if not element.get('src'):
                    element['src'] = local_path
            else:
                element[attribute] = local_path
        else:
            element.attrs.pop(attribute, None)

    for attribute in ('data-src', 'data-original', 'data-lazy-src'):
        element.attrs.pop(attribute, None)

    if element.get('srcset'):
        rewritten_srcset = rewrite_srcset(element['srcset'], alt_text)
        if rewritten_srcset:
            element['srcset'] = rewritten_srcset
        else:
            del element['srcset']

    if element.name == 'image':
        for attribute in ('href', 'xlink:href'):
            if element.get(attribute):
                local_path = localize_html_url(element[attribute], 'image', alt_text)
                if local_path:
                    element[attribute] = local_path
                else:
                    element.attrs.pop(attribute, None)

# Keep in-page links, but make all external navigation inert in the offline copy.
for anchor in soup.find_all('a', href=True):
    if not anchor['href'].startswith('#'):
        del anchor['href']

# Remove any remaining remote resource attributes that could trigger a request.
resource_attributes = {
    'href', 'src', 'srcset', 'action', 'formaction', 'poster', 'data',
    'cite', 'longdesc', 'manifest', 'background', 'codebase', 'xlink:href',
}
for element in soup.find_all(True):
    for attribute in resource_attributes.intersection(name.lower() for name in element.attrs):
        value = element.get(attribute)
        if not value or attribute == 'srcset':
            continue
        if urlparse(value).scheme in ('http', 'https'):
            element.attrs.pop(attribute, None)
    for attribute in ('action', 'formaction'):
        element.attrs.pop(attribute, None)
    if element.get('srcset'):
        candidates = element['srcset'].split(',')
        if any(urlparse(candidate.strip().split(None, 1)[0]).scheme in ('http', 'https') for candidate in candidates if candidate.strip()):
            del element['srcset']

# Save the rewritten page alongside its local assets.
with open(html_filename, 'w', encoding='utf-8') as html_file:
    html_file.write(str(soup))

# Write CSV
with open(csv_filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Original URL', 'Local Path', 'Alt Text', 'Type', 'Status'])
    for record in resources.values():
        writer.writerow([
            record['original_url'],
            record['local_path'],
            record['alt_text'],
            record['type'],
            record['status'],
        ])

downloaded_count = sum(record['status'] == 'Downloaded' for record in resources.values())
print(f"\nSaved {downloaded_count} local resources under {output_folder}")
print(f"Rewritten HTML saved to: {html_filename}")
print(f"Image metadata saved to: {csv_filename}")
print(f"Tutorial files saved to: {output_folder}")