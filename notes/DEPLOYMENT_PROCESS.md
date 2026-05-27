# Deployment

## Auto-deploy on push to `main`

**Frontend** — Cloudflare Pages builds and deploys automatically.

- Production: https://typingrpg.com
- PR previews: `https://[commit-hash].typing-rpg-10i.pages.dev`
- Build: `cd frontend && bun install && bun run build`
- Dashboard: Cloudflare → Pages → typing-rpg → Deployments

**Backend** — GitHub Actions runs CI, then the `Backend CD` job deploys the Worker.

- Workflow: `.github/workflows/ci.yml`
- Steps: D1 migrations (`--remote`) → `bunx wrangler deploy`
- Production: https://typing-rpg-backend.putter-ravit.workers.dev
- Run logs: https://github.com/RievoCante/typing-rpg/actions

## Manual deploy fallback

```bash
cd backend
bunx wrangler deploy
```

## Environment variables

**Local** — `.env` in repo root (gitignored). Holds `VITE_*` and `CLERK_SECRET_KEY`.

**Production frontend** — Cloudflare Pages → typing-rpg → Settings → Environment Variables:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_URL`
- `VITE_SENTRY_DSN`

**Production backend** — GitHub Secrets used by CI:

- `CLOUDFLARE_API_TOKEN`
- `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY` (passed to frontend build step)

Worker secrets (`bunx wrangler secret put <name>` from `backend/`):

- `CLERK_SECRET_KEY`

## Troubleshooting

**Backend deploy fails in CI**

1. Open workflow run logs on GitHub Actions
2. Verify `CLOUDFLARE_API_TOKEN` in GitHub Secrets
3. Reproduce locally: `cd backend && bunx wrangler deploy`

**Frontend deploy fails**

1. Open Cloudflare Pages build logs
2. Verify env vars in CF Pages dashboard
3. Reproduce locally: `cd frontend && bun run build`

**Sentry not capturing events**

1. Verify `VITE_SENTRY_DSN` is set in the target environment
2. Check Sentry dashboard for incoming events
