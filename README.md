# MonkeySkill Store

A community-maintained catalog of human-readable MSkills for the [MonkeySkill Chrome extension](https://github.com/allenyllee/monkeyskill).

The Store contains specifications, not generated JavaScript. The Extension sends a selected `skill.json` and `SKILL.md` to the user's configured Builder and independent Tester, runs both test layers locally, and asks for explicit approval before installation.

## Add an MSkill

1. Fork this repository.
2. Add `skills/<skill-id>/skill.json` and `skills/<skill-id>/SKILL.md`.
3. Run `npm test` and `npm run build`.
4. Open a pull request.

The build rejects extra files inside a Skill directory, executable snippets in `SKILL.md`, missing criteria, unsafe IDs, and unsupported catalog metadata.

## Local development

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:4174/` with the unpacked MonkeySkill Extension loaded.

## Fork as a separate Store

Fork the repository and enable GitHub Pages with **GitHub Actions** as its source. Every push to `main` rebuilds `catalog.json` from the `skills/` directory. A fork can publish its own catalog, but the Extension must explicitly trust that Store origin before it can receive install requests.
