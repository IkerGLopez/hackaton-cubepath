# Knowledge Folder

This folder allows you to add typography knowledge without modifying code.

## Supported file types

- `.json`
- `.md` or `.markdown`

## JSON format

Use either an array or `{ "documents": [...] }`.

```json
[
  {
    "id": "landing-contrast-playbook",
    "title": "Landing Hero Contrast",
    "tags": ["landing", "hero", "contrast"],
    "intents": ["landing"],
    "sourceName": "Design Notes",
    "sourceType": "best-practice",
    "sourceUrl": "https://example.com",
    "content": "Use high-contrast heading pairs for hero sections..."
  }
]
```

## Markdown format

Optional frontmatter block:

```markdown
---
id: editorial-whitespace-rhythm
title: Editorial Rhythm with Whitespace
tags: editorial, rhythm, readability
intents: editorial
sourceName: Editorial Handbook
sourceType: article
sourceUrl: https://example.com
---

# Editorial Rhythm with Whitespace

Body text benefits from generous line-height and paragraph spacing...
```

## Notes

- `intents` can include: `landing`, `dashboard`, `ecommerce`, `editorial`.
- If `intents` is omitted, the retriever infers intent from title/tags/content.
- Duplicate IDs are ignored after the first match.
