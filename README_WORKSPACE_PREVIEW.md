# Bonds Global Workspace Preview — Safe Integration Phase 1

This package is intentionally additive.

## What it does

- Adds `v3/workspace-preview/`.
- Uses the already-existing authenticated ECC endpoints:
  - `POST /api/v3/ecc/portfolio`
  - `POST /api/v3/ecc/notifications`
- Reads real portfolio/project data when the user is signed in.
- Links project rows to the existing `/v3/project?id=...` command center.
- Includes dark/light theme switching stored in `localStorage`.
- Keeps the approved visual direction while avoiding fake financial numbers.

## What it does NOT do

- Does not replace `/`, `/v3/portfolio`, or any current production page.
- Does not change Supabase schemas or migrations.
- Does not create, update, or delete projects.
- Does not run Commit, Push, or Deploy.
- The “New Project” button routes to the existing portfolio workflow rather than writing data itself.

## Installation

From repository root, run the included PowerShell installer:

```powershell
.\INSTALL_WORKSPACE_PREVIEW.ps1
```

Then use your existing local server and open:

`http://127.0.0.1:5500/v3/workspace-preview/`

The existing ECC portfolio endpoint is already the project's multi-project aggregator and returns summary, projects, alerts, upcoming actions, sectors, and lifecycle stages. This preview consumes that interface rather than creating a parallel backend.
