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
  }
  const rightClick = catalog.skills.find(skill => skill.id === "restore-right-click");
  assert.equal(rightClick.demoUrl, "skills/restore-right-click/demo/index.html");
});

test("published catalog contains no generated Build or TestSpec fields", async () => {
  await buildStore();
  const catalog = await readFile(new URL("../dist/catalog.json", import.meta.url), "utf8");
  assert.doesNotMatch(catalog, /artifactType|testSpec|selfTests|javascript/i);
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
