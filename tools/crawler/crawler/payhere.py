"""PayHere documentation crawl targets.

Single source of truth for the PayHere support-site pages we mirror locally
under ``REFERENCES/payhere/scrapes/``. Grouped by the sidebar section the
support site itself uses, so filenames stay ordered and readable.
"""

from __future__ import annotations

from .batch import Batch

SUPPORT_BASE = "https://support.payhere.lk"

# Sidebar section → page paths. Order is preserved in the output filenames.
API_AND_SDK_PATHS = [
    "checkout-api",
    "recurring-api",
    "preapproval-api",
    "charging-api",
    "retrieval-api",
    "subscription-manager-api",
    "refund-api",
    "authorize-api",
    "capture-api",
    "javascript-sdk",
    "android-sdk",
    "ios-sdk",
    "react-native-sdk",
    "flutter-sdk",
]

LINKS_AND_BUTTONS_PATHS = [
    "payhere-links",
    "payhere-buttons",
]

# Root-level (no section prefix) support articles that pair with the API
# reference: testing, payment-method coverage, and refund/charge mechanics.
MAIN_ARTICLE_PATHS = [
    "sandbox-and-testing",
    "payment-logos",
    "onsite-checkout",
    "refund-process",
    "recurring-billing",
    "automated-charging",
    "hold-on-card",
]


def _urls(prefix: str, paths: list[str]) -> list[str]:
    base = f"{SUPPORT_BASE}/{prefix}" if prefix else SUPPORT_BASE
    return [f"{base}/{path}" for path in paths]


def payhere_batches() -> list[Batch]:
    """Build the PayHere crawl batches (all read the ``section.content`` body)."""
    return [
        Batch(
            name="payhere/api-and-mobile-sdk",
            kind="article",
            content_selector="section.content",
            subdir="api-and-mobile-sdk",
            urls=_urls("api-&-mobile-sdk", API_AND_SDK_PATHS),
        ),
        Batch(
            name="payhere/links-and-buttons",
            kind="article",
            content_selector="section.content",
            subdir="links-and-buttons",
            urls=_urls("links-&-buttons", LINKS_AND_BUTTONS_PATHS),
        ),
        Batch(
            name="payhere/main-articles",
            kind="article",
            content_selector="section.content",
            subdir="main-articles",
            urls=_urls("", MAIN_ARTICLE_PATHS),
        ),
    ]
