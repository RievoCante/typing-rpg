# Security Policy & Best Practices

## 🔐 Security Overview

This document outlines the security measures, tools, and best practices implemented in the Typing RPG project.

---

## 🛡️ Automated Security Tools

### 1. **Dependabot** (Automated Dependency Updates)

**What it does:**

- Scans dependencies every week for known vulnerabilities
- Creates automatic PRs to update vulnerable packages
- Checks npm packages in frontend and backend
- Monitors GitHub Actions versions

**Configuration:** `.github/dependabot.yml`

**How to use:**

1. Dependabot creates PRs automatically
2. Review the PR and check if tests pass
3. Merge if safe, or investigate breaking changes
4. For security updates, prioritize merging quickly

**View alerts:** https://github.com/RievoCante/typing-rpg/security/dependabot

---

### 2. **CodeQL Security Scanning**

**What it does:**

- Scans JavaScript/TypeScript code for security vulnerabilities
- Detects: SQL injection, XSS, hardcoded secrets, insecure crypto, etc.
- Runs on every push, PR, and weekly schedule
- Uses GitHub's security-and-quality query suite

**Configuration:** `.github/workflows/codeql.yml`

**How to use:**

1. CodeQL runs automatically in CI/CD
2. Check "Security" tab on GitHub for findings
3. Click on alerts to see details and remediation steps
4. Fix issues before merging to main

**View results:** https://github.com/RievoCante/typing-rpg/security/code-scanning

---

### 3. **Secret Scanning** (GitHub Native)

**What it does:**

- Scans commits for accidentally committed secrets
- Detects: API keys, tokens, passwords, private keys
- Alerts you immediately if secrets are found
- Works on public repositories automatically

**How to enable:**

1. Go to GitHub repository Settings
2. Navigate to "Security" → "Code security and analysis"
3. Enable "Secret scanning"
4. Enable "Push protection" (blocks pushes with secrets)

**Best practices:**

- Never commit `.env` file (already in `.gitignore`)
- Use GitHub Secrets for CI/CD variables
- Use Cloudflare Secrets for production Workers
- Rotate secrets immediately if exposed

---

## 🔒 Secrets Management

### **Local Development (.env file)**

```env
# .env file (NEVER commit this!)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:8787
VITE_SENTRY_DSN=https://...@sentry.io/...
CLERK_SECRET_KEY=sk_test_...
```

**Rules:**

- ✅ Store in `.env` at project root
- ✅ Already in `.gitignore`
- ❌ NEVER commit to Git
- ❌ NEVER share in screenshots or public channels

---

### **GitHub Secrets (CI/CD)**

**Location:** Settings → Secrets and variables → Actions

**Current secrets:**

- `CLOUDFLARE_API_TOKEN` - For Wrangler deployments
- `VITE_CLERK_PUBLISHABLE_KEY` - For frontend builds
- `VITE_API_URL` - For frontend builds

**How to add:**

```bash
# In GitHub repository settings
Settings → Secrets → New repository secret
```

---

### **Cloudflare Secrets (Production)**

**For environment variables in Pages:**

```bash
# Go to Cloudflare Dashboard
Pages → typing-rpg → Settings → Environment variables
```

**For Worker secrets:**

```bash
cd backend
bunx wrangler secret put SECRET_NAME
# Enter value when prompted
```

**Current secrets:**

- `CLERK_SECRET_KEY` - Clerk authentication (stored via Wrangler)

---

## 🚨 Vulnerability Response Process

### **If Dependabot Alerts You:**

1. **Assess severity:**

   - Critical/High → Fix immediately (same day)
   - Medium → Fix within 1 week
   - Low → Fix in next sprint

2. **Update the package:**

   ```bash
   cd frontend  # or backend
   bun update package-name
   bun test     # Run tests
   ```

3. **Test locally:**

   ```bash
   bun run dev  # Frontend
   bun run dev  # Backend
   # Verify everything works
   ```

4. **Deploy:**
   - Push to `dev` branch first
   - Test in preview environment
   - Merge to `main` when stable

---

### **If CodeQL Finds an Issue:**

1. **Review the alert:**

   - Go to Security → Code scanning
   - Read the description and affected code
   - Check severity and CWE classification

2. **Fix the vulnerability:**

   - Follow CodeQL's remediation advice
   - Refactor the code
   - Run tests

