#!/usr/bin/env python3
"""Build the controlled public edition of the private mathSystem site."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse


SAFE_SUFFIXES = {
    ".html", ".css", ".js", ".svg", ".png", ".jpg", ".jpeg",
    ".webp", ".woff", ".woff2",
}
TEXT_SUFFIXES = {".html", ".css", ".js", ".svg"}
EXPECTED_DOWNLOADS = {
    "downloads/math-atlas-a2-zh.pdf",
    "downloads/math-atlas-a2-de.pdf",
}
LOCAL_PATH_RE = re.compile(
    r"(?:file:///|[A-Za-z]:[\\/](?:Users|workspace|An|wangFamily)[\\/])",
    re.IGNORECASE,
)
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
EXTERNAL_REF_RE = re.compile(r"(?:href|src)=[\"']https?://", re.IGNORECASE)
NETWORK_CODE_RE = re.compile(
    r"\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(|"
    r"\beval\s*\(|\bnew\s+Function\s*\(|\bdocument\.write\s*\(",
    re.IGNORECASE,
)
IDENTITY_DENYLIST = (
    re.compile(r"王明华|Minghua[_ -]?Wang|Herr Wang|Frau Wang", re.IGNORECASE),
    re.compile(r"FamilyWangWang|qwang|fanghe1979", re.IGNORECASE),
)
REF_RE = re.compile(r"(?:href|src)=[\"']([^\"']+)[\"']", re.IGNORECASE)
ID_RE = re.compile(r"\bid=[\"']([^\"']+)[\"']", re.IGNORECASE)


PUBLIC_CSS = r"""

