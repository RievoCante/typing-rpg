# Deployment Process Guide

## 🚀 **Current Deployment Workflow (Automated)**

### **Frontend (Cloudflare Pages)**

**Trigger**: Automatic on push/merge to `main`

**Process**:

1. Push code to `main` branch
2. Cloudflare Pages detects the push
3. Runs build: `cd frontend && bun install && bun run build`
4. Deploys to: https://typingrpg.com
5. Preview URLs for PRs: https://[commit-hash].typing-rpg-10i.pages.dev

**Manual Override**: Not needed! Cloudflare handles everything

---

### **Backend (Cloudflare Workers)**

**Trigger**: Automatic on push/merge to `main` via GitHub Actions

**Process**:

1. Push code to `main` branch
2. GitHub Actions workflow triggers (`.github/workflows/ci.yml`)
3. Runs CI checks (lint, type-check, tests)
4. If CI passes, runs `Backend CD` job:
   - Runs D1 database migrations
   - Deploys Worker with `bunx wrangler deploy`
5. Deploys to: https://typing-rpg-backend.putter-ravit.workers.dev

**Manual Override**: Only if GitHub Actions fails

```bash
cd backend
bunx wrangler deploy
```

---

## 🔄 **Development Workflow**

### **Step-by-Step Process**:

1. **Create feature branch from `dev`**:

   ```bash
   git checkout dev
   git pull
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit**:

   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

3. **Push to GitHub**:

   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open Pull Request**:

   - Go to GitHub
   - Click "Compare & pull request"
   - Target branch: `dev` (NOT `main`)
   - Wait for CI checks to pass ✅

5. **Merge PR to `dev`**:

   - Click "Merge pull request"
   - Delete feature branch

6. **When ready for production**:
   - Open PR from `dev` → `main`
   - Wait for CI checks to pass ✅
   - Merge to `main`
   - **Automatic deployment happens!** 🎉

---

## ✅ **What You DON'T Need to Do Manually**:

- ❌ `bunx wrangler deploy` (automated via GitHub Actions)
- ❌ Build frontend (Cloudflare Pages does it)
- ❌ Run migrations (automated in CI/CD)
- ❌ Set environment variables in production (configured in dashboards)

---

## 🔍 **What Was Fixed Today**:

### **Issue 1: Frontend Docker Missing Sentry DSN**

**Problem**: `VITE_SENTRY_DSN` wasn't passed to Docker build
**Fix**: Added to `frontend/Dockerfile`:

```dockerfile
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
```

### **Issue 2: Backend Hardcoded Sentry DSN**

**Status**: Documented as acceptable for Cloudflare Workers
**Reason**:

- Sentry DSN is safe to expose (send-only)
- Server-side only (users can't see it)
- Cloudflare Workers don't easily support build-time secrets
- Alternative: Use Cloudflare Workers secrets (more complex)

---

## 🔐 **Environment Variables Location**

### **Development (Local)**:

- File: `.env` (root directory)
- Contains: `VITE_*`, `CLERK_SECRET_KEY`
- **Never commit this file!**

### **Production Frontend (Cloudflare Pages)**:

- Dashboard: https://dash.cloudflare.com → Pages → typing-rpg → Settings → Environment Variables
- Variables:
  - `VITE_CLERK_PUBLISHABLE_KEY`
  - `VITE_API_URL` (production URL)
  - `VITE_SENTRY_DSN`

### **Production Backend (Cloudflare Workers)**:

- Set via GitHub Secrets for CI/CD:
  - `CLOUDFLARE_API_TOKEN`
  - `VITE_API_URL` (for frontend build)
  - `VITE_CLERK_PUBLISHABLE_KEY` (for frontend build)
- Worker secrets (if needed):
  ```bash
  cd backend
  bunx wrangler secret put CLERK_SECRET_KEY
  ```

---

## 📊 **Monitoring Deployments**

### **Frontend**:

- Check: https://dash.cloudflare.com → Pages → typing-rpg → Deployments
- View build logs if deployment fails

### **Backend**:

- Check: https://github.com/RievoCante/typing-rpg/actions
- Click on latest workflow run to see logs
- If failed, check the "Backend CD" job

---

## 🆘 **Troubleshooting**

### **Backend deployment fails in CI/CD**:

1. Check GitHub Actions logs
2. Verify `CLOUDFLARE_API_TOKEN` is set in GitHub Secrets
3. Test locally: `cd backend && bunx wrangler deploy`

### **Frontend deployment fails**:

1. Check Cloudflare Pages build logs
2. Verify environment variables are set in Cloudflare dashboard
3. Check if build succeeds locally: `cd frontend && bun run build`

### **Sentry not working**:

1. Check `VITE_SENTRY_DSN` is set correctly
2. Check Sentry dashboard for incoming events
3. Test with a manual error in dev environment

---

## 📚 **Key Takeaways**

✅ **Fully automated CI/CD** - No manual deployments needed
✅ **Branch protection** - Can't merge without passing checks
✅ **Preview deployments** - Test changes before production
✅ **Monitoring** - Sentry tracks errors automatically
✅ **Security** - Secrets managed via GitHub Secrets & Cloudflare

**You're running a production-grade DevOps setup!** 🎉
