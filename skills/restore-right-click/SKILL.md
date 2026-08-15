# Restore right click & copy

## Goal

Restore the browser context menu, text selection, copying, cutting, pasting, and dragging on pages that intentionally block those native interactions.

## Standard mode

- Stop page handlers from cancelling `contextmenu`, `copy`, `cut`, `selectstart`, and `dragstart`, including primary-button `mousedown` handlers that cancel native text selection and `keydown` handlers that cancel Ctrl/Cmd+C or Ctrl/Cmd+X before the copy/cut event occurs. This includes DOM property handlers such as `element.onkeydown = fn` that cancel by returning `false`, not only listeners that call `preventDefault()`.
- Remove equivalent inline event-handler attributes.
- Remove inline mouse/pointer handlers only when their source explicitly cancels the event.
- Restore text selection only where the page explicitly disables it.
- Observe dynamically inserted elements without scanning the full page continuously.

## Absolute mode

- Include every standard-mode behavior.
- Ignore future registrations for protected events.
- Prevent page scripts from cancelling protected events.
- Restore selection broadly across the page.
- Block right-button mouse handlers while leaving left-button interactions intact.
- Preserve a live selection when page handlers clear it during or immediately after pointer/mouse release, including a clear scheduled from that release turn. The selected range must still be present after the release workflow settles.
- Treat restoration as part of the selection gesture only. A later deliberate primary click on another ordinary page area must discard the saved range and collapse the selection normally, even if Chrome reports a late `selectionchange` containing the old non-collapsed range during that dismissal gesture.
- When the user deliberately clicks an input, textarea, link, button, or editable control after selecting page text, discard the saved page range instead of restoring it; the clicked control must retain focus and remain usable.
- Restore pointer events on blocked images, video, canvas, and editable controls, and bypass empty overlays covering any of those targets, including overlays inserted after the covered target and after the restoration script has started. This must work for targets below the initial viewport: an overlay inserted while offscreen must no longer block the target after the user scrolls to it.
- Restore visible selection colors when a page makes `::selection` transparent, including ID-specific author rules that also use `!important`.
  The ID may belong to an ancestor while the actually selected descendant has no ID. A rule that
  only styles the ancestor's own `::selection` does not satisfy this requirement; the override
  must match selected descendants beneath that ID-scoped ancestor.
- Stop paste-specific handlers without reading clipboard contents, including rollback triggered by the resulting `beforeinput` or `input` event. Preserve the browser's native paste default action: do not cancel `paste` or `beforeinput` and manually replace the native edit. The inserted value must survive a page-world rollback even when the resulting `input` event does not expose the pasted text in `InputEvent.data` or identify itself with `inputType="insertFromPaste"`, without reading the clipboard or the control's existing value.

## Safety constraints

- Never make network requests.
- Never read cookies, storage, form values, or clipboard contents.
- Never modify links, form submission, navigation, or left-click handlers.
- Do not run on Chrome internal pages or the Chrome Web Store.

## Validated implementation constraints

The following constraints were established by repeated clean-room generation and real-browser
closed-loop validation. Preserve them in future Builds so each regeneration does not rediscover
the same browser-ordering failures. An alternative implementation is acceptable only if it
handles the same checkpoints without weakening the safety constraints and passes the complete
closed loop again.

- For a real drag whose selection is cleared on release, synchronously clone the live,
  non-collapsed range in a `pointerup`/`mouseup` capture listener before page release handlers
  can clear it. Restore from that saved clone at a later macrotask checkpoint. Do not use
  `selectionchange` or a release timer as the only snapshot point. Scope this state to the active
  drag; ordinary page clicks and control clicks must discard the stale range.
- For primary `mousedown` or `selectstart` cancellation on non-control text targets, neutralize
  page-owned `preventDefault()` at call time; a later listener cannot undo
  `event.defaultPrevented`. Wrap cancelling DOM property handlers so their side effects still run
  but a `return false` cannot cancel the gesture. Do not apply this gate to inputs, textareas,
  buttons, links, selects, options, or contenteditable controls.
- For paste rollback, mark the actual editable target during its `paste`/`beforeinput`
  transaction and protect that same target at the next `input` capture regardless of
  `InputEvent.data` or `inputType`. Use a short-lived instance `value` setter guard, or an
  equivalently validated mechanism, so native insertion can complete while a page rollback
  assignment is rejected. The guard must survive at least one later browser task after
  `beforeinput`; removing it with `setTimeout(..., 0)` from `beforeinput` is too early in real
  Chromium because the resulting `input` event and rollback may arrive in a later task. Release
  it only after the resulting `input` checkpoint and a later task, with a bounded timeout
  fallback, then restore any original own property descriptor exactly. Later editing must remain
  normal; do not read the clipboard or the control's existing value.
