"""Orchestrate the crawl pipeline and write the markdown output."""

from __future__ import annotations

from .browser import launch_browser
from .config import CrawlConfig
from .fetcher import fetch_article, fetch_sections
from .render import render_document, slugify, write_markdown


def crawl_page(config: CrawlConfig | None = None) -> str:
    """Crawl ``config.url`` (a Postman documenter page) and write one document.

    Returns the absolute path of the generated markdown file.
    """
    config = config or CrawlConfig()

    with launch_browser(config) as (_playwright, browser):
        sections = fetch_sections(browser, config)
        markdown = render_document(_page_title(config.url), sections, config)

    return str(write_markdown(markdown, config))


def crawl_article(config: CrawlConfig | None = None) -> str:
    """Crawl ``config.url`` (a conventional article page) and write one document.

    The body is read from ``config.content_selector``. Returns the path of the
    generated markdown file.
    """
    config = config or CrawlConfig()

    with launch_browser(config) as (_playwright, browser):
        section = fetch_article(browser, config)
        markdown = render_document(section["title"], [section], config)

    return str(write_markdown(markdown, config))


def _page_title(url: str) -> str:
    """A human-friendly document title derived from the URL tail."""
    return f"API Documentation ({slugify(url)})"
