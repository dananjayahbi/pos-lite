"""Modular chromium-based web page crawler.

Extracts the main content of a JavaScript-rendered public web page and
converts it to a clean markdown document.
"""

__version__ = "0.1.0"

from .runner import crawl_page  # noqa: F401
