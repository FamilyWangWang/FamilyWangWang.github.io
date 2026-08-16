#!/usr/bin/env python3
"""Build the sanitized learnLanguage public site from the private Markdown source."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import pathlib
import re
import shutil
import subprocess
import unicodedata
from dataclasses import dataclass
from urllib.parse import unquote

import markdown


SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
ASSET_DIR = SCRIPT_DIR / "learn_language_assets"
TRACK_ORDER = ("de", "en", "de_vocab", "en_vocab")

TRACKS = {
    "de": {
        "code": "DE",
        "name": "德语口语实战",
        "target": "Deutsch im Alltag",
        "description": "从真实场景进入德语：日常对话、俚语边界与口语语法。",
        "kind": "场景口语",
    },
    "en": {
        "code": "EN",
        "name": "英语口语实战",
        "target": "English in Real Life",
        "description": "从教科书表达走向真实英语：场景、地区差异与自然口语。",
        "kind": "场景口语",
    },
    "de_vocab": {
        "code": "DE·W",
        "name": "德语主题词汇",
        "target": "Deutscher Wortschatz",
        "description": "按主题、级别与使用场景组织的系统德语词汇库。",
        "kind": "主题词汇",
    },
    "en_vocab": {
        "code": "EN·V",
        "name": "英语主题词汇",
        "target": "English Vocabulary",
        "description": "覆盖生活与抽象表达，区分美英差异、级别与使用边界。",
        "kind": "主题词汇",
    },
}

COMMON_GROUPS = {
    "00-guide": "入门指南",
    "01-social": "社交寒暄",
    "02-shopping": "购物消费",
    "03-dining": "餐饮饮食",
    "04-work": "工作职场",
    "05-publicService": "公共服务",
    "06-health": "医疗健康",
    "07-dailyLife": "日常生活",
    "08-socialLeisure": "社交休闲",
    "09-email": "邮件写作",
    "10-socialMedia": "社交媒体",
    "grammarInAction": "口语语法",
    "slang": "俚语专题",
}

VOCAB_GROUPS = {
    "00-guide": "使用指南",
    "01-body": "身体与动作",
    "02-emotion": "情绪与性格",
    "03-family": "家庭与关系",
    "04-appearance": "外貌与穿着",
    "05-housing": "住房与家务",
    "06-food": "食物与餐饮",
    "07-shopping": "购物与金融",
    "08-transport": "交通出行",
    "09-city": "城市与方向",
    "10-travel": "旅行与住宿",
    "11-work": "工作与组织",
    "12-education": "教育与研究",
    "13-health": "健康与医疗",
    "14-government": "政府与公共事务",
    "15-digital": "数字生活",
    "16-nature": "自然与环境",
    "17-sport": "运动与休闲",
    "18-time": "时间、数量与材料",
    "19-thinking": "思考与评价",
    "20-prefixes": "前缀动词",
    "20-phrasalVerbs": "短语动词",
    "21-funktionswoerter": "功能词",
    "21-functionWords": "功能词",
}

SANITIZE_REPLACEMENTS = (
    ("Minghua_Wang", "Li_Hua"),
    ("Minghua-Wang", "Li-Hua"),
    ("Minghua Wang", "Li Hua"),
    ("王明华", "李华"),
    ("Wei Zhang", "Alex Chen"),
    ("Wei Li", "Alex Chen"),
    ("张伟", "陈明"),
    ("W-E-I, L-I", "A-L-E-X, C-H-E-N"),
    ("W-E-I", "A-L-E-X"),
    ("Z-H-A-N-G", "C-H-E-N"),
    ("March 15th, 1975", "April 23rd, 1988"),
    ("March 15, 1975", "April 23, 1988"),
    ("15th of March, 1975", "23rd of April, 1988"),
    ("1975年3月15日", "1988年4月23日"),
    ("01.01.1975", "23.04.1988"),
    ("Musterstraße 12", "Beispielweg 1"),
    ("10115 Berlin", "00000 Musterstadt"),
    ("wang@example.de", "learner@example.org"),
    ("becker@beispiel.de", "becker@example.org"),
    ("cute_cat_2000@qq.com", "nickname@example.org"),
    ("schaden@allianz.de", "service@example.org"),
    ("yourname@gmail.com", "name@example.org"),
    ("yourname@outlook.com", "name@example.org"),
    ("Herr Wang", "Herr Lin"),
    ("Frau Wang", "Frau Lin"),
    ("王先生", "林先生"),
    ("王女士", "林女士"),
    ("你是一个50岁的、受过良好教育的中国男性。", "如果你是中文母语的成年学习者，"),
    ("作为一个50岁的中国男性", "作为中文母语的成年学习者"),
    ("作为50岁的中国男性", "作为中文母语的成年学习者"),
    ("作为约50岁的中国学习者", "作为中文母语的中年学习者"),
    ("50岁的中国男士", "中文母语的中年学习者"),
    ("50岁的中国大叔", "中文母语的中年学习者"),
    ("特别针对**50岁左右男性**学习者", "特别关注**中文母语的成年**学习者"),
    ("你大约50岁", "如果你是中年学习者"),
    ("作为50岁的学习者", "作为中年学习者"),
    ("作为一个50岁的学习者", "作为中年学习者"),
    ("DE12 3456 7890 1234 5678 90", "DE00 0000 0000 0000 0000 00"),
)

FORBIDDEN_PUBLIC = (
    re.compile(r"王明华|Minghua[_ -]?Wang", re.IGNORECASE),
    re.compile(r"Wei Zhang|Wei Li|张伟", re.IGNORECASE),
    re.compile(r"1975年3月15日|(?:March 15(?:th)?|15th of March)[, ]+1975|01\.01\.1975", re.IGNORECASE),
    re.compile(r"Herr Wang|Frau Wang|王先生|王女士", re.IGNORECASE),
    re.compile(r"你是一个50岁的、受过良好教育的中国男性"),
    re.compile(r"作为(?:一个)?50岁的中国男性"),
    re.compile(r"wang@example\.de|schaden@allianz\.de", re.IGNORECASE),
)

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})", re.IGNORECASE)
MD_LINK_RE = re.compile(r"(!?\[[^\]]*\]\()([^)]+)(\))")
REF_LINK_RE = re.compile(r"(?m)^(\[[^\]]+\]:\s+)(\S+)(.*)$")
HREF_RE = re.compile(r'href="([^"]+)"')
HEADING_RE = re.compile(r"(?m)^#\s+(.+?)\s*$")
TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class Document:
    track: str
    source_path: pathlib.Path
    source_relative: pathlib.PurePosixPath
    output_relative: pathlib.PurePosixPath
    title: str
    group_key: str
    group_title: str
    sanitized_markdown: str

    @property
    def url(self) -> str:
        return f"/learnLanguage/{self.track}/{self.output_relative.as_posix()}"


def git_value(repo: pathlib.Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def sanitize(text: str) -> str:
    for old, new in SANITIZE_REPLACEMENTS:
        text = text.replace(old, new)
    return text


def validate_public_text(text: str, label: str) -> None:
    for pattern in FORBIDDEN_PUBLIC:
        match = pattern.search(text)
        if match:
            raise SystemExit(f"public privacy check failed in {label}: {match.group(0)!r}")
    for match in EMAIL_RE.finditer(text):
        if match.group(1).lower() != "example.org":
            raise SystemExit(f"non-placeholder email remains in {label}: {match.group(0)}")
    for iban in re.findall(r"\bDE\d{2}(?:[ ]?[0-9]{4}){4}[ ]?[0-9]{2}\b", text):
        if not iban.startswith("DE00"):
            raise SystemExit(f"non-placeholder IBAN remains in {label}: {iban}")


def rewrite_target(target: str) -> str:
    stripped = target.strip()
    if stripped.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
        return target
    wrapped = stripped.startswith("<") and stripped.endswith(">")
    core = stripped[1:-1] if wrapped else stripped
    suffix = ""
    if " " in core and not wrapped:
        core, suffix = core.split(" ", 1)
        suffix = " " + suffix
    path_part, marker, anchor = core.partition("#")
    if re.search(r"(^|/)README\.md$", path_part, flags=re.IGNORECASE):
        path_part = re.sub(
            r"README\.md$", "index.html", path_part, flags=re.IGNORECASE
        )
    elif path_part.lower().endswith(".md"):
        path_part = path_part[:-3] + ".html"
    rewritten = path_part + (marker + anchor if marker else "") + suffix
    return f"<{rewritten}>" if wrapped else rewritten


def rewrite_markdown_links(text: str) -> str:
    def inline(match: re.Match[str]) -> str:
        return match.group(1) + rewrite_target(match.group(2)) + match.group(3)

    def reference(match: re.Match[str]) -> str:
        return match.group(1) + rewrite_target(match.group(2)) + match.group(3)

    return REF_LINK_RE.sub(reference, MD_LINK_RE.sub(inline, text))


def group_for(track: str, relative: pathlib.PurePosixPath) -> tuple[str, str]:
    parts = relative.parts
    if track in ("de", "en"):
        if parts[0] == "commonExpressions":
            key = "00-guide" if len(parts) == 2 else parts[1]
        else:
            key = parts[0]
        return key, COMMON_GROUPS.get(key, key)
    key = "00-guide" if len(parts) == 1 else parts[0]
    return key, VOCAB_GROUPS.get(key, key)


def discover(source: pathlib.Path) -> tuple[list[Document], list[str], list[str]]:
    documents: list[Document] = []
    included: list[str] = []
    excluded: list[str] = []
    for track in TRACK_ORDER:
        track_root = source / track
        if not track_root.is_dir():
            raise SystemExit(f"missing source track: {track_root}")
        for source_path in sorted(track_root.rglob("*.md")):
            rel = pathlib.PurePosixPath(source_path.relative_to(track_root).as_posix())
            repo_rel = f"{track}/{rel.as_posix()}"
            excluded_file = (
                rel.name in {"README.md", "PLAN.md"}
                or (track.endswith("_vocab") and rel.parts[0] == "index")
            )
            if excluded_file:
                excluded.append(repo_rel)
                continue
            text = source_path.read_text(encoding="utf-8")
            clean = rewrite_markdown_links(sanitize(text))
            validate_public_text(clean, repo_rel)
            heading = HEADING_RE.search(clean)
            if not heading:
                raise SystemExit(f"missing H1 in {repo_rel}")
            title = re.sub(r"[*_`]", "", heading.group(1)).strip()
            group_key, group_title = group_for(track, rel)
            output_rel = rel.with_suffix(".html")
            documents.append(
                Document(
                    track=track,
                    source_path=source_path,
                    source_relative=rel,
                    output_relative=output_rel,
                    title=title,
                    group_key=group_key,
                    group_title=group_title,
                    sanitized_markdown=clean,
                )
            )
            included.append(repo_rel)
    return documents, included, excluded


def validate_source_links(source: pathlib.Path) -> int:
    checked = 0
    missing: list[str] = []
    for path in source.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        targets = [m.group(2).strip() for m in MD_LINK_RE.finditer(text)]
        targets.extend(m.group(2).strip() for m in REF_LINK_RE.finditer(text))
        for target in targets:
            core = target.strip("<>").split(" ", 1)[0]
            if core.startswith(("http://", "https://", "mailto:", "#")):
                continue
            path_part = unquote(core.split("#", 1)[0])
            if not path_part:
                continue
            checked += 1
            if not (path.parent / path_part).resolve().exists():
                missing.append(f"{path.relative_to(source)} -> {target}")
    if missing:
        raise SystemExit("missing Markdown link targets:\n" + "\n".join(missing[:100]))
    return checked


def slugify(value: str, separator: str) -> str:
    value = unicodedata.normalize("NFKC", value).strip().lower()
    value = re.sub(r"[^\w\-\u3400-\u9fff]+", separator, value, flags=re.UNICODE)
    return value.strip(separator)


def normalize_markdown_blocks(text: str) -> str:
    """Accept the loose table/list spacing used by the source's GitHub Markdown."""
    lines = text.splitlines()
    normalized: list[str] = []
    list_item = re.compile(r"^(?:[-+*]|\d+\.)\s+")
    table_rule = re.compile(r"^\|?\s*:?-{3,}")
    for index, line in enumerate(lines):
        stripped = line.lstrip()
        previous = normalized[-1].lstrip() if normalized else ""
        next_line = lines[index + 1].lstrip() if index + 1 < len(lines) else ""
        starts_table = stripped.startswith("|") and table_rule.match(next_line)
        starts_list = bool(list_item.match(stripped))
        previous_is_list = bool(list_item.match(previous))
        if normalized and previous and (
            starts_table or (starts_list and not previous_is_list)
        ):
            normalized.append("")
        normalized.append(line)
    text = "\n".join(normalized)
    return re.sub(
        r"(?<!\\)_{3,}",
        lambda match: "\\_" * len(match.group(0)),
        text,
    )


