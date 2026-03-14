# HealAgent — PRD

## Original Problem Statement
Autonomous CI/CD Healing Agent that takes open-source repo links, finds bugs/issues (code bugs, dependency issues, linting, quality), generates AI fixes with tests, and creates PRs following open-source standards with AI labels.

## Architecture
- **Frontend:** React 18 + Tailwind CSS + Framer Motion
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (Motor async)
- **AI:** OpenAI GPT-4o via Emergent LLM key
- **SCM:** GitHub REST API v3

## Core Requirements
1. JWT authentication (register/login)
2. Add any GitHub repo URL for scanning
3. Clone + static analysis (flake8) + dependency checks + AI deep analysis
4. Issue detection with severity (critical/high/medium/low) and type (bug/security/performance/quality/lint/dependency)
5. AI fix generation with complete file content
6. AI test generation for each fix
7. GitHub PR creation: fork → branch → commit fix + tests → PR with conventional commits + AI labels
8. Dashboard with stats, recent issues, PRs
9. Settings for GitHub PAT, AI model, safety guards

## What's Been Implemented (Jan 2026)
- Full JWT auth system (register, login, token validation)
- Repository management (add, list, detail, delete)
- Background scanning pipeline (clone, flake8, dependency check, AI analysis)
- Issue management with filtering (severity, type, status)
- AI fix generation via GPT-4o
- AI test generation for fixes
- GitHub PR creation (fork, branch, commit, PR, labels)
- Dashboard with severity breakdown and stats
- Settings page (GitHub PAT, AI model, scan limits, protected paths)
- Dark theme DevOps-style UI
- Comprehensive README.md

## User Personas
- DevOps engineers managing CI/CD pipelines
- Open-source maintainers wanting automated bug detection
- Developers contributing automated fixes to OSS projects

## P0 (Done)
- [x] Auth system
- [x] Repo scanning pipeline
- [x] AI issue detection
- [x] Fix generation
- [x] Test generation
- [x] PR creation with labels
- [x] Dashboard analytics
- [x] Settings management

## P1 (Next)
- [ ] Webhook support for auto-scanning on push
- [ ] Batch fix+PR for multiple issues
- [ ] PR status sync (merged/closed tracking)
- [ ] Scan history / diff between scans
- [ ] Email notifications on scan completion

## P2 (Backlog)
- [ ] GitHub OAuth login
- [ ] Team/org support
- [ ] Custom analysis rules
- [ ] Support for GitLab/Bitbucket repos
- [ ] Scheduled recurring scans
- [ ] CI/CD pipeline healing (original concept)
