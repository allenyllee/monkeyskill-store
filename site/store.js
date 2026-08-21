const catalog = document.querySelector("#catalog");
const template = document.querySelector("#skill-template");
const connection = document.querySelector("#connection");
const count = document.querySelector("#count");
const notice = document.querySelector("#notice");
const dialog = document.querySelector("#decision-dialog");
const dialogEyebrow = document.querySelector("#dialog-eyebrow");
const dialogTitle = document.querySelector("#dialog-title");
const dialogCopy = document.querySelector("#dialog-copy");
const dialogDetails = document.querySelector("#dialog-details");
const dialogConfirm = document.querySelector("#dialog-confirm");
const pendingRequests = new Map();
const instructionCache = new Map();
const LOCAL_RUNTIME_CHANGE_KEY = "monkeyskill-local-runtime-change";
const messages = {
  "zh-Hant": {
    connecting: "正在連線至 Extension…", ready: "Extension 已連線", missing: "未偵測到 MonkeySkill Extension",
    heroEyebrow: "安裝能力，而不是更多擴充功能", heroTitle: "需要的功能，\n現在才生成。", heroCopy: "這個 Store 發布人類可讀的 MSkill 規格與受限的固定回歸測試。MonkeySkill Extension 會使用你的 LLM 生成 Build，通過差分安全、開發者回歸、公開與獨立測試後，再請你核准安裝。",
    catalogEyebrow: "社群目錄", catalogTitle: "可用的 MSkills", installed: "已安裝", available: "可用", regenerate: "重新生成", install: "使用 MonkeySkill 安裝", demo: "開啟測試頁", modes: "模式",
    installedStatus: "已安裝；可重新生成更新。", availableStatus: "由你的 LLM 即時生成後安裝。", viewSource: "查看 Skill 內容", sourceHint: "展開後載入人類可讀的 Skill 內容。", loadingSource: "正在載入 Skill 內容…",
    cancel: "取消", start: "是，開始生成", approve: "是，核准安裝", installTitle: "安裝 {name}？", installCopy: "Store 會傳送 skill.json、人類可讀的 SKILL.md，以及只能阻擋、不能授權的受限 Developer Conformance。Builder 不會看到測試內容。", approveTitle: "核准安裝生成的 Build？",
    footerGithub: "GitHub、投稿與 Fork", footerNote: "Store 不包含生成的 JavaScript。", sameOrigin: "Skill 內容必須來自相同來源。", loadSource: "無法載入 Skill 內容。", securityExample: "⚠ 惡意安全測試樣本：預期 Tester 拒絕，絕不應產生或安裝 Build。", testSecurity: "測試安全閘門",
    runnerBootstrap: "Runner Bootstrap", bootstrapStatus: "展開閱讀內容後，讓 Extension 核對此版本、完整 package hash 與 protocol，再複製給本機 Agent。", copyBootstrap: "複製已驗證的 Bootstrap prompt", verifyingBootstrap: "Extension 正在重新下載並驗證 Bootstrap…", copiedBootstrap: "已由 Extension 驗證並複製 v{version}（{hash}…）。", copyFailed: "無法取得已驗證的 Bootstrap prompt：{error}"
  },
  en: {
    connecting: "Connecting to Extension…", ready: "Extension connected", missing: "MonkeySkill Extension not detected",
    heroEyebrow: "INSTALL ABILITIES, NOT EXTENSIONS", heroTitle: "Generate the ability\nwhen you need it.", heroCopy: "This Store publishes human-readable MSkill specifications with constrained, versioned regression tests. MonkeySkill validates differential security, developer conformance, public tests, and independent tests before approval.",
    catalogEyebrow: "COMMUNITY CATALOG", catalogTitle: "Available MSkills", installed: "Installed", available: "Available", regenerate: "Regenerate", install: "Install with MonkeySkill", demo: "Open test page", modes: "Modes",
    installedStatus: "Installed; regenerate to update.", availableStatus: "Generated on demand by your LLM before installation.", viewSource: "View Skill content", sourceHint: "Expand to load the human-readable Skill content.", loadingSource: "Loading Skill content…",
    cancel: "Cancel", start: "Yes, start generation", approve: "Yes, approve installation", installTitle: "Install {name}?", installCopy: "The Store sends skill.json, human-readable SKILL.md, and constrained Developer Conformance that may block but never authorize a build. Builder never sees its test content.", approveTitle: "Approve the generated Build?",
    footerGithub: "GitHub, contribute, and fork", footerNote: "The Store contains no generated JavaScript.", sameOrigin: "Skill content must come from the same origin.", loadSource: "Unable to load Skill content.", securityExample: "⚠ Malicious security sample: Tester must reject it; no Build should be generated or installed.", testSecurity: "Test security gate",
    runnerBootstrap: "Runner Bootstrap", bootstrapStatus: "Read the content, then let the Extension verify this version, complete package hash, and protocol before copying it to your local agent.", copyBootstrap: "Copy verified Bootstrap prompt", verifyingBootstrap: "The Extension is downloading and verifying the Bootstrap…", copiedBootstrap: "Extension-verified v{version} copied ({hash}…).", copyFailed: "Unable to obtain a verified Bootstrap prompt: {error}"
  }
};
let locale = localStorage.getItem("monkeyskill-store-locale")
  || (navigator.languages?.some(language => /^zh(?:-|$)/i.test(language)) ? "zh-Hant" : "en");
