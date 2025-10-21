# Enable Secret Scanning - Step-by-Step Guide

## 🔐 What is Secret Scanning?

Secret scanning automatically detects secrets (API keys, tokens, passwords) that are accidentally committed to your repository. It prevents security breaches by alerting you immediately.

---

## ✅ How to Enable (5 minutes)

### **Step 1: Go to Repository Settings**

1. Open: https://github.com/RievoCante/typing-rpg
2. Click **"Settings"** tab (top menu)

---

### **Step 2: Navigate to Security Settings**

1. In left sidebar, find **"Security"** section
2. Click **"Code security and analysis"**

---

### **Step 3: Enable Secret Scanning**

Find the **"Secret scanning"** section and:

1. Click **"Enable"** button next to "Secret scanning"
2. ✅ This will scan your entire repository for secrets

---

### **Step 4: Enable Push Protection** (IMPORTANT!)

Find the **"Push protection"** section and:

1. Click **"Enable"** button
2. ✅ This **blocks pushes** that contain secrets
3. You'll get an error if you try to commit a secret

---

### **Step 5: Enable Dependabot Alerts** (if not already enabled)

Find the **"Dependabot alerts"** section:

1. Click **"Enable"** if not already on
2. ✅ This works with the `dependabot.yml` file we created

---

## 🎯 What You Should See

After enabling, your settings should show:

- ✅ **Dependabot alerts:** Enabled
- ✅ **Dependabot security updates:** Enabled (optional but recommended)
- ✅ **Secret scanning:** Enabled
- ✅ **Push protection:** Enabled

---

## 🧪 Test It Works

### **Test 1: Try to commit a fake secret**

```bash
# Create a test file
echo "const apiKey = 'sk_test_1234567890abcdefghijklmnop'" > test-secret.js

# Try to commit
git add test-secret.js
git commit -m "test: secret detection"

# Expected result: ⚠️ Push blocked by GitHub!
```

If it blocks you, **secret scanning is working!** ✅

Delete the test file:

```bash
git reset HEAD test-secret.js
rm test-secret.js
```

---

## 📊 View Secret Scanning Alerts

1. Go to: https://github.com/RievoCante/typing-rpg/security
2. Click **"Secret scanning"** in left sidebar
3. You'll see any detected secrets here

**Current status:** Should be 0 alerts (we keep secrets out of Git!)

---

## 🚨 What to Do If a Secret is Detected

### **If GitHub blocks your push:**

1. ✅ **Good!** Push protection is working
2. Remove the secret from your commit:
   ```bash
   # Edit the file to remove the secret
   # Then amend the commit
   git add .
   git commit --amend --no-edit
   ```

### **If an alert appears for an old commit:**

1. **Immediately revoke the secret:**

   - Clerk keys: Regenerate in Clerk Dashboard
   - Cloudflare tokens: Revoke in Cloudflare
   - Sentry DSN: Create new project or rotate

2. **Update everywhere:**

   - Update in `.env` locally
   - Update in GitHub Secrets
   - Update in Cloudflare dashboard

3. **Mark as resolved:**
   - Go to the alert
   - Click "Close alert"
   - Select reason: "Revoked"

---

## ✅ Completion Checklist

After following this guide, you should have:

- [ ] Secret scanning enabled
- [ ] Push protection enabled
- [ ] Tested that it blocks secrets
- [ ] 0 active secret scanning alerts
- [ ] Dependabot also enabled

---

## 📸 Screenshot Reference

Your Security settings should look like this:

```
Code security and analysis
├─ Dependabot
│  ├─ Dependabot alerts: ✅ Enabled
│  └─ Dependabot security updates: ✅ Enabled
├─ Code scanning
│  └─ CodeQL analysis: ✅ Set up (via .github/workflows/codeql.yml)
└─ Secret scanning
   ├─ Secret scanning: ✅ Enabled
   └─ Push protection: ✅ Enabled
```

---

## 🎉 Done!

You now have enterprise-grade secret protection! This is exactly what companies use in production.

**Next steps:**

- Monitor the Security tab regularly
- Review Dependabot PRs when they appear
- Keep secrets in `.env` (never commit!)

---

_Part of the DevOps Security & Dependency Management phase_
