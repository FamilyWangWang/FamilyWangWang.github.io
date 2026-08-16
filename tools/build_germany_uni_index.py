#!/usr/bin/env python3
"""Build the public germanyUniResearch index from the sanitized reader TOC."""

from __future__ import annotations

import html
import pathlib
import re
from string import Template


ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECT = ROOT / "germanyUniResearch"
READER = PROJECT / "reader.html"
OUTPUT = PROJECT / "index.html"

TOC_RE = re.compile(r'<nav id="toc">(.*?)<div id="hits"', re.DOTALL)
LANG_RE = re.compile(r'<div data-lang="(zh|de)">(.*?)</div>', re.DOTALL)
TOKEN_RE = re.compile(
    r"<h4>(.*?)</h4>|<a\s+href=\"#([^\"]+)\"[^>]*>(.*?)</a>", re.DOTALL
)
TAG_RE = re.compile(r"<[^>]+>")
PUBLIC_NAV_STYLE = """
.public-index-link{padding-right:.65rem;border-right:1px solid var(--line);color:var(--muted);font-size:.7rem;font-weight:700;letter-spacing:.04em;text-decoration:none;white-space:nowrap}
.public-index-link:hover,.public-index-link:focus-visible{color:var(--accent)}
"""
PUBLIC_NAV_LINK = (
    '  <a class="public-index-link" href="./" '
    'aria-label="返回公开阅读目录 / Zum öffentlichen Leseverzeichnis">'
    '← 目录 / Index</a>\n'
)
OLD_READER_STARTUP = """window.addEventListener('DOMContentLoaded',function(){
  setLang('zh');
  var h=location.hash.slice(1);
  if(h&&document.getElementById(h)){ setLang(h.slice(0,2)); show(h); }
  else show(document.querySelector('#toc div[data-lang="zh"] a').dataset.t);
});"""
PUBLIC_READER_STARTUP = """window.addEventListener('DOMContentLoaded',function(){
  var h=location.hash.slice(1);
  if(h&&document.getElementById(h)){ setLang(h.slice(0,2)); show(h); }
  else setLang('zh');
});"""
OLD_SET_LANG_START = """function setLang(l){
  LANG=l;"""
PUBLIC_SET_LANG_START = """function setLang(l){
  LANG=l;
  document.documentElement.lang=l;
  var publicIndex=document.querySelector('.public-index-link');
  if(publicIndex) publicIndex.href=(l==='de')?'./?lang=de':'./';"""


def plain(value: str) -> str:
    return html.unescape(TAG_RE.sub("", value)).strip()


def ensure_reader_navigation(source: str) -> str:
    """Add the public-only return link without touching the private source project."""
    changed = False
    if 'class="public-index-link"' not in source:
        if "</style></head>" not in source or '<div id="bar">' not in source:
            raise SystemExit("reader.html does not contain the expected style or toolbar")
        source = source.replace("</style></head>", PUBLIC_NAV_STYLE + "</style></head>", 1)
        source = source.replace('<div id="bar">\n', '<div id="bar">\n' + PUBLIC_NAV_LINK, 1)
        changed = True
    if OLD_READER_STARTUP in source:
        source = source.replace(OLD_READER_STARTUP, PUBLIC_READER_STARTUP, 1)
        changed = True
    elif PUBLIC_READER_STARTUP not in source:
        raise SystemExit("reader.html does not contain the expected startup logic")
    if PUBLIC_SET_LANG_START in source:
        pass
    elif OLD_SET_LANG_START in source:
        source = source.replace(OLD_SET_LANG_START, PUBLIC_SET_LANG_START, 1)
        changed = True
    else:
        raise SystemExit("reader.html does not contain the expected language switch")
    if changed:
        # The exported reader uses CRLF; preserving it keeps this public-only patch reviewable.
        with READER.open("w", encoding="utf-8", newline="\r\n") as stream:
            stream.write(source)
    return source