if (!messages[locale]) locale = "en";
const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), messages[locale][key]);
const localizedSkill = skill => ({ ...skill, ...(skill.localized?.[locale] || skill.localized?.en || {}) });

if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  window.monkeySkillClosedLoop = Object.freeze({
    async setMode(skillId, mode) {
      const response = await rpc("set-test-mode", skillId, { mode }, 3000);
      if (response?.ok) announceLocalRuntimeChange(skillId, "mode");
      return response;
    }
  });
}
let skills = [];
let installed = new Map();
let extensionReady = false;

function applyLocale() {
  document.documentElement.lang = locale;
  const keys = {
    "hero.eyebrow": "heroEyebrow", "hero.title": "heroTitle", "hero.copy": "heroCopy",
    "catalog.eyebrow": "catalogEyebrow", "catalog.title": "catalogTitle", "card.modes": "modes",
    "card.install": "install", "card.demo": "demo", "card.viewSource": "viewSource", "card.sourceHint": "sourceHint",
    "dialog.cancel": "cancel", "footer.github": "footerGithub", "footer.note": "footerNote"
  };
  for (const element of document.querySelectorAll("[data-i18n]")) element.textContent = t(keys[element.dataset.i18n]);
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) element.setAttribute("aria-label", t(keys[element.dataset.i18nAriaLabel]));
  for (const button of document.querySelectorAll("[data-locale]")) button.setAttribute("aria-pressed", String(button.dataset.locale === locale));
  connection.textContent = t(extensionReady ? "ready" : "connecting");
  renderCatalog();
}

for (const button of document.querySelectorAll("[data-locale]")) button.addEventListener("click", () => {
  locale = button.dataset.locale;
  localStorage.setItem("monkeyskill-store-locale", locale);
  instructionCache.clear();
  applyLocale();
});
applyLocale();

window.addEventListener("message", event => {
  const message = event.data;
  if (event.source !== window || event.origin !== location.origin || message?.source !== "monkeyskill-extension") return;
  if (message.type === "ready") {
    markExtensionReady();
    return;
  }
  const request = pendingRequests.get(message.requestId);
  if (!request) return;
  clearTimeout(request.timeout);
  pendingRequests.delete(message.requestId);
  request.resolve(message.response);
});

void probeExtension();
void initialize();
void reloadExtensionForLocalDevelopment();

