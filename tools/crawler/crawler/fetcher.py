"""Fetch a page and retrieve its JavaScript-rendered HTML.

Postman's documenter renders documentation dynamically and lazy-loads each
endpoint's details only when its sidebar item is clicked. A plain HTTP request
would return an empty shell, and the initial render only contains the intro.
This module drives real chromium: it loads the page, captures the intro, then
clicks each sidebar endpoint and captures the freshly rendered content.
"""

from __future__ import annotations

import time

from playwright.sync_api import Browser, Page

from .config import CrawlConfig

# Sidebar item-name elements are clickable and enumerate every endpoint.
ITEM_SELECTOR = "[class*='documentation-core-list__item-name']"
# The content wrapper that holds the intro plus one <section id> per endpoint.
DOC_WRAPPER_SELECTOR = "#doc-wrapper"
# Endpoint sections are direct children of the doc wrapper, in sidebar order.
SECTION_SELECTOR = "#doc-wrapper > section[id]"
# JS that reads the inner HTML of the ``index``-th endpoint section.
_SECTION_JS = """
(index) => {
  const sections = document.querySelectorAll("#doc-wrapper > section[id]");
  const section = sections[index];
  return section ? section.innerHTML : "";
}
"""
# JS that reads the inner HTML of the configured article container.
_ARTICLE_JS = """
(selector) => {
  const el = document.querySelector(selector);
  return el ? el.innerHTML : null;
}
"""


def fetch_sections(browser: Browser, config: CrawlConfig) -> list[dict[str, str]]:
    """Return one entry per documentation section.

    Each entry is ``{"title": str, "html": str}``. The first entry is the intro
    page; each following entry is the rendered content of one sidebar endpoint.
    The documenter lazy-loads endpoint details, so each sidebar item is clicked
    in turn and the matching ``#doc-wrapper > section[id]`` is captured.
    """
    page = _open_page(browser, config)
    try:
        sections: list[dict[str, str]] = [_read_intro(page)]

        labels = page.eval_on_selector_all(
            ITEM_SELECTOR,
            "els => els.map(e => e.textContent.trim())",
        )
        items = page.locator(ITEM_SELECTOR)

        for index, label in enumerate(labels):
            items.nth(index).click()
            _wait_for_render(config)
            html = page.evaluate(_SECTION_JS, index)
            sections.append({"title": label, "html": html})

        return sections
    finally:
        page.close()


def _wait_for_render(config: CrawlConfig) -> None:
    """Pause long enough for dynamic content to render after a click."""
    time.sleep(config.wait_ms / 1000)


def fetch_article(browser: Browser, config: CrawlConfig) -> dict[str, str]:
    """Return the article body of ``config.url`` as ``{"title", "html"}``.

    Targets a plain documentation page that renders its body server-side (or
    after a single navigation), as opposed to Postman's click-driven
    documenter. The body is read from ``config.content_selector``; the document
    ``<h1>`` (falling back to ``<title>``) supplies the title.
    """
    page = _open_page(browser, config)
    try:
        html = page.evaluate(_ARTICLE_JS, config.content_selector)
        title = _article_title(page, config.url)
        return {"title": title, "html": html or ""}
    finally:
        page.close()


def _open_page(browser: Browser, config: CrawlConfig) -> Page:
    page = browser.new_page(
        user_agent=config.user_agent,
        viewport={"width": 1440, "height": 900},
    )
    page.goto(
        config.url,
        wait_until="networkidle",
        timeout=config.timeout_ms,
    )
    _wait_for_render(config)
    return page


def _article_title(page: Page, url: str) -> str:
    """Return the document heading, falling back to the URL tail."""
    heading = page.eval_on_selector_all(
        "h1",
        "els => (els.length ? els[0].textContent.trim() : '')",
    )
    if heading:
        return heading
    title = (page.title() or "").split(" - ")[0].strip()
    return title or url.rstrip("/").rsplit("/", 1)[-1]


def _read_intro(page: Page) -> dict[str, str]:
    """Capture the doc wrapper's content before any endpoint is selected."""
    html = page.eval_on_selector(
        DOC_WRAPPER_SELECTOR,
        "(el) => el.innerHTML",
    )
    return {"title": "Overview", "html": html}


def _wait_for_render(config: CrawlConfig) -> None:
    """Pause long enough for dynamic content to render after a click."""
    time.sleep(config.wait_ms / 1000)
