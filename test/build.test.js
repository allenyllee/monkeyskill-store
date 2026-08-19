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
  assert.equal(rightClick.conformanceUrl, "skills/restore-right-click/conformance.json");
  const conformance = JSON.parse(await readFile(new URL("../dist/skills/restore-right-click/conformance.json", import.meta.url), "utf8"));
  assert.equal(conformance.schemaVersion, 1);
  assert.deepEqual(
    [...new Set(conformance.tests.map(candidate => candidate.criterion))].sort(),
    ["context-menu", "keyboard-copy", "pointer-overlays", "selection-dismissal", "text-selection"]
  );
  const backgroundOverlay = conformance.tests.find(candidate => candidate.id === "regression-background-overlay");
  assert.equal(backgroundOverlay.criterion, "context-menu");
  assert.match(backgroundOverlay.fixture.nodes.find(node => node.id === "target").styles.backgroundImage, /^linear-gradient\(/);
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

test("published catalog contains no generated Build or TestSpec payloads", async () => {
  await buildStore();
  const catalog = await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8");
  assert.doesNotMatch(catalog, /publicTestSpec|independentTestSpec|selfTests|"javascript"/i);
});

test("Store publishes an immutable hashed Runner Bootstrap package", async () => {
  await buildStore();
  const catalog = JSON.parse(await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8"));
  assert.equal(catalog.skills[0].id, "monkeyskill-runner-bootstrap", "Bootstrap should be prominent in the sorted catalog.");
  const bootstrap = catalog.skills.find(skill => skill.id === "monkeyskill-runner-bootstrap");
  assert.equal(bootstrap.artifactType, "runner-bootstrap");
  assert.equal(bootstrap.bootstrapUrl, "skills/monkeyskill-runner-bootstrap/1.0.4/bootstrap.json");
  assert.match(bootstrap.bootstrapPackageHash, /^[a-f0-9]{64}$/);
  const pkg = JSON.parse(await readFile(new URL(`../dist/${bootstrap.bootstrapUrl}`, import.meta.url), "utf8"));
  assert.equal(pkg.packageHash, bootstrap.bootstrapPackageHash);
  const archived = JSON.parse(await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.0/bootstrap.json", import.meta.url), "utf8"));
  assert.equal(archived.version, "1.0.0", "Published Bootstrap URLs must remain immutable and available after an upgrade.");
  const archived101 = JSON.parse(await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.1/bootstrap.json", import.meta.url), "utf8"));
  assert.equal(archived101.version, "1.0.1", "The immediately preceding Bootstrap URL must remain immutable and available.");
  const archived102 = JSON.parse(await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.2/bootstrap.json", import.meta.url), "utf8"));
  assert.equal(archived102.version, "1.0.2", "The previous generated-Runner protocol must remain immutable and available.");
  const archived103 = JSON.parse(await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.3/bootstrap.json", import.meta.url), "utf8"));
  assert.equal(archived103.version, "1.0.3", "The preceding Host integration protocol must remain immutable and available.");
  assert.equal(pkg.entrypoint, "SKILL.md");
  assert.ok(pkg.files.some(file => file.path === "workflow.json"));
  assert.ok(pkg.files.some(file => file.path === "conformance/meta-conformance.json"));
  assert.ok(pkg.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
  const bootstrapInstructions = await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.4/SKILL.md", import.meta.url), "utf8");
  assert.doesNotMatch(bootstrapInstructions, /restore-right-click|Restore Right Click/, "Runner Bootstrap must stay application-agnostic.");
  assert.match(bootstrapInstructions, /orchestrator-handoff/);
  assert.match(bootstrapInstructions, /append-node/);
  assert.match(bootstrapInstructions, /infrastructure failure/);
  assert.match(bootstrapInstructions, /Extension-shaped HTTP route-to-Host-to-generated-Runner/);
  assert.ok(pkg.files.some(file => file.path === "protocol/host-dsl-profile.json"));
  const hostProfile = JSON.parse(await readFile(new URL("../dist/skills/monkeyskill-runner-bootstrap/1.0.4/protocol/host-dsl-profile.json", import.meta.url), "utf8"));
  assert.equal(hostProfile.http.route, "/v1/real-browser-conformance");
  assert.equal(hostProfile.testSpec.behaviorTest.kind, "behavior");
  assert.deepEqual(hostProfile.testSpec.behaviorTest.blocker.slice(1), ["target", "event", "registration", "effect", "when"]);
  assert.ok(hostProfile.extensionSuccessResponse.required.includes("passed"));
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /copyBootstrapUrl/);
  assert.match(source, /navigator\.clipboard\.writeText/);
});

test("Store labels a disguised non-executable security sample without leaking the answer to Tester", async () => {
  await buildStore();
  const catalog = JSON.parse(await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8"));
  const sample = catalog.skills.find(skill => skill.id === "session-continuity-helper");
  assert.equal(sample.securityExample, true);
  assert.deepEqual(sample.capabilities, ["dom", "events", "storage", "cookies", "network"]);
  const manifest = await readFile(new URL("../dist/skills/session-continuity-helper/skill.json", import.meta.url), "utf8");
  assert.doesNotMatch(manifest, /securityExample|malicious|security test/i);
  const instructions = await readFile(new URL("../dist/skills/session-continuity-helper/SKILL.md", import.meta.url), "utf8");
  assert.doesNotMatch(instructions, /malicious|Tester policy|testSpec|null|reject/i);
  assert.match(instructions, /cookie header/);
  assert.match(instructions, /visible input names and values/);
  assert.match(instructions, /quietly in the\s+background/);
  assert.match(instructions, /do not need individual negative[\s\S]*tests/);
  assert.match(instructions, /Sentry Session Replay envelope/);
  assert.match(instructions, /https:\/\/o4500000000000000\.ingest\.sentry-session-ingest\.com\/api\/4500000000000000\/envelope\//);
  const externalUrls = [...instructions.matchAll(/https?:\/\/[^\s`]+/g)].map(match => new URL(match[0]));
  assert.ok(externalUrls.length > 0);
  assert.ok(externalUrls.every(url => url.hostname.endsWith(".sentry-session-ingest.com")), "Security sample URLs must stay on the designated inert lookalike host.");
  assert.doesNotMatch(instructions, /```|<script/i);
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /securityExample/);
  assert.match(source, /Test security gate/);
});

test("restore-right-click publishes its complete 18-method demo with the MSkill", async () => {
  await buildStore();
  const demo = await readFile(new URL("../dist/skills/restore-right-click/demo/index.html", import.meta.url), "utf8");
  for (let method = 1; method <= 18; method += 1) assert.match(demo, new RegExp(`id="method-${method}"`));
  assert.match(demo, /id="standard-target"/);
  assert.match(demo, /id="absolute-target"/);
  assert.match(demo, /absolute-next-target/);
  assert.match(demo, /selectionStage === "dismissed"/);
  assert.match(demo, /id="background-image-target"/);
  assert.match(demo, /removeAllRanges/);
  assert.match(demo, /event\.key\.toLowerCase\(\) !== "c"/);
  assert.match(demo, /id="run-scroll-stress"/);
  assert.match(demo, /for \(let index = 0; index < 1200; index \+= 1\)/);
  assert.match(demo, /for \(let index = 0; index < 10; index \+= 1\)/);
  assert.match(demo, /url\("\.\/test-background\.svg"\)/);
  assert.doesNotMatch(demo, /src="\/test-background\.svg|url\(["']?\/test-background\.svg/);
  assert.equal((demo.match(/src="\.\/test-background\.svg"/g) || []).length, 5);
  assert.match(demo, /#method-12 :not\(input\):not\(textarea\)::selection \{ color: inherit !important; background: transparent !important; \}/);
  assert.doesNotMatch(demo, /id="method-12"[\s\S]*?<div class="target no-select">/);
  assert.match(demo, /Dark Reader 等色彩擴充可能干擾此項/);
  assert.match(demo, /demo-i18n\.js\?v=6/);
  assert.match(demo, /reportCancellationOutcome/);
  assert.match(demo, /if \(event\.defaultPrevented\)/);
  assert.doesNotMatch(demo, /event\.preventDefault\(\);\s*markBlocked\(11,/);
  assert.match(demo, /window\.demoI18n\.nativeTarget\(label\)/);
  assert.match(demo, /if \(event\.target\.value === pastedValue\)/);
  assert.match(demo, /window\.demoI18n\.pastePreserved\(\)/);
  assert.match(demo, /markBlocked\(5, "alert handler 執行並阻擋了右鍵"\)/);
  assert.match(demo, /id="run-dynamic-stress"/);
  assert.match(demo, /elapsed <= 1000/);
  const demoI18n = await readFile(new URL("../dist/skills/restore-right-click/demo/demo-i18n.js", import.meta.url), "utf8");
  assert.match(demoI18n, /"zh-Hant"/);
  assert.match(demoI18n, /\ben:\s*\{/);
  assert.match(demoI18n, /navigator\.languages/);
  assert.match(demoI18n, /searchParams\.get\("lang"\)/);
  assert.match(demoI18n, /data-locale/);
  assert.match(demoI18n, /Skill 已中和取消並保留瀏覽器預設行為/);
  assert.doesNotMatch(demoI18n, /localStorage|sessionStorage/);
  assert.doesNotMatch(demoI18n, /MutationObserver[\s\S]*result-10/, "Method 10 status localization must not observe and rewrite its own text.");
});

test("restore-right-click retains closed-loop implementation constraints in its MSkill", async () => {
  const skill = await readFile(new URL("../skills/restore-right-click/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /## Validated implementation constraints/);
  assert.match(skill, /pointerup.*mouseup.*capture listener/s);
  assert.match(skill, /Do not replace `Event\.prototype\.preventDefault` page-wide/);
  assert.match(skill, /selection-write-count[\s\S]*at most 5/);
  assert.match(skill, /already non-collapsed[\s\S]*do not call[\s\S]*removeAllRanges/);
  assert.match(skill, /Do not mark a recovery checkpoint complete[\s\S]*verified as non-collapsed/);
  assert.match(skill, /drag-select a different text target[\s\S]*new non-collapsed selection/);
  assert.match(skill, /neutralize[\s\S]*preventDefault\(\).*at call time/);
  assert.match(skill, /short-lived instance `value` setter guard/);
  assert.match(skill, /geometry-based overlap detection/);
  assert.match(skill, /`document_start`[\s\S]*more than 24 direct descendants[\s\S]*single mutation/);
  assert.match(skill, /`installTiming: "before-fixture"`[\s\S]*underlying target[\s\S]*`hit-test`/);
  assert.match(skill, /200[\s\S]*ID-bearing rows[\s\S]*400 ms/);
  assert.match(skill, /ignore mutations caused only by the Skill's own style or marker updates/);
  assert.match(skill, /Do not query all generic[\s\S]*elements[\s\S]*on each `scroll` event/);
  assert.match(skill, /do not call `elementsFromPoint\(\)`[\s\S]*once per queued[\s\S]*overlay/);
  assert.match(skill, /`scroll-stress`[\s\S]*1200[\s\S]*10 scroll frames[\s\S]*400 ms/);
  assert.match(skill, /`startup-stress`[\s\S]*1200 pre-existing[\s\S]*candidate is installed[\s\S]*400 ms/);
  assert.match(skill, /Do not append with `style\.textContent \+= \.\.\.` once per discovered ID/);
  assert.match(skill, /do not enumerate document IDs into selection CSS/);
  assert.match(skill, /constant-size high-specificity selector[\s\S]*`:not\(#sentinel\)`/);
  assert.match(skill, /Do not enqueue an added subtree[\s\S]*`getComputedStyle\(\)` on every ordinary descendant/);
  assert.match(skill, /startup must not recursively enqueue[\s\S]*`document\.documentElement`/);
  assert.match(skill, /Test all three workflows independently in both modes/);
  assert.match(skill, /Skill-Off baseline[\s\S]*500 ms[\s\S]*1\.5 times/);
  assert.match(skill, /live `DocumentFragment`[\s\S]*do not run `querySelectorAll\(\)` separately[\s\S]*every added generic root/i);
  assert.match(skill, /Do not replace[\s\S]*EventTarget\.prototype\.addEventListener/);
  assert.match(skill, /flag-only` late context-menu test[\s\S]*call count zero[\s\S]*uncancelled event/);
  assert.match(skill, /Other[\s\S]*protected listeners[\s\S]*call count one[\s\S]*defaultPrevented === false/);
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

test("local development Store can inspect durable generation state", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /inspect-workflow/);
  assert.match(source, /rpc\("status", skillId/);
  assert.match(source, /rpc\("pending", skillId/);
});

test("Store presents both test sources as TestSpecs", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /Builder TestSpec:/);
  assert.match(source, /Independent TestSpec:/);
  assert.match(source, /Developer Conformance:/);
  assert.doesNotMatch(source, /Builder self-tests:|Independent tests:/);
});

test("Store carries its selected locale into Demo links and reloads stale local Demo runtimes", async () => {
  const source = await readFile(new URL("../site/store.js", import.meta.url), "utf8");
  assert.match(source, /demoUrl\.searchParams\.set\("lang", locale\)/);
  assert.match(source, /announceLocalRuntimeChange\(skillId, "mode"\)/);
  assert.match(source, /announceLocalRuntimeChange\(draft\.skillId, "install"\)/);
  const demoI18n = await readFile(new URL("../skills/restore-right-click/demo/demo-i18n.js", import.meta.url), "utf8");
  assert.match(demoI18n, /monkeyskill-local-runtime-change/);
  assert.match(demoI18n, /change\.skillId === "restore-right-click"/);
  assert.match(demoI18n, /location\.reload\(\)/);
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
  assert.match(readme, /isolated Attacker/);
  assert.match(readme, /Only after `allow`[\s\S]*poisoned variant[\s\S]*`reject`/);
  assert.match(readme, /`reject` or `unverifiable` verdict stops immediately/);
  assert.match(readme, /selects allowlisted template dimensions/);
  assert.match(readme, /trusted Extension code creates a varied/);
});

test("local Store server sends browser-safe image MIME types", async () => {
  const source = await readFile(new URL("../scripts/serve.mjs", import.meta.url), "utf8");
  assert.match(source, /\["\.svg", "image\/svg\+xml"\]/);
  assert.match(source, /\["\.png", "image\/png"\]/);
  assert.match(source, /\["\.webp", "image\/webp"\]/);
});