3. **Verify the fix:**
   - Push changes
   - Wait for CodeQL to re-scan
   - Confirm alert is resolved

---

### **If a Secret is Leaked:**

**IMMEDIATE ACTIONS (within 1 hour):**

1. **Revoke the secret:**

   - For Clerk: Regenerate API keys in Clerk Dashboard
   - For Cloudflare: Revoke API token in Cloudflare
   - For Sentry: Rotate DSN (create new project if needed)

2. **Update everywhere:**

   - Update in `.env` locally
   - Update in GitHub Secrets
   - Update in Cloudflare dashboard
   - Redeploy backend: `git push origin main`

3. **Clean Git history (if needed):**

   ```bash
   # DO NOT DO THIS unless absolutely necessary
   # Contact GitHub support to remove from cache
   # Consider the repository compromised
   ```

4. **Monitor for abuse:**
   - Check Cloudflare logs
   - Check Sentry events
   - Look for unauthorized API calls

---

## ✅ Security Checklist

### **Before Every Deployment:**

- [ ] No secrets in code (check with `git diff`)
- [ ] All Dependabot alerts reviewed
- [ ] CodeQL scan passed
- [ ] Tests passing in CI/CD
- [ ] Environment variables set correctly

### **Monthly Review:**

- [ ] Review all open Dependabot PRs
- [ ] Check Security tab for alerts
- [ ] Rotate long-lived secrets (if any)
- [ ] Review Cloudflare access logs
- [ ] Update this security document

### **When Adding New Dependencies:**

- [ ] Check package reputation (npm downloads, GitHub stars)
- [ ] Verify package is actively maintained
- [ ] Check for known vulnerabilities: https://snyk.io/vuln/
- [ ] Review package permissions (what does it access?)
- [ ] Add to `package.json` with specific version (not `^` or `~`)

---

## 🎯 Security Best Practices

### **Code Level:**

1. **Input Validation:**

   ```typescript
   // ✅ Good
   if (!email || !email.includes("@")) {
     throw new Error("Invalid email");
   }

   // ❌ Bad
   // No validation, trusting user input
   ```

2. **SQL Injection Prevention:**

   ```typescript
   // ✅ Good - Using Drizzle ORM (parameterized queries)
   await db.select().from(users).where(eq(users.id, userId));

   // ❌ Bad - String concatenation
   await db.run(`SELECT * FROM users WHERE id = '${userId}'`);
   ```

3. **XSS Prevention:**

   ```tsx
   // ✅ Good - React escapes by default
   <div>{userInput}</div>

   // ❌ Bad - dangerouslySetInnerHTML
   <div dangerouslySetInnerHTML={{ __html: userInput }} />
   ```

### **Deployment Level:**

1. **Environment Separation:**

   - Development: Local `.env`
   - Production: Cloudflare Secrets
   - Never mix environments

2. **HTTPS Only:**

   - ✅ Cloudflare Pages: Automatic HTTPS
   - ✅ Cloudflare Workers: Automatic HTTPS
   - All traffic encrypted

3. **Rate Limiting:**
   - ✅ Implemented in `backend/src/core/rateLimit.ts`
   - 120 requests per minute per user/IP
   - Prevents abuse and DDoS

### **Access Control:**

1. **Authentication:**

   - ✅ Using Clerk for secure auth
   - ✅ JWT tokens (httpOnly cookies)
   - ✅ No password storage (Clerk handles it)

2. **Authorization:**

   - ✅ Middleware checks on protected routes
   - ✅ User can only access their own data
   - Example: `authMiddleware` in backend

3. **API Security:**
   - ✅ CORS configured (`cors()` middleware)
   - ✅ Rate limiting per user
   - ✅ Request validation

---

## 📚 Additional Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **npm Security Best Practices:** https://docs.npmjs.com/security-best-practices
- **Cloudflare Security:** https://developers.cloudflare.com/workers/platform/security
- **GitHub Security:** https://docs.github.com/en/code-security

---

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email: [Your email or create security@typingrpg.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours.

---

## 📊 Security Metrics

**Current Status:**

- ✅ Automated dependency scanning (Dependabot)
- ✅ Code security analysis (CodeQL)
- ✅ Secret scanning enabled
- ✅ HTTPS enforced
- ✅ Rate limiting implemented
- ✅ Authentication & authorization in place
- ✅ Error tracking (Sentry)
- ✅ No known high/critical vulnerabilities

**Last Updated:** October 20, 2025