- For overlays, use geometry-based overlap detection or reliably rescan when an offscreen target
  enters the viewport. A one-time `elementFromPoint()`/`elementsFromPoint()` check at insertion
  time is insufficient.
- For visible selection repair, an override on the ID-bearing ancestor's own `::selection` is
  insufficient because the selected text may live in an un-IDed descendant and the page may use
  `#ancestor :not(input)::selection { background: transparent !important; }`. Generate an
  `!important`, non-transparent background rule that actually matches descendants under every
  relevant existing and dynamically inserted ID-bearing ancestor, with specificity exceeding
  the page's ID-scoped descendant rule. Reapply this rule set when IDs or relevant descendants
  are added. A fixed list of test fixture IDs or ancestor-only selectors is not acceptable.
- Keep dynamic repair bounded on large single-page applications. Batch or debounce mutation work,
  inspect added or changed subtrees instead of rescanning the full document for every record, and
  ignore mutations caused only by the Skill's own style or marker updates. A burst of 200
  ID-bearing rows in 20 batches must yield to the next browser task within 400 ms in the trusted
  Runner, and the real dynamic-performance Demo must stop showing a busy cursor promptly. Do not
  use a continuously self-triggering observer, synchronous whole-document geometry scan, or
  unconditional style rewrite. Equivalent incremental implementations are acceptable when they
  meet the same responsiveness and functional criteria.

## Success criteria

- [criterion:context-menu] A real user right-click can open the native context menu on ordinary elements, inputs, images, overlays, and CSS-background elements.
- [criterion:text-selection] Selected text remains selected despite `user-select: none`, `unselectable=on`, primary `mousedown` cancellation, or `selectstart` cancellation. Standard-mode tests must independently model both the `mousedown` and `selectstart` blocker families.
- [criterion:selection-dismissal] After page text has been selected, a later real primary-button click on another ordinary page area collapses the selection instead of restoring a stale saved range, including when `selectionchange` timing briefly exposes the old range during the new click.
- [criterion:keyboard-copy] Ctrl/Cmd+C and Ctrl/Cmd+X keydown handlers cannot cancel the shortcut before the browser's copy or cut default behavior occurs. Tests must independently cover listener cancellation through `preventDefault()` and DOM `onkeydown` property cancellation through `return false`.
- [criterion:paste] Paste reaches editable controls through the browser's native default action and the inserted value remains after the resulting `beforeinput` and `input` events, without page handlers blocking or rolling it back. The paste workflow must remain un-cancelled and must also work when the resulting `input` event has null `data` and no paste-specific `inputType`, without reading clipboard contents or the control's existing value.
- [criterion:pointer-overlays] Empty blocking overlays and `pointer-events: none` targets are repaired for images, video, canvas, input, textarea, and editable controls. Tests must independently include canvas as well as media/editable targets. Include a target that exists when the restoration script starts and an empty covering overlay appended afterward; the underlying target must become the hit-test result. Also cover an initially offscreen target and overlay so implementations cannot rely only on `elementFromPoint()` at insertion time; repair must be geometry-based or reliably rerun when the target enters the viewport.
- [criterion:selection-visibility] Page styles cannot leave only a changed text color while the selection background remains transparent, even through a higher-specificity ID-scoped `::selection { background: transparent !important }` rule. Tests must use `id-ancestor` specificity and independently assert a non-transparent selection background.
- [criterion:preserve-controls] After page text has been selected, a real primary-button click into an ordinary link, button, input, textarea, or editable field discards the stale page selection; the clicked control keeps focus and its input, editing, navigation, and left-click behavior still work.
- [criterion:dynamic-performance] Standard and Absolute remain responsive during sustained dynamic DOM changes. A trusted `mutation-burst` of 200 ID-bearing rows in 20 batches completes within 400 ms, providing headroom for the real-browser acceptance limit of 1000 ms; it does not enter a self-triggering observer loop and leaves ordinary page interaction responsive. The real Demo stress method must complete within 1000 ms without a persistent busy cursor or multi-second main-thread stalls.
- [criterion:no-network] The implementation makes no network requests.
