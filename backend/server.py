from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class PipelineRunCreate(BaseModel):
    repo: str
    branch: str
    commit_sha: str
    workflow_name: str = "CI Pipeline"
    trigger: str = "push"

class HealingTrigger(BaseModel):
    pipeline_run_id: str

class AgentConfigUpdate(BaseModel):
    github_token: Optional[str] = None
    ai_model: Optional[str] = "gpt-4o"
    max_heal_attempts: Optional[int] = 3
    auto_merge: Optional[bool] = False
    max_files_per_fix: Optional[int] = 5
    protected_paths: Optional[List[str]] = None
    notifications_enabled: Optional[bool] = True

class AnalyzeRequest(BaseModel):
    pipeline_run_id: str

# ============ AUTH HELPERS ============

def create_token(user_id: str, email: str):
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
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

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hashed,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email)
    return {"token": token, "user": {"id": user_id, "email": data.email, "name": data.name}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(data.password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"]}

# ============ DASHBOARD STATS ============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    total_runs = await db.pipeline_runs.count_documents({})
    failed_runs = await db.pipeline_runs.count_documents({"status": "failure"})
    healed_runs = await db.pipeline_runs.count_documents({"status": "healed"})
    successful_runs = await db.pipeline_runs.count_documents({"status": "success"})
    total_heals = await db.healing_attempts.count_documents({})
    successful_heals = await db.healing_attempts.count_documents({"status": "completed"})
    pending_heals = await db.healing_attempts.count_documents({"status": {"$in": ["analyzing", "generating_fix", "creating_pr"]}})
    
    # Recent activity
    recent_runs = await db.pipeline_runs.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_heals = await db.healing_attempts.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "pipeline": {
            "total": total_runs,
            "failed": failed_runs,
            "healed": healed_runs,
            "successful": successful_runs,
            "success_rate": round((successful_runs / total_runs * 100) if total_runs > 0 else 0, 1)
        },
        "healing": {
            "total": total_heals,
            "successful": successful_heals,
            "pending": pending_heals,
            "heal_rate": round((successful_heals / total_heals * 100) if total_heals > 0 else 0, 1)
        },
        "recent_runs": recent_runs,
        "recent_heals": recent_heals
    }

# ============ PIPELINE RUNS ============

@api_router.get("/pipeline-runs")
async def get_pipeline_runs(user=Depends(get_current_user), limit: int = 50, status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    runs = await db.pipeline_runs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return runs

@api_router.get("/pipeline-runs/{run_id}")
async def get_pipeline_run(run_id: str, user=Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    return run

# ============ HEALING ATTEMPTS ============

@api_router.get("/healing-attempts")
async def get_healing_attempts(user=Depends(get_current_user), limit: int = 50):
    attempts = await db.healing_attempts.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return attempts

@api_router.get("/healing-attempts/{attempt_id}")
async def get_healing_attempt(attempt_id: str, user=Depends(get_current_user)):
    attempt = await db.healing_attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Healing attempt not found")
    return attempt

@api_router.post("/healing-attempts/trigger")
async def trigger_healing(data: HealingTrigger, user=Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": data.pipeline_run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    if run["status"] != "failure":
        raise HTTPException(status_code=400, detail="Can only heal failed pipeline runs")
    
    attempt_id = str(uuid.uuid4())
    attempt = {
        "id": attempt_id,
        "pipeline_run_id": data.pipeline_run_id,
        "repo": run["repo"],
        "branch": run["branch"],
        "commit_sha": run["commit_sha"],
        "status": "analyzing",
        "steps": [
            {"name": "Failure Detected", "status": "completed", "timestamp": datetime.now(timezone.utc).isoformat()},
            {"name": "Analyzing Logs", "status": "in_progress", "timestamp": datetime.now(timezone.utc).isoformat()},
            {"name": "Generating Fix", "status": "pending", "timestamp": None},
            {"name": "Creating PR", "status": "pending", "timestamp": None}
        ],
        "analysis": None,
        "fixes": None,
        "pr_url": None,
        "error_message": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.healing_attempts.insert_one(attempt)
    
    # Trigger AI analysis in background
    import asyncio
    asyncio.create_task(_run_healing_pipeline(attempt_id, run))
    
    # Remove _id before returning
    attempt.pop("_id", None)
    return attempt

async def _run_healing_pipeline(attempt_id: str, run: dict):
    """Background task to run the full healing pipeline"""
    try:
        from agent.ai_analyzer import AIAnalyzer
        from agent.log_parser import LogParser
        from agent.fix_generator import FixGenerator
        
        # Step 1: Parse logs
        parser = LogParser()
        failure_info = parser.parse(run.get("logs", {}))
        
        # Step 2: AI analysis
        api_key = os.environ.get('EMERGENT_LLM_KEY', '')
        if not api_key:
            raise ValueError("No LLM API key configured")
        
        analyzer = AIAnalyzer(api_key=api_key)
        file_contents = {}
        if run.get("affected_files"):
            for f in run["affected_files"]:
                file_contents[f["path"]] = f.get("content", "# File content not available")
        
        analysis = await analyzer.analyze_failure(failure_info, file_contents)
        
        # Update step 2 complete, step 3 in progress
        await db.healing_attempts.update_one(
            {"id": attempt_id},
            {"$set": {
                "status": "generating_fix",
                "analysis": analysis,
                "steps.1.status": "completed",
                "steps.1.timestamp": datetime.now(timezone.utc).isoformat(),
                "steps.2.status": "in_progress",
                "steps.2.timestamp": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Step 3: Generate fixes
        fix_gen = FixGenerator()
        fixes = fix_gen.generate(analysis)
        
        # Step 4: Create PR (simulated if no GitHub token)
        config = await db.agent_config.find_one({}, {"_id": 0})
        github_token = config.get("github_token") if config else None
        
        pr_url = None
        if github_token and run.get("repo"):
            try:
                from agent.pr_creator import PRCreator
                pr_creator_inst = PRCreator(token=github_token, repo=run["repo"])
                heal_branch = f"auto-heal/{run['branch']}-{run['commit_sha'][:7]}"
                pr_url = pr_creator_inst.create(
                    head=heal_branch,
                    base=run["branch"],
                    title=f"Auto-Heal: Fix {failure_info.get('error_type', 'error')}",
                    body=_generate_pr_body(failure_info, analysis, fixes)
                )
            except Exception as e:
                logger.warning(f"GitHub PR creation failed: {e}")
                pr_url = f"https://github.com/{run['repo']}/pull/simulated-{attempt_id[:8]}"
        else:
            pr_url = f"https://github.com/{run.get('repo', 'org/repo')}/pull/simulated-{attempt_id[:8]}"
        
        # Update final status
        await db.healing_attempts.update_one(
            {"id": attempt_id},
            {"$set": {
                "status": "completed",
                "fixes": fixes,
                "pr_url": pr_url,
                "steps.2.status": "completed",
                "steps.2.timestamp": datetime.now(timezone.utc).isoformat(),
                "steps.3.status": "completed",
                "steps.3.timestamp": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update pipeline run status
        await db.pipeline_runs.update_one(
            {"id": run["id"]},
            {"$set": {"status": "healed", "healing_attempt_id": attempt_id}}
        )
        
    except Exception as e:
        logger.error(f"Healing pipeline failed: {e}")
        await db.healing_attempts.update_one(
            {"id": attempt_id},
            {"$set": {
                "status": "failed",
                "error_message": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

def _generate_pr_body(failure_info, analysis, fixes):
    fix_files = "\n".join([f"- `{f['file']}`" for f in fixes]) if fixes else "- No files modified"
    return f"""## Autonomous Healing Agent

### Failure Detected
- **Error Type:** {failure_info.get('error_type', 'Unknown')}
- **Error Message:** {failure_info.get('error_message', 'Unknown')}
- **File:** {failure_info.get('file', 'N/A')}
- **Line:** {failure_info.get('line', 'N/A')}

### Root Cause Analysis
{analysis.get('root_cause', 'Analysis pending')}

### Fix Applied
{analysis.get('fix_description', 'Fix details pending')}

### Files Modified
{fix_files}

### Confidence Level
{analysis.get('confidence', 'N/A')}

---
*This PR was automatically generated by the CI/CD Healing Agent.*
"""

# ============ ANALYZE FAILURE (Manual) ============

@api_router.post("/analyze-failure")
async def analyze_failure_endpoint(data: AnalyzeRequest, user=Depends(get_current_user)):
    run = await db.pipeline_runs.find_one({"id": data.pipeline_run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    
    from agent.log_parser import LogParser
    parser = LogParser()
    failure_info = parser.parse(run.get("logs", {}))
    return {"failure_info": failure_info, "run": run}

# ============ AGENT CONFIG ============

@api_router.get("/config")
async def get_config(user=Depends(get_current_user)):
    config = await db.agent_config.find_one({"user_id": user["id"]}, {"_id": 0})
    if not config:
        config = {
            "user_id": user["id"],
            "ai_model": "gpt-4o",
            "max_heal_attempts": 3,
            "auto_merge": False,
            "max_files_per_fix": 5,
            "protected_paths": [".github/workflows/healing-agent.yml", ".env"],
            "notifications_enabled": True,
            "github_connected": False
        }
    # Never return the actual token
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
        {"user_id": user["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    config = await db.agent_config.find_one({"user_id": user["id"]}, {"_id": 0})
    config.pop("github_token", None)
    return config

# ============ SIMULATION / SEED DATA ============

SAMPLE_ERRORS = [
    {
        "error_type": "AssertionError",
        "error_message": "assert calculate_total([10, 20, 30]) == 60, got 50",
        "file": "tests/test_calculator.py",
        "line": 42,
        "category": "test",
        "failed_step": "Run tests",
        "traceback": """Traceback (most recent call last):
  File "tests/test_calculator.py", line 42, in test_calculate_total
    assert calculate_total([10, 20, 30]) == 60
AssertionError: assert 50 == 60
  + where 50 = calculate_total([10, 20, 30])""",
        "fix_file": "src/calculator.py",
        "fix_description": "Fixed off-by-one error in calculate_total function"
    },
    {
        "error_type": "ModuleNotFoundError",
        "error_message": "No module named 'pandas'",
        "file": "src/data_processor.py",
        "line": 3,
        "category": "dependency",
        "failed_step": "Install dependencies",
        "traceback": """Traceback (most recent call last):
  File "src/data_processor.py", line 3, in <module>
    import pandas as pd
ModuleNotFoundError: No module named 'pandas'""",
        "fix_file": "requirements.txt",
        "fix_description": "Added missing pandas dependency to requirements.txt"
    },
    {
        "error_type": "SyntaxError",
        "error_message": "unexpected EOF while parsing",
        "file": "src/auth/middleware.py",
        "line": 28,
        "category": "syntax",
        "failed_step": "Run linting",
        "traceback": """File "src/auth/middleware.py", line 28
    if token:
              ^
SyntaxError: unexpected EOF while parsing""",
        "fix_file": "src/auth/middleware.py",
        "fix_description": "Fixed incomplete if-block in authentication middleware"
    },
    {
        "error_type": "TypeError",
        "error_message": "'NoneType' object is not subscriptable",
        "file": "src/api/handlers.py",
        "line": 67,
        "category": "runtime",
        "failed_step": "Run tests",
        "traceback": """Traceback (most recent call last):
  File "src/api/handlers.py", line 67, in get_user_profile
    username = response['data']['username']
TypeError: 'NoneType' object is not subscriptable""",
        "fix_file": "src/api/handlers.py",
        "fix_description": "Added null check before accessing nested response data"
    },
    {
        "error_type": "E302",
        "error_message": "expected 2 blank lines, found 1",
        "file": "src/utils/helpers.py",
        "line": 15,
        "category": "lint",
        "failed_step": "Run linting",
        "traceback": """src/utils/helpers.py:15:1: E302 expected 2 blank lines, found 1
src/utils/helpers.py:28:80: E501 line too long (95 > 79 characters)
src/utils/helpers.py:42:1: W291 trailing whitespace""",
        "fix_file": "src/utils/helpers.py",
        "fix_description": "Fixed PEP8 formatting issues: blank lines and line length"
    },
    {
        "error_type": "ConnectionRefusedError",
        "error_message": "Connection refused: localhost:5432",
        "file": "src/db/connection.py",
        "line": 12,
        "category": "infrastructure",
        "failed_step": "Run tests",
        "traceback": """Traceback (most recent call last):
  File "src/db/connection.py", line 12, in connect
    conn = psycopg2.connect(host='localhost', port=5432)
ConnectionRefusedError: [Errno 111] Connection refused""",
        "fix_file": "docker-compose.yml",
        "fix_description": "Updated database service configuration in docker-compose"
    },
    {
        "error_type": "KeyError",
        "error_message": "'API_KEY'",
        "file": "src/services/payment.py",
        "line": 8,
        "category": "config",
        "failed_step": "Run tests",
        "traceback": """Traceback (most recent call last):
  File "src/services/payment.py", line 8, in <module>
    api_key = os.environ['API_KEY']
KeyError: 'API_KEY'""",
        "fix_file": ".github/workflows/ci.yml",
        "fix_description": "Added missing API_KEY environment variable to CI workflow"
    },
    {
        "error_type": "npm ERR!",
        "error_message": "ERESOLVE unable to resolve dependency tree",
        "file": "package.json",
        "line": None,
        "category": "dependency",
        "failed_step": "Install dependencies",
        "traceback": """npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! Found: react@18.2.0
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^17.0.0" from react-old-lib@2.1.0""",
        "fix_file": "package.json",
        "fix_description": "Updated conflicting dependency versions in package.json"
    }
]

SAMPLE_REPOS = [
    "acme-corp/web-platform",
    "acme-corp/api-gateway",
    "acme-corp/data-pipeline",
    "acme-corp/auth-service",
    "acme-corp/billing-engine"
]

SAMPLE_BRANCHES = ["main", "develop", "feature/user-auth", "feature/payments", "fix/memory-leak", "hotfix/api-timeout"]

@api_router.post("/simulate/seed")
async def seed_simulation_data(user=Depends(get_current_user)):
    """Seed the database with realistic simulation data"""
    # Clear existing simulation data
    await db.pipeline_runs.delete_many({})
    await db.healing_attempts.delete_many({})
    
    runs = []
    heals = []
    now = datetime.now(timezone.utc)
    
    for i in range(25):
        run_id = str(uuid.uuid4())
        error = random.choice(SAMPLE_ERRORS)
        repo = random.choice(SAMPLE_REPOS)
        branch = random.choice(SAMPLE_BRANCHES)
        sha = uuid.uuid4().hex[:7]
        created = (now - timedelta(hours=random.randint(1, 720))).isoformat()
        
        status_options = ["success", "success", "success", "failure", "failure", "healed"]
        status = random.choice(status_options)
        
        run = {
            "id": run_id,
            "repo": repo,
            "branch": branch,
            "commit_sha": sha,
            "workflow_name": "CI Pipeline",
            "trigger": random.choice(["push", "pull_request"]),
            "status": status,
            "duration_seconds": random.randint(30, 600),
            "created_at": created,
            "logs": {},
            "affected_files": [],
            "healing_attempt_id": None
        }
        
        if status in ["failure", "healed"]:
            run["error_type"] = error["error_type"]
            run["error_message"] = error["error_message"]
            run["failed_step"] = error["failed_step"]
            run["category"] = error["category"]
            run["logs"] = {
                "build-and-test": {
                    "log": error["traceback"],
                    "steps": [
                        {"name": "Checkout", "conclusion": "success", "number": 1},
                        {"name": "Setup Python", "conclusion": "success", "number": 2},
                        {"name": "Install dependencies", "conclusion": "success" if error["failed_step"] != "Install dependencies" else "failure", "number": 3},
                        {"name": error["failed_step"], "conclusion": "failure", "number": 4}
                    ],
                    "conclusion": "failure"
                }
            }
            run["affected_files"] = [
                {"path": error["file"], "content": f"# Content of {error['file']}\n# Line {error.get('line', 'N/A')} has the issue"}
            ]
        
        if status == "healed":
            attempt_id = str(uuid.uuid4())
            run["healing_attempt_id"] = attempt_id
            heal_created = (datetime.fromisoformat(created) + timedelta(minutes=2)).isoformat()
            
            heal = {
                "id": attempt_id,
                "pipeline_run_id": run_id,
                "repo": repo,
                "branch": branch,
                "commit_sha": sha,
                "status": "completed",
                "steps": [
                    {"name": "Failure Detected", "status": "completed", "timestamp": heal_created},
                    {"name": "Analyzing Logs", "status": "completed", "timestamp": (datetime.fromisoformat(heal_created) + timedelta(seconds=30)).isoformat()},
                    {"name": "Generating Fix", "status": "completed", "timestamp": (datetime.fromisoformat(heal_created) + timedelta(seconds=90)).isoformat()},
                    {"name": "Creating PR", "status": "completed", "timestamp": (datetime.fromisoformat(heal_created) + timedelta(seconds=120)).isoformat()}
                ],
                "analysis": {
                    "root_cause": f"The {error['error_type']} was caused by {error['error_message']}",
                    "fix_description": error["fix_description"],
                    "confidence": random.choice(["high", "high", "medium"]),
                    "category": error["category"],
                    "summary": error["fix_description"],
                    "risk_assessment": "Low risk - targeted fix with no side effects",
                    "fixes": [{"file": error["fix_file"], "action": "modify", "content": f"# Fixed content for {error['fix_file']}", "diff_summary": error["fix_description"]}]
                },
                "fixes": [{"file": error["fix_file"], "action": "modify", "content": f"# Fixed content for {error['fix_file']}", "diff_summary": error["fix_description"]}],
                "pr_url": f"https://github.com/{repo}/pull/{random.randint(100, 999)}",
                "error_message": None,
                "created_at": heal_created,
                "updated_at": (datetime.fromisoformat(heal_created) + timedelta(seconds=120)).isoformat()
            }
            heals.append(heal)
        
        runs.append(run)
    
    if runs:
        await db.pipeline_runs.insert_many(runs)
    if heals:
        await db.healing_attempts.insert_many(heals)
    
    return {"message": f"Seeded {len(runs)} pipeline runs and {len(heals)} healing attempts"}

@api_router.post("/simulate/failure")
async def simulate_failure(user=Depends(get_current_user)):
    """Create a single simulated failure for testing the healing agent"""
    error = random.choice(SAMPLE_ERRORS)
    repo = random.choice(SAMPLE_REPOS)
    branch = random.choice(SAMPLE_BRANCHES)
    sha = uuid.uuid4().hex[:7]
    run_id = str(uuid.uuid4())
    
    run = {
        "id": run_id,
        "repo": repo,
        "branch": branch,
        "commit_sha": sha,
        "workflow_name": "CI Pipeline",
        "trigger": "push",
        "status": "failure",
        "duration_seconds": random.randint(30, 300),
        "error_type": error["error_type"],
        "error_message": error["error_message"],
        "failed_step": error["failed_step"],
        "category": error["category"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "logs": {
            "build-and-test": {
                "log": error["traceback"],
                "steps": [
                    {"name": "Checkout", "conclusion": "success", "number": 1},
                    {"name": "Setup Python", "conclusion": "success", "number": 2},
                    {"name": error["failed_step"], "conclusion": "failure", "number": 3}
                ],
                "conclusion": "failure"
            }
        },
        "affected_files": [
            {"path": error["file"], "content": f"# Content of {error['file']}\n# Line {error.get('line', 'N/A')} has the issue"}
        ],
        "healing_attempt_id": None
    }
    await db.pipeline_runs.insert_one(run)
    run.pop("_id", None)
    return run

# ============ ROOT ============

@api_router.get("/")
async def root():
    return {"message": "CI/CD Healing Agent API", "version": "1.0.0"}

# Include router
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
