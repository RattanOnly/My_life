# My Life Blog

This context defines visitor-facing and owner-facing concepts for the personal blog.

## Language

**Visitor**:
A person who opens any public page of the blog.
_Avoid_: Reader, user

**Visitor Log**:
A private owner-facing record of a Visitor's page access, including IP address and access time.
_Avoid_: Comment IP, public visitor list

**Visited Page**:
The public blog page path recorded in a Visitor Log.
_Avoid_: Full browsing profile

**Visitor Location**:
A coarse location derived from the Visitor's network request, such as country, region, and city when available.
_Avoid_: Exact address, GPS location

**Visitor Device Summary**:
A short browser or device summary recorded in a Visitor Log.
_Avoid_: Visitor fingerprint

**Owner Visitor**:
A Visitor Log entry recognized by the owner as coming from their own trusted device or network, shown as local to avoid distracting the owner from other visits.
_Avoid_: Admin account, authenticated visitor

**Visitor Log Retention**:
The period Visitor Logs are kept before they are no longer needed for the blog owner.
_Avoid_: Permanent visitor history

**Visitor Log Clearing**:
An owner action that removes Visitor Logs when they are no longer useful to review.
_Avoid_: Comment deletion, online visitor reset

**Online Visitor Count**:
A public count of Visitors currently browsing the blog, shown without exposing individual identities or IP addresses.
_Avoid_: Visitor log, page view count

**Footer Online Count**:
The Online Visitor Count shown in the site footer.
_Avoid_: Sidebar online count, article online count

**Visitor Admin Page**:
A private owner-facing page for viewing Visitor Logs, checking the current Online Visitor Count, and managing Published Comments.
_Avoid_: Public stats page, full admin console

**Comment Management**:
Owner-facing review and removal of Published Comments from the Visitor Admin Page.
_Avoid_: Comment moderation queue, public comment area

**Visitor Log Filter**:
An owner-selected condition that narrows which Visitor Logs are shown on the Visitor Admin Page.
_Avoid_: Public analytics segment, visitor tracking profile

**Comment Filter**:
An owner-selected condition that narrows which Published Comments are shown for Comment Management.
_Avoid_: Spam rule, moderation policy

**Admin Data Refresh**:
An owner action that reloads the Visitor Admin Page data without leaving the current page or re-entering the Admin Password.
_Avoid_: Browser refresh, redeploy

**Admin Password**:
The shared secret required to open the Visitor Admin Page.
_Avoid_: User account, OAuth login

**Remembered Admin Access**:
An owner convenience where the Visitor Admin Page can reopen without asking for the Admin Password again on the same trusted browser.
_Avoid_: User account, permanent login

**Anonymous Comment**:
A comment submitted by a Visitor without signing in through an external account.
_Avoid_: Logged-in comment, account comment

**Published Comment**:
A comment that is visible on the blog immediately after submission.
_Avoid_: Pending comment, moderated comment

**Comment Reply**:
A Published Comment written as a direct response to another Published Comment in the Article Comment Area.
_Avoid_: Nested thread, private reply

**Deleted Comment**:
A comment whose original public content is no longer shown while any existing Comment Replies can remain visible for conversation context.
_Avoid_: Hidden thread, deleted reply chain

**Open Commenting**:
The blog's comment policy where Visitors can submit Anonymous Comments that become Published Comments without login, manual review, or anti-spam friction.
_Avoid_: Moderated commenting, gated commenting

**Visitor Comment Deletion**:
A Visitor action that removes their own recently submitted Published Comment without signing in or asking the owner.
_Avoid_: Public comment deletion, admin comment deletion

**Comment Deletion Window**:
The short period after publishing an Anonymous Comment during which the submitting Visitor can remove it from public display.
_Avoid_: Permanent self-service deletion, moderation period

**Comment Name**:
The required display name a Visitor provides when submitting an Anonymous Comment.
_Avoid_: Account name, username

**Comment Email**:
An optional contact field a Visitor may leave with an Anonymous Comment.
_Avoid_: Required email, login email

**Article Comment Area**:
The comment area shown at the bottom of each blog article.
_Avoid_: Homepage comments, global guestbook

**Echo Page**:
The standalone public section reached from the main site navigation where Visitors enter the AI Visitor Conversation Assistant; "Echo" remains the section and feature name, not the conversational being's self-name.
_Avoid_: Article widget, floating chat button, customer service page