def read_groups() -> dict[str, list[tuple[str, list[tuple[str, str]]]]]:
    source = ensure_reader_navigation(READER.read_text(encoding="utf-8"))
    toc_match = TOC_RE.search(source)
    if not toc_match:
        raise SystemExit("reader.html does not contain the expected TOC")

    result: dict[str, list[tuple[str, list[tuple[str, str]]]]] = {}
    for lang, body in LANG_RE.findall(toc_match.group(1)):
        groups: list[tuple[str, list[tuple[str, str]]]] = []
        current_title: str | None = None
        current_links: list[tuple[str, str]] = []
        for heading, anchor, title in TOKEN_RE.findall(body):
            if heading:
                if current_title is not None:
                    groups.append((current_title, current_links))
                current_title = plain(heading)
                current_links = []
            elif anchor and current_title is not None:
                current_links.append((anchor, plain(title)))
        if current_title is not None:
            groups.append((current_title, current_links))
        result[lang] = groups

    if set(result) != {"zh", "de"}:
        raise SystemExit("reader.html must contain Chinese and German TOCs")
    counts = {lang: sum(len(links) for _, links in groups) for lang, groups in result.items()}
    if counts != {"zh": 87, "de": 87}:
        raise SystemExit(f"unexpected public article counts: {counts}")
    if [len(result[lang]) for lang in ("zh", "de")] != [4, 4]:
        raise SystemExit("expected four public directory groups per language")
    return result


def render_question_map(lang: str) -> str:
    rows = {
        "zh": (
            ("01", "专业实际学什么，毕业后能做什么？", "从专业与职业开始", "#directory-zh-0"),
            ("02", "同一学科里，大学和研究方向有什么差别？", "查看横向比较与研究环境", "#directory-zh-1"),
            ("03", "听说过一所大学，想先了解它？", "按大学名称查找", "#directory-zh-2"),
            ("04", "遇到不熟悉的德国大学术语？", "打开德国大学术语表", "./reader.html#zh--glossary"),
        ),
        "de": (
            ("01", "Was lernt man in einem Fach, und was kommt danach?", "Bei Studienfächern und Berufen beginnen", "#directory-de-0"),
            ("02", "Wie unterscheiden sich Hochschulen und Forschungsrichtungen?", "Vergleiche und Forschungsumfelder öffnen", "#directory-de-1"),
            ("03", "Eine Hochschule ist bekannt, aber noch nicht eingeordnet?", "Nach Hochschulnamen nachschlagen", "#directory-de-2"),
            ("04", "Ein Begriff aus dem deutschen Hochschulsystem ist unklar?", "Das Hochschulglossar öffnen", "./reader.html#de--glossary"),
        ),
    }[lang]
    return "".join(
        f'<a class="question-row" href="{html.escape(href, quote=True)}">'
        f'<span>{number}</span><strong>{html.escape(question)}</strong>'
        f'<small>{html.escape(action)}</small><b aria-hidden="true">↗</b></a>'
        for number, question, action, href in rows
    )


def render_directory(lang: str, groups: list[tuple[str, list[tuple[str, str]]]]) -> str:
    article_word = "篇" if lang == "zh" else "Artikel"
    parts: list[str] = []
    for index, (title, links) in enumerate(groups):
        rows = "".join(
            f'<li><a href="./reader.html#{html.escape(anchor, quote=True)}">'
            f'<span>{html.escape(article_title)}</span><b aria-hidden="true">↗</b></a></li>'
            for anchor, article_title in links
        )
        parts.append(
            f'<details class="directory-group" id="directory-{lang}-{index}" open>'
            f'<summary><span>{index + 1:02d}</span><h3>{html.escape(title)}</h3>'
            f'<small>{len(links)} {article_word}</small></summary>'
            f'<ol>{rows}</ol></details>'
        )
    return "".join(parts)


