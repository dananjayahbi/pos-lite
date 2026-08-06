# Web Page Crawler

A modular, chromium-based crawler that extracts the **main content** of a
JavaScript-rendered public web page and exports it as a clean markdown file
(no navigation bars, sidebars, footers, or other chrome).

## Why chromium?

Pages such as Postman documenter render their content dynamically after the
initial HTML loads. A plain `httpx`/`requests` GET would only return an empty
shell. This tool drives real **chromium** (via Playwright) so the content is
fully hydrated before it is captured.

## Project layout

```
crawler/
  run.py                 # CLI entry point
  crawler/
    config.py            # target URL + browser + cleanup rules
    browser.py           # chromium launch/shutdown lifecycle
    fetcher.py           # navigate + capture rendered HTML
    cleaner.py           # strip navigation/chrome, keep main content
    converter.py         # HTML -> markdown (html2text)
    runner.py            # orchestrates the pipeline, writes output
  output/                # generated markdown files
```

## Requirements

- Python 3.10+
- A virtual environment (created in the terminal below).

## Setup

```bash
cd crawler
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m playwright install chromium
```

## Usage

```bash
# Crawl the default target from config.py
.venv/Scripts/python.exe run.py

# Target a different URL
.venv/Scripts/python.exe run.py --url "https://example.com"

# Choose an output directory
.venv/Scripts/python.exe run.py --output-dir "docs"

# Visible browser for debugging
.venv/Scripts/python.exe run.py --headful
```

## Pipeline

1. Launch headless chromium.
2. Navigate to the URL and wait for the network to settle.
3. Capture the fully rendered HTML.
4. Remove noise (nav/sidebar/footer/scripts) with BeautifulSoup.
5. Convert the cleaned HTML to markdown with `html2text`.
6. Write the result to `output/<slug>.md`.

The resulting markdown contains **only the document content** — navigation and
other chrome are excluded.

## Output

- `output/2sAYJ3D1i7.md` — the raw, per-section crawl dump of the target page
  (Overview + every API endpoint, with fenced code blocks).
- `output/trans-express-api.md` — a **curated, content-only** document crafted
  from the dump: navigation/tab labels, request-header chrome, and response
  header metadata are removed, and each endpoint is presented under a clean
  heading with its URL, description, parameters, request body, and examples.
