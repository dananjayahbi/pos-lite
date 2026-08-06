"""Command-line entry point for the crawler."""

from __future__ import annotations

import argparse
import sys

from tools.crawler.crawler.config import CrawlConfig
from tools.crawler.crawler.runner import crawl_page


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Crawl a JavaScript-rendered public web page and export it as markdown.",
    )
    parser.add_argument("--url", default=None, help="Target page URL (overrides config).")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to write the markdown file into.",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Run chromium with a visible window (debugging).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    overrides = {
        "url": args.url,
        "output_dir": args.output_dir,
        "headless": not args.headful,
    }
    config = CrawlConfig(
        **{k: v for k, v in overrides.items() if v is not None},
    )

    path = crawl_page(config)
    print(f"[crawler] markdown written to: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
