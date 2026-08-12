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

if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
  window.monkeySkillClosedLoop = Object.freeze({
    setMode(skillId, mode) {
      return rpc("set-test-mode", skillId, { mode }, 3000);
    }
  });
}
let skills = [];
let installed = new Map();
let extensionReady = false;

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
  connection.textContent = "Extension connected";
  connection.classList.add("ready");
  void setTestModeForLocalDevelopment();
  void refreshInstalled();
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
  showNotice(response?.ok ? `${skillId} test mode: ${mode}` : response?.error || "Mode switch failed.", !response?.ok);
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
      if (!extensionReady) connection.textContent = "MonkeySkill Extension not detected";
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
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.skillId = skill.id;
    card.querySelector("h3").textContent = skill.name;
    card.querySelector(".version").textContent = `v${skill.version}`;
    card.querySelector(".description").textContent = skill.description;
    card.querySelector(".badge").textContent = installed.has(skill.id) ? "Installed" : "Available";
    card.querySelector(".skill-status").textContent = installed.has(skill.id)
      ? "已安裝；可重新生成更新。"
      : "由你的 LLM 生成後安裝。";
    for (const mode of skill.modes) {
      const pill = document.createElement("span");
      pill.textContent = mode;
      card.querySelector(".modes").append(pill);
    }
    const button = card.querySelector(".install");
    button.textContent = installed.has(skill.id) ? "重新生成" : "使用 MonkeySkill 安裝";
    button.addEventListener("click", () => beginInstall(skill));
    const demo = card.querySelector(".demo");
    if (skill.demoUrl) {
      const demoUrl = new URL(skill.demoUrl, location.href);
      if (demoUrl.origin === location.origin) {
        demo.href = demoUrl.href;
        demo.hidden = false;
      }
    }
    catalog.append(card);
  }
}

async function beginInstall(skill) {
  try {
    if (!extensionReady) throw new Error("請先安裝並啟用 MonkeySkill Extension。");
    const accepted = await ask({
      eyebrow: "INSTALL MSKILL",
      title: `安裝 ${skill.name}？`,
      copy: "Store 只會傳送 skill.json 與人類可讀的 SKILL.md。Builder 與獨立 Tester 會在你的 Extension 中生成及驗證 Build。",
      confirm: "是，開始生成"
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
  const [manifestResponse, instructionsResponse] = await Promise.all([
    fetch(manifestUrl, { cache: "no-store" }),
    fetch(instructionsUrl, { cache: "no-store" })
  ]);
  if (!manifestResponse.ok || !instructionsResponse.ok) throw new Error("Unable to load the MSkill specification.");
  const skill = await manifestResponse.json();
  if (skill.id !== entry.id || skill.version !== entry.version) throw new Error("Catalog and Skill manifest do not match.");
  return { skill, instructions: await instructionsResponse.text() };
}

async function reviewDraft(draft) {
  const approved = await ask({
    eyebrow: "VALIDATION PASSED",
    title: "核准安裝生成的 Build？",
    copy: draft.summary,
    details: [
      `Model: ${draft.generation.model}`,
      `Tester: ${draft.generation.testerModel}`,
      `Generation attempts: ${draft.generation.attempts}`,
      `Builder TestSpec: ${draft.publicTestCount - (draft.publicTestInconclusiveCount || 0)}/${draft.publicTestCount}`,
      `Independent TestSpec: ${draft.independentTestCount - (draft.independentTestInconclusiveCount || 0)}/${draft.independentTestCount}`,
      `Hash: ${draft.generation.hash.slice(0, 16)}`,
      `Validation: ${draft.validation.join(", ")}`
    ].join("\n"),
    confirm: "是，核准安裝"
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
