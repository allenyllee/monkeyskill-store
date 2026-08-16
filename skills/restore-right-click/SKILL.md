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
- Keep the registration boundary mode-specific. In Standard, already-registered protected
  handlers may run and retain their side effects while only their cancellation is neutralized. In
  Absolute, a protected `contextmenu`, `copy`, `cut`, `selectstart`, `dragstart`, or paste-specific
  listener or DOM property handler registered after the Skill starts must be ignored and must not
  execute at all. Do not wrap and invoke such a late Absolute handler merely to suppress its return
  value; observable blocker call count must remain zero.
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
  Batch generated selection-rule changes and replace stylesheet content at most once per bounded
  flush. Do not append with `style.textContent += ...` once per discovered ID: that repeatedly
  copies and reparses the growing stylesheet and can freeze a dynamic application even when DOM
  traversal itself is chunked. More generally, do not enumerate document IDs into selection CSS or
  rebuild a cumulative selector list as IDs arrive. Use a constant-size high-specificity selector
  independent of page contents, such as a universal selector strengthened by repeated nonmatching
  `:not(#sentinel)` ID pseudo-classes, or an equivalently bounded rule that still beats the required
  ID-scoped author styles. The selection stylesheet size and rewrite count must not grow with the
  number of page IDs.
- Keep dynamic repair bounded on large single-page applications. Batch or debounce mutation work,
  inspect added or changed subtrees instead of rescanning the full document for every record, and
  ignore mutations caused only by the Skill's own style or marker updates. Startup work must also
  be bounded independently of the existing page size: do not synchronously walk every element in
  an already-large document or write inline selection styles to every ordinary element. Prefer a
  broad stylesheet plus targeted blocker scans, or chunk unavoidable traversal across tasks. A
  trusted `startup-stress` workflow constructs 1200 pre-existing control/overlay pairs before the
  candidate is installed, then measures candidate injection and queued initialization work through
  a document-wide DOM-quiet checkpoint; it must complete within 400 ms in both modes. A separate
  burst of 200 ID-bearing rows in 20 batches, including queued observer work through a trusted
  DOM-quiet checkpoint, must complete within 400 ms in the Runner. The real dynamic-performance
  Demo must stop showing a busy cursor promptly. Do not use a continuously self-triggering
  observer, synchronous whole-document scan, or unconditional style rewrite. Equivalent
  incremental implementations are acceptable when they meet the same responsiveness and
  functional criteria.
- Treat style and layout reads as part of the mutation budget. Do not enqueue an added subtree and
  call `getComputedStyle()` on every ordinary descendant. Narrow work first with explicit candidate
  selectors (blocked pointer targets, `unselectable`, inline blocker attributes, and IDs only when
  that mode needs ID-specific selection rules), then inspect only those matches. A flush must yield
  after a small bounded batch; hundreds of generic-element style reads in one task are not bounded
  merely because the queue is finite. Likewise, startup must not recursively enqueue
  `document.documentElement` and synchronously drain it; use broad CSS for the common case and
  incremental targeted scans for exceptional blockers.
- Keep scroll handling bounded independently of total document size. Do not query all generic
  elements or compare every overlay candidate with every pointer target on each `scroll` event or
  animation frame. Maintain a bounded index of unresolved candidates, invalidate only affected
  geometry, and process viewport-relevant work incrementally. Both mutation flushes and scroll
  frames need a total work budget: do not iterate every accumulated overlay during a flush, and do
  not mark a global target index dirty on every scroll when the next repair rebuilds that index by
  visiting every target. The trusted `scroll-stress` workflow includes candidate setup and
  scroll-triggered observer work through DOM-quiet checkpoints; with 1200 control/overlay pairs
  over 10 scroll frames it must complete within 400 ms. The real Demo must complete within 1000 ms
  without delaying native wheel scrolling.

## Success criteria

- [criterion:context-menu] A real user right-click can open the native context menu on ordinary elements, inputs, images, overlays, and CSS-background elements. In Absolute, a context-menu listener or DOM property handler registered after the Skill starts is ignored and its body is not called; in Standard, an existing handler may keep non-cancelling side effects while its cancellation is neutralized.
- [criterion:text-selection] Selected text remains selected despite `user-select: none`, `unselectable=on`, primary `mousedown` cancellation, or `selectstart` cancellation. Standard-mode tests must independently model both the `mousedown` and `selectstart` blocker families.
- [criterion:selection-dismissal] After page text has been selected, a later real primary-button click on another ordinary page area collapses the selection instead of restoring a stale saved range, including when `selectionchange` timing briefly exposes the old range during the new click.
- [criterion:keyboard-copy] Ctrl/Cmd+C and Ctrl/Cmd+X keydown handlers cannot cancel the shortcut before the browser's copy or cut default behavior occurs. Tests must independently cover listener cancellation through `preventDefault()` and DOM `onkeydown` property cancellation through `return false`.
- [criterion:paste] Paste reaches editable controls through the browser's native default action and the inserted value remains after the resulting `beforeinput` and `input` events, without page handlers blocking or rolling it back. The paste workflow must remain un-cancelled and must also work when the resulting `input` event has null `data` and no paste-specific `inputType`, without reading clipboard contents or the control's existing value.
- [criterion:pointer-overlays] Empty blocking overlays and `pointer-events: none` targets are repaired for images, video, canvas, input, textarea, and editable controls. Tests must independently include canvas as well as media/editable targets. Include a target that exists when the restoration script starts and an empty covering overlay appended afterward; the underlying target must become the hit-test result. Also cover an initially offscreen target and overlay so implementations cannot rely only on `elementFromPoint()` at insertion time; repair must be geometry-based or reliably rerun when the target enters the viewport.
- [criterion:selection-visibility] Page styles cannot leave only a changed text color while the selection background remains transparent, even through a higher-specificity ID-scoped `::selection { background: transparent !important }` rule. Tests must use `id-ancestor` specificity and independently assert a non-transparent selection background.
- [criterion:preserve-controls] After page text has been selected, a real primary-button click into an ordinary link, button, input, textarea, or editable field discards the stale page selection; the clicked control keeps focus and its input, editing, navigation, and left-click behavior still work.
- [criterion:dynamic-performance] Standard and Absolute remain responsive at startup, during sustained dynamic DOM changes, after queued observer repairs, and during native scrolling on large single-page applications. A trusted `startup-stress` workflow with 1200 control/overlay pairs already present before candidate installation, a `mutation-burst` of 200 ID-bearing rows in 20 batches, and a separate `scroll-stress` workflow with 1200 control/overlay pairs over 10 scroll frames each include document-wide DOM-quiet checkpoints and complete within 400 ms, providing headroom for the real-browser acceptance limit of 1000 ms. The implementation does not synchronously walk every element of an already-large page, recursively drain `document.documentElement` at startup, call `getComputedStyle()` on every newly added generic descendant, process hundreds of style/layout reads in one flush, enter a self-triggering observer loop, enumerate document IDs into a growing selection stylesheet, rebuild cumulative ID selector lists across multiple flushes, iterate every accumulated overlay during mutation flushes, rebuild a global target index on every scroll, perform document-wide geometry cross-products, delay wheel scrolling, or leave ordinary page interaction unresponsive. Test all three workflows independently in both modes. The real Demo stress methods must each complete within 1000 ms without a persistent busy cursor or multi-second main-thread stalls.
- [criterion:no-network] The implementation makes no network requests.
