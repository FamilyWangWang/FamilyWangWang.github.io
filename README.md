# FamilyWangWang Docs

Public documentation hub for FamilyWangWang learning and knowledge projects.

## Published projects

- [mathOlymp](https://familywangwang.github.io/mathOlymp/) — bilingual German–Chinese mathematics olympiad learning site
- [germanyUniResearch](https://familywangwang.github.io/germanyUniResearch/) — sanitized bilingual research on German degree subjects, universities, and research environments
- [learnLanguage](https://familywangwang.github.io/learnLanguage/) — sanitized German and English scenario and vocabulary learning site with full-text search

Published project content is static. Project source and editing history remain in their respective source repositories.

The public `germanyUniResearch` reading index is generated from the sanitized reader TOC with `tools/build_germany_uni_index.py`; its source Markdown remains untouched in the private project repository.

The public `learnLanguage` site is generated from its private Markdown source with `tools/build_learn_language.py`. Only sanitized HTML and search indexes are published; the source Markdown remains untouched. A source-repository workflow validates and republishes the site whenever learning content changes.