async function reloadExtensionForLocalDevelopment() {
  const local = location.protocol === "http:"
    && ["127.0.0.1", "localhost"].includes(location.hostname)
    && location.port === "4174";
  const url = new URL(location.href);
  if (!local || url.searchParams.get("reload-extension") !== "1") return;
  url.searchParams.delete("reload-extension");
  history.replaceState(null, "", url);
  try {
    const response = await rpc("reload-extension", null, {}, 3000);
    if (!response?.ok) throw new Error(response?.error || "Extension reload failed.");
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function probeExtension() {
  for (const delay of [0, 300, 900]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (extensionReady) return;
    try {
      const response = await rpc("ping", null, {}, 500);
      if (response?.ok) return markExtensionReady();
    } catch {}
  }
}

function markExtensionReady() {
  if (extensionReady) return;
  extensionReady = true;
  connection.textContent = t("ready");
  connection.classList.add("ready");
  void setTestModeForLocalDevelopment();
  void inspectWorkflowForLocalDevelopment();
  void refreshInstalled();
}

async function inspectWorkflowForLocalDevelopment() {
  const local = location.protocol === "http:"
    && ["127.0.0.1", "localhost"].includes(location.hostname)
    && location.port === "4174";
  const url = new URL(location.href);
  const skillId = url.searchParams.get("inspect-workflow");
  if (!local || !skillId) return;
  url.searchParams.delete("inspect-workflow");
  history.replaceState(null, "", url);
  const [status, pending] = await Promise.all([
    rpc("status", skillId, {}, 3000),
    rpc("pending", skillId, {}, 3000)
  ]);
  const draft = pending?.draft;
  showNotice(JSON.stringify({
    state: status?.job?.state || null,
    error: status?.job?.error || null,
    pending: Boolean(draft),
    hash: draft?.generation?.hash?.slice(0, 16) || null,
    attempts: draft?.generation?.attempts || null
  }), !status?.ok || !pending?.ok);
}

async function setTestModeForLocalDevelopment() {
  const local = location.protocol === "http:"
    && ["127.0.0.1", "localhost"].includes(location.hostname)
    && location.port === "4174";
  const url = new URL(location.href);
  const mode = url.searchParams.get("set-test-mode");
  const skillId = url.searchParams.get("skill-id");
  if (!local || !mode || !skillId) return;
  url.searchParams.delete("set-test-mode");
  url.searchParams.delete("skill-id");
  history.replaceState(null, "", url);
  const response = await rpc("set-test-mode", skillId, { mode }, 3000);
  if (response?.ok) announceLocalRuntimeChange(skillId, "mode");
  showNotice(response?.ok ? `${skillId} test mode: ${mode}` : response?.error || "Mode switch failed.", !response?.ok);
}

function announceLocalRuntimeChange(skillId, reason) {
  localStorage.setItem(LOCAL_RUNTIME_CHANGE_KEY, JSON.stringify({ skillId, reason, at: Date.now() }));
}

async function initialize() {
  try {
    const response = await fetch("catalog.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load catalog.json");
    const value = await response.json();
    if (value.schemaVersion !== 1 || !Array.isArray(value.skills)) throw new Error("Unsupported Store catalog.");
    skills = value.skills;
    renderCatalog();
    setTimeout(() => {
      if (!extensionReady) connection.textContent = t("missing");
    }, 2400);
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function refreshInstalled() {
  try {
    const response = await rpc("list", null, {}, 5000);
    if (!response.ok) throw new Error(response.error);
    installed = new Map(response.skills.map(skill => [skill.id, skill]));
    renderCatalog();
    await restoreWorkflow();
  } catch (error) {
    showNotice(error.message, true);
  }
}

function renderCatalog() {
  catalog.replaceChildren();
  count.textContent = `${skills.length} MSKILL${skills.length === 1 ? "" : "S"}`;
  for (const skill of skills) {
    const displaySkill = localizedSkill(skill);
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.skillId = skill.id;
    const isBootstrap = skill.artifactType === "runner-bootstrap";
    card.classList.toggle("runner-bootstrap", isBootstrap);
    card.querySelector("h3").textContent = displaySkill.name;
    card.querySelector(".version").textContent = `v${skill.version}`;
    card.querySelector(".description").textContent = displaySkill.description;
    const securityWarning = card.querySelector(".security-warning");
    if (skill.securityExample) {
      securityWarning.textContent = t("securityExample");
      securityWarning.hidden = false;
    }
    card.querySelector(".badge").textContent = isBootstrap ? t("runnerBootstrap") : t(installed.has(skill.id) ? "installed" : "available");
    card.querySelector(".skill-status").textContent = installed.has(skill.id)
      ? "已安裝；可重新生成更新。"
      : "由你的 LLM 生成後安裝。";
    card.querySelector(".skill-status").textContent = isBootstrap ? t("bootstrapStatus") : t(installed.has(skill.id) ? "installedStatus" : "availableStatus");
    for (const mode of skill.modes) {
      const pill = document.createElement("span");
      pill.textContent = mode;
      card.querySelector(".modes").append(pill);
    }
    const button = card.querySelector(".install");
    button.textContent = installed.has(skill.id) ? "重新生成" : "使用 MonkeySkill 安裝";
    button.textContent = skill.securityExample ? t("testSecurity") : t(installed.has(skill.id) ? "regenerate" : "install");
    button.hidden = isBootstrap;
    if (!isBootstrap) button.addEventListener("click", () => beginInstall(skill));
    const copyBootstrap = card.querySelector(".copy-bootstrap");
    if (isBootstrap) {
      copyBootstrap.hidden = false;
      copyBootstrap.textContent = t("copyBootstrap");
      copyBootstrap.addEventListener("click", () => copyVerifiedBootstrapPrompt(skill, copyBootstrap));
    }
    const demo = card.querySelector(".demo");
    demo.textContent = t("demo");
    card.querySelector(".modes").setAttribute("aria-label", t("modes"));
    if (skill.demoUrl) {
      const demoUrl = new URL(skill.demoUrl, location.href);
      if (demoUrl.origin === location.origin) {
        demoUrl.searchParams.set("lang", locale);
        demo.href = demoUrl.href;
        demo.hidden = false;
      }
    }
    const source = card.querySelector(".skill-source");
    source.querySelector("summary").textContent = t("viewSource");
    source.querySelector(".skill-source-status").textContent = t("sourceHint");
    source.addEventListener("toggle", () => {
      if (source.open) void revealSkillSource(skill, source);
    });
    catalog.append(card);
  }
}

async function revealSkillSource(skill, container) {
  const status = container.querySelector(".skill-source-status");
  const content = container.querySelector(".skill-source-content");
  if (content.dataset.loaded === "true") return;
  status.hidden = false;
  status.textContent = "正在載入 SKILL.md…";
  status.textContent = t("loadingSource");
  status.classList.remove("error");
  try {
    const displaySkill = localizedSkill(skill);
    const cacheKey = `${skill.id}:${locale}`;
    let instructions = instructionCache.get(cacheKey);
    if (!instructions) {
      const bootstrapInstructions = skill.bootstrapUrl
        ? new URL("SKILL.md", new URL(skill.bootstrapUrl, location.href))
        : null;
      if (bootstrapInstructions && locale === "zh-Hant") bootstrapInstructions.pathname = bootstrapInstructions.pathname.replace(/SKILL\.md$/, "SKILL.zh-Hant.md");
      const instructionsUrl = bootstrapInstructions || new URL(displaySkill.instructionsUrl || skill.instructionsUrl, location.href);
      if (instructionsUrl.origin !== location.origin) throw new Error("Skill 內容必須來自相同來源。");
      const response = await fetch(instructionsUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("無法載入 SKILL.md。");
      instructions = await response.text();
      instructionCache.set(cacheKey, instructions);
    }
    content.textContent = instructions;
    content.dataset.loaded = "true";
    content.hidden = false;
    status.hidden = true;
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }
}

async function copyVerifiedBootstrapPrompt(skill, button) {
  const originalText = button.textContent;
  try {
    if (!extensionReady) throw new Error(t("missing"));
    const url = new URL(skill.bootstrapUrl, location.href);
    if (url.origin !== location.origin) throw new Error(t("sameOrigin"));
    if (!/^[a-f0-9]{64}$/.test(skill.bootstrapPackageHash)) throw new Error("Invalid Store package hash.");
    button.disabled = true;
    button.textContent = t("verifyingBootstrap");
    const response = await rpc("verify-bootstrap", skill.id, {
      bootstrap: {
        id: skill.id,
        version: skill.version,
        bootstrapUrl: url.href,
        packageHash: skill.bootstrapPackageHash
      }
    }, 30_000);
    if (!response?.ok) throw new Error(response?.error || "Extension verification failed.");
    showNotice(t("copiedBootstrap", {
      version: response.version,
      hash: response.packageHashPrefix
    }), false);
  } catch (error) {
    showNotice(t("copyFailed", { error: error.message }), true);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function beginInstall(skill) {
  try {
    if (!extensionReady) throw new Error(locale === "zh-Hant" ? "請先安裝並啟用 MonkeySkill Extension。" : "Install and enable MonkeySkill Extension first.");
    const accepted = await ask({
      eyebrow: "INSTALL MSKILL",
      title: t("installTitle", { name: localizedSkill(skill).name }),
      copy: t("installCopy"),
      confirm: t("start")
    });
    if (!accepted) return;
    setBusy(skill.id, true, "讀取規格並交給 LLM…");
    const skillPackage = await loadSkillPackage(skill);
    const response = await rpc("generate", skill.id, { skillPackage }, 15000);
    if (!response.ok) throw new Error(response.error);
    const draft = await waitForGeneration(skill.id);
    await reviewDraft(draft);
  } catch (error) {
    showFailedNotice(skill, error.message);
  } finally {
    setBusy(skill.id, false);
  }
}

async function loadSkillPackage(entry) {
  const manifestUrl = new URL(entry.manifestUrl, location.href);
  const instructionsUrl = new URL(entry.instructionsUrl, location.href);
  if (manifestUrl.origin !== location.origin || instructionsUrl.origin !== location.origin) {
    throw new Error("Catalog entries must use same-origin Skill files.");
  }
  const conformanceUrl = entry.conformanceUrl ? new URL(entry.conformanceUrl, location.href) : null;
  if (conformanceUrl && conformanceUrl.origin !== location.origin) throw new Error("Developer Conformance must come from the same origin.");
  const [manifestResponse, instructionsResponse, conformanceResponse] = await Promise.all([
    fetch(manifestUrl, { cache: "no-store" }),
    fetch(instructionsUrl, { cache: "no-store" }),
    conformanceUrl ? fetch(conformanceUrl, { cache: "no-store" }) : null
  ]);
  if (!manifestResponse.ok || !instructionsResponse.ok || conformanceResponse && !conformanceResponse.ok) throw new Error("Unable to load the MSkill specification.");
  const skill = await manifestResponse.json();
  if (skill.id !== entry.id || skill.version !== entry.version) throw new Error("Catalog and Skill manifest do not match.");
  return {
    skill,
    instructions: await instructionsResponse.text(),
    ...(conformanceResponse ? { developerConformance: await conformanceResponse.json() } : {})
  };
}

async function reviewDraft(draft) {
  const approved = await ask({
    eyebrow: "VALIDATION PASSED",
    title: t("approveTitle"),
    copy: draft.summary,
    details: [
      `Model: ${draft.generation.model}`,
      `Tester: ${draft.generation.testerModel}`,
      `Generation attempts: ${draft.generation.attempts}`,
      `Builder TestSpec: ${draft.publicTestCount - (draft.publicTestInconclusiveCount || 0)}/${draft.publicTestCount}`,
      `Developer Conformance: ${draft.developerConformancePassCount}/${draft.developerConformanceCount}`,
      `Independent TestSpec: ${draft.independentTestCount - (draft.independentTestInconclusiveCount || 0)}/${draft.independentTestCount}`,
      `Hash: ${draft.generation.hash.slice(0, 16)}`,
      `Validation: ${draft.validation.join(", ")}`
    ].join("\n"),
    confirm: t("approve")
  });
  if (!approved) {
    await rpc("discard", draft.skillId);
    showNotice("已捨棄生成的 Build。", false);
    return;
  }
  const response = await rpc("approve", draft.skillId, {}, 120000);
  if (!response.ok) throw new Error(response.error);
  installed.set(draft.skillId, response.skill);
  renderCatalog();
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    announceLocalRuntimeChange(draft.skillId, "install");
  }
  showNotice(`${draft.skillName} 已安裝。`, false);
}

async function restoreWorkflow() {
  for (const skill of skills) {
    const [statusResponse, pendingResponse] = await Promise.all([
      rpc("status", skill.id),
      rpc("pending", skill.id)
    ]);
    const job = statusResponse.job;
    if (job?.state === "running") {
      setBusy(skill.id, true, "LLM 生成與驗證中…");
      try { await reviewDraft(await waitForGeneration(skill.id)); }
      catch (error) { showFailedNotice(skill, error.message); }
    } else if (job?.state === "failed") {
      showFailedNotice(skill, job.error);
    } else if (pendingResponse.draft) {
      await reviewDraft(pendingResponse.draft);
    }
  }
}

async function waitForGeneration(skillId) {
  const deadline = Date.now() + 90 * 60 * 1000;
  while (Date.now() < deadline) {
    const response = await rpc("status", skillId);
    if (!response.ok) throw new Error(response.error);
    if (response.job?.state === "failed") throw new Error(response.job.error || "生成失敗。");
    if (response.job?.state === "ready") {
      const pending = await rpc("pending", skillId);
      if (pending.draft) return pending.draft;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("生成逾時，請稍後重試。");
}

function rpc(action, skillId, payload = {}, timeoutMs = 10000) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("MonkeySkill Extension 回應逾時。"));
    }, timeoutMs);
    pendingRequests.set(requestId, { resolve, timeout });
    window.postMessage({ source: "monkeyskill-store", requestId, action, skillId, ...payload }, location.origin);
  });
}

function ask({ eyebrow, title, copy, details = "", confirm }) {
  dialogEyebrow.textContent = eyebrow;
  dialogTitle.textContent = title;
  dialogCopy.textContent = copy;
  dialogDetails.textContent = details;
  dialogDetails.hidden = !details;
  dialogConfirm.textContent = confirm;
  dialog.showModal();
  return new Promise(resolve => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

function setBusy(skillId, busy, text = "") {
  const card = catalog.querySelector(`[data-skill-id="${CSS.escape(skillId)}"]`);
  if (!card) return;
  card.querySelector("button").disabled = busy;
  if (text) card.querySelector(".skill-status").textContent = text;
}

function showNotice(message, error) {
  notice.hidden = false;
  notice.textContent = message;
  notice.classList.toggle("error", error);
}

function showFailedNotice(skill, message) {
  showNotice(`上次生成失敗：${message}`, true);
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "清除紀錄";
  clear.addEventListener("click", async () => {
    const response = await rpc("clear-history", skill.id);
    if (!response.ok) return showNotice(response.error, true);
    notice.hidden = true;
  });
  notice.append(document.createTextNode(" "), clear);
}
