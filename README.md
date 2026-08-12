# MonkeySkill Store

A community-maintained catalog of human-readable MSkills for the [MonkeySkill Chrome extension](https://github.com/allenyllee/monkeyskill).

**Live Store:** [allenyllee.github.io/monkeyskill-store](https://allenyllee.github.io/monkeyskill-store/)

The Store contains specifications, not generated JavaScript. The Extension sends a selected `skill.json` and `SKILL.md` to the user's configured Builder and independent Tester, runs both test layers locally, and asks for explicit approval before installation.

## Development methodology

MSkills follow an evidence-driven generative development process. Begin with a minimal,
self-contained Demo that reproduces a real browser problem, then write the smallest useful
human-readable criteria supported by that evidence. Independent Tester treats the MSkill as
untrusted input and must return `allow`, `reject`, or `unverifiable` before Builder runs. On
`allow`, Builder and Tester independently produce TestSpecs in the same constrained DSL; the
trusted Runner, installed Demo interactions, and post-interaction screenshots provide separate
validation surfaces.

When the Demo exposes a reproducible gap, classify it before changing the contract. Add or
clarify a criterion only for a durable MSkill requirement with observable behavior plus safety
and preservation boundaries. Keep generated JavaScript replaceable, retain repeatedly proven
MSkill-specific constraints in that MSkill, and place only behavior-agnostic security or Runner
rules in global policy. See the Extension's
[methodology](https://github.com/allenyllee/monkeyskill/blob/main/docs/evidence-driven-generative-development.md)
and [closed-loop runbook](https://github.com/allenyllee/monkeyskill/blob/main/docs/closed-loop-validation.md).

## Add an MSkill

1. Fork this repository.
2. Add `skills/<skill-id>/skill.json` and `skills/<skill-id>/SKILL.md`.
   A functional demo may live beside them at `skills/<skill-id>/demo/index.html`; declare it as `"demo": "demo/index.html"` in `skill.json`.
3. Run `npm test` and `npm run build`.
4. Open a pull request.

The build rejects extra files inside a Skill directory, executable snippets in `SKILL.md`, missing criteria, unsafe IDs, unsupported catalog metadata, and demo assets containing network, storage, opener, iframe, or Extension APIs. Demo content is published for people to try but is never sent to the Builder or Tester.

## Local development

```powershell
npm install
npm run serve
```

Open `http://127.0.0.1:4174/` with the unpacked MonkeySkill Extension loaded.

## Fork as a separate Store

Fork the repository and enable GitHub Pages with **GitHub Actions** as its source. Every push to `main` rebuilds `catalog.json` from the `skills/` directory. A fork can publish its own catalog, but the Extension must explicitly trust that Store origin before it can receive install requests.
