#!/usr/bin/env python3
"""Builds index.html from src/ by inlining src/bookmarklet.js into src/index.src.html.
index.html is what GitHub Pages serves. CI checks that it matches the source exactly."""
from pathlib import Path

root = Path(__file__).parent
bm = (root / "src" / "bookmarklet.js").read_text(encoding="utf-8")
assert "</script" not in bm.lower()
page = (root / "src" / "index.src.html").read_text(encoding="utf-8")
(root / "index.html").write_text(page.replace("/*__BOOKMARKLET__*/", bm), encoding="utf-8")
print("Built index.html")
