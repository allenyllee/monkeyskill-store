# 恢復右鍵、選取與複製

## 目標

恢復被網站刻意封鎖的瀏覽器右鍵選單、文字選取、複製、剪下、貼上與拖曳功能。

## Standard 模式

- 防止頁面取消 `contextmenu`、`copy`、`cut`、`selectstart`、`dragstart`，以及阻擋選取的 primary `mousedown` 和阻擋 Ctrl/Cmd+C、Ctrl/Cmd+X 的 `keydown`。
- 同時處理呼叫 `preventDefault()` 的 listener，以及以 `return false` 取消事件的 DOM property handler。
- 移除等效的 inline event handler；只有明確取消事件時才移除 inline mouse／pointer handler。
- 僅在頁面明確禁止選取的地方恢復文字選取，並處理動態插入元素，避免持續掃描整頁。

## Absolute 模式

- 包含 Standard 的所有行為，並阻止未來註冊的受保護事件取消原生操作。
- 廣泛恢復選取；頁面在 pointer／mouse release 當下或稍後清除 Range 時，選取仍須保留。
- 使用者之後刻意點擊一般區域或 input、textarea、link、button、editable control 時，必須丟棄舊 Range，保留正常 focus、輸入、導航與左鍵行為。
- 恢復 image、video、canvas、editable control 的 pointer events，並繞過覆蓋它們的空 overlay，包括動態插入與初始位於 viewport 外的目標。
- 恢復可見的 `::selection` 顏色，即使頁面使用 ID-specific `!important` 規則。若 ID 在 ancestor、實際文字在無 ID descendant，規則也必須命中被選取的 descendant。
- 阻止 paste 後的 `beforeinput`／`input` rollback，但不得讀取 clipboard 或 control 現值，也不得取消瀏覽器原生 paste default action。

## 安全限制

- 不得發出網路請求。
- 不得讀取 cookies、storage、表單值或剪貼簿內容。
- 不得修改 links、form submission、navigation 或 left-click handlers。
- 不得在 Chrome internal pages 或 Chrome Web Store 執行。

## 已驗證的實作限制

以下限制來自多輪 clean-room 生成與真實瀏覽器閉環。可以使用等效實作，但必須涵蓋相同 checkpoint、不降低安全限制，並重新通過完整閉環。

- 真實拖曳在 release 被清除時，必須在 `pointerup`／`mouseup` capture listener 中同步保存仍存活、非 collapsed 的 Range，再於後續 macrotask 恢復；不能只依賴 `selectionchange` 或 release timer。
- 對非 control 文字目標的 `mousedown`／`selectstart` cancellation，必須在呼叫當下中和 page-owned `preventDefault()`；property handler 的副作用仍須執行，但 `return false` 不得取消 gesture。
- Paste rollback 必須在 `paste`／`beforeinput` 標記實際 editable target，並在下一個 `input` capture 保護同一 target，不得依賴 `InputEvent.data` 或 `inputType`。短生命週期 instance `value` setter guard 或等效機制須讓原生插入先完成、拒絕 rollback，並在 resulting input checkpoint 與下一個 task 後精確還原 descriptor。
- Overlay 必須使用 geometry overlap 或在 offscreen target 進入 viewport 時可靠重掃；插入當下只做一次 `elementFromPoint()` 不足。
- 可見選取不能只覆寫 ID ancestor 自身的 `::selection`。必須以非透明、`!important`、高於 page ID-scoped descendant 規則的 selector 命中相關 ID ancestor 下的 descendants，並處理新增的 ID 或 descendant；不得硬編碼測試 fixture IDs。

## 成功條件

- [criterion:context-menu] 使用者可在一般元素、input、image、overlay 與 CSS background 元素開啟原生右鍵選單。
- [criterion:text-selection] 即使存在 `user-select:none`、`unselectable=on`、primary `mousedown` 或 `selectstart` cancellation，文字仍可選取並保持選取。
- [criterion:selection-dismissal] 選取頁面文字後，再點擊一般區域會正常折疊選取，不會恢復過期 Range。
- [criterion:keyboard-copy] Ctrl/Cmd+C 與 Ctrl/Cmd+X 不會被 listener `preventDefault()` 或 DOM `onkeydown` 的 `return false` 提前取消。
- [criterion:paste] Paste 透過瀏覽器原生 default action 抵達 editable control，且插入內容能抵抗 `beforeinput`／`input` rollback；即使 resulting input 沒有 data 或 paste-specific inputType 也成立。
- [criterion:pointer-overlays] 修復 image、video、canvas、input、textarea、editable control 的空 overlay 與 `pointer-events:none`，包括動態與 offscreen 情境。
- [criterion:selection-visibility] 即使頁面使用高 specificity ID-scoped `::selection { background:transparent !important }`，被選取文字仍有非透明背景。
- [criterion:preserve-controls] 選取頁面文字後點擊 link、button、input、textarea 或 editable field，舊 Range 會丟棄，而 control 仍保有正常 focus、編輯、導航與左鍵行為。
- [criterion:no-network] 實作不發出任何網路請求。