/* Public documentation hub additions. Source content remains unchanged. */
.page-frame{width:min(100% - 2.5rem,760px);margin-inline:auto}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
nav.toc{overflow:visible;margin-bottom:3rem;padding:0}
nav.toc .toc-primary{position:relative;display:flex;align-items:center;gap:.65rem;min-height:52px;font-family:var(--f-mono);font-size:11.5px;letter-spacing:.06em}
nav.toc .toc-hub,nav.toc .toc-root{flex:none;color:var(--ink-2);font-weight:500}
nav.toc .toc-hub{color:var(--mark);font-weight:600}
nav.toc .toc-separator{color:var(--rule)}
nav.toc .toc-current{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
nav.toc .toc-actions{display:flex;align-items:center;gap:.55rem;margin-left:auto;flex:none}
nav.toc .toc-menu summary,nav.toc .toc-language{display:inline-flex;align-items:center;min-height:30px;box-sizing:border-box;border:1px solid var(--rule);border-radius:3px;background:var(--paper);padding:.28rem .65rem;color:var(--ink);font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;text-decoration:none;cursor:pointer}
nav.toc .toc-menu summary{list-style:none}
nav.toc .toc-menu summary::-webkit-details-marker{display:none}
nav.toc .toc-menu summary::after{content:"+";margin-left:.5rem;color:var(--mark)}
nav.toc .toc-menu[open] summary{border-color:var(--mark);color:var(--mark)}
nav.toc .toc-menu[open] summary::after{content:"−"}
nav.toc .toc-language{color:var(--mark);border-color:var(--mark)}
nav.toc .toc-panel{position:absolute;top:calc(100% + 1px);right:0;z-index:30;width:min(720px,calc(100vw - 2rem));box-sizing:border-box;border:1px solid var(--rule);border-top:2px solid var(--mark);background:var(--paper);padding:.8rem;box-shadow:0 14px 34px rgba(20,28,35,.12)}
nav.toc .toc-panel ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.2rem .8rem;margin:0;padding:0;white-space:normal}
nav.toc .toc-panel li{min-width:0}
nav.toc .toc-panel a{display:block;border:0;padding:.48rem .55rem;line-height:1.45}
nav.toc .toc-panel a:hover{background:var(--surface);border:0}
nav.toc .toc-panel a[aria-current="page"]{background:var(--mark-bg);color:var(--mark);font-weight:600}
.public-download{width:min(100% - 2.5rem,1500px);margin:0 auto 2rem;padding:1rem 1.2rem;border:1px solid var(--el1-line);border-radius:4px;background:var(--el1-bg);color:var(--el1);font-size:.93rem}
.public-download a{color:inherit;font-weight:600}
@media (max-width:640px){
  nav.toc .page-frame{width:100%;box-sizing:border-box;padding:0 1rem}
  nav.toc .toc-primary{gap:.5rem;min-height:48px}
  nav.toc .toc-root,nav.toc .toc-separator{display:none}
  nav.toc .toc-current{font-size:11px}
  nav.toc .toc-menu summary,nav.toc .toc-language{min-height:29px;padding:.25rem .5rem}
  nav.toc .toc-panel{width:calc(100vw - 2rem)}
  nav.toc .toc-panel ul{grid-template-columns:1fr;max-height:min(68vh,540px);overflow-y:auto}
}
@media print{.public-download{display:none!important}}
"""


def git_value(source: pathlib.Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(source), *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def safe_source_files(source: pathlib.Path) -> list[pathlib.Path]:
    files = []
    for path in source.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SAFE_SUFFIXES:
            continue
        relative = path.relative_to(source)
        if any(part.startswith(".") for part in relative.parts):
            continue
        files.append(path)
    return sorted(files, key=lambda item: item.relative_to(source).as_posix())


def scan_public_safety(source: pathlib.Path, files: list[pathlib.Path]) -> None:
    problems: list[str] = []
    for path in files:
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        relative = path.relative_to(source).as_posix()
        text = path.read_text(encoding="utf-8")
        if LOCAL_PATH_RE.search(text):
            problems.append(f"local path in {relative}")
        if EXTERNAL_REF_RE.search(text):
            problems.append(f"external asset or link in {relative}")
        for pattern in IDENTITY_DENYLIST:
            if pattern.search(text):
                problems.append(f"identity denylist match in {relative}")
        for email_match in EMAIL_RE.finditer(text):
            if not email_match.group(0).lower().endswith("@example.org"):
                problems.append(f"email address in {relative}")
        if path.suffix.lower() == ".js" and NETWORK_CODE_RE.search(text):
            problems.append(f"network or dynamic-code API in {relative}")
    if problems:
        raise RuntimeError("public safety scan failed:\n- " + "\n- ".join(problems))


def collect_ids(path: pathlib.Path) -> set[str]:
    if path.suffix.lower() != ".html":
        return set()
    return {html.unescape(value) for value in ID_RE.findall(path.read_text(encoding="utf-8"))}


def validate_references(root: pathlib.Path, allow_expected_downloads: bool) -> int:
    checked = 0
    problems: list[str] = []
    for path in root.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        for raw_ref in REF_RE.findall(text):
            ref = html.unescape(raw_ref)
            if ref.startswith(("http://", "https://", "mailto:", "tel:", "data:", "javascript:")):
                continue
            checked += 1
            path_part, _, fragment = ref.partition("#")
            if path_part.startswith("/"):
                # The hub link and root favicon are intentionally outside this project directory.
                continue
            target = path if not path_part else (path.parent / urllib.parse.unquote(path_part)).resolve()
            try:
                relative_target = target.relative_to(root.resolve()).as_posix()
            except ValueError:
                problems.append(f"reference escapes public directory: {path.relative_to(root)} -> {ref}")
                continue
            if not target.exists():
                if allow_expected_downloads and relative_target in EXPECTED_DOWNLOADS:
                    continue
                problems.append(f"missing file: {path.relative_to(root)} -> {ref}")
                continue
            if fragment and target.suffix.lower() == ".html":
                decoded_fragment = urllib.parse.unquote(fragment)
                if decoded_fragment not in collect_ids(target):
                    problems.append(f"missing anchor: {path.relative_to(root)} -> {ref}")
    if problems:
        raise RuntimeError("reference validation failed:\n- " + "\n- ".join(problems))
    return checked


def content_digest(source: pathlib.Path, files: list[pathlib.Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(source).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        data = path.read_bytes()
        if path.suffix.lower() in TEXT_SUFFIXES:
            # Git may check the same text out with CRLF on Windows and LF on Linux.
            # Hash a canonical representation so identical source stays idempotent.
            data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return digest.hexdigest()


def canonical_for(relative: pathlib.PurePosixPath) -> str:
    if relative.name == "index.html":
        suffix = "/".join(relative.parts[:-1])
        return "https://familywangwang.github.io/mathSystem/" + (suffix + "/" if suffix else "")
    return "https://familywangwang.github.io/mathSystem/" + relative.as_posix()


def replace_semantic_wrapper(text: str, tag: str) -> str:
    pattern = re.compile(
        rf"(<{tag}\b[^>]*>\s*)<main(\b[^>]*)>(.*?)(</main>\s*</{tag}>)",
        re.IGNORECASE | re.DOTALL,
    )

    def replacement(match: re.Match[str]) -> str:
        closing = re.sub(r"^</main>", "</div>", match.group(4), flags=re.IGNORECASE)
        attributes = match.group(2)
        if "class=" in attributes:
            attributes = re.sub(
                r"class=([\"'])(.*?)\1",
                lambda item: f'class={item.group(1)}page-frame {item.group(2)}{item.group(1)}',
                attributes,
                count=1,
                flags=re.IGNORECASE,
            )
        else:
            attributes += ' class="page-frame"'
        return f"{match.group(1)}<div{attributes}>{match.group(3)}{closing}"

    return pattern.sub(replacement, text)


def compact_public_navigation(text: str, language: str) -> str:
    pattern = re.compile(
        r"<nav\b[^>]*class=[\"'][^\"']*\btoc\b[^\"']*[\"'][^>]*>\s*"
        r"<div\b[^>]*class=[\"'][^\"']*\bpage-frame\b[^\"']*[\"'][^>]*>\s*"
        r"<ul[^>]*>(.*?)</ul>\s*</div>\s*</nav>",
        re.IGNORECASE | re.DOTALL,
    )

    def replacement(match: re.Match[str]) -> str:
        items = match.group(1)
        current_match = re.search(
            r"<a\b[^>]*aria-current=[\"']page[\"'][^>]*>(.*?)</a>",
            items,
            re.IGNORECASE | re.DOTALL,
        )
        language_match = re.search(
            r"<li\b[^>]*class=[\"'][^\"']*\blang\b[^\"']*[\"'][^>]*>\s*"
            r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>\s*</li>",
            items,
            re.IGNORECASE | re.DOTALL,
        )
        if not current_match or not language_match:
            raise RuntimeError("navigation is missing its current-page or language link")

        current = html.unescape(re.sub(r"<[^>]+>", "", current_match.group(1))).strip()
        language_href = language_match.group(1)
        language_label = html.unescape(re.sub(r"<[^>]+>", "", language_match.group(2))).strip()
        menu_items = items[:language_match.start()] + items[language_match.end():]
        menu_items = re.sub(r"^[ \t]+$", "", menu_items, flags=re.MULTILINE).strip()
        labels = {
            "hub": "Dokumentzentrum" if language == "de" else "文档中心",
            "root": "Mathematikatlas" if language == "de" else "数学版图",
            "menu": "Inhalt" if language == "de" else "目录",
            "nav": "Seitennavigation" if language == "de" else "站点导航",
            "contents": "Atlas-Inhalt" if language == "de" else "数学版图目录",
        }
        return f'''<nav class="toc" aria-label="{labels["nav"]}">
  <div class="page-frame">
    <div class="toc-primary">
      <a class="toc-hub" href="/">← {labels["hub"]}</a>
      <span class="toc-separator" aria-hidden="true">/</span>
      <a class="toc-root" href="index.html">{labels["root"]}</a>
      <span class="toc-separator" aria-hidden="true">/</span>
      <span class="toc-current">{html.escape(current)}</span>
      <div class="toc-actions">
        <details class="toc-menu">
          <summary>{labels["menu"]}</summary>
          <div class="toc-panel" aria-label="{labels["contents"]}">
            <ul>
{menu_items}
            </ul>
          </div>
        </details>
        <a class="toc-language" href="{html.escape(language_href, quote=True)}">{html.escape(language_label)}</a>
      </div>
    </div>
  </div>
</nav>'''

    updated, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError("could not replace the source navigation")
    return updated


def inject_head(text: str, relative: pathlib.PurePosixPath, language: str) -> str:
    title_match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
    title = html.unescape(re.sub(r"<[^>]+>", "", title_match.group(1))).strip() if title_match else "数学版图"
    description = (
        "Ein interaktiver zweisprachiger Atlas der Mathematik mit Lernlabor, Fortschritt und A2-Wandposter."
        if language == "de"
        else "按数学方向组织的中德双语知识图谱，包含互动实验、学习进度和 A2 挂墙版。"
    )
    canonical = canonical_for(relative)
    metadata = f"""
