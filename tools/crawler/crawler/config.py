"""Central configuration for the crawler.

Holds the target URL, browser settings, and the CSS/structural rules used
to separate the meaningful article content from surrounding chrome
(navigation bars, sidebars, headers, footers, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass, field

# The public web page to crawl.
TARGET_URL = "https://documenter.getpostman.com/view/37399545/2sAYJ3D1i7"

# Default browser behaviour.
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)
DEFAULT_TIMEOUT_MS = 60_000
DEFAULT_WAIT_MS = 3_000
HEADLESS = True


@dataclass
class CrawlConfig:
    """Runtime configuration passed through the pipeline."""

    url: str = TARGET_URL
    user_agent: str = DEFAULT_USER_AGENT
    timeout_ms: int = DEFAULT_TIMEOUT_MS
    wait_ms: int = DEFAULT_WAIT_MS
    headless: bool = HEADLESS
    output_dir: str = "output"

    # Structural rules used by the cleaner step.
    # Elements to strip from a content fragment (the fetcher already targets
    # <main>, so only UI chrome that survives inside it needs removing).
    fragment_noise_selectors: list[str] = field(
        default_factory=lambda: [
            "script",
            "style",
            "noscript",
            "iframe",
            "svg",
            "button",
            "form",
            "input",
            "select",
            "[class*='toast']",
            "[class*='cookie']",
            "[class*='modal']",
            "[class*='language-label']",
            # Only the small "click to expand" button, NOT the
            # `-container` that holds the actual code block.
            "[class~='click-to-expand-overlay']",
        ]
    )