PAGE = Template(r'''<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="germanyUniResearch 公开脱敏版的中德双语阅读目录。">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%23153d35'/%3E%3Cpath d='M16 18h32v28H16zM22 26h20M22 33h20M22 40h13' fill='none' stroke='%23f2efe6' stroke-width='3'/%3E%3C/svg%3E">
  <title>germanyUniResearch · 公开阅读目录</title>
  <script>
    if (/^#(?:zh|de)--/.test(location.hash)) {
      location.replace('./reader.html' + location.hash);
    }
  </script>
  <style>
    :root{--paper:#f2efe6;--ink:#153d35;--soft:#526a62;--accent:#c44832;--line:rgba(21,61,53,.24);--serif:"Iowan Old Style","Noto Serif SC","Songti SC",Georgia,serif;--sans:"Avenir Next",Avenir,"Noto Sans SC","Microsoft YaHei",sans-serif}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:linear-gradient(rgba(21,61,53,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(21,61,53,.035) 1px,transparent 1px),var(--paper);background-size:44px 44px;font-family:var(--sans);-webkit-font-smoothing:antialiased}a{color:inherit}.skip{position:fixed;left:1rem;top:-5rem;z-index:50;background:var(--ink);color:var(--paper);padding:.7rem 1rem}.skip:focus{top:1rem}.shell{width:min(1320px,calc(100% - 48px));margin:auto}.topbar{height:76px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:24px;position:relative;z-index:2}.home{font-size:.72rem;font-weight:800;letter-spacing:.13em;text-decoration:none}.topbar strong{font-family:var(--serif);font-size:1.05rem;font-weight:500}.grow{flex:1}.languages{display:flex;align-items:center;gap:8px}.languages button{border:0;border-bottom:1px solid transparent;padding:.45rem .3rem;background:transparent;color:var(--soft);font:700 .68rem/1 var(--sans);letter-spacing:.14em;cursor:pointer}.languages button[aria-pressed="true"]{border-color:var(--accent);color:var(--ink)}.hero{min-height:620px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);align-items:center;gap:clamp(40px,8vw,120px);border-bottom:1px solid var(--line)}.hero-copy{padding:82px 0;animation:rise .75s cubic-bezier(.16,1,.3,1) both}.eyebrow{margin:0 0 28px;color:var(--accent);font-size:.67rem;font-weight:800;letter-spacing:.17em}.hero h1{max-width:830px;margin:0;font-family:var(--serif);font-size:clamp(4.2rem,8vw,8rem);font-weight:500;line-height:.93;letter-spacing:-.06em;text-wrap:balance}.lede{max-width:650px;margin:38px 0 34px;color:var(--soft);font-family:var(--serif);font-size:clamp(1.03rem,1.5vw,1.3rem);line-height:1.85}.hero-actions{display:flex;flex-wrap:wrap;gap:14px 26px}.hero-actions a{min-width:210px;padding:13px 0;border-bottom:1px solid var(--ink);display:flex;justify-content:space-between;text-decoration:none;font-size:.76rem;font-weight:800;letter-spacing:.06em;transition:color .2s,border-color .2s,padding .2s}.hero-actions a:hover,.hero-actions a:focus-visible{color:var(--accent);border-color:var(--accent);padding-left:8px}.hero-mark{width:min(31vw,390px);aspect-ratio:1;justify-self:end;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;position:relative;animation:scale-in 1s .1s cubic-bezier(.16,1,.3,1) both}.hero-mark:before,.hero-mark:after{content:"";position:absolute;background:var(--line)}.hero-mark:before{left:0;right:0;height:1px}.hero-mark:after{top:0;bottom:0;width:1px}.hero-mark span{width:58%;aspect-ratio:1;border:1px solid var(--ink);background:rgba(242,239,230,.86);display:grid;place-items:center;transform:rotate(8deg);font-family:var(--serif);font-size:clamp(3.2rem,6vw,6rem)}.hero-mark small{position:absolute;right:1%;bottom:20%;color:var(--accent);font:italic clamp(2.2rem,4vw,4rem)/1 var(--serif);transform:rotate(-8deg)}.meta-line{position:absolute;left:6%;top:17%;padding:.25rem .5rem;background:var(--paper);font-size:.58rem;font-weight:800;letter-spacing:.13em}.section{padding:clamp(85px,10vw,140px) 0;border-bottom:1px solid var(--line)}.section-head{display:grid;grid-template-columns:.55fr 1.2fr 1fr;gap:36px;align-items:end;margin-bottom:52px}.section-number{font-size:.66rem;font-weight:800;letter-spacing:.17em}.section h2{margin:0;font-family:var(--serif);font-size:clamp(2.5rem,5vw,5rem);font-weight:500;line-height:1;letter-spacing:-.045em}.section-head p{margin:0;color:var(--soft);font-size:.84rem;line-height:1.75}.question-list{border-top:1px solid var(--ink)}.question-row{min-height:104px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:70px minmax(0,1.25fr) minmax(220px,.75fr) 38px;align-items:center;gap:24px;text-decoration:none;transition:color .2s,padding .25s}.question-row>span{font-family:var(--serif);font-style:italic}.question-row strong{font-family:var(--serif);font-size:clamp(1.25rem,2vw,1.8rem);font-weight:500}.question-row small{color:var(--soft);font-size:.75rem;line-height:1.55}.question-row b{color:var(--accent);font:400 1.8rem/1 var(--serif);transition:transform .2s}.question-row:hover,.question-row:focus-visible{color:var(--accent);padding-left:8px;outline:none}.question-row:hover b,.question-row:focus-visible b{transform:translate(5px,-5px)}.directory{border-top:1px solid var(--ink)}.directory-group{border-bottom:1px solid var(--ink)}.directory-group summary{min-height:120px;display:grid;grid-template-columns:70px minmax(0,1fr) auto;align-items:center;gap:24px;cursor:pointer;list-style:none}.directory-group summary::-webkit-details-marker{display:none}.directory-group summary>span{font-family:var(--serif);font-style:italic}.directory-group summary h3{margin:0;font-family:var(--serif);font-size:clamp(1.9rem,3.5vw,3.5rem);font-weight:500;letter-spacing:-.035em}.directory-group summary small{color:var(--soft);font-size:.67rem;font-weight:800;letter-spacing:.12em}.directory-group summary small:after{content:" −";color:var(--accent)}.directory-group:not([open]) summary small:after{content:" +"}.directory-group ol{margin:0 0 38px 70px;padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:48px;counter-reset:item}.directory-group li{counter-increment:item;border-top:1px solid var(--line)}.directory-group li a{min-height:68px;padding:13px 0;display:grid;grid-template-columns:1fr 24px;align-items:center;gap:14px;text-decoration:none;font-size:.82rem;line-height:1.5}.directory-group li a:before{content:counter(item,decimal-leading-zero);grid-row:1;display:none}.directory-group li b{color:var(--accent);font:400 1.15rem/1 var(--serif);transition:transform .2s}.directory-group li a:hover,.directory-group li a:focus-visible{color:var(--accent);outline:none}.directory-group li a:hover b,.directory-group li a:focus-visible b{transform:translate(4px,-4px)}.notice{display:grid;grid-template-columns:.55fr 1.2fr 1fr;gap:36px;align-items:start}.notice h2{font-size:clamp(2.4rem,4vw,4.2rem)}.notice-copy{color:var(--soft);font-family:var(--serif);font-size:1.05rem;line-height:1.9}.notice-copy p:first-child{margin-top:0}.notice-copy strong{color:var(--ink)}.footer{min-height:130px;display:flex;align-items:center;justify-content:space-between;gap:28px;color:var(--soft);font-size:.68rem;letter-spacing:.08em}.footer a{text-decoration:none}.footer a:hover{color:var(--accent)}[data-lang-pane][hidden]{display:none!important}@keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes scale-in{from{opacity:0;transform:scale(.9) rotate(-3deg)}to{opacity:1;transform:none}}
    @media(max-width:900px){.hero{grid-template-columns:1fr;padding-bottom:70px}.hero-copy{padding-bottom:10px}.hero-mark{width:min(72vw,380px);justify-self:center}.section-head,.notice{grid-template-columns:1fr 2fr}.section-head p,.notice-copy{grid-column:2}.question-row{grid-template-columns:50px 1fr 32px}.question-row small{grid-column:2}.question-row b{grid-column:3;grid-row:1/3}.directory-group ol{grid-template-columns:1fr}.directory-group summary{grid-template-columns:50px 1fr auto}.directory-group ol{margin-left:50px}}
    @media(max-width:600px){.shell{width:calc(100% - 28px)}.topbar{height:68px;gap:12px}.topbar strong{display:none}.hero{min-height:0}.hero-copy{padding:70px 0 20px}.hero h1{font-size:clamp(3.35rem,17vw,5rem)}.hero-mark{width:88vw}.section{padding:78px 0}.section-head,.notice{display:block}.section-number{display:block;margin-bottom:18px}.section-head p,.notice-copy{margin-top:22px}.question-row{padding:18px 0;gap:12px}.question-row:hover,.question-row:focus-visible{padding-left:4px}.directory-group summary{min-height:98px;grid-template-columns:38px 1fr;gap:12px}.directory-group summary small{grid-column:2}.directory-group ol{margin:0 0 30px 38px}.directory-group li a{font-size:.78rem}.footer{padding:30px 0;align-items:flex-start;flex-direction:column;justify-content:center}.home{font-size:.62rem}.languages{gap:3px}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <!-- Generated by tools/build_germany_uni_index.py from the sanitized reader TOC. -->
  <a class="skip" href="#questions">跳到阅读导航 / Zur Lesenavigation</a>
  <header class="topbar shell">
    <a class="home" href="../">← DOCUMENT CENTER</a>
    <strong>germanyUniResearch</strong><span class="grow"></span>
    <nav class="languages" aria-label="Language / 语言">
      <button type="button" data-language="zh" aria-pressed="true">中文</button>
      <button type="button" data-language="de" aria-pressed="false">DEUTSCH</button>
    </nav>
  </header>
  <main>
    <section class="hero shell">
      <div class="hero-copy" data-lang-pane="zh">
        <p class="eyebrow">公开脱敏版 · PUBLIC RESEARCH ARCHIVE</p>
        <h1>德国大学与<br>专业研究</h1>
        <p class="lede">先从问题进入，再打开具体文章。这里汇集专业、职业、大学比较、研究方向与学校介绍。</p>
        <div class="hero-actions"><a href="#questions">选择阅读入口 <span>↓</span></a><a href="./reader.html">打开完整阅读器 <span>↗</span></a></div>
      </div>
      <div class="hero-copy" data-lang-pane="de" hidden>
        <p class="eyebrow">ÖFFENTLICHE AUSGABE · PUBLIC RESEARCH ARCHIVE</p>
        <h1>Studienfächer &amp;<br>Hochschulen</h1>
        <p class="lede">Erst von einer Frage ausgehen, dann den passenden Text öffnen: Fächer, Berufe, Hochschulvergleiche, Forschungsrichtungen und Hochschulporträts.</p>
        <div class="hero-actions"><a href="#questions">Leseeinstieg wählen <span>↓</span></a><a href="./reader.html#de--fields-mathematics-overview">Gesamten Reader öffnen <span>↗</span></a></div>
      </div>
      <div class="hero-mark" aria-hidden="true"><span>中</span><small>DE</small><b class="meta-line">87 ARTIKEL · 87 篇</b></div>
    </section>
    <section class="section shell" id="questions">
      <div data-lang-pane="zh">
        <div class="section-head"><span class="section-number">01 · 按问题进入</span><h2>你想先弄清什么？</h2><p>不需要从数学开始，也不需要按目录顺序通读。选一个现在真正关心的问题即可。</p></div>
        <div class="question-list">$questions_zh</div>
      </div>
      <div data-lang-pane="de" hidden>
        <div class="section-head"><span class="section-number">01 · NACH FRAGE</span><h2>Was soll zuerst klarer werden?</h2><p>Der Einstieg muss weder Mathematik sein noch der Reihenfolge folgen. Eine konkrete Frage genügt.</p></div>
        <div class="question-list">$questions_de</div>
      </div>
    </section>
    <section class="section shell" id="directory">
      <div data-lang-pane="zh">
        <div class="section-head"><span class="section-number">02 · 完整目录</span><h2>87 篇公开文章</h2><p>目录只包含已经脱敏并公开的内容。每个标题会直接打开阅读器中的对应文章。</p></div>
        <div class="directory">$directory_zh</div>
      </div>
      <div data-lang-pane="de" hidden>
        <div class="section-head"><span class="section-number">02 · VERZEICHNIS</span><h2>87 öffentliche Texte</h2><p>Das Verzeichnis enthält ausschließlich die bereinigten öffentlichen Inhalte. Jeder Titel öffnet den passenden Text im Reader.</p></div>
        <div class="directory">$directory_de</div>
      </div>
    </section>
    <section class="section shell">
      <div class="notice" data-lang-pane="zh"><span class="section-number">03 · 阅读说明</span><h2>区分长期知识与时间快照</h2><div class="notice-copy"><p><strong>专业内容与职业形态</strong>相对稳定，适合现在阅读。</p><p><strong>大学比较、录取方式、排名、团队和教授</strong>是 2026 年 8 月的研究快照。真正做决定前，应重新核对大学官方页面和当年规则。</p><p>公开版已排除家庭情况、个人画像、活动安排和家庭申请路径。</p></div></div>
      <div class="notice" data-lang-pane="de" hidden><span class="section-number">03 · LESEHINWEIS</span><h2>Dauerhaftes Wissen von Momentaufnahmen trennen</h2><div class="notice-copy"><p><strong>Fachinhalte und Berufsbilder</strong> sind vergleichsweise beständig und schon heute lesbar.</p><p><strong>Hochschulvergleiche, Zulassung, Ranglisten, Gruppen und Professuren</strong> sind eine Momentaufnahme vom August 2026. Vor einer Entscheidung müssen offizielle Hochschulseiten und die dann geltenden Regeln erneut geprüft werden.</p><p>Die öffentliche Ausgabe enthält keine familiären Angaben, persönlichen Profile, Aktivitätenpläne oder familiären Bewerbungswege.</p></div></div>
    </section>
  </main>
  <footer class="footer shell"><span>FamilyWangWang · Öffentliche Dokumentation</span><a data-lang-pane="zh" href="./reader.html">完整阅读器 ↗</a><a data-lang-pane="de" href="./reader.html#de--fields-mathematics-overview" hidden>Gesamter Reader ↗</a></footer>
  <script>
    function setLanguage(language, updateUrl) {
      document.documentElement.lang = language === 'de' ? 'de' : 'zh';
      document.querySelectorAll('[data-lang-pane]').forEach(function (pane) {
        pane.hidden = pane.dataset.langPane !== language;
      });
      document.querySelectorAll('[data-language]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.language === language));
      });
      if (updateUrl) {
        var url = new URL(location.href);
        if (language === 'de') url.searchParams.set('lang', 'de');
        else url.searchParams.delete('lang');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }
    document.querySelectorAll('[data-language]').forEach(function (button) {
      button.addEventListener('click', function () { setLanguage(button.dataset.language, true); });
    });
    var initialLanguage = new URLSearchParams(location.search).get('lang') === 'de' ? 'de' : 'zh';
    setLanguage(initialLanguage, false);
  </script>
</body>
</html>
''')


def main() -> None:
    groups = read_groups()
    rendered = PAGE.substitute(
        questions_zh=render_question_map("zh"),
        questions_de=render_question_map("de"),
        directory_zh=render_directory("zh", groups["zh"]),
        directory_de=render_directory("de", groups["de"]),
    )
    with OUTPUT.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(rendered)
    print(f"generated {OUTPUT.relative_to(ROOT)} from 87 Chinese and 87 German articles")


if __name__ == "__main__":
    main()
