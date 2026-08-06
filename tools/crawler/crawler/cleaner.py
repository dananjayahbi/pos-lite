"""Clean a content fragment before conversion to markdown.

The fetcher already targets the page's ``<main>`` container, so this module
only removes a conservative set of UI/noise elements (scripts, icons, buttons,
overlays) and extracts code blocks for fenced rendering. It deliberately does
not re-pick a sub-container, which would discard real content.
"""

from __future__ import annotations

from bs4 import BeautifulSoup

from . import codeblocks
from .config import CrawlConfig


def clean_fragment(
    fragment_html: str,
    config: CrawlConfig,
) -> tuple[str, dict[str, str]]:
    """Return ``(clean_html, codeblock_placeholders)`` for a content fragment.

    The returned ``clean_html`` is ready for ``html2text``; code blocks have
    been replaced by tokens that must be restored via ``codeblocks.restore``.
    """
    soup = BeautifulSoup(fragment_html, "html.parser")

    _remove_noise(soup, config.fragment_noise_selectors)
    placeholders = codeblocks.extract(soup)

    return soup.decode_contents().strip(), placeholders


def _remove_noise(soup: BeautifulSoup, selectors: list[str]) -> None:
    """Delete elements matching the noise selectors."""
    for selector in selectors:
        for element in soup.select(selector):
            element.decompose()

