# 恢復右鍵、選取與複製

## 目標

恢復被網站刻意封鎖的瀏覽器右鍵選單、文字選取、複製、剪下、貼上與拖曳功能。

## Standard 模式

- 讓原生 `contextmenu` 繼續出現，但在頁面收到 context-menu dispatch 前停止傳遞，避免 alert 等干擾性副作用執行。對 `copy`、`cut`、`selectstart`、`dragstart`，則中和取消並保留一般非取消行為；同時處理阻擋選取的 primary `mousedown` 和阻擋 Ctrl/Cmd+C、Ctrl/Cmd+X 的 `keydown`。
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

- 真實拖曳在 release 被清除時，必須在 `pointerup`／`mouseup` capture listener 中同步保存仍存活、非 collapsed 的 Range，再於後續 macrotask 恢復；不能只依賴 `selectionchange` 或 release timer。每個延後恢復 checkpoint 必須 idempotent：目前 selection 已非 collapsed 時，不得再次呼叫 `removeAllRanges()`／`addRange()` 重套同一 Range。頁面再次清除後可以再恢復，但 selection 已存在時的多餘重寫可能鎖死瀏覽器選取流程。只有在 `addRange()` 已回傳且即時重新檢查 Selection 確實為非 collapsed 後，才能把恢復 checkpoint 標記完成；若寫入失敗、丟出例外或沒有生效，後續有限次 checkpoint 仍必須能重試。恢復視窗結束後必須清除保存的 Range、gesture、release record 與 timers，讓後續點擊及新拖曳從乾淨狀態開始。release-clear 測試必須對 `drag-select-text` step 使用 `selection-write-count` 並要求 `lte 5`，涵蓋可信初始選取、一次頁面清除與一次 Skill 恢復。
- 對非 control 文字目標的 `mousedown`／`selectstart` cancellation，必須在呼叫當下中和 page-owned `preventDefault()`；property handler 的副作用仍須執行，但 `return false` 不得取消 gesture。
- 兩種模式都必須保留瀏覽器原本的事件註冊 API。不得改寫 `EventTarget.prototype.addEventListener` 或 `removeEventListener`，也不得靜默丟棄之後註冊的 `contextmenu`、`copy`、`cut`、`selectstart`、`dragstart`、paste、mouse 或 pointer registration。對 `contextmenu`，必須在最早事件 checkpoint 停止頁面傳遞但不取消瀏覽器 default，使 alert 等干擾性副作用不執行；late `flag-only` context-menu 測試須為 call count 0 且事件未取消。其他 protected listener 或 DOM property handler 仍須執行一次並保留非取消性的副作用，只能中和取消嘗試，測試須為 call count 1 且 `event.defaultPrevented === false`。
- 不得在整個頁面替換 `Event.prototype.preventDefault`。永久 prototype wrapper 會介入大型應用程式的每個無關事件，與頁面或其他擴充的 wrapper 疊加時可能讓既有分頁失去回應。若必須在呼叫當下中和取消，只能在最早 capture checkpoint 暫時 shadow 該次受保護 event instance 的 `preventDefault`；除上述明確的 context-menu suppression 外，仍須讓頁面 handler 執行並保留副作用，dispatch 結束後移除 instance override；一般事件必須繼續使用原本的 prototype method 與取消語義。
- Paste rollback 必須在 `paste`／`beforeinput` 標記實際 editable target，並在下一個 `input` capture 保護同一 target，不得依賴 `InputEvent.data` 或 `inputType`。短生命週期 instance `value` setter guard 或等效機制須讓原生插入先完成、拒絕 rollback，並在 resulting input checkpoint 與下一個 task 後精確還原 descriptor。
- Overlay 必須使用 geometry overlap 或在 offscreen target 進入 viewport 時可靠重掃；插入當下只做一次 `elementFromPoint()` 不足。必須同時辨識 computed author style 與 inline style 所造成的定位；真實頁面常以 CSS class 定位空 overlay，僅比對 `style` attribute 不得通過驗證。
- 可見選取不能只覆寫 ID ancestor 自身的 `::selection`。必須以非透明、`!important`、高於 page ID-scoped descendant 規則的 selector 命中相關 ID ancestor 下的 descendants，並處理新增的 ID 或 descendant；不得硬編碼測試 fixture IDs。
- 大型單頁應用上的動態修復必須有界。將 mutation 工作批次化或 debounce，只檢查新增／變動 subtree，並忽略 Skill 自身 style 或 marker 更新造成的 mutation。啟動成本也必須與既有頁面大小解耦：不得同步走訪大型 document 的每個元素，也不得替每個一般元素寫入 inline selection style；應優先使用廣域 stylesheet 加上針對 blocker 的 selector，或把不可避免的走訪切成多個 task。不得把 document IDs 枚舉進 selection CSS，也不得隨 ID 增加而反覆重建累積 selector 清單；應使用與頁面內容無關、固定大小的高 specificity selector，例如以多個不命中的 `:not(#sentinel)` ID pseudo-class 提高 specificity，或其他同樣有界且能壓過 ID-scoped author style 的規則。Selection stylesheet 的大小與 rewrite 次數不得隨頁面 ID 數量成長。可信 Runner 以 20 批加入 200 個帶 ID 的資料列時，計時須包含整份 sandbox document 中排隊的 observer 與 stylesheet 工作直到 DOM-quiet checkpoint，並在 400 ms 內完成。不得無條件重寫 style 或形成 observer 自我觸發迴圈。
- Style 與 layout read 也計入 mutation 預算。不得把新增 subtree 的每個普通 descendant 都排入佇列並逐一呼叫 `getComputedStyle()`；應先以窄範圍 candidate selector 找出 blocked pointer target、`unselectable`、inline blocker attribute，以及只有需要 ID-specific selection 規則的模式才處理 ID，再檢查這些 matches。單一 flush 必須在小型有界 batch 後讓出主執行緒；一次處理數百個普通元素的 style/layout read 並不算有界。啟動時也不得遞迴 enqueue `document.documentElement` 再同步 drain，普通情境應使用廣域 CSS，例外 blocker 才做增量 targeted scan。
- 捲動處理的成本必須與整份 document 的大小解耦。不得在每個 `scroll` event 或 animation frame 查詢所有一般元素，或把所有 overlay candidate 與所有 pointer target 做交叉幾何比較。應維護有界的未解決候選索引，只讓受影響的 geometry 失效，並增量處理 viewport 相關工作。Mutation flush 與 scroll frame 都必須有總工作預算：flush 不得遍歷所有累積 overlay；每次 scroll 也不得先把全域 target index 標成失效，再由下一個 repair 走訪所有 target 重建。可信 `scroll-stress` 工作流會用單一 live `DocumentFragment` 插入 1200 個 sibling roots，計時包含候選 setup、真實 layout checkpoint 與 10 個 scroll frame 的 observer 工作直到 DOM-quiet checkpoint，並須在 400 ms 內完成。不得對同一批大量新增的每個普通 sibling root 分別執行一次 `querySelectorAll()` subtree scan；應先低成本篩選、合併批次候選查找，或跨 task 有界處理。真實 Demo 先量 Skill-Off 基線，各啟用模式增加不得超過 500 ms，總時間不得超過基線 1.5 倍，且不能延遲原生滾輪捲動。

