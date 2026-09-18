# UNORON AI v4 — Self-Development Edition

## What this version does
UNORON can generate/edit project files, show HTML previews, export ZIPs, audit supplied files, and enter **SELF UPGRADE** mode.

In SELF UPGRADE mode the model receives UNORON's source files and can produce a candidate new version. If GitHub integration is configured, the candidate can be committed to a configured branch.

## Required for real autonomous self-development
Netlify alone cannot safely execute arbitrary generated software indefinitely. For a production autonomous loop, connect:
1. GitHub repository (source of truth)
2. CI/build runner or isolated sandbox (actual install/build/test)
3. Netlify deploy/preview integration
4. Health-check endpoint
5. Rollback mechanism
6. Server-side credentials only

The intended loop is:
PLAN -> EDIT -> BUILD/TEST IN ISOLATED RUNNER -> FIX -> RETEST -> PREVIEW -> HEALTH CHECK -> PROMOTE OR ROLLBACK.

## Environment variables
`OPENAI_API_KEY` or Netlify AI Gateway configuration
`UNORON_MODEL` optional
`GITHUB_TOKEN` optional server-side token
`GITHUB_OWNER`
`GITHUB_REPO`
`GITHUB_BRANCH` optional, defaults to main
`ENABLE_SELF_COMMIT=true` to allow candidate commits

Do not expose any of these as `VITE_*`.

## Deploy
Push this folder to GitHub and import the repo into Netlify. Build command: `npm run build`; publish: `dist`.

## Honest limits
This project removes an artificial feature whitelist, but it cannot remove real limits imposed by AI providers, Netlify, GitHub, compute, storage, or the execution environment. "Self-upgrade" does not mean uncontrolled modification of security controls.
