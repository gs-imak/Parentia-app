# Parentia App - Warp AI Rules

## CRITICAL: Frontend Deployment Process

**NEVER commit frontend changes without rebuilding the web bundle.**

### When to rebuild:

ANY time you modify files in `mobile/src/`:
- `mobile/src/screens/*.tsx`
- `mobile/src/components/*.tsx`
- `mobile/src/api/*.ts`
- Any React Native component or screen

### Required steps BEFORE committing:

1. ✅ Make code changes in `mobile/src/`
2. ✅ Run `npm run build:web` (rebuilds `mobile/dist/`)
3. ✅ Verify build succeeded (check for errors)
4. ✅ Stage ALL files including `mobile/dist/` changes
5. ✅ Commit with conventional commit message
6. ✅ Push to GitHub (triggers Railway deployment)

### Why this matters:

- Railway serves the **static bundle** from `mobile/dist/`
- Changes in `mobile/src/` are NOT visible until bundle is rebuilt
- Client will see OLD version if you forget to rebuild
- Backend changes (`src/*.ts`) deploy automatically, frontend does NOT

### Command checklist:

```bash
# After making frontend changes:
npm run build:web          # Rebuild web bundle
git add -A                 # Stage everything including dist/
git commit -m "..."        # Commit with message
git push                   # Deploy to Railway
```

### Exception:

Backend-only changes (`src/*.ts`, NOT `mobile/src/`) do NOT require frontend rebuild.

---

## Deployment Architecture

- **Backend**: Node.js on Railway - auto-deploys on push
- **Frontend**: React Native web bundle - must be manually rebuilt
- **URL**: https://parentia-app-production.up.railway.app
- **Build command**: `npm run build:web` (defined in package.json)

---

**REMEMBER: Mobile code changes = Rebuild required. No exceptions.**