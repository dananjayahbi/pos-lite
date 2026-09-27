"""Crawl the PayHere support documentation into ``REFERENCES/payhere/scrapes``.

Usage (from the repository root):

    tools/crawler/.venv/Scripts/python.exe tools/crawler/scrape_payhere.py

The default output directory is resolved relative to this file, so the command
works from any working directory. One browser session serves every page.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow ``python tools/crawler/scrape_payhere.py`` (script dir on sys.path).
sys.path.insert(0, str(Path(__file__).resolve().parent))

from crawler.batch import crawl_batches  # noqa: E402
from crawler.config import CrawlConfig  # noqa: E402
from crawler.payhere import payhere_batches  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = REPO_ROOT / "REFERENCES" / "payhere" / "scrapes"


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    output_dir = Path(argv[0]) if argv else DEFAULT_OUTPUT_DIR

    config = CrawlConfig(output_dir=str(output_dir), headless=True, wait_ms=2500)
    reports = crawl_batches(payhere_batches(), config)

    total = sum(len(r.results) for r in reports)
    failures = [r for report in reports for r in report.failures]
    print(f"\n[crawler] {total - len(failures)}/{total} pages written to {output_dir}")
    for failure in failures:
        print(f"[crawler] FAILED {failure.url}: {failure.error}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
