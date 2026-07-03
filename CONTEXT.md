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
