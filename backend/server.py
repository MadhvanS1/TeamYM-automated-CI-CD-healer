from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import jwt
import bcrypt
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ====================== MODELS ======================

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class RepoAdd(BaseModel):
    url: str

class ScanTrigger(BaseModel):
    repo_id: str

class FixTrigger(BaseModel):
    issue_id: str

class CreatePRRequest(BaseModel):
    issue_id: str

class AgentConfigUpdate(BaseModel):
    github_token: Optional[str] = None
    ai_model: Optional[str] = "gpt-4o"
    max_files_per_scan: Optional[int] = 20
    auto_pr: Optional[bool] = False
    protected_paths: Optional[List[str]] = None
    notifications_enabled: Optional[bool] = True

# ====================== AUTH ======================

def create_token(user_id: str, email: str):
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials.credentials)
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id, "email": data.email, "name": data.name,
        "password_hash": hashed, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not bcrypt.checkpw(data.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"]}

# ====================== DASHBOARD ======================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    total_repos = await db.repos.count_documents({"user_id": user["id"]})
    total_issues = await db.issues.count_documents({"user_id": user["id"]})
    open_issues = await db.issues.count_documents({"user_id": user["id"], "status": "open"})
    fixed_issues = await db.issues.count_documents({"user_id": user["id"], "status": "fixed"})
    total_prs = await db.pull_requests.count_documents({"user_id": user["id"]})
    open_prs = await db.pull_requests.count_documents({"user_id": user["id"], "status": "open"})

    # Severity breakdown
    critical = await db.issues.count_documents({"user_id": user["id"], "severity": "critical"})
    high = await db.issues.count_documents({"user_id": user["id"], "severity": "high"})
    medium = await db.issues.count_documents({"user_id": user["id"], "severity": "medium"})
    low = await db.issues.count_documents({"user_id": user["id"], "severity": "low"})

    # Recent activity
    recent_repos = await db.repos.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_issues = await db.issues.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)
    recent_prs = await db.pull_requests.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)

    return {
        "repos": {"total": total_repos},
        "issues": {
            "total": total_issues, "open": open_issues, "fixed": fixed_issues,
            "critical": critical, "high": high, "medium": medium, "low": low
        },
        "prs": {"total": total_prs, "open": open_prs},
        "recent_repos": recent_repos,
        "recent_issues": recent_issues,
        "recent_prs": recent_prs,
    }

# ====================== REPOS ======================

