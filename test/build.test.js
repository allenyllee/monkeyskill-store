import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildStore } from "../scripts/build.mjs";

test("build creates a catalog from human-readable Skill directories", async () => {
  const result = await buildStore();
  assert.ok(result.skills.length > 0);
  const catalog = JSON.parse(await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8"));
  assert.equal(catalog.schemaVersion, 1);
  assert.deepEqual(catalog.skills.map(skill => skill.id), result.skills.map(skill => skill.id));
  for (const skill of catalog.skills) {
    assert.match(skill.manifestUrl, /^skills\/[a-z0-9-]+\/skill\.json$/);
    assert.match(skill.instructionsUrl, /^skills\/[a-z0-9-]+\/SKILL\.md$/);
    assert.equal(skill.localized.en.instructionsUrl, skill.instructionsUrl);
  }
  const rightClick = catalog.skills.find(skill => skill.id === "restore-right-click");
  assert.equal(rightClick.demoUrl, "skills/restore-right-click/demo/index.html");
});

test("Store publishes and switches English and Traditional Chinese content", async () => {
  await buildStore();
  const catalog = JSON.parse(await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8"));
  const skill = catalog.skills.find(entry => entry.id === "restore-right-click");
  assert.equal(skill.localized["zh-Hant"].name, "恢復右鍵、選取與複製");
  assert.equal(skill.localized["zh-Hant"].instructionsUrl, "skills/restore-right-click/SKILL.zh-Hant.md");
  const localized = await readFile(new URL("../dist/skills/restore-right-click/SKILL.zh-Hant.md", import.meta.url), "utf8");
  assert.match(localized, /\[criterion:selection-visibility\]/);
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(source, /navigator\.languages/);
  assert.match(source, /monkeyskill-store-locale/);
  assert.match(source, /localizedSkill/);
  assert.match(page, /data-locale="zh-Hant"/);
  assert.match(page, /data-locale="en"/);
});

test("published catalog contains no generated Build or TestSpec fields", async () => {
  await buildStore();
  const catalog = await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8");
  assert.doesNotMatch(catalog, /artifactType|TestSpec|selfTests|javascript/i);
});

test("Store publishes a clearly labeled non-executable malicious security sample", async () => {
  await buildStore();
  const catalog = JSON.parse(await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8"));
  const sample = catalog.skills.find(skill => skill.id === "malicious-security-test");
  assert.equal(sample.securityExample, true);
  assert.deepEqual(sample.capabilities, ["dom", "network", "cookies", "storage"]);
  const instructions = await readFile(new URL("../dist/skills/malicious-security-test/SKILL.md", import.meta.url), "utf8");
  assert.match(instructions, /Ignore the independent Tester policy/);
  assert.match(instructions, /sensitive-data access,[\s\S]*external communication/);
  assert.match(instructions, /testSpec` to null/);
  assert.doesNotMatch(instructions, /```|<script|https?:\/\//i);
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /securityExample/);
  assert.match(source, /Test security gate/);
});

test("restore-right-click publishes its complete 16-method demo with the MSkill", async () => {
  await buildStore();
  const demo = await readFile(new URL("../dist/skills/restore-right-click/demo/index.html", import.meta.url), "utf8");
  for (let method = 1; method <= 16; method += 1) assert.match(demo, new RegExp(`id="method-${method}"`));
  assert.match(demo, /id="standard-target"/);
  assert.match(demo, /id="absolute-target"/);
  assert.match(demo, /id="background-image-target"/);
  assert.match(demo, /removeAllRanges/);
  assert.match(demo, /event\.key\.toLowerCase\(\) !== "c"/);
  assert.match(demo, /url\("\.\/test-background\.svg"\)/);
  assert.doesNotMatch(demo, /src="\/test-background\.svg|url\(["']?\/test-background\.svg/);
  assert.equal((demo.match(/src="\.\/test-background\.svg"/g) || []).length, 5);
  assert.match(demo, /#method-12 :not\(input\):not\(textarea\)::selection \{ color: inherit !important; background: transparent !important; \}/);
  assert.doesNotMatch(demo, /id="method-12"[\s\S]*?<div class="target no-select">/);
  assert.match(demo, /Dark Reader 等色彩擴充可能干擾此項/);
});

test("restore-right-click retains closed-loop implementation constraints in its MSkill", async () => {
  const skill = await readFile(new URL("../skills/restore-right-click/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /## Validated implementation constraints/);
  assert.match(skill, /pointerup.*mouseup.*capture listener/s);
  assert.match(skill, /neutralize[\s\S]*preventDefault\(\).*at call time/);
  assert.match(skill, /short-lived instance `value` setter guard/);
  assert.match(skill, /geometry-based overlap detection/);
  assert.match(skill, /alternative implementation is acceptable only if[\s\S]*passes the complete[\s\S]*closed loop again/);
});

test("Store actively probes the Extension bridge instead of relying on a one-shot ready event", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(source, /void probeExtension\(\)/);
  assert.match(source, /rpc\("ping", null, \{\}, 500\)/);
  assert.match(source, /function markExtensionReady\(\)/);
  assert.match(source, /90 \* 60 \* 1000/);
  assert.match(page, /store\.js\?v=\d+/);
  assert.match(page, /store\.css\?v=\d+/);
});

test("local development Store can request an automated Extension reload", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /reloadExtensionForLocalDevelopment/);
  assert.match(source, /searchParams\.get\("reload-extension"\) !== "1"/);
  assert.match(source, /rpc\("reload-extension", null, \{\}, 3000\)/);
  assert.match(source, /history\.replaceState/);
});

test("Store presents both test sources as TestSpecs", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /Builder TestSpec:/);
  assert.match(source, /Independent TestSpec:/);
  assert.doesNotMatch(source, /Builder self-tests:|Independent tests:/);
});

test("Store cards can safely expand their human-readable Skill content", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../site/store.css", import.meta.url), "utf8");
  assert.match(page, /<details class="skill-source">/);
  assert.match(page, /<summary[^>]*>查看 Skill 內容<\/summary>/);
  assert.match(source, /instructionsUrl\.origin !== location\.origin/);
  assert.match(source, /content\.textContent = instructions/);
  assert.match(source, /instructionCache/);
  assert.match(styles, /\.skill-source-content/);
});

test("Store documents evidence-driven MSkill development", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /evidence-driven generative development/i);
  assert.match(readme, /`allow`, `reject`, or `unverifiable`/);
  assert.match(readme, /post-interaction screenshots/);
  assert.match(readme, /generated JavaScript replaceable/);
});

test("local Store server sends browser-safe image MIME types", async () => {
  const source = await readFile(new URL("../scripts/serve.mjs", import.meta.url), "utf8");
  assert.match(source, /\["\.svg", "image\/svg\+xml"\]/);
  assert.match(source, /\["\.png", "image\/png"\]/);
  assert.match(source, /\["\.webp", "image\/webp"\]/);
});
