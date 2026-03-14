# HealAgent — Autonomous CI/CD Healing Agent

An AI-powered platform that scans open-source GitHub repositories, detects bugs and code issues, generates fixes with test cases, and raises Pull Requests following open-source contribution standards — all autonomously.

---

## Overview

HealAgent automates the tedious process of finding and fixing bugs in codebases. Point it at any public GitHub repository and it will:

1. **Clone & Analyze** — Scans the repo for code bugs, dependency issues, linting violations, and security concerns
2. **AI-Powered Detection** — Uses GPT-4o to deeply analyze code files and identify real bugs with root cause explanations
3. **Generate Fixes + Tests** — Produces complete code fixes alongside test cases that verify the fix
4. **Raise PRs** — Forks the repo, creates a branch, commits the fix and tests, and opens a Pull Request with proper open-source formatting and `ai-generated` labels

```
Repo URL → Clone → Static Analysis + AI Scan → Issues Found →
AI Fix + Tests Generated → Fork → Branch → Commit → PR Created ✅
```

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Repo Scanner** | Clone and scan any public GitHub repository |
| 2 | **Multi-Pattern Analysis** | Python (flake8), JS, dependency checks, AI-powered deep analysis |
| 3 | **Bug Detection** | Code bugs, type errors, logic issues, null references |
| 4 | **Security Scanning** | Injection risks, exposed secrets, auth vulnerabilities |
| 5 | **Dependency Audit** | Unpinned versions, wildcard deps, known issues |
| 6 | **Lint & Quality** | PEP8, code quality, dead code, unclear naming |
| 7 | **AI Fix Generation** | GPT-4o generates complete corrected file content |
| 8 | **Test Generation** | Auto-generates test cases for every fix (pytest/jest) |
| 9 | **GitHub PR Creation** | Fork → Branch → Commit → PR with conventional commits |
| 10 | **AI Labels** | PRs tagged with `ai-generated`, `automated-fix`, `bot` labels |
| 11 | **Open-Source PR Format** | Detailed body: root cause, fix explanation, risk assessment, test descriptions |
| 12 | **Severity Classification** | Critical / High / Medium / Low issue severity |
| 13 | **Issue Categorization** | Bug, Security, Performance, Quality, Lint, Dependency |
| 14 | **Safety Guards** | Protected paths, file size limits, no auto-merge |
| 15 | **Real-time Progress** | Live scan progress, fix generation status, PR creation tracking |
| 16 | **Dashboard Analytics** | Issue severity breakdown, fix rate, PR stats |
| 17 | **JWT Authentication** | Secure user accounts with token-based auth |
| 18 | **Dark Theme UI** | Professional DevOps-style dashboard |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Tailwind CSS, Framer Motion, Lucide Icons |
| **Backend** | Python FastAPI, Uvicorn |
| **Database** | MongoDB (Motor async driver) |
| **AI** | OpenAI GPT-4o via Emergent LLM |
| **SCM** | GitHub REST API v3 |
| **Auth** | JWT (PyJWT + bcrypt) |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   React Frontend                      │
│  Dashboard │ Repos │ Issues │ PRs │ Settings          │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼───────────────────────────────┐
│                  FastAPI Backend                       │
│  /api/auth  │  /api/repos  │  /api/issues  │  /api/prs│
└──────┬──────────┬──────────────┬─────────────────────┘
       │          │              │
  ┌────▼───┐ ┌───▼────────┐ ┌──▼──────────┐
  │MongoDB │ │ Agent Core │ │ GitHub API  │
  │        │ │            │ │             │
  │ users  │ │ Scanner    │ │ Fork        │
  │ repos  │ │ Analyzer   │ │ Branch      │
  │ issues │ │ FixGen     │ │ Commit      │
  │ PRs    │ │ TestGen    │ │ Create PR   │
  │ config │ │            │ │ Add Labels  │
  └────────┘ └────────────┘ └─────────────┘
```

---

## Directory Structure

```
/app
├── backend/
│   ├── server.py                 # FastAPI app — all API routes
│   ├── .env                      # Environment variables
│   ├── requirements.txt          # Python dependencies
│   └── agent/
│       ├── __init__.py
│       ├── repo_scanner.py       # Git clone, flake8, dependency checks
│       ├── code_analyzer.py      # GPT-4o powered code analysis & fix generation
│       ├── fix_generator.py      # Fix validation & safety guards
│       ├── pr_creator.py         # GitHub API: fork, branch, commit, PR, labels
│       ├── pipeline_monitor.py   # GitHub Actions log fetching
│       ├── log_parser.py         # Regex-based CI/CD log parsing
│       └── git_operations.py     # Local git operations
├── frontend/
│   ├── src/
│   │   ├── App.js                # Routes, auth context, layout
│   │   ├── App.css               # Global styles
│   │   ├── pages/
│   │   │   ├── LoginPage.js      # Auth (sign in / register)
│   │   │   ├── DashboardPage.js  # Stats overview, recent activity
│   │   │   ├── ReposPage.js      # Add repos, list, scan trigger
│   │   │   ├── RepoDetailPage.js # Issues table with filters
│   │   │   ├── IssueDetailPage.js# Issue details, AI fix, tests, PR
│   │   │   ├── PullRequestsPage.js # All created PRs
│   │   │   └── SettingsPage.js   # GitHub PAT, AI model, safety config
│   │   └── components/
│   │       ├── Sidebar.js        # Navigation sidebar
│   │       └── StatusBadge.js    # Status/severity indicators
│   ├── .env                      # Frontend env vars
│   └── package.json
└── README.md
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Sign in (`email`, `password`) → JWT token |
| `GET` | `/api/auth/me` | Get current user (requires Bearer token) |

