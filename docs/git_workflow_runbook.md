# 🌿 CACI Hub — Git Workflow Runbook

## Branch Structure

```
main          ← production (protected, no direct pushes)
dev           ← integration & staging (mirrors dev Supabase)
feature/*     ← individual features (branched from dev)
fix/*         ← bug fixes (branched from dev)
hotfix/*      ← urgent prod fixes (branched from main)
```

---

## Overview

| Branch | Source | Merges into | Purpose |
|--------|--------|-------------|---------|
| `main` | — | — | Live production code |
| `dev` | `main` | `main` | Integration, QA, staging |
| `feature/*` | `dev` | `dev` | New features |
| `fix/*` | `dev` | `dev` | Non-urgent bug fixes |
| `hotfix/*` | `main` | `main` + `dev` | Critical prod fixes only |

---

## Daily Workflow

### 1. Starting a New Feature

```bash
# Always start from an up-to-date dev
git checkout dev
git pull origin dev

# Create your feature branch
git checkout -b feature/your-feature-name

# Examples
git checkout -b feature/add-member-search
git checkout -b feature/export-members-pdf
git checkout -b feature/attendance-tracking
git checkout -b feature/batch-sql-import
```

### 2. Working on the Feature

```bash
# Check what you've changed
git status

# Stage specific files
git add src/modules/membership/pages/MemberList.ts

# Or stage everything
git add .

# Commit with a clear message
git commit -m "feat: add member search by name and phone"
```

### 3. Keeping Your Branch Up to Date

If `dev` has moved on while you were working:

```bash
git checkout dev
git pull origin dev
git checkout feature/your-feature-name
git rebase dev
```

### 4. Pushing and Opening a PR

```bash
# Push your feature branch
git push origin feature/your-feature-name

# Then on GitHub:
# - Open Pull Request: feature/your-feature-name → dev
# - Add a description of what changed
# - Review your own diff before merging
```

### 5. After PR is Merged — Clean Up

```bash
# Switch back to dev and pull the merged changes
git checkout dev
git pull origin dev

# Delete the local feature branch
git branch -d feature/your-feature-name

# Delete the remote branch (or do it on GitHub after merge)
git push origin --delete feature/your-feature-name
```

---

## Merging Dev → Main (Releasing to Prod)

Only do this when `dev` has been tested and is stable.

```bash
# 1. Make sure dev is up to date
git checkout dev
git pull origin dev

# 2. Open a PR on GitHub: dev → main
#    Review all changes
#    Merge only when confident

# 3. After merge, pull main locally
git checkout main
git pull origin main
```

> **Never push directly to `main`.** Always go through a PR.

---

## Hotfix (Urgent Prod Fix)

For critical bugs that can't wait for the normal dev → main flow:

```bash
# Branch off main
git checkout main
git pull origin main
git checkout -b hotfix/fix-login-crash

# Make the fix, commit
git add .
git commit -m "fix: resolve login crash on member dashboard"

# Push and open PR → main
git push origin hotfix/fix-login-crash

# After merging to main, also merge into dev
git checkout dev
git pull origin dev
git merge main
git push origin dev
```

---

## Commit Message Convention

Use this format consistently:

```
type: short description
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Config, tooling, dependencies |
| `docs` | Documentation changes |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no behavior change |
| `db` | Migration or schema change |

**Examples:**
```bash
git commit -m "feat: add member registration form"
git commit -m "fix: correct phone number formatting for Ghana numbers"
git commit -m "db: add baptism_date column to members table"
git commit -m "chore: update supabase client to v2"
git commit -m "docs: update environment runbook"
```

---

## Database Migrations with Git

Every schema change should be a migration file committed alongside the feature:

```bash
# 1. Create migration
npx supabase migration new add_baptism_date_to_members

# 2. Write SQL in the generated file
# supabase/migrations/20260530101500_add_baptism_date_to_members.sql

# 3. Commit migration with the feature
git add supabase/migrations/
git commit -m "db: add baptism_date column to members table"
```

> Migration files are committed to Git — they are your schema changelog.  
> Never delete or rename a migration file after it has been pushed.

---

## Useful Commands

### Viewing State
```bash
git status                      # what's changed
git log --oneline -10           # last 10 commits
git branch -a                   # all local and remote branches
git diff                        # unstaged changes
git diff --staged               # staged changes
```

### Undoing Things
```bash
git restore <file>              # discard unstaged changes to a file
git restore --staged <file>     # unstage a file (keep changes)
git commit --amend              # edit the last commit message
git reset --soft HEAD~1         # undo last commit, keep changes staged
```

### Syncing
```bash
git fetch origin                # check for remote changes without applying
git pull origin dev             # pull latest dev
git push origin feature/name    # push feature branch
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Start new feature | `git checkout dev && git pull && git checkout -b feature/name` |
| Stage all changes | `git add .` |
| Commit | `git commit -m "type: description"` |
| Push branch | `git push origin feature/name` |
| Update from dev | `git rebase dev` |
| Delete local branch | `git branch -d feature/name` |
| Delete remote branch | `git push origin --delete feature/name` |
| Check all branches | `git branch -a` |
| Last 10 commits | `git log --oneline -10` |
| Discard file changes | `git restore <file>` |

---

## Golden Rules

```
1. Never push directly to main
2. Always branch from dev, not main
3. Keep feature branches short-lived
4. Commit migrations alongside the feature code
5. Pull before you branch — always start fresh
```