<meta name="description" content="{html.escape(description, quote=True)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="canonical" href="{canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="{html.escape(title, quote=True)}">
<meta property="og:description" content="{html.escape(description, quote=True)}">
<meta property="og:url" content="{canonical}">
"""
    return re.sub(r"</head>", metadata + "</head>", text, count=1, flags=re.IGNORECASE)


def publicize_html(text: str, relative: pathlib.PurePosixPath) -> str:
    language = "de" if relative.parts and relative.parts[0] == "de" else "zh"
    text = inject_head(text, relative, language)
    for tag in ("header", "nav", "footer"):
        text = replace_semantic_wrapper(text, tag)
    text = compact_public_navigation(text, language)
    if not re.search(r"<h1\b", text, re.IGNORECASE):
        title_match = re.search(r"<title>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
        title = html.unescape(title_match.group(1)).split(" · ", 1)[0] if title_match else "数学版图"
        text = re.sub(
            r"(<main\b[^>]*>)",
            lambda match: match.group(1) + f'\n<h1 class="sr-only">{html.escape(title)}</h1>',
            text,
            count=1,
            flags=re.IGNORECASE,
        )
    if relative.as_posix() == "poster.html":
        download = (
            '<p class="public-download"><strong>A2 单页下载：</strong> '
            '<a href="downloads/math-atlas-a2-zh.pdf">中文版 PDF</a> · '
            '<a href="downloads/math-atlas-a2-de.pdf">Deutsch PDF</a></p>'
        )
        text = re.sub(r"(<div class=\"hint\">.*?</div>)", r"\1\n" + download, text, count=1, flags=re.DOTALL)
    elif relative.as_posix() == "de/poster.html":
        download = (
            '<p class="public-download"><strong>A2-Einzelseite:</strong> '
            '<a href="../downloads/math-atlas-a2-de.pdf">Deutsches PDF</a> · '
            '<a href="../downloads/math-atlas-a2-zh.pdf">中文版 PDF</a></p>'
        )
        text = re.sub(r"(<div class=\"hint\">.*?</div>)", r"\1\n" + download, text, count=1, flags=re.DOTALL)
    return text


def validate_required_structure(root: pathlib.Path, require_downloads: bool) -> int:
    required = [
        "index.html", "de/index.html", "lab.html", "de/labor.html",
        "progress.html", "de/fortschritt.html", "poster.html", "de/poster.html",
        "assets/atlas.css", "assets/lab.js", "assets/progress-data.js", "assets/progress.js",
    ]
    if require_downloads:
        required.extend(sorted(EXPECTED_DOWNLOADS))
        required.append("downloads/manifest.json")
    missing = [item for item in required if not (root / item).is_file()]
    if missing:
        raise RuntimeError("missing required public files: " + ", ".join(missing))

    html_files = list(root.rglob("*.html"))
    if len(html_files) != 28:
        raise RuntimeError(f"expected 28 HTML pages, found {len(html_files)}")
    data = (root / "assets/progress-data.js").read_text(encoding="utf-8")
    if len(re.findall(r"\bid\s*:\s*['\"]s\d+['\"]", data)) != 8:
        raise RuntimeError("progress data must define exactly eight strands")
    return validate_references(root, allow_expected_downloads=not require_downloads)


def build(source: pathlib.Path, output: pathlib.Path) -> None:
    source = source.resolve()
    output = output.resolve()
    if output.name != "mathSystem":
        raise RuntimeError("refusing to replace an output directory not named mathSystem")
    if source == output or output.is_relative_to(source):
        raise RuntimeError("output must not be inside the private source repository")
    if not (source / "index.html").is_file() or not (source / "de/index.html").is_file():
        raise RuntimeError("source does not contain both Chinese and German entry pages")

    files = safe_source_files(source)
    scan_public_safety(source, files)
    validate_references(source, allow_expected_downloads=False)
    digest = content_digest(source, files)
    source_commit = git_value(
        source, "log", "-1", "--format=%H", "--", "*.html", "de/**", "assets/**"
    )
    source_date = git_value(
        source, "log", "-1", "--format=%cI", "--", "*.html", "de/**", "assets/**"
    )

    staging = output.parent / ".mathSystem-build"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    if (output / "downloads").is_dir():
        shutil.copytree(output / "downloads", staging / "downloads")

    for source_path in files:
        relative = source_path.relative_to(source)
        target = staging / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source_path.suffix.lower() == ".html":
            transformed = publicize_html(
                source_path.read_text(encoding="utf-8"),
                pathlib.PurePosixPath(relative.as_posix()),
            )
            target.write_text(transformed, encoding="utf-8", newline="\n")
        elif source_path.suffix.lower() == ".css" and relative.as_posix() == "assets/atlas.css":
            css = source_path.read_text(encoding="utf-8").rstrip() + PUBLIC_CSS
            target.write_text(css, encoding="utf-8", newline="\n")
        else:
            shutil.copy2(source_path, target)

    manifest = {
        "project": "mathSystem",
        "source_repository": "private static source",
        "source_content_sha256": digest,
        "source_commit": source_commit,
        "source_commit_date": source_date,
        "generated_at": source_date,
        "published_source_files": len(files),
        "published_html_pages": sum(1 for item in files if item.suffix.lower() == ".html"),
        "interactive_labs": 7,
        "progress_items": 114,
        "languages": ["zh-Hans", "de"],
    }
    (staging / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    checked = validate_required_structure(staging, require_downloads=False)
    if output.exists():
        shutil.rmtree(output)
    staging.rename(output)
    print(
        f"built {manifest['published_html_pages']} pages from {len(files)} safe source files; "
        f"checked {checked} references"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    try:
        if args.validate_only:
            checked = validate_required_structure(args.output.resolve(), require_downloads=True)
            print(f"validated complete public mathSystem site; checked {checked} references")
        else:
            if args.source is None:
                parser.error("--source is required unless --validate-only is used")
            build(args.source, args.output)
    except (RuntimeError, subprocess.CalledProcessError, UnicodeDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