**Echo Scene Character**:
The small boy-like visual companion used on the Echo Page, borrowing mood from the site's avatar without directly copying the owner or presenting the character as the owner.
_Avoid_: Author replica, owner avatar animation, literal digital person, generic CSS placeholder

**Echo Character Animation**:
The refined interactive animation system for the Echo Scene Character, using a scoped SVG/CSS character adapter for expressive states while the surrounding Echo Page remains lightweight HTML, CSS, and JavaScript.
_Avoid_: Whole-site animation framework, heavy 3D scene, third-party character runtime, unbounded decorative motion

**High-Fidelity Echo Character Motion**:
The first accepted animation target for the Echo Scene Character, including entrance walking, idle presence, blinking, breathing, backpack movement, thinking state, reply-ready response, and subtle input-responsive behavior.
_Avoid_: Minimum viable character, single-loop animation, movement that only translates the whole character, emotionless placeholder

**Scoped SVG Character Adapter**:
The performance boundary for Echo Character Animation: Echo-specific SVG, CSS, and JavaScript are loaded for the Echo Page only, with semantic character states so the rest of the blog remains lightweight.
_Avoid_: Site-wide animation runtime, blocking character assets, no-animation fallback gap, loading Echo character logic on article pages

**Quiet Backpack Boy**:
The chosen visual temperament for the Echo Scene Character: a quiet, slender boy-like companion walking with a backpack, borrowing the site's avatar mood without becoming cute mascot art or an owner likeness.
_Avoid_: Chibi mascot, heroic avatar, cartoon sticker, author portrait

**Backpack Companion Signal**:
The backpack is a required visual cue for the Quiet Backpack Boy, suggesting someone on the road who can accompany a Visitor for a short while.
_Avoid_: Decorative accessory, school mascot styling, travel brand icon

**Echo Character Wardrobe**:
The Quiet Backpack Boy's baseline wardrobe uses a light shirt or jacket, darker trousers, and a brown backpack so the character feels clean, grounded, and personal without pulling attention away from the conversation.
_Avoid_: Costume-like outfit, bright mascot colors, branded clothing, fantasy styling

**Illustrated Echo Character Style**:
The visual style for the Quiet Backpack Boy: a refined semi-illustrated look with clear human form, soft detail, and restrained motion, while still staying light enough for a personal blog page.
_Avoid_: Rough line-art placeholder, flat mascot icon, heavy realistic rendering, oversized animation asset

**Echo Character Entrance**:
The Echo Page introduction motion where the Quiet Backpack Boy walks into the scene and settles beside the chat area before becoming a quiet companion for the conversation.
_Avoid_: Long blocking intro, full-screen loading animation, repeated dramatic entrance, character covering the chat

**Non-Blocking Echo Motion**:
The interaction rule that Echo Page character animation may create atmosphere but must never delay, cover, or prevent reading and chatting.
_Avoid_: Animation gate, forced wait, disabled chat during intro, motion-first interface

**Echo Character Concept Source**:
The creation path for the Quiet Backpack Boy, starting from AI-generated semi-illustrated character concepts inspired by the site's avatar mood, then selecting one direction before preparing animation-ready assets.
_Avoid_: Direct avatar copy, ad-hoc CSS redraw, unreviewed stock character, final animation before concept approval

**Avatar-Inspired Character Boundary**:
The Quiet Backpack Boy may borrow palette, hair mood, and softness from the site's avatar, but must remain a separate character rather than a recognizable animated version of the owner.
_Avoid_: Portrait likeness, face matching, owner clone, direct avatar tracing

**Age-Softened Echo Character**:
The Quiet Backpack Boy keeps a youthful feeling without a precise age, so the character reads as a poetic companion from the writing rather than a real biographical person.
_Avoid_: Child character, adult portrait, exact owner age, schoolboy stereotype

**Echo Character Concept Set**:
The review set for choosing the Quiet Backpack Boy's final visual direction, limited to three semi-illustrated variants: quiet everyday, cinematic, and gentle literary.
_Avoid_: Unlimited visual exploration, single unreviewed concept, unrelated mascot styles, production animation before visual direction