## 成功條件

- [criterion:context-menu] 使用者可在一般元素、input、image、overlay 與 CSS background 元素開啟原生右鍵選單，且 alert 等干擾性頁面 context-menu 副作用不得執行。兩種模式的 late `flag-only` context-menu listener 或 DOM property handler 必須保持已註冊但 call count 為 0，可信 dispatch 仍未取消。實作不得改寫全域 EventTarget 註冊方法、不得取消瀏覽器 default，也不得抑制無關的左鍵或 control 行為。
- [criterion:text-selection] 即使存在 `user-select:none`、`unselectable=on`、primary `mousedown` 或 `selectstart` cancellation，文字仍可選取並保持選取。Absolute release-clear 測試還必須在 `drag-select-text` step 斷言 `selection-write-count lte 5`，避免延後恢復對已存在的 Range 重複寫入並鎖死頁面。
- [criterion:selection-dismissal] 選取頁面文字後，再點擊另一個一般區域會正常折疊選取，不會恢復過期 Range；同一測試接著必須能拖曳選取另一段不同文字並得到新的非 collapsed 選取，證明恢復狀態與事件保護已釋放，不會鎖住後續互動。
- [criterion:keyboard-copy] Ctrl/Cmd+C 與 Ctrl/Cmd+X 不會被 listener `preventDefault()` 或 DOM `onkeydown` 的 `return false` 提前取消。
- [criterion:paste] Paste 透過瀏覽器原生 default action 抵達 editable control，且插入內容能抵抗 `beforeinput`／`input` rollback；即使 resulting input 沒有 data 或 paste-specific inputType 也成立。
- [criterion:pointer-overlays] 修復 image、video、canvas、input、textarea、editable control 的空 overlay 與 `pointer-events:none`，包括動態與 offscreen 情境。至少一個 overlay 測試必須由 fixture author rule 或 class 定位，而非把 position 寫在 inline `style` attribute。
- [criterion:selection-visibility] 即使頁面使用高 specificity ID-scoped `::selection { background:transparent !important }`，被選取文字仍有非透明背景。
- [criterion:preserve-controls] 選取頁面文字後點擊 link、button、input、textarea 或 editable field，舊 Range 會丟棄，而 control 仍保有正常 focus、編輯、導航與左鍵行為。
- [criterion:dynamic-performance] Standard 與 Absolute 在啟動時、持續動態 DOM 變動、排隊中的 observer 修復完成前後，以及大型單頁應用的原生捲動期間都須保持回應。可信 Runner 的 `startup-stress` 會在候選安裝前先建立 1200 組既有 control／overlay，另以 `mutation-burst` 測試 20 批、200 個帶 ID 的資料列，並以具實際 layout checkpoint 的獨立 `scroll-stress` 用單一 live `DocumentFragment` 插入 1200 個 control／overlay sibling roots，再跑 10 個 scroll frame；三者都包含整份 sandbox document 的 DOM-quiet checkpoint，並須在 400 ms 內完成。實作不得同步走訪既有大型頁面的每個元素、啟動時遞迴 drain `document.documentElement`、對每個新增普通 descendant 呼叫 `getComputedStyle()`、對同一 mutation delivery 的每個普通 sibling root 分別執行一次 `querySelectorAll()` subtree scan、在單一 flush 執行數百次 style/layout read、對每個排隊中的 overlay 分別呼叫 `elementsFromPoint()` 或等價的強制 layout hit test、形成 observer 自我觸發迴圈、把 document IDs 枚舉進持續增長的 selection stylesheet、跨多個 flush 重建累積 ID selector 清單、在 mutation flush 遍歷所有累積 overlay、每次 scroll 重建全域 target index、做整份 document 的 geometry 交叉比較、延遲滾輪捲動，或讓一般頁面互動失去回應。兩種模式都要分別測試三個工作流。真實 Demo 應先記錄 Skill-Off 基線；各啟用模式的額外耗時不得超過 500 ms，且總時間不得高於基線的 1.5 倍，並且不能出現持續忙碌游標或多秒主執行緒停頓。
- [criterion:no-network] 實作不發出任何網路請求。