### Repositories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/repos` | Add a repo (`url`: GitHub URL) |
| `GET` | `/api/repos` | List all repos |
| `GET` | `/api/repos/:id` | Get repo details |
| `DELETE` | `/api/repos/:id` | Delete repo and all its issues |
| `POST` | `/api/repos/:id/scan` | Start scanning for bugs |

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/repos/:id/issues` | List issues (filters: `severity`, `type`, `status`) |
| `GET` | `/api/issues/:id` | Get issue detail with fix and tests |
| `POST` | `/api/issues/:id/fix` | Generate AI fix + test cases |
| `POST` | `/api/issues/:id/create-pr` | Create GitHub PR for the fix |

### Pull Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/prs` | List all created PRs |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Get agent configuration |
| `PUT` | `/api/config` | Update config (GitHub token, AI model, safety settings) |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | Aggregated stats: repos, issues, PRs, severity breakdown |

---

## Scanning Pipeline

When you trigger a scan on a repository, the agent runs this pipeline in the background:

### 1. Clone Repository
```
git clone --depth 50 <repo_url> /tmp/repos/<repo_id>
```

### 2. Detect Language
Counts file extensions to determine the primary language (Python, JavaScript, Java, Go, Ruby, Rust).

### 3. Static Analysis
- **Python** — Runs `flake8` with common error/warning rules
- **Dependencies** — Checks `requirements.txt` for unpinned packages, `package.json` for wildcard versions

### 4. AI Deep Analysis
For each scannable file (up to configurable limit):
- Sends file content to GPT-4o with expert code review prompt
- AI identifies bugs, security issues, performance problems, quality concerns
- Returns structured JSON with severity, line numbers, code snippets, suggested fixes

### 5. Store Results
All issues saved to MongoDB with full metadata for filtering and tracking.

---

## Fix & PR Pipeline

When you generate a fix for an issue:

### 1. AI Fix Generation
- Reads the actual file from the repo
- Sends issue context + file content to GPT-4o
- Returns: complete fixed file, conventional commit message, explanation, risk assessment

### 2. Test Generation
- AI generates test cases that verify the fix
- Returns: test file path, test content, framework, test descriptions

### 3. GitHub PR Creation
```
Fork repo → Create branch (ai-fix/<issue-slug>) →
Commit fix file → Commit test file →
Create PR with detailed body → Add labels (ai-generated, automated-fix, bot)
```

### PR Body Format
Every PR follows this open-source standard format:
- **Issue description** with severity and file location
- **Root cause analysis** explaining why the bug exists
- **Changes made** with diff summary
- **Tests added** with descriptions
- **Risk assessment** (breaking changes check)
- **AI disclaimer** reminding reviewers to validate

---

## Configuration

### Agent Settings (via Settings page)

| Setting | Default | Description |
|---------|---------|-------------|
| AI Model | `gpt-4o` | LLM model for analysis (gpt-4o, gpt-4o-mini, gpt-5.2) |
| Max Files Per Scan | `20` | Maximum files to AI-analyze per scan |
| Auto-Create PRs | `false` | Automatically create PRs after fix generation |
| Protected Paths | `.env`, `.github/workflows/` | Files that won't be modified |
| GitHub Token | — | Personal Access Token with `repo` scope |

### Environment Variables

**Backend** (`/app/backend/.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=<your-key>
JWT_SECRET=<secret>
```

**Frontend** (`/app/frontend/.env`):
```
REACT_APP_BACKEND_URL=<backend-url>
```

---

## Getting Started

### 1. Register an Account
Navigate to the login page and create an account.

### 2. Configure GitHub Token
Go to **Settings** and add your GitHub Personal Access Token:
- Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
- Generate a token with `repo` scope (for forking, branching, and creating PRs)
- Paste it in the Settings page

### 3. Add a Repository
Go to **Repositories** and paste a GitHub URL:
```
https://github.com/owner/repo
```

### 4. Scan for Issues
Click the **Scan** button. The agent will:
- Clone the repository
- Run static analysis (flake8, dependency checks)
- Use AI to deeply analyze each code file
- Report all issues with severity and type

### 5. Generate Fixes
Click on any issue → **Generate Fix**. The AI will:
- Analyze the issue in context of the full file
- Generate a corrected version of the file
- Create test cases that verify the fix

### 6. Create a Pull Request
Click **Create PR** on a fixed issue. The agent will:
- Fork the repository (if you don't own it)
- Create a branch named `ai-fix/<issue-slug>`
- Commit the fix and test files
- Open a PR with detailed description and `ai-generated` label

---

## Safety Mechanisms

- **Protected Paths** — Configurable list of files that will never be modified
- **No Auto-Merge** — PRs always require human review before merging
- **File Size Limits** — Won't modify files over 50KB
- **Max File Count** — Limits the number of files per fix
- **Syntax Validation** — Validates Python (compile), YAML, and JSON fixes before committing
- **No Deletions** — Agent will never delete files
- **Human-in-the-Loop** — Every fix is reviewed before PR creation

---

## Issue Types Detected

| Type | Examples |
|------|----------|
| **Bug** | Null references, type errors, off-by-one, logic flaws |
| **Security** | SQL injection, XSS, exposed secrets, auth bypass |
| **Performance** | N+1 queries, memory leaks, unnecessary computations |
| **Quality** | Dead code, duplicated code, unclear naming, missing error handling |
| **Lint** | PEP8 violations, style issues, formatting |
| **Dependency** | Unpinned versions, wildcard deps, conflicting packages |

---

## License

MIT

---

Built with the CI/CD Healing Agent platform.
