const translations = {
  "zh-Hant": {
    title: "MonkeySkill 18 種方法測試矩陣",
    language: "語言",
    intro: "先關閉 Skill 確認阻擋存在，再依序測試 Standard 與 Absolute。紅色訊息代表頁面的阻擋器實際收到事件。",
    legend: ["關閉：應被阻擋", "Standard：一般事件阻擋", "Absolute：結構型／持續阻擋", "Native：瀏覽器原生差異"],
    methods: [
      ["行內事件阻擋", "oncontextmenu + onmousedown return false", "選取、複製並在這裡按右鍵。"],
      ["輸入框事件監聽器", "input 上的 contextmenu listener", "在這個 input 按右鍵"],
      ["貼上事件", "paste listener 阻止貼上", "嘗試貼上文字"],
      ["圖片事件監聽器", "圖片上的 contextmenu listener", "右鍵測試圖片"],
      ["警示框阻擋器", "右鍵時顯示 alert 並取消事件", "alert 右鍵測試圖片"],
      ["指標事件", "圖片使用 pointer-events:none", "pointer-events 測試圖片"],
      ["覆蓋層與事件", "透明 overlay 攔截 contextmenu", "overlay 測試圖片"],
      ["覆蓋層與指標事件", "圖片 pointer-events:none 且被 overlay 覆蓋", "雙重阻擋圖片"],
      ["Selectstart 事件", "selectstart listener 阻止反白", "請嘗試選取這段 Sample text。"],
      ["removeAllRanges", "mouseup／keyup／contextmenu／touchend 清除選取", "請選取這段文字並放開滑鼠，選取範圍應維持。"],
      ["鍵盤複製阻擋器", "input keydown 阻止 Ctrl/Cmd+C", "選取後按 Ctrl+C"],
      ["不可見的選取", "仍可選取，但 ::selection 強制透明", "未安裝時不應看到反白底色；Absolute 應恢復可見底色。"],
      ["輸入框覆蓋層", "透明 overlay 覆蓋可選取的 input", "選取這個 input 的文字"],
      ["貼上回滾", "input event 在一次新增超過兩字時還原內容", "貼上三個字以上"],
      ["Canvas 與覆蓋層", "canvas pointer-events:none 且被 overlay 覆蓋", ""],
      ["CSS 背景圖片", "普通元素使用 background-image", "CSS 背景圖片測試"],
      ["動態 DOM 回應性", "加入並持續變更 200 個帶 ID 的資料列，再等待排隊中的修復工作安靜", "執行回應性檢查"],
      ["大型頁面捲動回應性", "1200 組 control／overlay 與 10 個 scroll frame，包含 setup 與排隊中的修復工作", "執行捲動檢查"]
    ],
    waiting: "等待操作…",
    hints: { 6: "右鍵目標應恢復成圖片。", 8: "右鍵目標應恢復成圖片。", 12: "拖曳選取並觀察反白底色；Dark Reader 等色彩擴充可能干擾此項。", 13: "Absolute 應讓 input 重新成為事件目標。", 15: "右鍵目標應恢復成 canvas。", 16: "右鍵應開啟，但「另存新檔」會儲存 HTML，因為它不是 img。", 17: "計時包含排隊中的 observer 工作直到 DOM-quiet checkpoint，並應在 1000 ms 內完成。", 18: "先以 Skill-Off 量基線；啟用後額外耗時不得超過 500 ms、總時間不得超過 1.5 倍，且不得延遲原生滾輪。" },
    checklist: "判讀方式：Standard 著重一般事件攔截；Absolute 處理 pointer-events、overlay、持續清除選取與 paste rollback；Method 16 只展示 Chrome 原生差異；Methods 17–18 驗證動態 DOM 與大型頁面捲動仍保持回應。",
    blocked: { 1: "inline handler 阻止右鍵", 2: "input listener 阻止右鍵", 3: "paste listener 阻止貼上", 4: "image listener 阻止右鍵", 5: "alert handler 阻止右鍵", 7: "overlay listener 阻止右鍵", 9: "selectstart 阻止選取", 10: "removeAllRanges 清除選取", 11: "keydown handler 阻止 Ctrl/Cmd+C", 14: "input handler 還原了貼上內容" },
    restored: "成功：Skill 在 removeAllRanges 後恢復選取",
    performance: { running: "正在加入動態資料列…", passed: ms => `成功：${ms} ms 內完成，頁面保持回應`, failed: ms => `失敗：耗時 ${ms} ms，動態修復阻塞頁面` },
    scrollPerformance: { running: "正在建立大型頁面並測試捲動…", passed: ms => `成功：10 個捲動 frame 在 ${ms} ms 內完成`, failed: ms => `失敗：10 個捲動 frame 耗時 ${ms} ms` },
    alert: "右鍵選單已被阻擋"
  },
  en: {
    title: "MonkeySkill 18-method Test Matrix",
    language: "Language",
    intro: "Disable the Skill first to confirm each blocker, then test Standard and Absolute in order. Red messages mean the page blocker actually received the event.",
    legend: ["Off: expected to be blocked", "Standard: ordinary event blockers", "Absolute: structural and persistent blockers", "Native: browser-native differences"],
    methods: [
      ["Inline event blocking", "oncontextmenu + onmousedown return false", "Select, copy, and open the context menu here."],
      ["Input event listener", "contextmenu listener on an input", "Open the context menu on this input"],
      ["Paste event", "paste listener prevents native paste", "Try pasting text"],
      ["Image event listener", "contextmenu listener on an image", "Context-menu test image"],
      ["Alert blocker", "Shows an alert and cancels the context menu", "Alert context-menu test image"],
      ["Pointer events", "Image uses pointer-events:none", "Pointer-events test image"],
      ["Overlay + event", "Transparent overlay intercepts contextmenu", "Overlay test image"],
      ["Overlay + pointer events", "Image uses pointer-events:none under an overlay", "Double-blocked image"],
      ["Selectstart event", "selectstart listener prevents highlighting", "Try selecting this Sample text."],
      ["removeAllRanges", "mouseup / keyup / contextmenu / touchend clears selection", "Select this text and release the pointer; the range should persist."],
      ["Keyboard copy blocker", "input keydown prevents Ctrl/Cmd+C", "Select and press Ctrl+C"],
      ["Invisible selection", "Selection works, but ::selection is forced transparent", "Without the Skill, no highlight should be visible; Absolute should restore it."],
      ["Input overlay", "Transparent overlay covers a selectable input", "Select this input text"],
      ["Paste rollback", "input event restores content when more than two characters are added", "Paste three or more characters"],
      ["Canvas + overlay", "canvas uses pointer-events:none under an overlay", ""],
      ["CSS background image", "Ordinary element uses background-image", "CSS background image test"],
      ["Dynamic DOM responsiveness", "Append and mutate 200 ID-bearing rows, then wait for queued repair work to become quiet", "Run responsiveness check"],
      ["Large-page scroll responsiveness", "1200 control/overlay pairs across 10 scroll frames, including setup and queued repair work", "Run scroll check"]
    ],
    waiting: "Waiting for interaction…",
    hints: { 6: "The context-menu target should be the image again.", 8: "The context-menu target should be the image again.", 12: "Drag to select and inspect the highlight; color-transforming extensions such as Dark Reader may interfere.", 13: "Absolute should make the input the event target again.", 15: "The context-menu target should be the canvas again.", 16: "The context menu should open, but Save As stores HTML because this is not an img element.", 17: "The check includes queued observer work through a DOM-quiet checkpoint and should finish within 1000 ms.", 18: "Measure Skill-Off first; enabled overhead must stay within 500 ms and total time within 1.5x, without delaying native wheel scrolling." },
    checklist: "How to judge: Standard covers ordinary event interception. Absolute covers pointer-events, overlays, persistent selection removal, and paste rollback. Method 16 demonstrates a Chrome-native distinction; Methods 17–18 verify responsiveness under dynamic DOM changes and large-page scrolling.",
    blocked: { 1: "inline handler blocked the context menu", 2: "input listener blocked the context menu", 3: "paste listener blocked native paste", 4: "image listener blocked the context menu", 5: "alert handler blocked the context menu", 7: "overlay listener blocked the context menu", 9: "selectstart blocked selection", 10: "removeAllRanges cleared the selection", 11: "keydown handler blocked Ctrl/Cmd+C", 14: "input handler rolled back the pasted content" },
    restored: "Passed: the Skill restored selection after removeAllRanges",
    performance: { running: "Appending dynamic rows…", passed: ms => `Passed: completed in ${ms} ms and remained responsive`, failed: ms => `Failed: ${ms} ms; dynamic repair blocked the page` },
    scrollPerformance: { running: "Building a large page and testing scroll…", passed: ms => `Passed: 10 scroll frames completed in ${ms} ms`, failed: ms => `Failed: 10 scroll frames took ${ms} ms` },
    alert: "The context menu is blocked"
  }
};

