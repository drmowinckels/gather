import type { CatalogPart, LocaleMeta } from "../types";

export const meta: LocaleMeta = { label: "English", order: 0 };

// English — the source of truth for the key set and plural shapes. Every other
// locale is typed against `Catalog` (derived from this file), so adding a key
// here without translating it elsewhere is a compile error.
//
// Keys are flat, dotted, and namespaced by surface (`nav.*`, `landing.*`,
// `create.*`, …). A value is a string or a plural group ({ one, other });
// `{name}` placeholders are filled at call time, and a `\n` renders as a line
// break where the call site opts into it.
//
// To add a language, copy this file to `<code>.ts`, keep every key, translate
// the values, and register it in `../registry.ts`. See CONTRIBUTING.md.
export const en = {
  // ── nav / chrome ──
  "nav.primary": "Primary",
  "nav.skipToContent": "Skip to content",
  "nav.api": "API",
  "nav.about": "About",
  "nav.github": "GitHub",
  "nav.newPoll": "New poll",

  "theme.toLight": "Switch to light theme",
  "theme.toDark": "Switch to dark theme",

  "lang.switchTo": "Switch language to {language}",

  "footer.label": "Footer",
  "footer.tagline": "find a time, together.",
  "footer.docs": "Docs",
  "footer.support": "Buy me a coffee",

  // ── landing ──
  "landing.eyebrow": "Group scheduling, one shared link",
  "landing.title": "Find a time,\ntogether.",
  "landing.subcopy":
    "Paint when you're free, share one link, and watch the group's best slot light up. No accounts required — and every poll is reachable from the API.",
  "landing.ctaCreate": "Create a poll",
  "landing.ctaApi": "Explore the API",
  "landing.step1.title": "Paint your hours",
  "landing.step1.body":
    "Click and drag across the grid to mark when you're free. No account, no calendar sync.",
  "landing.step2.title": "See it converge",
  "landing.step2.body":
    "A live heatmap surfaces the slot that works for the most people, runner-ups close behind.",
  "landing.step3.title": "Automate it",
  "landing.step3.body":
    "Every poll is a REST resource, so a CLI or a bot can open one and read the winning slot back.",

  // ── results (shared) ──
  "results.peopleFree": {
    one: "{count} person free",
    other: "{count} people free",
  },

  // ── about ──
  "about.eyebrow": "About",
  "about.heroTitle": "We made the boring part painless.",
  "about.heroLede":
    "samkoma is a small, independent tool for the universally annoying job of finding a time that works for a group. One link, no accounts, and a live heatmap that lights up the slot the most people can make. That's the whole thing.",
  "about.whyTitle": "Why it works this way",
  "about.whyLead":
    "A few deliberate choices, each one in service of getting out of your way.",
  "about.principle1.title": "No accounts, ever",
  "about.principle1.body":
    "You shouldn't have to sign up to answer “when are you free?” Nobody makes a profile, nobody gets added to a list. Polls expire on their own and quietly disappear.",
  "about.principle2.title": "One link does it",
  "about.principle2.body":
    "Share a single link. People paint when they're free — on a phone, in their own timezone — and leave. No app to install, no invite to accept.",
  "about.principle3.title": "Your data isn't the product",
  "about.principle3.body":
    "There's nothing to monetise here. A poll holds only what it needs to do its job, and it's deleted once it's done.",
  "about.principle4.title": "API-first, not API-eventually",
  "about.principle4.body":
    "Everything the website does is a public REST call, so a script or a bot can run the very same flow. The web app is just one polite client.",
  "about.originTitle": "Where it comes from",
  "about.originPara1a": "samkoma began as the scheduling brain behind",
  "about.originPara1b":
    ", the RLadies+ community bot — but it's built to stand on its own. Jinx is simply one consumer of the public API; anyone can be another. The product is deliberately",
  "about.independent": "independent",
  "about.originPara1c":
    ": not tied to any single community or company, and not anyone's growth funnel.",
  "about.originPara2":
    "It's open source and maintained by Dr. Athanasia Mowinckel. If you'd like to see how it's built, file an issue, or send a patch, it all lives on",
  "about.freeTitle": "Keeping it free",
  "about.freeBody":
    "samkoma runs on free tiers and stays free to use — no paywalls, no “pro” plan. If it saved you an email thread or two and you'd like to chip in toward the upkeep, you can buy me a coffee. Entirely optional, genuinely appreciated.",
  "about.supportCta": "Buy me a coffee",
  "about.ctaTitle": "Ready to find a time?",
  "about.ctaCreate": "Create a poll",
  "about.ctaApi": "Explore the API",

  // ── apiPage ──
  "apiPage.example.windowTitle": "create a poll",
  "apiPage.hero.title": "One poll, two front doors.",
  "apiPage.hero.lede":
    "Everything you can do by clicking, you can do with a request. The web app, the CLI, and bots like Jinx all speak to the same public REST API. No SDK to learn — it's just HTTP and JSON.",
  "apiPage.action.openConsole": "Open interactive console ↗",
  "apiPage.action.viewRawSpec": "View raw spec ↗",
  "apiPage.action.sourceOnGitHub": "Source on GitHub ↗",
  "apiPage.action.createPoll": "Create a poll →",
  "apiPage.reference.heading": "Reference",
  "apiPage.reference.lead.before":
    "No accounts: creating a poll returns an edit token, sent as",
  "apiPage.reference.lead.after":
    "for host-only actions. Expand any endpoint for its parameters, body, and responses. The interactive console adds a “try it” runner.",
  "apiPage.reference.loadFailed": "The reference couldn't load.",
  "apiPage.reference.openDocs": "Open the interactive docs ↗",
  "apiPage.reference.or": "or",
  "apiPage.reference.viewRawSpec": "view the raw spec ↗",
  "apiPage.reference.instead": "instead.",
  "apiPage.reference.loading": "Loading the reference…",
  "apiPage.bots.heading": "Built for bots",
  "apiPage.bots.lead":
    "Because the API is the product, automation isn't a bolt-on. Jinx, the RLadies+ bot, turns a comment on a GitHub issue into a poll — then edits its own reply with the winning slot once everyone's in.",
  "apiPage.bots.repliedJustNow": "replied just now",
  "apiPage.bots.pollsUp": "📋 Poll's up!",
  "apiPage.bots.editNote":
    "I'll edit this comment with the winning slot once everyone's responded.",
  "apiPage.build.heading": "Start building",

  // ── miniheat ──
  "miniheat.ariaLabel":
    "Preview of a group availability heatmap converging on a shared time",
  "miniheat.title": "Group availability",
  "miniheat.respondents": {
    one: "{count} respondent",
    other: "{count} respondents",
  },
  "miniheat.mon": "MON",
  "miniheat.tue": "TUE",
  "miniheat.wed": "WED",
  "miniheat.thu": "THU",
  "miniheat.fri": "FRI",
  "miniheat.fewer": "fewer",
  "miniheat.everyone": "everyone",

  // ── qr ──
  "qr.tooLong": "That link is too long to fit in a QR code.",
  "qr.downloadSvg": "Download SVG",
  "qr.downloadPng": "Download PNG",

  // ── apiRef ──
  "apiRef.parameters": "Parameters",
  "apiRef.requestBody": "Request body",
  "apiRef.responses": "Responses",
  "apiRef.optional": "optional",
  "apiRef.in": "in {location}",
  "apiRef.defaultsTo": "defaults to",

  // ── calendar ──
  "calendar.prevMonth": "Previous month",
  "calendar.nextMonth": "Next month",
  "calendar.chooseDatesIn": "Choose dates in {month}",
  "calendar.lockedDay": "Already in the poll — can't be removed",

  // ── create ──
  "create.heading.new": "New poll",
  "create.heading.duplicate": "Duplicate poll",
  "create.lede.new":
    "Two minutes, no account. You'll get a link to share and an edit link to keep.",
  "create.lede.duplicateDates":
    "Copied the settings from your poll — now pick the new dates.",
  "create.lede.duplicateOther":
    "Copied the settings from your poll — tweak anything below.",
  "create.error.api":
    "We couldn't create the poll. Check the fields and try again.",
  "create.error.network":
    "Can't reach the samkoma service. Check your connection and try again.",
  "create.title.label": "Event name",
  "create.title.placeholder": "Team offsite — September",
  "create.days.label": "Which days?",
  "create.kind.ariaLabel": "Poll type",
  "create.kind.dates": "Specific dates",
  "create.kind.weekdays": "Days of the week",
  "create.days.datesHint":
    "Tap a day, or drag across several. Use ‹ › to reach another month.",
  "create.days.weekdaysHint":
    "Pick the weekdays that recur — times stay in the poll's home timezone.",
  "create.days.noneSelected": "No days selected yet.",
  "create.days.countSelected": {
    one: "{count} day selected.",
    other: "{count} days selected.",
  },
  "create.from.label": "No earlier than",
  "create.to.label": "No later than",
  "create.slot.label": "Slot size",
  "create.slot.minutes": {
    one: "{count} min",
    other: "{count} min",
  },
  "create.time.invalid": "The end time needs to be after the start time.",
  "create.tz.label": "Timezone",
  "create.tz.hint":
    "This is the poll's home timezone. Respondents paint in their own.",
  "create.deadline.label": "Respond-by deadline",
  "create.optional": "(optional)",
  "create.deadline.hint":
    "After this, the poll stops accepting availability. You can also close it by hand any time.",
  "create.capacity.label": "Per-slot capacity",
  "create.capacity.placeholder": "e.g. 8",
  "create.capacity.hint":
    'A slot is shown as "full" once this many people are free in it. Leave blank for no limit.',
  "create.toggle.public": "Make results public",
  "create.toggle.hideResults": "Hide results until I reveal them",
  "create.toggle.defaultAvailable": "Start everyone available (they mark busy)",
  "create.submit.busy": "Creating…",
  "create.submit.idle": "Create poll",
  "create.cli.label": "CLI equivalent",
  "create.cli.hint":
    "The form and the CLI hit the same endpoint. Anything you can click, a script can do.",

  // ── edit ──
  "edit.error.notAdditive":
    "Editing is additive — you can add days or widen the window, but not drop a day or time people may already have answered for.",
  "edit.error.fromAfterTo": "The end time needs to be after the start time.",
  "edit.error.slotChangeUnsupported":
    "The slot size can't be changed after a poll is created.",
  "edit.error.invalidBody": "Check the fields and try again.",
  "edit.error.generic": "We couldn't save those changes.",
  "edit.error.network":
    "Can't reach the samkoma service. Check your connection and try again.",
  "edit.heading": "Edit poll",
  "edit.close": "Close",
  "edit.eventName": "Event name",
  "edit.days": "Days",
  "edit.existingDay": "Existing day — can't be removed",
  "edit.daysHelp":
    "You can add days, but existing ones (ringed, fixed) stay — people may have answered for them.",
  "edit.noEarlierThan": "No earlier than",
  "edit.noLaterThan": "No later than",
  "edit.slotSize": "Slot size",
  "edit.slotMinutes": "{slot} min",
  "edit.windowHelp":
    "You can only widen the window (earlier start, later end), and the slot size is fixed.",
  "edit.makePublic": "Make results public",
  "edit.hideResults": "Hide results until I reveal them",
  "edit.saving": "Saving…",
  "edit.save": "Save changes",
  "edit.public.warningLead": "Heads up:",
  "edit.public.warningBody":
    "making results public reveals the names and painted availability of everyone who already answered while this poll was private. This can't be undone for answers they've already given.",
  "edit.public.confirm": "I understand — make past responses public",

  // ── filter ──
  "filter.toggle": "Filter people",
  "filter.counting": {
    one: "Counting {included} of {total} people",
    other: "Counting {included} of {total} people",
  },
  "filter.groupsLabel": "Groups counted in the results",
  "filter.peopleLabel": "People counted in the results",
  "filter.reset": "Reset — count everyone",

  // ── grid ──
  "grid.state.available": "available",
  "grid.state.maybe": "maybe",
  "grid.state.busy": "busy",
  "grid.slot": "{day}, {time}",
  "grid.cellLabel": "{day}, {time} — {state}",
  "grid.cellLabelConflict": "{day}, {time} — {state} — calendar conflict",
  "grid.announce": "{slot} — {state}",
  "grid.conflictDot": "Busy in your calendar",

  // ── heatmap ──
  "heatmap.title": "Group availability",
  "heatmap.responsesOf": "{total} of {names} responses",
  "heatmap.responses": {
    one: "{count} response",
    other: "{count} responses",
  },
  "heatmap.downloadCsv": "Download CSV",
  "heatmap.emptyTitle": "No availability yet",
  "heatmap.emptyFilteredTitle": "No one in this selection",
  "heatmap.emptyBody":
    "Once people paint their free times, the group's best slot lights up here.",
  "heatmap.emptyFilteredBody": "Add someone back in to see where they overlap.",
  "heatmap.byGroup": "By group:",
  "heatmap.srCaption":
    "Group availability by slot, {total} of {names} responses counted. Best slot {time} with {count} available.",
  "heatmap.colTimeSlot": "Time slot",
  "heatmap.colAvailable": "Available",
  "heatmap.colMaybe": "Maybe",
  "heatmap.srCount": "{count} of {total}",
  "heatmap.srFull": " (full)",
  "heatmap.cellEmpty": "{time} — nobody yet",
  "heatmap.cellAvailable": "{time} — {count} of {total} available",
  "heatmap.cellMaybeSuffix": ", {count} maybe",
  "heatmap.cellFullSuffix": " — full",
  "heatmap.cellAriaLockable": "{desc}. Select to lock in.",
  "heatmap.legendMaybe": "maybe",
  "heatmap.legendFull": "full",
  "heatmap.bestSlot": "Best slot",
  "heatmap.bestSlotCount": "{count} / {total} available",
  "heatmap.bestSlotMaybeSuffix": " · {count} maybe",
  "heatmap.bestSlotAllIn": " · all in",
  "heatmap.runnerUps": "Runner-ups",
  "heatmap.thisSlot": "This slot",
  "heatmap.detailAvailable": "Available · {count}",
  "heatmap.detailMaybe": "Maybe · {count}",
  "heatmap.lockedLabel": "Locked:",
  "heatmap.unlock": "Unlock",
  "heatmap.locking": "Locking…",
  "heatmap.lockIn": "Lock in {time}",
  "heatmap.pickHintSelected": "Tap another slot to change your pick.",
  "heatmap.pickHintDefault":
    "Best slot picked — tap any slot to choose a different one.",

  // ── poll ──
  "poll.loading": "Loading poll…",
  "poll.notFound.title": "That poll isn't here",
  "poll.notFound.body":
    "The link may be mistyped, or the poll was never created. Start a fresh one and share the new link.",
  "poll.notFound.cta": "Create a poll",
  "poll.expired.title": "This poll has expired",
  "poll.expired.body":
    "Polls stay live for 14 days after their last day, then they're cleared. Start a fresh one for your next get-together.",
  "poll.expired.cta": "Create a poll",
  "poll.error.title": "Can't load this poll right now",
  "poll.error.body":
    "The samkoma service didn't respond. Refresh to try again.",
  "poll.error.refresh": "Refresh",
  "poll.tz.showingIn": "Showing times in",
  "poll.tz.selectLabel": "Show times in timezone",
  "poll.tz.convertedFrom": "converted from {tz}",
  "poll.tz.noteLabel": "timezone note",
  "poll.tz.weekdayNote":
    "Weekday times are shown in the poll's home timezone, {tz}.",
  "poll.youHost": "You host this",
  "poll.editPoll": "Edit poll",
  "poll.duplicate": "Duplicate",
  "poll.meta": "{slot}-min slots · home tz {tz}",
  "poll.responding.closed": "🔒 Responding is closed",
  "poll.responding.closesAt": "Responding closes {date}",
  "poll.responding.open": "Responding is open",
  "poll.reopen": "Reopen",
  "poll.closeNow": "Close now",
  "poll.closeError": "Couldn't update — retry.",
  "poll.lockedIn": "📌 Locked in:",
  "poll.addToCalendar": "Add to calendar",
  "poll.curtain.hostHidden":
    "🙈 Results are hidden from respondents until you reveal them.",
  "poll.curtain.revealError": "Couldn't reveal — try again.",
  "poll.curtain.reveal": "Reveal results",
  "poll.private.curtainedTitle": "Results hidden for now",
  "poll.private.privateTitle": "Results are private",
  "poll.private.curtainedBody":
    "The host is keeping the group results hidden until they reveal them. Your availability is saved.",
  "poll.private.privateBody":
    "The host kept the group results private. Your availability is saved.",
  "poll.share.label": "Share this link",
  "poll.share.inputLabel": "Shareable poll link",
  "poll.copied": "Copied",
  "poll.copy": "Copy",
  "poll.qr.hide": "Hide QR",
  "poll.qr.show": "QR",
  "poll.qr.label": "QR code linking to this poll",
  "poll.share.copiedStatus": "Link copied to clipboard",
  "poll.share.anyone":
    "Anyone with this link can add their availability — no account needed.",
  "poll.share.activeUntil": "Link active until {date}.",
  "poll.host.label": "🔑 Your host link",
  "poll.host.inputLabel": "Private host link",
  "poll.host.hint":
    "Keep this private — anyone with it can lock the poll and see private results. Open it on another device to manage from there.",

  // ── respond ──
  "respond.error.nameProtected":
    "That name is protected. Enter its password to edit, or pick another name.",
  "respond.error.saveFailed": "Couldn't save — please try again.",
  "respond.error.network": "Can't reach samkoma. Check your connection.",
  "respond.overlay.tooLarge": "That calendar file is too large (over 5 MB).",
  "respond.overlay.noEvents": "No events found in this poll's range.",
  "respond.overlay.marked": {
    one: "Marked {count} busy slot(s) from your calendar — nothing was uploaded.",
    other:
      "Marked {count} busy slot(s) from your calendar — nothing was uploaded.",
  },
  "respond.overlay.recurring": {
    one: " ({count} recurring event couldn't be expanded.)",
    other: " ({count} recurring events couldn't be expanded.)",
  },
  "respond.overlay.readFailed":
    "Couldn't read that file — is it a .ics calendar?",
  "respond.bulk.allAvailable": "All slots marked available.",
  "respond.bulk.allCleared": "All slots cleared.",
  "respond.closed.title": "Responding is closed",
  "respond.closed.body": "This poll is no longer accepting availability.",
  "respond.details.heading": "Your details",
  "respond.name.label": "Your name",
  "respond.name.placeholder": "e.g. Ada",
  "respond.group.label": "Group",
  "respond.optional": "(optional)",
  "respond.group.placeholder": "e.g. Design team",
  "respond.group.helper":
    "Tag yourself to a team to see per-group tallies in the results.",
  "respond.password.label": "Edit password",
  "respond.password.placeholder": "to edit from another device",
  "respond.password.helper":
    "Leave blank to keep this response to this browser. Set one to claim your name and edit it elsewhere.",
  "respond.calendar.overlay": "Overlay my calendar (.ics)",
  "respond.calendar.blockOut": "Block out busy times",
  "respond.bulk.selectAll": "Select all",
  "respond.bulk.clearAll": "Clear all",
  "respond.bulk.helper": "Mark everything free, then paint when you're busy.",
  "respond.availability.heading": "Your availability",
  "respond.availability.helperDefaultAvailable":
    "You start marked free everywhere — paint the times you're busy. Each tap cycles a slot: available → maybe → clear.",
  "respond.availability.helper":
    "Click or drag to mark when you're free. Each tap cycles a slot: available → maybe → clear.",
  "respond.save.saving": "Saving…",
  "respond.save.button": "Save availability",
  "respond.save.addName": "Add your name to save.",
  "respond.save.saved": "Saved",
  "respond.save.liveSaving": "Saving your availability",
  "respond.save.liveSaved": "Availability saved",

  // ── format ──
  "format.ariaTrigger": "Date and time format",
  "format.time": "Time",
  "format.date": "Date",
  "format.auto": "Auto",
  "format.h12": "12h",
  "format.h24": "24h",
  "format.iso": "ISO",
} satisfies CatalogPart;

export default en;

export type Catalog = typeof en;
export type TKey = keyof Catalog;
