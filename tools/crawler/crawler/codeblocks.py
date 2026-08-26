"""Extract code blocks from cleaned HTML and restore them as fenced markdown.

``html2text`` has no native fenced-code support (it emits ``[code]`` markers).
To get clean ``` fences we pull every ``<pre>`` out of the fragment before
conversion, swap it for an opaque text token, then substitute real fenced
blocks back after ``html2text`` has done its job.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

TOKEN_PREFIX = "__CODE_BLOCK_"
LANG_RE = re.compile(r"language-([\w+-]+)", re.IGNORECASE)


def extract(soup: BeautifulSoup) -> dict[str, str]:
    """Replace ``<pre>`` elements with tokens and return token -> fenced text.

    Mutates ``soup`` in place. The returned mapping is later passed to
    :func:`restore`.
    """
    placeholders: dict[str, str] = {}

    for index, pre in enumerate(soup.select("pre")):
        token = f"{TOKEN_PREFIX}{index}__"
        placeholders[token] = _fenced_block(pre, token)
        pre.replace_with(token)

    return placeholders


def restore(markdown: str, placeholders: dict[str, str]) -> str:
    """Swap every token inside ``markdown`` back to its fenced block."""
    for token, fenced in placeholders.items():
        markdown = markdown.replace(token, fenced)
    return markdown


def _fenced_block(pre: Tag, token: str) -> str:
    """Build a fenced code block from a ``<pre>`` element."""
    del token  # the placeholder is replaced wholesale; no need to re-embed it
    language = _detect_language(pre)
    code = _extract_code_text(pre)
    # Blank lines around the fence guarantee clean paragraph breaks.
    return f"\n\n```{language}\n{code.strip()}\n```\n\n"


def _detect_language(pre: Tag) -> str:
    """Read the language from ``language-*`` classes on the pre or its code."""
    candidates: list[Tag] = [pre]
    candidates.extend(pre.find_all("code"))
    for element in candidates:
        classes = element.get("class") or []
        for cls in classes:
            match = LANG_RE.match(str(cls))
            if match:
                return match.group(1).lower()
    return ""


def _extract_code_text(pre: Tag) -> str:
    """Return the code's raw text with decorative whitespace preserved."""
    code = pre.find("code") or pre
    text = code.get_text()
    return text.replace("\xa0", " ")