const requestedLocale = new URL(location.href).searchParams.get("lang");
const LOCAL_RUNTIME_CHANGE_KEY = "monkeyskill-local-runtime-change";
let locale = requestedLocale
  || (navigator.languages?.some(language => /^zh(?:-|$)/i.test(language)) ? "zh-Hant" : "en");
if (!translations[locale]) locale = "en";

window.addEventListener("storage", event => {
  if (event.key !== LOCAL_RUNTIME_CHANGE_KEY || !event.newValue) return;
  try {
    const change = JSON.parse(event.newValue);
    if (change.skillId === "restore-right-click") location.reload();
  } catch {}
});

function applyLocale() {
  const text = translations[locale];
  document.documentElement.lang = locale;
  document.title = text.title;
  document.querySelector("h1").textContent = text.title;
  document.querySelector(".language-switch").setAttribute("aria-label", text.language);
  document.querySelector(".intro").textContent = text.intro;
  document.querySelectorAll(".legend span").forEach((node, index) => { node.textContent = text.legend[index]; });
  document.querySelectorAll(".case").forEach((section, index) => {
    const method = text.methods[index];
    section.querySelector(".description h2").textContent = method[0];
    section.querySelector(".description p").textContent = method[1];
    const fixtureText = section.querySelector(".target");
    const fixtureInput = section.querySelector(".fixture input");
    const fixtureImage = section.querySelector(".fixture img");
    const background = section.querySelector("[role=img]");
    const fixtureButton = section.querySelector(".fixture button");
    if (fixtureText && method[2]) fixtureText.textContent = method[2];
    if (fixtureInput && method[2]) {
      if (fixtureInput.hasAttribute("placeholder")) fixtureInput.placeholder = method[2];
      else fixtureInput.value = method[2];
    }
    if (fixtureImage && method[2]) fixtureImage.alt = method[2];
    if (background && method[2]) background.setAttribute("aria-label", method[2]);
    if (fixtureButton && method[2]) fixtureButton.textContent = method[2];
    const result = section.querySelector(".result");
    result.textContent = text.hints[index + 1] || text.waiting;
    result.className = index === 15 ? "result info" : "result";
  });
  document.querySelector(".checklist").textContent = text.checklist;
  for (const button of document.querySelectorAll("[data-locale]")) button.setAttribute("aria-pressed", String(button.dataset.locale === locale));
}

