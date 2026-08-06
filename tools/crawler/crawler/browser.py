"""Browser lifecycle management for Playwright chromium."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from playwright.sync_api import Browser, Playwright, sync_playwright

from .config import CrawlConfig


@contextmanager
def launch_browser(config: CrawlConfig) -> Generator[tuple[Playwright, Browser], None, None]:
    """Yield a launched chromium ``Browser`` tied to a Playwright context.

    Yields ``(playwright, browser)`` and guarantees both are closed when the
    generator exits, regardless of whether the body succeeded.
    """
    p: Playwright = sync_playwright().start()
    browser: Browser = p.chromium.launch(
        headless=config.headless,
        args=["--no-sandbox"],
    )
    try:
        yield p, browser
    finally:
        browser.close()
        p.stop()
