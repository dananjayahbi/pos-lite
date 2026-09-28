"""Render crawled HTML fragments to markdown and persist them.

Shared by the single-page pipeline (``runner.crawl_page``), the single-article
pipeline (``runner.crawl_article``) and the batch pipeline
(``batch.crawl_batch``) so every output is cleaned, converted and written the
same way.
"""

from __future__ import annotations

import re
from pathlib import Path

from .cleaner import clean_fragment
from .codeblocks import restore
from .config import CrawlConfig
from .converter import html_to_markdown

# Fields of a crawled page: ``{"title": str, "html": str}``.
PageSection = dict[str, str]


def render_section(section: PageSection, config: CrawlConfig) -> str:
    """Clean and convert one section's HTML to markdown (sans heading)."""
    body, placeholders = clean_fragment(section["html"], config)
    markdown = html_to_markdown(body, config)
    return restore(markdown, placeholders)


def render_document(title: str, sections: list[PageSection], config: CrawlConfig) -> str:
    """Render a full markdown document from one or more sections.

    ``sections`` is rendered in order. Section titles become ``##`` headings
    unless the section is the document's leading body (title ``""`` or the
    document title itself), which is rendered without a duplicate heading.
    """
    parts: list[str] = []
    for section in sections:
        markdown = render_section(section, config)
        if not markdown:
            continue
        heading = section["title"]
        if heading and heading != title:
            parts.append(f"## {heading}\n\n{markdown}")
        else:
            parts.append(markdown)

    if not parts:
        return f"# {title}\n"

    return f"# {title}\n\n" + "\n\n---\n\n".join(parts) + "\n"


def write_markdown(
    markdown: str,
    config: CrawlConfig,
    slug: str | None = None,
    filename: str | None = None,
) -> Path:
    """Persist ``markdown`` under ``config.output_dir``.

    The file name is ``filename`` when given, otherwise the slug of ``slug``
    (falling back to ``config.url``). Non-ASCII transliterations are the
    caller's responsibility for ``filename``; slugs are always safe.
    """
    out_dir = Path(config.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    name = filename or f"{slugify(slug or config.url)}.md"
    path = out_dir / name
    path.write_text(markdown, encoding="utf-8")
    return path


def slugify(url: str) -> str:
    """Derive a filesystem-safe base name from a URL or identifier."""
    tail = url.rstrip("/").rsplit("/", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9]+", "_", tail).strip("_")
    return name or "page"