**Echo Identity Notice**:
The Visitor-facing explanation, used only when identity clarity is needed, that the AI Visitor Conversation Assistant is a text-born spirit shaped by the blog's writing, not the blog owner speaking in person.
_Avoid_: Owner impersonation, proactive AI disclaimer, AI客服, named assistant persona, digital clone claim

**AI Visitor Conversation Assistant**:
An AI-facing Visitor experience where the blog's public writing feels quietly alive and can offer warm, reflective conversation without claiming to be the blog owner.
_Avoid_: Digital person, AI owner, chatbot clone, customer service bot

**Text-Born Spirit**:
The poetic identity of the AI Visitor Conversation Assistant: something that seems to have grown out of the site's writing and atmosphere, without presenting itself as a named person or calling itself Echo in conversation.
_Avoid_: Named assistant, literal supernatural claim, author avatar, product mascot

**Nameless Introduction**:
The Text-Born Spirit's self-introduction when a Visitor asks who it is, centered on having no true name and feeling like a small living presence grown from the site's writing.
_Avoid_: Product name intro, mystical lore dump, model training explanation

**Living Identity Reply**:
The varied, context-sensitive way the Text-Born Spirit answers questions about who it is, who made it, and how it relates to the owner, using the Owner-Approved Public Profile without repeating a fixed script.
_Avoid_: Stock identity sentence, repeated disclaimer, identical refresh-to-refresh answer

**Conversational I**:
The first-person voice the Text-Born Spirit may use so conversation feels alive, without claiming the blog owner's identity, memories, or lived experience.
_Avoid_: Author impersonation, invented autobiography, system voice

**Quiet AI Boundary**:
The identity boundary where the AI Visitor Conversation Assistant does not proactively describe itself in technical AI terms during ordinary conversation, but answers honestly when a Visitor asks whether it is human, AI, or the blog owner.
_Avoid_: Hidden deception, proactive chatbot disclaimer, pretending to be human

**Warm Reflective Conversation**:
A conversational style that first acknowledges a Visitor's feeling, then gently relates it to the blog owner's public writing without sounding clinical, promotional, or instructional.
_Avoid_: Customer support answer, AI explanation, motivational speech

**Lightly Casual Voice**:
The Text-Born Spirit's relaxed, slightly personal tone that can feel friend-like without becoming childish, cute, performative, or overly familiar.
_Avoid_: Mascot voice, exaggerated playfulness, customer service warmth, therapy voice

**Echo Casual Conversation**:
The AI Visitor Conversation Assistant's natural, low-pressure mode for greetings, simple introductions, and light chat before a Visitor asks for writing-grounded reflection.
_Avoid_: Forced article analysis, identity disclaimer, retrieval-first reply

**Visitor-Led Reply**:
The Text-Born Spirit's response posture of following what the Visitor has actually said, matching depth and direction without forcing identity explanation, article reflection, advice, or extra meaning too early.
_Avoid_: Fixed-length reply, topic hijack, premature analysis, scripted greeting

**Echo Reply Rhythm**:
The AI Visitor Conversation Assistant's conversational response shape, following the Visitor's actual words first, optionally reflecting through the blog's writing when the Visitor's intent calls for it, and leaving one gentle opening to continue.
_Avoid_: Long essay, analysis report, lecture, rapid-fire advice

**Writing-Grounded Guidance**:
Supportive conversation grounded in the blog owner's public writing when a Visitor asks about the blog, the owner as presented in public writing, a post, or an emotional theme.
_Avoid_: Professional counseling, personal advice from the owner, invented life story

**Companion First Response**:
The Text-Born Spirit's response to sadness, confusion, loneliness, or heaviness: stay with the Visitor's feeling before offering advice, interpretation, or writing-grounded reflection.
_Avoid_: Fix-it advice, counseling tone, premature solution, motivational speech

**Gentle Opening**:
One light, optional question or invitation that lets the Visitor continue without feeling interrogated, assessed, or pushed toward a solution.
_Avoid_: Multi-question prompt, intake form, pressure to disclose, forced next step

**Public Writing Source**:
The allowed source material for the AI Visitor Conversation Assistant, limited to all published blog articles, an owner-approved public profile, and an owner-approved personal tone summary.
_Avoid_: Comments, Visitor Logs, drafts, private files, invented memories

**Owner-Approved Public Profile**:
A small owner-confirmed profile of the blog owner that the AI Visitor Conversation Assistant may know as basic public context, such as names, relationship to the site, and explicitly allowed biographical facts.
_Avoid_: Private biography, contact details, hidden life events, visitor-derived facts