def markdown_to_html(text: str) -> str:
    text = normalize_markdown_blocks(text)
    text = re.sub(
        r"<details(?![^>]*\bmarkdown=)([^>]*)>",
        r'<details markdown="1"\1>',
        text,
        flags=re.IGNORECASE,
    )
    rendered = markdown.markdown(
        text,
        extensions=["extra", "sane_lists", "toc"],
        extension_configs={"toc": {"slugify": slugify}},
        output_format="html5",
    )
    rendered = rendered.replace("<table>", '<div class="table-scroll"><table>')
    rendered = rendered.replace("</table>", "</table></div>")
    rendered = re.sub(
        r'<a href="(https?://[^"]+)"',
        r'<a href="\1" target="_blank" rel="noopener noreferrer"',
        rendered,
    )
    return rendered


def plain_text(markdown_text: str) -> str:
    text = re.sub(r"```.*?```", " ", markdown_text, flags=re.DOTALL)
    text = TAG_RE.sub(" ", text)
    text = re.sub(r"!?(?:\[([^\]]*)\])\([^)]+\)", r"\1", text)
    text = re.sub(r"[`*_>#|~\[\]{}]", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def page_shell(
    *,
    title: str,
    description: str,
    body: str,
    body_class: str,
    track: str | None = None,
    source_sha: str,
    source_date: str,
) -> str:
    track_attr = f' data-track="{track}"' if track else ""
    search_index = f'/learnLanguage/assets/search-{track}.json' if track else ""
    search_attr = f' data-search-index="{search_index}"' if search_index else ""
    return f'''<!doctype html>
<html lang="zh-Hans">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="{html.escape(description, quote=True)}">
  <link rel="icon" href="/favicon.svg">
  <link rel="stylesheet" href="/learnLanguage/assets/styles.css">
  <title>{html.escape(title)}</title>
</head>
<body class="{body_class}"{track_attr}{search_attr}>
  <a class="skip-link" href="#main">跳到正文</a>
  {body}
  <footer class="site-footer">
    <span>公开脱敏版 · Public learning edition</span>
    <span>自动生成 · Generated from sanitized Markdown</span>
  </footer>
  <script src="/learnLanguage/assets/app.js" defer></script>
</body>
</html>
'''


def track_groups(documents: list[Document]) -> list[tuple[str, str, list[Document]]]:
    grouped: dict[str, list[Document]] = {}
    titles: dict[str, str] = {}
    for doc in documents:
        grouped.setdefault(doc.group_key, []).append(doc)
        titles[doc.group_key] = doc.group_title
    return [(key, titles[key], grouped[key]) for key in grouped]


def search_markup(track: str) -> str:
    return f'''<div class="search" data-search>
      <label class="sr-only" for="search-{track}">搜索本栏目</label>
      <input id="search-{track}" type="search" placeholder="搜索词语、场景或文章…" autocomplete="off" data-search-input>
      <span class="search-key">⌘ K</span>
      <div class="search-results" data-search-results hidden></div>
    </div>'''


def render_root(documents: list[Document], source_sha: str, source_date: str) -> str:
    counts = {track: sum(1 for doc in documents if doc.track == track) for track in TRACK_ORDER}
    rows = []
    for number, track in enumerate(TRACK_ORDER, 1):
        info = TRACKS[track]
        rows.append(
            f'''<a class="track-row" href="./{track}/">
              <span class="track-number">{number:02d}</span>
              <span class="track-code">{info['code']}</span>
              <span class="track-name"><strong>{info['name']}</strong><small>{info['target']}</small></span>
              <span class="track-kind">{info['kind']} · {counts[track]} 篇</span>
              <b aria-hidden="true">↗</b>
            </a>'''
        )
    body = f'''<header class="root-nav shell">
      <a href="../">← DOCUMENT CENTER</a><span>learnLanguage</span>
    </header>
    <main id="main">
      <section class="root-hero shell">
        <div class="root-kicker">03 · PUBLIC LANGUAGE ARCHIVE</div>
        <h1>learn<br><em>Language</em></h1>
        <p>从真实场景到系统词汇。选择语言，再选择今天要解决的问题。</p>
        <div class="language-mark" aria-hidden="true"><span>DE</span><i>EN</i><b>中</b></div>
      </section>
      <section class="track-section shell" aria-labelledby="tracks-title">
        <div class="section-intro"><span>01 · 学习路径</span><h2 id="tracks-title">四个入口，一套方法</h2><p>场景教程强调自然表达和使用边界；主题词汇强调级别、辨义、复现与自测。</p></div>
        <div class="track-list">{''.join(rows)}</div>
      </section>
      <section class="root-note shell">
        <span>02 · 阅读说明</span>
        <h2>语言可以练习，现实规则需要复核</h2>
        <div><p>医疗、法律、税务、移民和平台规则只作为语言场景，不构成专业建议。</p><p>带有年份的内容是资料快照；实际办理事务前，请核对当前官方信息。</p></div>
      </section>
    </main>'''
    return page_shell(
        title="learnLanguage · 语言学习档案",
        description="面向中文母语成年学习者的德语与英语场景教程和主题词汇库。",
        body=body,
        body_class="root-page",
        source_sha=source_sha,
        source_date=source_date,
    )


def render_track_landing(track: str, documents: list[Document], source_sha: str, source_date: str) -> str:
    info = TRACKS[track]
    groups = track_groups(documents)
    group_html = []
    for index, (_, title, docs) in enumerate(groups, 1):
        links = "".join(
            f'<li><a href="./{doc.output_relative.as_posix()}"><span>{html.escape(doc.title)}</span><b>↗</b></a></li>'
            for doc in docs
        )
        group_html.append(
            f'''<details class="catalog-group" open>
              <summary><span>{index:02d}</span><h3>{html.escape(title)}</h3><small>{len(docs)} 篇</small></summary>
              <ol>{links}</ol>
            </details>'''
        )
    body = f'''<header class="reader-top shell">
      <a href="../">← learnLanguage</a>
      <span>{html.escape(info['name'])}</span>
      {search_markup(track)}
    </header>
    <main id="main">
      <section class="track-hero shell">
        <p class="track-kicker">{html.escape(info['kind'])} · {len(documents)} 篇</p>
        <h1>{html.escape(info['name'])}</h1>
        <div class="track-lede"><strong>{html.escape(info['target'])}</strong><p>{html.escape(info['description'])}</p></div>
        <span class="track-watermark" aria-hidden="true">{html.escape(info['code'])}</span>
      </section>
      <section class="catalog shell" aria-labelledby="catalog-title">
        <div class="catalog-intro"><span>目录</span><h2 id="catalog-title">按主题开始</h2><p>每篇内容都保留原有练习、表格与交叉链接。</p></div>
        <div class="catalog-groups">{''.join(group_html)}</div>
      </section>
    </main>'''
    return page_shell(
        title=f"{info['name']} · learnLanguage",
        description=info["description"],
        body=body,
        body_class="track-page",
        track=track,
        source_sha=source_sha,
        source_date=source_date,
    )


def risk_notice(doc: Document) -> str:
    path = doc.source_relative.as_posix().lower()
    high_risk = any(
        marker in path
        for marker in (
            "05-publicservice",
            "06-health",
            "13-health",
            "14-government",
            "bank",
            "versicherung",
            "insurance",
            "immigration",
            "naturalization",
            "tax",
            "steuern",
            "law",
            "recht",
        )
    )
    if not high_risk:
        return ""
    return '''<aside class="risk-note"><strong>语言场景提示</strong><p>本页用于学习表达，不构成医疗、法律、金融或行政建议。规则与流程可能变化，请以当前官方信息为准。</p></aside>'''


def render_article(
    doc: Document,
    track_docs: list[Document],
    source_sha: str,
    source_date: str,
) -> str:
    info = TRACKS[doc.track]
    position = track_docs.index(doc)
    previous = track_docs[position - 1] if position else None
    following = track_docs[position + 1] if position + 1 < len(track_docs) else None
    group_docs = [item for item in track_docs if item.group_key == doc.group_key]
    sidebar_links = "".join(
        f'<a href="{item.url}" class="{"current" if item is doc else ""}">{html.escape(item.title)}</a>'
        for item in group_docs
    )
    previous_link = (
        f'<a rel="prev" href="{previous.url}"><small>上一篇</small><span>{html.escape(previous.title)}</span></a>'
        if previous
        else '<span></span>'
    )
    next_link = (
        f'<a rel="next" href="{following.url}"><small>下一篇</small><span>{html.escape(following.title)}</span></a>'
        if following
        else '<span></span>'
    )
    body_html = markdown_to_html(doc.sanitized_markdown)
    body = f'''<header class="reader-top shell">
      <a href="/learnLanguage/{doc.track}/">← {html.escape(info['name'])}</a>
      <span>{html.escape(doc.group_title)}</span>
      {search_markup(doc.track)}
      <button class="menu-button" type="button" data-menu-button aria-expanded="false">目录</button>
    </header>
    <div class="reader-layout shell">
      <aside class="reader-sidebar" data-sidebar>
        <a class="sidebar-home" href="/learnLanguage/{doc.track}/">全部目录</a>
        <p>{html.escape(doc.group_title)} · {len(group_docs)} 篇</p>
        <nav aria-label="本组文章">{sidebar_links}</nav>
      </aside>
      <main id="main" class="reader-main">
        <div class="breadcrumbs"><a href="/learnLanguage/">learnLanguage</a><span>/</span><a href="/learnLanguage/{doc.track}/">{html.escape(info['code'])}</a><span>/</span><span>{html.escape(doc.group_title)}</span></div>
        {risk_notice(doc)}
        <article class="prose">{body_html}</article>
        <nav class="article-pager" aria-label="前后文章">{previous_link}{next_link}</nav>
      </main>
    </div>'''
    return page_shell(
        title=f"{doc.title} · {info['name']}",
        description=f"{info['name']}：{doc.title}",
        body=body,
        body_class="reader-page",
        track=doc.track,
        source_sha=source_sha,
        source_date=source_date,
    )


def validate_output(output: pathlib.Path) -> int:
    checked = 0
    missing: list[str] = []
    for page in output.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        validate_public_text(text, page.relative_to(output).as_posix())
        for href in HREF_RE.findall(text):
            core = href.split("#", 1)[0].split("?", 1)[0]
            if not core or core.startswith(("http://", "https://", "mailto:", "javascript:")):
                continue
            checked += 1
            if core.startswith("/learnLanguage/"):
                relative = unquote(core.removeprefix("/learnLanguage/"))
                target = output / relative
            elif core == "/learnLanguage/":
                target = output / "index.html"
            elif core.startswith("/"):
                continue
            else:
                target = page.parent / unquote(core)
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                missing.append(f"{page.relative_to(output)} -> {href}")
    if missing:
        raise SystemExit("missing generated link targets:\n" + "\n".join(missing[:100]))
    return checked


def safe_prepare_output(output: pathlib.Path) -> None:
    resolved = output.resolve()
    if resolved.name != "learnLanguage":
        raise SystemExit(f"refusing to replace unexpected output directory: {resolved}")
    if resolved.parent == resolved or len(resolved.parts) < 3:
        raise SystemExit(f"unsafe output directory: {resolved}")
    if resolved.exists():
        shutil.rmtree(resolved)
    resolved.mkdir(parents=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    if not (source / ".git").exists():
        raise SystemExit(f"source is not a Git checkout: {source}")
    if output == source or source in output.parents:
        raise SystemExit("output must not be inside the private source repository")
    for required in (ASSET_DIR / "styles.css", ASSET_DIR / "app.js"):
        if not required.exists():
            raise SystemExit(f"missing build asset: {required}")

    content_paths = ("de", "en", "de_vocab", "en_vocab")
    source_sha = git_value(source, "log", "-1", "--format=%H", "--", *content_paths)
    source_date = git_value(source, "log", "-1", "--format=%cI", "--", *content_paths)
    markdown_count = len(list(source.rglob("*.md")))
    source_links = validate_source_links(source)
    documents, included, excluded = discover(source)
    if markdown_count != len(included) + len(excluded):
        raise SystemExit("content inventory mismatch")

    safe_prepare_output(output)
    assets = output / "assets"
    assets.mkdir()
    shutil.copy2(ASSET_DIR / "styles.css", assets / "styles.css")
    shutil.copy2(ASSET_DIR / "app.js", assets / "app.js")

    (output / "index.html").write_text(
        render_root(documents, source_sha, source_date), encoding="utf-8", newline="\n"
    )
    for track in TRACK_ORDER:
        track_docs = [doc for doc in documents if doc.track == track]
        track_output = output / track
        track_output.mkdir(parents=True, exist_ok=True)
        (track_output / "index.html").write_text(
            render_track_landing(track, track_docs, source_sha, source_date),
            encoding="utf-8",
            newline="\n",
        )
        search_rows = []
        for doc in track_docs:
            destination = track_output / pathlib.Path(doc.output_relative.as_posix())
            destination.parent.mkdir(parents=True, exist_ok=True)
            rendered = render_article(doc, track_docs, source_sha, source_date)
            destination.write_text(rendered, encoding="utf-8", newline="\n")
            search_rows.append(
                {
                    "url": doc.url,
                    "title": doc.title,
                    "group": doc.group_title,
                    "text": plain_text(doc.sanitized_markdown),
                }
            )
        (assets / f"search-{track}.json").write_text(
            json.dumps(search_rows, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
            newline="\n",
        )

    manifest = {
        "project": "learnLanguage",
        "source_repository": "private Markdown source",
        "source_commit": source_sha,
        "source_commit_date": source_date,
        "generated_at": source_date,
        "source_markdown": markdown_count,
        "published_documents": len(documents),
        "source_links_checked": source_links,
        "tracks": {
            track: sum(1 for doc in documents if doc.track == track) for track in TRACK_ORDER
        },
        "included": included,
        "excluded": excluded,
        "build_fingerprint": hashlib.sha256("\n".join(included).encode()).hexdigest(),
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    generated_links = validate_output(output)
    print(
        f"built {len(documents)} pages from {markdown_count} Markdown files; "
        f"checked {source_links} source links and {generated_links} generated links"
    )


if __name__ == "__main__":
    main()
