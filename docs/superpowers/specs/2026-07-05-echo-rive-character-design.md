# Echo Rive Character Design

## Status

Approved for specification on 2026-07-05. This document refines the Echo Page visual companion direction after the decision to use Rive for the character animation.

This is a design specification, not an implementation plan.

## Goal

Create a small Q-style boy character that feels alive beside the Echo chat interface. The character should make the page feel warm and accompanied without turning the page into a game, mascot-heavy UI, or owner imitation.

The priority is smooth motion, clear emotional state, and long-term extensibility. Fine realistic modeling is not required. The character can be cute and simplified, but it should respond naturally to the chat state.

## Character Direction

The character is a Q-style backpack boy.

- Big head, smaller body, soft proportions.
- Young, quiet, and gentle, without a precise age.
- Carries a visible brown backpack.
- Wears a light shirt or light jacket with darker trousers.
- Borrows mood from the site's avatar only through softness, dark hair, and restrained warmth.
- Must not look like a direct copy of the owner.
- Should feel like a small soul that grew out of the writing, not a customer-service bot.

The character should be readable at small size on mobile. Details should support the silhouette rather than require close inspection.

## Animation Runtime Decision

Use Rive as the primary character animation runtime.

Rive is chosen because this character needs stateful, interactive motion rather than a single decorative loop. The page should load a `.riv` asset on the Echo Page only, run one character state machine, and let JavaScript switch states through semantic inputs.

The rest of the Echo Page remains plain static-site HTML, CSS, and JavaScript. The project should not migrate to React, Next.js, Three.js, or a larger animation framework for this feature.

## Rive Asset Requirements

The first production asset should include one artboard and one main state machine.

Recommended names:

- Artboard: `EchoBoy`
- State machine: `EchoBoyState`

Required state machine inputs:

- `mode`: number input
  - `0`: idle
  - `1`: listening
  - `2`: thinking
  - `3`: reply ready
  - `4`: disabled
- `enter`: trigger input for the first walk-in sequence
- `attention`: trigger input for a short glance or head movement
- `reducedMotion`: boolean input for reduced animation behavior

The runtime code must wrap these Rive inputs behind a local adapter such as `setEchoCharacterState('thinking')` so the chat code does not depend directly on Rive APIs.

## Motion States

### Entrance

When the visitor opens `/echo/`, the character walks into the scene once and settles beside or on the chat surface. This should not block the visitor from typing.

Motion intent:

- small steps
- soft backpack bounce
- slight head bob
- no large screen-covering movement

### Idle

When no message is being sent, the character feels present but quiet.

Motion intent:

- slow breathing
- occasional blink
- slight posture shift
- subtle backpack or sleeve movement

Idle should be calm enough that visitors can read long messages without distraction.

### Listening

When the visitor focuses the input or starts typing, the character should look attentive.

Motion intent:

- head turns slightly toward the input
- eyes open a little
- body leans forward subtly

This state should not loop aggressively. It can transition back to idle when the visitor pauses.

### Thinking

When the AI request is waiting for a response, the character should show that Echo is thinking.

Motion intent:

- sits or leans into a thoughtful pose
- slow blink
- small foot swing or backpack squeeze
- visible enough to reassure the visitor that the page is working

The UI should also show a text status such as `我想一想...` so the animation is not the only loading indicator.

### Reply Ready

When a response arrives, the character should give a small completion signal.

Motion intent:

- lift head
- slight nod
- tiny hand gesture
- return to idle after the message appears

The reply-ready animation should be short and should not delay rendering the message.

### Disabled

When Echo is paused from the admin side, the character can be still, seated, or resting.

Motion intent:

- almost no movement
- warm but unavailable
- no broken or error-like posture

## Page Integration

The Echo Page should own a character container with a canvas for Rive and a static fallback image.

The Rive runtime should:

- load only on `/echo/`
- use canvas rendering
- use a contained layout so the character is not cropped unexpectedly
- resize the drawing surface after load for device-pixel-ratio clarity
- clean up the Rive instance before replacing the canvas or tearing down the Echo page

The chat state manager should emit semantic states:

- `idle`
- `listening`
- `thinking`
- `reply_ready`
- `disabled`
- `error`

The character adapter maps these semantic states to Rive inputs. If Rive fails to load, the same semantic states map to CSS classes on the static fallback.

## Fallback And Reduced Motion

Fallback is required.

If the `.riv` asset or Rive runtime fails to load, Echo remains fully usable with a static Q-style character image and text status. A broken animation must never break chat.

When `prefers-reduced-motion` is enabled:

- skip the entrance walk
- keep idle motion minimal or still
- keep thinking state mostly static
- preserve the text thinking indicator

## Performance Rules

- Rive runtime and `.riv` asset are loaded only on the Echo Page.
- No global site bundle should include Rive.
- The `.riv` file should be kept small enough for mobile use.
- The character area should have stable dimensions to avoid layout shift.
- Chat input and message rendering must not wait for the animation to load.
- The animation should not create many DOM nodes.
- Testing must include desktop and mobile viewport checks.

## Accessibility Rules

The character is decorative by default and should not be announced as meaningful UI.

Required behavior:

- Use a text status for waiting and failure states.
- Keep buttons and input labels accessible.
- Respect `prefers-reduced-motion`.
- Do not put critical information only in the animation.

## First Implementation Scope

In scope:

- replace the current interim character architecture with a Rive-ready character adapter
- add an Echo-only Rive canvas slot
- add a static Q-style fallback
- support the semantic states listed above
- wire chat lifecycle events to character state changes
- keep existing Echo chat behavior intact
- test that the Echo page still works when Rive is unavailable

Out of scope:

- whole-site animation system
- 3D character rendering
- realistic human modeling
- owner likeness reconstruction
- birthday gift-box effect
- weather system
- forum or account system

## Acceptance Criteria

The first Rive version is acceptable when:

- the character visibly enters once, then settles
- idle feels alive through blink and breathing
- typing/focus produces a gentle listening response
- AI waiting state shows both animation and text status
- reply completion gives a short visual response
- chat remains usable if the Rive file fails to load
- reduced-motion users get a calm static or near-static version
- mobile layout remains readable and does not crop the character awkwardly
- no Rive code or asset loads outside `/echo/`

## References

- Rive Web runtime: `@rive-app/canvas`
- Rive state machine inputs: boolean, number, and trigger inputs
- Rive layout direction: contained canvas layout, centered alignment, resize drawing surface after load
