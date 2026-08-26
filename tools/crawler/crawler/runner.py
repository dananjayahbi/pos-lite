"""Orchestrate the crawl pipeline and write the markdown output."""

from __future__ import annotations

import re
from pathlib import Path

from .browser import launch_browser
from .cleaner import clean_fragment
from .codeblocks import restore
from .config import CrawlConfig
from .converter import html_to_markdown
from .fetcher import fetch_sections


def crawl_page(config: CrawlConfig | None = None) -> str:
    """Crawl ``config.url`` and write a single combined markdown document.

    Returns the absolute path of the generated markdown file.
    """
    config = config or CrawlConfig()

    with launch_browser(config) as (_playwright, browser):
        sections = fetch_sections(browser, config)
        markdown = _render_sections(sections, config)

    output_path = _write_output(markdown, config)
    return str(output_path)


def _render_sections(sections: list[dict[str, str]], config: CrawlConfig) -> str:
    """Convert every section's HTML to markdown and join under headings."""
    parts: list[str] = []
    for section in sections:
        body, placeholders = clean_fragment(section["html"], config)
        markdown = html_to_markdown(body, config)
        markdown = restore(markdown, placeholders)
        if not markdown:
            continue
        heading = section["title"] or "Untitled"
        parts.append(f"## {heading}\n\n{markdown}")

    title = _page_title(config.url)
    return f"# {title}\n\n" + "\n\n---\n\n".join(parts) + "\n"


def _write_output(markdown: str, config: CrawlConfig) -> Path:
    """Persist the markdown to ``config.output_dir`` with a slug-based name."""
    out_dir = Path(config.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    filename = _slugify(config.url) + ".md"
    path = out_dir / filename
    path.write_text(markdown, encoding="utf-8")
    return path


def _slugify(url: str) -> str:
    """Derive a filesystem-safe base name from the page URL."""
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9]+", "_", tail).strip("_")
    return name or "page"


def _page_title(url: str) -> str:
    """A human-friendly document title derived from the URL tail."""
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    return f"API Documentation ({tail})"