for (const button of document.querySelectorAll("[data-locale]")) button.addEventListener("click", () => {
  locale = button.dataset.locale;
  const url = new URL(location.href);
  url.searchParams.set("lang", locale);
  history.replaceState(null, "", url);
  applyLocale();
});

window.demoI18n = Object.freeze({
  blocked(number, fallback) { return translations[locale].blocked[number] || fallback; },
  restored() { return translations[locale].restored; },
  method10NextTarget() {
    return locale === "zh-Hant" ? "最後請拖曳選取這一段不同的文字。" : "Finally, drag-select this different passage.";
  },
  method10Restored() {
    return locale === "zh-Hant" ? "步驟 1/3：已在 removeAllRanges 後恢復選取；現在請點擊其他一般區域。" : "Step 1/3: selection restored after removeAllRanges; now click another ordinary page area.";
  },
  method10Dismissed() {
    return locale === "zh-Hant" ? "步驟 2/3：舊選取已正常折疊；現在請拖曳選取下方的另一段文字。" : "Step 2/3: the stale selection collapsed; now drag-select the different passage below.";
  },
  method10Passed() {
    return locale === "zh-Hant" ? "通過：恢復、清除與後續新選取皆正常。" : "Passed: restore, dismissal, and a subsequent fresh selection all work.";
  },
  performanceRunning() { return translations[locale].performance.running; },
  performanceResult(elapsed, passed) { return translations[locale].performance[passed ? "passed" : "failed"](elapsed); },
  scrollPerformanceRunning() { return translations[locale].scrollPerformance.running; },
  scrollPerformanceResult(elapsed) {
    return locale === "zh-Hant"
      ? `完成：10 個捲動 frame 耗時 ${elapsed} ms；請與同裝置的 Skill-Off 基線比較`
      : `Completed: 10 scroll frames took ${elapsed} ms; compare with the Skill-Off baseline on this device`;
  },
  alertMessage() { return translations[locale].alert; }
});

applyLocale();
