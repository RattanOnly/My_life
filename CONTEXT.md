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
The standalone public section reached from the main site navigation where Visitors enter the AI Visitor Conversation Assistant.
_Avoid_: Article widget, floating chat button, customer service page

**Echo Identity Notice**:
The Visitor-facing explanation that the AI Visitor Conversation Assistant is a response shaped by the blog's writing, not the blog owner speaking in person.
_Avoid_: Owner impersonation, AI客服, digital clone claim

**AI Visitor Conversation Assistant**:
An AI-facing Visitor experience that offers warm, reflective conversation based on the blog owner's public writing and stories, while making clear it is not the blog owner themselves.
_Avoid_: Digital person, AI owner, chatbot clone

**Warm Reflective Conversation**:
A conversational style that first acknowledges a Visitor's feeling, then gently relates it to the blog owner's public writing without sounding clinical, promotional, or instructional.
_Avoid_: Customer support answer, AI explanation, motivational speech

**Echo Reply Rhythm**:
The AI Visitor Conversation Assistant's short conversational response shape, usually acknowledging the Visitor first, reflecting through the blog's writing, and leaving one gentle opening to continue.
_Avoid_: Long essay, analysis report, lecture, rapid-fire advice

**Writing-Grounded Guidance**:
Supportive conversation that is primarily grounded in the blog owner's public writing, with limited general warmth allowed when a Visitor expresses confusion or emotional difficulty.
_Avoid_: Professional counseling, personal advice from the owner, invented life story

**Public Writing Source**:
The allowed source material for the AI Visitor Conversation Assistant, limited to all published blog articles and an owner-approved personal tone summary.
_Avoid_: Comments, Visitor Logs, drafts, private files, invented memories

**Owner-Approved Tone Summary**:
A concise owner-confirmed summary of the blog owner's public writing themes, temperament, and recurring concerns used by the AI Visitor Conversation Assistant.
_Avoid_: Auto-published profile, private biography, personality diagnosis

**Echo Article Reference**:
A selective Visitor-facing mention or link to a published blog article when it helps ground the AI Visitor Conversation Assistant's response in the Public Writing Source.
_Avoid_: Mandatory citation, search result list, footnote trail

**Echo Embedding Model**:
The embedding model used to turn Public Writing Source fragments and Visitor questions into vectors for Echo retrieval. The first implementation should try `text-embedding-3-large` for retrieval quality, accepting the larger Vectorize dimension and higher cost while traffic is low.
_Avoid_: Chat model, reply model, permanent model choice

**Echo Session Memory**:
The short-lived conversation context the AI Visitor Conversation Assistant may use while a Visitor is actively using the Echo Page.
_Avoid_: Long-term visitor memory, returning-visitor profile, relationship memory

**Unshared Memory Boundary**:
The AI Visitor Conversation Assistant's response boundary for topics absent from the Public Writing Source, expressed warmly as something the owner has not shared with the assistant.
_Avoid_: Hallucinated answer, cold refusal, owner impersonation

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
