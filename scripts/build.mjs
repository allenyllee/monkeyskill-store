import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(root, "skills");
const siteRoot = join(root, "site");
const distRoot = join(root, "dist");
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const MODE = /^[a-z][a-z0-9-]*$/;

export async function buildStore() {
  const resolvedDist = relative(root, distRoot);
  if (resolvedDist !== "dist") throw new Error("Refusing to clean an unexpected build path.");
  await rm(distRoot, { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  const entries = (await readdir(skillsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const skills = [];

  for (const entry of entries) {
    if (!ID.test(entry.name)) throw new Error(`Invalid Skill directory: ${entry.name}`);
    const skillRoot = join(skillsRoot, entry.name);
    const children = await readdir(skillRoot, { withFileTypes: true });
    const files = children
      .filter(item => item.isFile())
      .map(item => item.name)
      .sort();
    const unexpected = files.filter(name => !["SKILL.md", "skill.json"].includes(name));
    if (unexpected.length > 0) throw new Error(`${entry.name} contains unsupported files: ${unexpected.join(", ")}`);
    const directories = children.filter(item => item.isDirectory()).map(item => item.name);
    if (directories.some(name => name !== "demo")) throw new Error(`${entry.name} contains an unsupported directory.`);
    if (children.some(item => !item.isFile() && !item.isDirectory())) throw new Error(`${entry.name} contains an unsupported filesystem entry.`);

    const manifest = validateManifest(JSON.parse(await readFile(join(skillRoot, "skill.json"), "utf8")), entry.name);
    const instructions = await readFile(join(skillRoot, manifest.entrypoint), "utf8");
    validateInstructions(instructions, manifest.id);

    const destination = join(distRoot, "skills", manifest.id);
    await mkdir(destination, { recursive: true });
    await cp(join(skillRoot, "skill.json"), join(destination, "skill.json"));
    await cp(join(skillRoot, "SKILL.md"), join(destination, "SKILL.md"));
    if (manifest.demo) {
      if (manifest.demo !== "demo/index.html" || !directories.includes("demo")) {
        throw new Error(`${manifest.id} has an invalid demo entrypoint.`);
      }
      await validateDemoAssets(join(skillRoot, "demo"), manifest.id);
      await cp(join(skillRoot, "demo"), join(destination, "demo"), { recursive: true });
    } else if (directories.includes("demo")) {
      throw new Error(`${manifest.id} has demo assets but does not declare a demo entrypoint.`);
    }
    skills.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      modes: manifest.modes,
      capabilities: manifest.capabilities,
      manifestUrl: `skills/${manifest.id}/skill.json`,
      instructionsUrl: `skills/${manifest.id}/SKILL.md`,
      ...(manifest.demo ? { demoUrl: `skills/${manifest.id}/${manifest.demo}` } : {})
    });
  }

  await cp(siteRoot, distRoot, { recursive: true });
  await writeFile(join(distRoot, "catalog.json"), `${JSON.stringify({ schemaVersion: 1, skills }, null, 2)}\n`);
  return { skills };
}

function validateManifest(value, directory) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${directory}/skill.json is invalid.`);
  if (value.schemaVersion !== 1 || value.id !== directory || !ID.test(value.id)) throw new Error(`${directory} has an invalid id or schema.`);
  for (const field of ["name", "version", "description"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`${directory} is missing ${field}.`);
  }
  if (value.entrypoint !== "SKILL.md") throw new Error(`${directory} must use SKILL.md as its entrypoint.`);
  if (!Array.isArray(value.modes) || value.modes.length === 0 || value.modes.some(mode => !MODE.test(mode))) {
    throw new Error(`${directory} has invalid modes.`);
  }
  for (const field of ["capabilities", "forbiddenCapabilities"]) {
    if (!Array.isArray(value[field]) || value[field].some(item => typeof item !== "string" || !item)) {
      throw new Error(`${directory} has invalid ${field}.`);
    }
  }
  return value;
}

async function validateDemoAssets(demoRoot, id) {
  const entries = await readdir(demoRoot, { withFileTypes: true });
  const allowed = /\.(?:html|css|js|svg|png|jpe?g|webp|gif)$/i;
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !allowed.test(entry.name)) throw new Error(`${id}/demo contains an unsupported asset.`);
    const path = join(demoRoot, entry.name);
    totalBytes += (await stat(path)).size;
    if (/\.(?:html|css|js|svg)$/i.test(entry.name)) {
      const source = await readFile(path, "utf8");
      if (/<iframe\b|window\.open\s*\(|\bopener\b|window\.(?:top|parent)\b|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker|\bchrome\.|\beval\s*\(|new\s+Function/i.test(source)) {
        throw new Error(`${id}/demo contains a forbidden browser or network primitive.`);
      }
    }
  }
  if (!entries.some(entry => entry.isFile() && entry.name === "index.html")) throw new Error(`${id}/demo is missing index.html.`);
  if (totalBytes > 500_000) throw new Error(`${id}/demo exceeds 500 KB.`);
}

function validateInstructions(value, id) {
  if (!value.trim() || value.length > 100_000) throw new Error(`${id}/SKILL.md is empty or too large.`);
  const criteria = [...value.matchAll(/\[criterion:([a-z][a-z0-9-]*)\]/g)].map(match => match[1]);
  if (criteria.length === 0) throw new Error(`${id}/SKILL.md must declare at least one criterion.`);
  if (/```(?:js|javascript|html)|<script\b|\beval\s*\(/i.test(value)) {
    throw new Error(`${id}/SKILL.md contains executable content instead of a human-readable specification.`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildStore();
  console.log(`Built ${result.skills.length} MSkill${result.skills.length === 1 ? "" : "s"}.`);
}