def parse_github_url(url):
    """Extract owner and name from GitHub URL."""
    patterns = [
        r'github\.com[/:]([^/]+)/([^/.]+?)(?:\.git)?$',
        r'github\.com[/:]([^/]+)/([^/.]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1), match.group(2)
    raise ValueError("Invalid GitHub URL")

@api_router.post("/repos")
async def add_repo(data: RepoAdd, user=Depends(get_current_user)):
    try:
        owner, name = parse_github_url(data.url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL. Use format: https://github.com/owner/repo")

    existing = await db.repos.find_one({"owner": owner, "name": name, "user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Repository already added")

    repo_id = str(uuid.uuid4())
    repo = {
        "id": repo_id,
        "user_id": user["id"],
        "url": f"https://github.com/{owner}/{name}",
        "owner": owner,
        "name": name,
        "full_name": f"{owner}/{name}",
        "language": None,
        "description": None,
        "default_branch": "main",
        "scan_status": "pending",
        "scan_progress": None,
        "issues_found": 0,
        "issues_fixed": 0,
        "prs_created": 0,
        "last_scanned": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.repos.insert_one(repo)
    repo.pop("_id", None)
    return repo

@api_router.get("/repos")
async def list_repos(user=Depends(get_current_user)):
    repos = await db.repos.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return repos

@api_router.get("/repos/{repo_id}")
async def get_repo(repo_id: str, user=Depends(get_current_user)):
    repo = await db.repos.find_one({"id": repo_id, "user_id": user["id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo

@api_router.delete("/repos/{repo_id}")
async def delete_repo(repo_id: str, user=Depends(get_current_user)):
    repo = await db.repos.find_one({"id": repo_id, "user_id": user["id"]})
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    await db.repos.delete_one({"id": repo_id})
    await db.issues.delete_many({"repo_id": repo_id})
    await db.pull_requests.delete_many({"repo_id": repo_id})
    return {"message": "Repository deleted"}

# ====================== SCANNING ======================

@api_router.post("/repos/{repo_id}/scan")
async def start_scan(repo_id: str, user=Depends(get_current_user)):
    repo = await db.repos.find_one({"id": repo_id, "user_id": user["id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    if repo["scan_status"] == "scanning":
        raise HTTPException(status_code=400, detail="Scan already in progress")

    await db.repos.update_one(
        {"id": repo_id},
        {"$set": {"scan_status": "scanning", "scan_progress": "Cloning repository..."}}
    )

    import asyncio
    asyncio.create_task(_run_scan(repo_id, repo, user["id"]))
    return {"message": "Scan started", "repo_id": repo_id}

async def _run_scan(repo_id, repo, user_id):
    """Background scan pipeline."""
    from agent.repo_scanner import RepoScanner
    from agent.code_analyzer import CodeAnalyzer

    scanner = RepoScanner()
    clone_path = None

    try:
        # Step 1: Clone
        await db.repos.update_one({"id": repo_id}, {"$set": {"scan_progress": "Cloning repository..."}})
        clone_path = scanner.clone_repo(repo["url"], repo_id)

        # Step 2: Detect language
        await db.repos.update_one({"id": repo_id}, {"$set": {"scan_progress": "Detecting language..."}})
        language = scanner.detect_language(clone_path)
        structure = scanner.get_repo_structure(clone_path)

        # Get default branch
        import subprocess
        branch_result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=clone_path
        )
        default_branch = branch_result.stdout.strip() or "main"

        await db.repos.update_one(
            {"id": repo_id},
            {"$set": {"language": language, "default_branch": default_branch,
                       "description": f"{structure['total_files']} files"}}
        )

        # Step 3: Clear old issues
        await db.issues.delete_many({"repo_id": repo_id})

        all_issues = []

        # Step 4: Static analysis
        await db.repos.update_one({"id": repo_id}, {"$set": {"scan_progress": "Running static analysis..."}})
        if language == "python":
            lint_issues = scanner.run_flake8(clone_path)
            # Group lint issues by file for batch creation
            for issue in lint_issues[:30]:  # Cap at 30 lint issues
                issue_id = str(uuid.uuid4())
                all_issues.append({
                    "id": issue_id,
                    "repo_id": repo_id,
                    "user_id": user_id,
                    "type": issue["type"],
                    "severity": issue["severity"],
                    "title": issue["title"],
                    "description": issue["description"],
                    "file_path": issue["file_path"],
                    "line_start": issue.get("line_start"),
                    "line_end": issue.get("line_end"),
                    "code_snippet": None,
                    "suggested_fix": None,
                    "status": "open",
                    "fix": None,
                    "tests": None,
                    "pr_id": None,
                    "pr_url": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })

        # Step 5: Dependency check
        await db.repos.update_one({"id": repo_id}, {"$set": {"scan_progress": "Checking dependencies..."}})
        dep_issues = scanner.check_dependencies(clone_path)
        for issue in dep_issues[:10]:
            issue_id = str(uuid.uuid4())
            all_issues.append({
                "id": issue_id,
                "repo_id": repo_id,
                "user_id": user_id,
                "type": issue["type"],
                "severity": issue["severity"],
                "title": issue["title"],
                "description": issue["description"],
                "file_path": issue["file_path"],
                "line_start": issue.get("line_start"),
                "line_end": issue.get("line_end"),
                "code_snippet": None,
                "suggested_fix": None,
                "status": "open",
                "fix": None,
                "tests": None,
                "pr_id": None,
                "pr_url": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

        # Step 6: AI-powered deep analysis
        await db.repos.update_one({"id": repo_id}, {"$set": {"scan_progress": "AI analyzing code files..."}})
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if api_key:
            config = await db.agent_config.find_one({"user_id": user_id}, {"_id": 0})
            model = config.get("ai_model", "gpt-4o") if config else "gpt-4o"
            max_files = config.get("max_files_per_scan", 20) if config else 20

            analyzer = CodeAnalyzer(api_key=api_key, model=model)
            scannable = scanner.get_scannable_files(clone_path, language)[:max_files]

            for idx, file_path in enumerate(scannable):
                await db.repos.update_one(
                    {"id": repo_id},
                    {"$set": {"scan_progress": f"AI analyzing ({idx+1}/{len(scannable)}): {file_path}"}}
                )
                content = scanner.read_file(clone_path, file_path)
                if not content or len(content.strip()) < 20:
                    continue

                ai_issues = await analyzer.analyze_file(file_path, content, f"{repo['full_name']} ({language})")
                for ai_issue in ai_issues:
                    issue_id = str(uuid.uuid4())
                    # Read code snippet
                    snippet = None
                    if ai_issue.get("line_start") and content:
                        lines = content.split("\n")
                        start = max(0, (ai_issue.get("line_start") or 1) - 2)
                        end = min(len(lines), (ai_issue.get("line_end") or ai_issue.get("line_start") or 1) + 2)
                        snippet = "\n".join(lines[start:end])

                    all_issues.append({
                        "id": issue_id,
                        "repo_id": repo_id,
                        "user_id": user_id,
                        "type": ai_issue.get("type", "bug"),
                        "severity": ai_issue.get("severity", "medium"),
                        "title": ai_issue.get("title", "Unknown issue"),
                        "description": ai_issue.get("description", ""),
                        "file_path": file_path,
                        "line_start": ai_issue.get("line_start"),
                        "line_end": ai_issue.get("line_end"),
                        "code_snippet": snippet or ai_issue.get("code_snippet"),
                        "suggested_fix": ai_issue.get("suggested_fix"),
                        "status": "open",
                        "fix": None,
                        "tests": None,
                        "pr_id": None,
                        "pr_url": None,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    })

        # Save all issues
        if all_issues:
            await db.issues.insert_many(all_issues)

        # Update repo stats
        await db.repos.update_one(
            {"id": repo_id},
            {"$set": {
                "scan_status": "completed",
                "scan_progress": None,
                "issues_found": len(all_issues),
                "last_scanned": datetime.now(timezone.utc).isoformat(),
            }}
        )
        logger.info(f"Scan completed for {repo['full_name']}: {len(all_issues)} issues found")

    except Exception as e:
        logger.error(f"Scan failed for repo {repo_id}: {e}")
        await db.repos.update_one(
            {"id": repo_id},
            {"$set": {"scan_status": "failed", "scan_progress": str(e)}}
        )
    finally:
        if clone_path:
            scanner.cleanup(repo_id)

# ====================== ISSUES ======================

@api_router.get("/repos/{repo_id}/issues")
async def get_repo_issues(repo_id: str, user=Depends(get_current_user),
                          severity: Optional[str] = None, issue_type: Optional[str] = None,
                          status: Optional[str] = None):
    query = {"repo_id": repo_id, "user_id": user["id"]}
    if severity:
        query["severity"] = severity
    if issue_type:
        query["type"] = issue_type
    if status:
        query["status"] = status
    issues = await db.issues.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return issues

@api_router.get("/issues/{issue_id}")
async def get_issue(issue_id: str, user=Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id, "user_id": user["id"]}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@api_router.post("/issues/{issue_id}/fix")
async def generate_fix(issue_id: str, user=Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id, "user_id": user["id"]}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    api_key = os.environ.get('EMERGENT_LLM_KEY', '')
    if not api_key:
        raise HTTPException(status_code=500, detail="LLM API key not configured")

    await db.issues.update_one({"id": issue_id}, {"$set": {"status": "fixing"}})

    import asyncio
    asyncio.create_task(_generate_fix_task(issue_id, issue, user["id"]))
    return {"message": "Fix generation started", "issue_id": issue_id}

async def _generate_fix_task(issue_id, issue, user_id):
    """Background task to generate fix + tests."""
    from agent.code_analyzer import CodeAnalyzer
    from agent.repo_scanner import RepoScanner

    try:
        config = await db.agent_config.find_one({"user_id": user_id}, {"_id": 0})
        model = config.get("ai_model", "gpt-4o") if config else "gpt-4o"
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')

        analyzer = CodeAnalyzer(api_key=api_key, model=model)

        # Get repo to clone and read the file
        repo = await db.repos.find_one({"id": issue["repo_id"]}, {"_id": 0})
        if not repo:
            raise ValueError("Repository not found")

        scanner = RepoScanner()
        clone_path = scanner.clone_repo(repo["url"], f"fix-{issue_id[:8]}")

        try:
            file_content = scanner.read_file(clone_path, issue["file_path"])
            if not file_content:
                raise ValueError(f"Could not read file: {issue['file_path']}")

            # Generate fix
            fix = await analyzer.generate_fix(issue["file_path"], file_content, issue)
            if not fix:
                raise ValueError("AI could not generate a fix")

            # Generate tests
            tests = await analyzer.generate_tests(issue["file_path"], file_content, issue, fix)

            await db.issues.update_one(
                {"id": issue_id},
                {"$set": {
                    "status": "fixed",
                    "fix": fix,
                    "tests": tests,
                }}
            )
        finally:
            scanner.cleanup(f"fix-{issue_id[:8]}")

    except Exception as e:
        logger.error(f"Fix generation failed for {issue_id}: {e}")
        await db.issues.update_one(
            {"id": issue_id},
            {"$set": {"status": "fix_failed", "fix": {"error": str(e)}}}
        )

# ====================== PULL REQUESTS ======================

@api_router.post("/issues/{issue_id}/create-pr")
async def create_pr_for_issue(issue_id: str, user=Depends(get_current_user)):
    issue = await db.issues.find_one({"id": issue_id, "user_id": user["id"]}, {"_id": 0})
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    if not issue.get("fix") or issue.get("status") not in ["fixed"]:
        raise HTTPException(status_code=400, detail="No fix available. Generate a fix first.")
    if issue.get("fix", {}).get("error"):
        raise HTTPException(status_code=400, detail="Fix generation failed. Try regenerating.")

    config = await db.agent_config.find_one({"user_id": user["id"]}, {"_id": 0})
    github_token = config.get("github_token") if config else None
    if not github_token:
        raise HTTPException(status_code=400, detail="GitHub token required. Configure it in Settings.")

    repo = await db.repos.find_one({"id": issue["repo_id"]}, {"_id": 0})
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.issues.update_one({"id": issue_id}, {"$set": {"status": "creating_pr"}})

    import asyncio
    asyncio.create_task(_create_pr_task(issue_id, issue, repo, github_token, user["id"]))
    return {"message": "PR creation started", "issue_id": issue_id}

async def _create_pr_task(issue_id, issue, repo, github_token, user_id):
    """Background task to create a PR on GitHub."""
    from agent.pr_creator import PRCreator

    try:
        pr_creator = PRCreator(token=github_token, repo_owner=repo["owner"], repo_name=repo["name"])

        # Get authenticated user
        gh_user = pr_creator.get_authenticated_user()
        is_own_repo = (gh_user.lower() == repo["owner"].lower())

        fork_owner = None
        if not is_own_repo:
            # Fork the repo
            pr_creator.fork_repo()
            fork_owner = gh_user
            import asyncio
            await asyncio.sleep(3)  # Wait for fork to be ready

        # Get default branch and its SHA
        default_branch = pr_creator.get_default_branch()
        base_sha = pr_creator.get_branch_sha(default_branch, fork_owner=fork_owner)

        # Create branch
        safe_title = re.sub(r'[^a-zA-Z0-9-]', '-', issue.get('title', 'fix')[:40]).lower().strip('-')
        branch_name = f"ai-fix/{safe_title}-{issue_id[:6]}"
        pr_creator.create_branch(branch_name, base_sha, fork_owner=fork_owner)

        # Commit the fix
        fix = issue["fix"]
        commit_msg = fix.get("commit_message", f"fix: {issue.get('title', 'automated fix')}")
        pr_creator.create_or_update_file(
            issue["file_path"], fix["fixed_content"], commit_msg, branch_name, fork_owner=fork_owner
        )

        # Commit tests if available
        tests = issue.get("tests")
        if tests and tests.get("test_content") and tests.get("test_file_path"):
            test_msg = f"test: add tests for {issue.get('title', 'fix')}"
            pr_creator.create_or_update_file(
                tests["test_file_path"], tests["test_content"], test_msg, branch_name, fork_owner=fork_owner
            )

        # Create PR
        pr_body = PRCreator.format_pr_body(issue, fix, tests)
        pr_title = commit_msg
        pr = pr_creator.create_pull_request(
            head=branch_name, base=default_branch,
            title=pr_title, body=pr_body, fork_owner=fork_owner
        )

        pr_url = pr.get("html_url", "")
        pr_number = pr.get("number")

        # Store PR in database
        pr_id = str(uuid.uuid4())
        pr_record = {
            "id": pr_id,
            "user_id": user_id,
            "repo_id": repo["id"],
            "issue_id": issue_id,
            "title": pr_title,
            "url": pr_url,
            "number": pr_number,
            "branch": branch_name,
            "status": "open",
            "repo_full_name": repo["full_name"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.pull_requests.insert_one(pr_record)

        # Update issue
        await db.issues.update_one(
            {"id": issue_id},
            {"$set": {"status": "pr_created", "pr_id": pr_id, "pr_url": pr_url}}
        )

        # Update repo stats
        await db.repos.update_one(
            {"id": repo["id"]},
            {"$inc": {"issues_fixed": 1, "prs_created": 1}}
        )

        logger.info(f"PR created: {pr_url}")

    except Exception as e:
        logger.error(f"PR creation failed for {issue_id}: {e}")
        await db.issues.update_one(
            {"id": issue_id},
            {"$set": {"status": "pr_failed", "pr_url": None,
                       "fix": {**issue.get("fix", {}), "pr_error": str(e)}}}
        )

@api_router.get("/prs")
async def list_prs(user=Depends(get_current_user)):
    prs = await db.pull_requests.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return prs

# ====================== CONFIG ======================

@api_router.get("/config")
async def get_config(user=Depends(get_current_user)):
    config = await db.agent_config.find_one({"user_id": user["id"]}, {"_id": 0})
    if not config:
        config = {
            "user_id": user["id"],
            "ai_model": "gpt-4o",
            "max_files_per_scan": 20,
            "auto_pr": False,
            "protected_paths": [".env", ".github/workflows/"],
            "notifications_enabled": True,
            "github_connected": False,
        }
    config.pop("github_token", None)
    return config

@api_router.put("/config")
async def update_config(data: AgentConfigUpdate, user=Depends(get_current_user)):
    update_data = data.model_dump(exclude_none=True)
    update_data["user_id"] = user["id"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    if data.github_token:
        update_data["github_connected"] = True
    await db.agent_config.update_one(
        {"user_id": user["id"]}, {"$set": update_data}, upsert=True
    )
    config = await db.agent_config.find_one({"user_id": user["id"]}, {"_id": 0})
    config.pop("github_token", None)
    return config

# ====================== ROOT ======================

@api_router.get("/")
async def root():
    return {"message": "CI/CD Healing Agent API", "version": "2.0.0"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
