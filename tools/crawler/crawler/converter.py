"""Convert cleaned HTML into markdown."""

from __future__ import annotations

import html2text

from .config import CrawlConfig


def _build_converter() -> html2text.HTML2Text:
    """Configure an ``html2text`` converter tuned for documentation pages."""
    converter = html2text.HTML2Text()
    converter.body_width = 0  # do not wrap long lines
    converter.ignore_images = False
    converter.ignore_emphasis = False
    converter.ignore_links = False
    converter.ignore_tables = False
    converter.mark_code = False
    return converter


def html_to_markdown(clean_html_body: str, config: CrawlConfig) -> str:
    """Convert the cleaned HTML fragment to a markdown string."""
    del config  # retained for a uniform pipeline signature
    converter = _build_converter()
    return converter.handle(clean_html_body).strip()
