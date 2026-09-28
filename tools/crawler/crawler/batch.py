"""Crawl a whole documentation set in one browser session.

The Playwright browser lifecycle is expensive (~1-2 s per launch), and a
documentation set is tens of pages. This module launches chromium **once**,
then drives each configured batch through the appropriate pipeline:

- Postman documenter pages (``Batch.kind == "postman"``) → sidebar-walking
  ``fetch_sections``.
- Conventional article pages (``Batch.kind == "article"``) → container-reading
  ``fetch_article``, with an optional extra CSS selector to narrow the body.

Each URL is written to its own markdown file; one failing URL never aborts the
batch (it is reported and skipped).
"""

from __future__ import annotations

import dataclasses
import re
from dataclasses import dataclass, field
from pathlib import Path

from .browser import launch_browser
from .config import CrawlConfig
from .fetcher import fetch_article, fetch_sections
from .render import PageSection, render_document, slugify, write_markdown


@dataclass
class Batch:
    """A named set of documentation URLs to crawl into a directory."""

    name: str
    urls: list[str]
    # ``"postman"`` walks the sidebar; ``"article"`` reads one container.
    kind: str = "article"
    # Directory under ``output_dir`` that receives this batch's files.
    subdir: str = ""
    # Extra CSS selector used to narrow an article body (applied with
    # ``document.querySelector`` before falling back to the configured one).
    content_selector: str = ""


@dataclass
class BatchResult:
    """Outcome of one URL inside a batch."""

    url: str
    path: Path | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.path is not None and self.error is None


@dataclass
class BatchReport:
    """Aggregate outcome for a batch of documentation."""

    batch: str
    results: list[BatchResult] = field(default_factory=list)

    @property
    def failures(self) -> list[BatchResult]:
        return [r for r in self.results if not r.ok]


# Filesystem-safe script that keeps ordering (e.g. ``01-checkout-api``).
_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def crawl_batches(
    batches: list[Batch],
    config: CrawlConfig | None = None,
    verbose: bool = True,
) -> list[BatchReport]:
    """Crawl every batch in a single browser session and return per-batch reports."""
    base = config or CrawlConfig()
    reports: list[BatchReport] = []

    with launch_browser(base) as (_playwright, browser):
        for batch in batches:
            report = BatchReport(batch=batch.name)
            for index, url in enumerate(batch.urls, start=1):
                sub_config = _config_for_url(base, batch, url)
                try:
                    sections = _fetch(browser, sub_config, batch)
                    title = _document_title(sections, sub_config.url)
                    markdown = render_document(title, sections, sub_config)
                    path = write_markdown(
                        markdown,
                        sub_config,
                        filename=_filename(batch, index, url),
                    )
                    report.results.append(BatchResult(url=url, path=path))
                    if verbose:
                        print(f"[crawler] {batch.name}: {path.name} ({len(markdown)} chars)")
                except Exception as exc:  # noqa: BLE001 — one URL must not abort the batch
                    report.results.append(BatchResult(url=url, error=str(exc)))
                    print(f"[crawler] FAILED {url}: {exc}")
            reports.append(report)

    return reports


def _config_for_url(base: CrawlConfig, batch: Batch, url: str) -> CrawlConfig:
    """Per-URL config with the batch's output subdirectory applied."""
    out_dir = str(Path(base.output_dir) / batch.subdir) if batch.subdir else base.output_dir
    selector = batch.content_selector or base.content_selector
    return dataclasses.replace(base, url=url, output_dir=out_dir, content_selector=selector)


def _fetch(browser, config: CrawlConfig, batch: Batch) -> list[PageSection]:
    """Dispatch to the pipeline that matches the batch kind."""
    if batch.kind == "postman":
        return fetch_sections(browser, config)
    article = fetch_article(browser, config)
    return [article]


def _document_title(sections: list[PageSection], url: str) -> str:
    """Use the first section's title, else a readable fallback from the URL."""
    for section in sections:
        title = (section.get("title") or "").strip()
        if title and title != "Overview":
            return title
    return slugify(url).replace("_", " ").title()


def _filename(batch: Batch, index: int, url: str) -> str:
    """Build an ordered, URL-safe markdown file name for one batch entry."""
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    safe = _FILENAME_RE.sub("-", tail).strip("-") or slugify(url)
    return f"{index:02d}-{safe}.md"