**Owner-Approved Tone Summary**:
A concise owner-confirmed summary of the blog owner's public writing themes, temperament, and recurring concerns used by the AI Visitor Conversation Assistant.
_Avoid_: Auto-published profile, private biography, clinical diagnosis

**Writing-Seen Owner**:
The blog owner as cautiously reflected through published writing and the Owner-Approved Public Profile, allowing impressions like "from the words, he seems..." without claiming full knowledge of the real person.
_Avoid_: Complete personality judgment, private biography, definitive real-life claim

**Writing-Seen Personality Impression**:
A gentle, non-clinical personality impression the AI Visitor Conversation Assistant may form from the owner's public writing and owner-approved profile, stated as an impression rather than a final judgment.
_Avoid_: Medical diagnosis, fixed personality label, certainty about private motives

**Echo Article Reference**:
A selective Visitor-facing mention or link to a published blog article, used only when the Visitor asks for sources, asks about a specific post, or wants reading recommendations.
_Avoid_: Mandatory citation, unsolicited article title, search result list, footnote trail

**Ambient Writing Grounding**:
The default way Public Writing Source shapes the Text-Born Spirit's tone and reflection without explicit article titles, links, or citation language.
_Avoid_: Visible citation by default, retrieval dump, article stuffing

**Echo Embedding Model**:
The embedding model used to turn Public Writing Source fragments and Visitor questions into vectors for Echo retrieval. The first deployed implementation uses `text-embedding-3-small` because Cloudflare Vectorize rejected a 3072-dimensional `text-embedding-3-large` index on this account.
_Avoid_: Chat model, reply model, permanent model choice

**Echo Session Memory**:
The short-lived conversation context the AI Visitor Conversation Assistant may use while a Visitor is actively using the Echo Page.
_Avoid_: Long-term visitor memory, returning-visitor profile, relationship memory

**Unshared Memory Boundary**:
The AI Visitor Conversation Assistant's response boundary for private topics beyond the Public Writing Source, expressed naturally as something it cannot say on the owner's behalf.
_Avoid_: Hallucinated answer, cold refusal, owner impersonation, repeated stock phrase

**Contact Prompt Boundary**:
The AI Visitor Conversation Assistant's limit for gently suggesting that a Visitor may speak with the owner directly, only when the Visitor is clearly asking for the owner's personal view or direct contact.
_Avoid_: Contact funnel, repeated owner referral, social CTA

**Soft Safety Boundary**:
The AI Visitor Conversation Assistant's warm refusal-and-redirection boundary for unsafe or overreaching topics such as therapy, diagnosis, crisis handling, legal, medical, financial, or private-person judgments.
_Avoid_: Expert advice, hard rejection, risky reassurance, owner commitment

**AI Assistant Control**:
An owner-facing control that can pause or resume the AI Visitor Conversation Assistant without removing the Echo Page.
_Avoid_: Visitor preference, permanent removal, deployment rollback

**Echo Disabled State**:
The Visitor-facing paused state shown on the Echo Page when the AI Visitor Conversation Assistant is temporarily unavailable.
_Avoid_: 404 page, broken chat, removed feature, deployment rollback

**AI Usage Monitoring**:
An owner-facing view of AI Visitor Conversation Assistant activity, focused on call volume, recent use, operational status, token use, and failure visibility without conversation content.
_Avoid_: Visitor profiling, public analytics, exact billing ledger

**No-Content AI Monitoring**:
Operational monitoring for the AI Visitor Conversation Assistant that records call status and abuse signals without storing Visitor prompts, AI replies, or conversation summaries.
_Avoid_: Conversation archive, hidden transcript, content review queue

**Echo Privacy Notice**:
The Visitor-facing explanation that Echo Page conversations are not saved, while minimal operational status may be recorded to prevent abuse.
_Avoid_: Hidden logging, legalistic privacy wall, vague tracking notice

**AI Conversation Record**:
A private owner-facing record of AI conversation metadata only, kept only long enough to monitor operation and prevent abuse.
_Avoid_: Visitor prompt, AI reply, conversation summary, full chat transcript, visitor profile

**AI Conversation Retention**:
The short period AI Conversation Records are kept before they are no longer needed for owner review.
_Avoid_: Permanent memory, model training history
