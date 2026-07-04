# Echo Page Design

## Status

Approved for specification on 2026-07-04. This document captures the agreed product and interaction design for the first Echo Page implementation. It is not an implementation plan.

## Goal

Create a standalone Echo Page where visitors can have a warm, reflective conversation shaped by the owner's published writing. The page should feel like entering a quiet personal room, not opening a customer-service widget.

Echo must be honest about its identity: it is not the owner speaking in person, not a digital clone, and not a therapy or advice service. It is a writing-grounded companion that can reflect through the blog's public articles and gently say when something has not been shared.

## Confirmed Visual Direction

The visual direction is hand-drawn storybook.

- A small boy with a backpack sits or walks on top of the chat box.
- When no conversation is active, he sits on the chat box, blinks, and daydreams.
- When the visitor starts a conversation or waits for a reply, he stands up and walks slowly.
- When the reply is ready, he pauses as if handing the words back to the visitor.
- The chat box should feel simple, plain, warm, and paper-like.
- The moving "conveyor belt" effect should be subtle: a light texture or line movement on the chat surface, not a heavy mechanical object.

The first implementation may use a lightweight interim SVG/CSS character, but the architecture should leave a clear adapter boundary so a future `.riv` character asset can replace it without rewriting chat logic.

## Page Placement

Echo is a standalone public section reached from the main site navigation, beside items such as the home page and diary list.

It should not be:

- an article-bottom widget
- a floating support bubble
- a homepage-only section
- a generic AI customer-service page

The likely route is `/echo/`.

## Visitor Copy

The page should use minimal, human copy. The opening notice should be short and visible before the first message:

> 这里不是他本人，只是一些从他的文字里长出来的回声。你的对话不会被保存。

The privacy notice should stay plain. It must not sound legalistic, but it must be clear that conversations are not saved and only minimal operational status may be recorded to prevent abuse.

When Echo does not know something personal about the owner, it should answer warmly:

> 这部分，他没有和我提起过。也许如果可以，你可以亲自去和他聊聊。

The exact wording can vary, but it must not invent private memories or claim direct access to the owner.

## Conversation Behavior

Echo responses should follow the Echo Reply Rhythm:

1. acknowledge the visitor's feeling or question first
2. reflect through the owner's published writing where relevant
3. keep the response short, usually two to four paragraphs
4. leave one gentle opening for the visitor to continue

Echo should not over-explain sources. Article references are selective and only used when they help ground the answer.

## UI States

### Not Started

The boy sits on the chat box and daydreams. The input is ready. No message history is shown except the identity/privacy notice.

### Visitor Typing

The input area receives a quiet focus state. The boy may glance toward the input area. No aggressive animation should distract from typing.

### Waiting for Reply

The boy stands and walks slowly on top of the chat box. The chat box texture moves subtly. A compact status line can say that Echo is thinking.

### Reply Ready

The assistant message appears. The boy pauses or lightly nods, then returns to an idle or walking loop depending on whether the session continues.

### Disabled

If the owner pauses Echo from the admin page, the Echo Page remains available and shows a warm disabled state. It should not look broken or removed.

### Failure

If the Worker, AI provider, or network fails, the UI shows a retryable message. It should not erase the visitor's current draft. It should not expose provider error details.

## Technical Architecture

The project should keep the existing Hexo static site plus Cloudflare Pages deployment model.

Frontend:

- add an Echo static page
- use plain JavaScript for the first implementation
- avoid introducing React, Next.js, or a new app framework for this feature
- load Echo-specific scripts only on the Echo Page

Backend:

- route chat requests through the existing Cloudflare Worker sidecar
- never expose API keys to the browser
- use Cloudflare Vectorize for retrieval
- use D1 only for operational metadata and admin controls
- do not store visitor prompts, AI replies, or conversation summaries

Retrieval:

- published blog posts and the Owner-Approved Tone Summary form the Public Writing Source
- drafts, comments, visitor logs, and private files are excluded
- published posts enter the retrieval index by default
- article edits refresh indexed fragments
- deleted or unpublished articles are removed from the index
- the Vectorize index is rebuildable derived data

Embedding:

- the first trial uses `text-embedding-3-large`
- the Vectorize index dimension should be `3072`
- switching to `text-embedding-3-small` later requires a separate or rebuilt `1536`-dimension index

## Animation Architecture

The preferred long-term animation runtime is Rive because the character has interactive states rather than a single decorative loop.

The animation adapter should expose semantic states:

- `idle_sit`
- `walk`
- `thinking`
- `reply_ready`
- `disabled`

The chat UI should not depend directly on Rive APIs. Instead, the chat state manager calls an adapter such as `setEchoAnimationState('thinking')`. The first version can map those states to SVG/CSS classes. A later Rive version can map them to Rive state machine inputs.

dotLottie remains a viable fallback for simpler one-shot animations, but it is not the recommended first architecture for the companion character because Echo needs stateful behavior.

## Admin Requirements

The owner-facing admin should eventually include:

- pause/resume Echo
- current operational status
- recent call count
- token usage estimate if available
- failure count and last failure time
- no prompt text
- no AI reply text
- no conversation transcript

This monitoring exists to prevent abuse and understand whether the feature is working, not to inspect visitors' private conversations.

## Performance Requirements

- The Echo animation must respect `prefers-reduced-motion`.
- Echo scripts and animation assets load only on `/echo/`.
- Chat box motion should use transform or background-position animation only.
- Avoid many animated DOM nodes.
- Mobile layout prioritizes readable conversation and input usability over large animation.
- If the character asset is not loaded yet, the chat should still be usable.
- Worker failures must produce quick user feedback.

## Accessibility Requirements

- The chat input must have a visible label.
- Buttons must have accessible names.
- Status changes such as waiting, failed, and disabled should be announced in a polite live region.
- Motion should reduce or stop when the visitor requests reduced motion.
- The visual boy is decorative unless later given explicit interactive controls.

## First-Version Scope

In scope:

- standalone Echo Page
- nav entry
- plain chat UI
- privacy and identity notice
- Worker chat endpoint
- Vectorize retrieval
- admin pause/resume
- no-content usage monitoring
- animation adapter with interim hand-drawn character states

Out of scope for first version:

- account login for visitors
- saved conversation history
- owner-visible prompt/reply transcripts
- voice chat
- full Rive production character asset
- birthday gift-box animation
- weather system
- forum-like social features

## References

- Rive runtime and state-machine direction: https://github.com/rive-app/rive-runtime
- Rive examples and learning resources: https://github.com/rive-app/awesome-rive
- dotLottie Web player fallback reference: https://github.com/LottieFiles/dotlottie-web
