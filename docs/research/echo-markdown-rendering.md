# Echo Markdown Rendering Research

Date: 2026-07-09

## Question

Echo replies can contain Markdown such as `**title**`, but the current frontend inserts replies with `textContent`, so Markdown is displayed as plain text. The question is how to render Markdown safely.

## Findings

- Treat assistant replies as untrusted input. AI output is still external text and should not be written directly with unsanitized `innerHTML`.
- `markdown-it` disables raw HTML by default with `html: false`, and its security guidance recommends disabling HTML for most safe rendering cases or using an external sanitizer if HTML is enabled.
- `DOMPurify` is a purpose-built HTML sanitizer and supports explicit allowlists such as `ALLOWED_TAGS` and `ALLOWED_ATTR`.
- OWASP's XSS prevention guidance treats `textContent` as a safe sink and recommends sanitization when HTML must be rendered.
- GitHub-style Markdown rendering should be understood as a pipeline, not a single parser call: Markdown is parsed, then HTML is filtered/sanitized before display.

## Recommendation

Use a small safe Markdown subset for assistant replies only:

1. Keep user messages as `textContent`.
2. Parse assistant replies with `markdown-it` using `html: false`, `breaks: true`, and a limited rule set.
3. Sanitize the parser output with `DOMPurify` before assigning `innerHTML`.
4. Allow only simple tags: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `blockquote`, `code`, and optionally safe `a` links.
5. Do not allow images, raw HTML, iframes, scripts, style attributes, or arbitrary classes.
6. Add tests for bold/list rendering and XSS inputs such as `<script>`, `onerror`, and `javascript:` URLs.

## Primary Sources

- markdown-it README and security docs: https://github.com/markdown-it/markdown-it
- DOMPurify README and demos: https://github.com/cure53/DOMPurify
- OWASP Cross-Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- GitHub markup repository: https://github.com/github/markup
