import os
import shutil
import subprocess
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

CLONE_BASE = "/tmp/repos"


class RepoScanner:
    """Clones repos and runs static analysis to find issues."""

    SUPPORTED_EXTENSIONS = {
        "python": [".py"],
        "javascript": [".js", ".jsx", ".ts", ".tsx"],
        "java": [".java"],
        "go": [".go"],
        "ruby": [".rb"],
        "rust": [".rs"],
    }

    IGNORE_DIRS = {
        "node_modules", ".git", "__pycache__", ".venv", "venv",
        "env", ".env", "dist", "build", ".next", ".nuxt",
        "vendor", ".tox", ".mypy_cache", ".pytest_cache",
        "coverage", ".coverage", "htmlcov", "egg-info",
    }

    IGNORE_FILES = {
        "package-lock.json", "yarn.lock", "poetry.lock",
        "Pipfile.lock", "pnpm-lock.yaml",
    }

    def clone_repo(self, repo_url, repo_id):
        """Clone a repo to local filesystem."""
        clone_path = os.path.join(CLONE_BASE, repo_id)
        if os.path.exists(clone_path):
            shutil.rmtree(clone_path)
        os.makedirs(CLONE_BASE, exist_ok=True)

        result = subprocess.run(
            ["git", "clone", "--depth", "50", repo_url, clone_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise RuntimeError(f"Git clone failed: {result.stderr}")

        return clone_path

    def detect_language(self, clone_path):
        """Detect primary language of the repo."""
        counts = {}
        for ext_lang, exts in self.SUPPORTED_EXTENSIONS.items():
            count = 0
            for ext in exts:
                for _ in Path(clone_path).rglob(f"*{ext}"):
                    count += 1
            if count > 0:
                counts[ext_lang] = count
        if not counts:
            return "unknown"
        return max(counts, key=counts.get)

    def get_repo_structure(self, clone_path):
        """Get a summary of the repo structure."""
        structure = {"files": [], "directories": [], "total_files": 0, "total_lines": 0}
        for root, dirs, files in os.walk(clone_path):
            dirs[:] = [d for d in dirs if d not in self.IGNORE_DIRS]
            rel_root = os.path.relpath(root, clone_path)
            if rel_root != ".":
                structure["directories"].append(rel_root)
            for f in files:
                if f in self.IGNORE_FILES:
                    continue
                rel_path = os.path.join(rel_root, f) if rel_root != "." else f
                structure["files"].append(rel_path)
                structure["total_files"] += 1
        return structure

    def get_scannable_files(self, clone_path, language=None):
        """Get list of files to scan."""
        files = []
        if language and language in self.SUPPORTED_EXTENSIONS:
            target_exts = self.SUPPORTED_EXTENSIONS[language]
        else:
            target_exts = [ext for exts in self.SUPPORTED_EXTENSIONS.values() for ext in exts]

        for root, dirs, filenames in os.walk(clone_path):
            dirs[:] = [d for d in dirs if d not in self.IGNORE_DIRS]
            for f in filenames:
                if any(f.endswith(ext) for ext in target_exts):
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, clone_path)
                    try:
                        size = os.path.getsize(full_path)
                        if size < 100000:  # Skip files > 100KB
                            files.append(rel_path)
                    except OSError:
                        pass
        return files

    def read_file(self, clone_path, rel_path):
        """Read a file from the cloned repo."""
        full_path = os.path.join(clone_path, rel_path)
        try:
            with open(full_path, 'r', errors='ignore') as f:
                return f.read()
        except Exception:
            return None

    def run_flake8(self, clone_path):
        """Run flake8 on Python files."""
        issues = []
        try:
            result = subprocess.run(
                ["python", "-m", "flake8", "--max-line-length=120",
                 "--select=E,W,F", "--format=%(path)s:%(row)d:%(col)d: %(code)s %(text)s",
                 clone_path],
                capture_output=True, text=True, timeout=60,
                cwd=clone_path
            )
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                match = re.match(r'(.+?):(\d+):(\d+): ([A-Z]\d+) (.+)', line)
                if match:
                    filepath = os.path.relpath(match.group(1), clone_path)
                    # Skip ignored dirs
                    if any(part in self.IGNORE_DIRS for part in filepath.split(os.sep)):
                        continue
                    code = match.group(4)
                    severity = "low"
                    if code.startswith("F"):
                        severity = "high"
                    elif code.startswith("E9"):
                        severity = "critical"
                    elif code.startswith("E"):
                        severity = "medium"
                    issues.append({
                        "type": "lint",
                        "severity": severity,
                        "file_path": filepath,
                        "line_start": int(match.group(2)),
                        "line_end": int(match.group(2)),
                        "code": code,
                        "title": f"{code}: {match.group(5)}",
                        "description": match.group(5),
                    })
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.warning(f"Flake8 failed: {e}")
        return issues

    def check_dependencies(self, clone_path):
        """Check for dependency issues."""
        issues = []
        # Python requirements.txt
        req_path = os.path.join(clone_path, "requirements.txt")
        if os.path.exists(req_path):
            with open(req_path) as f:
                content = f.read()
            for line in content.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Check for unpinned dependencies
                if "==" not in line and ">=" not in line and "<=" not in line and line.strip():
                    pkg_name = re.split(r'[><=!]', line)[0].strip()
                    if pkg_name:
                        issues.append({
                            "type": "dependency",
                            "severity": "low",
                            "file_path": "requirements.txt",
                            "line_start": None,
                            "line_end": None,
                            "title": f"Unpinned dependency: {pkg_name}",
                            "description": f"Package '{pkg_name}' has no version pinned. This can lead to unexpected behavior when dependencies update.",
                        })

        # Check for setup.py / pyproject.toml
        pkg_json = os.path.join(clone_path, "package.json")
        if os.path.exists(pkg_json):
            import json
            try:
                with open(pkg_json) as f:
                    pkg = json.load(f)
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                for name, version in deps.items():
                    if version.startswith("*") or version == "latest":
                        issues.append({
                            "type": "dependency",
                            "severity": "medium",
                            "file_path": "package.json",
                            "line_start": None,
                            "line_end": None,
                            "title": f"Wildcard dependency: {name}@{version}",
                            "description": f"Package '{name}' uses wildcard/latest version '{version}'. Pin to a specific version for reproducible builds.",
                        })
            except Exception:
                pass

        return issues

    def cleanup(self, repo_id):
        """Remove cloned repo."""
        clone_path = os.path.join(CLONE_BASE, repo_id)
        if os.path.exists(clone_path):
            shutil.rmtree(clone_path, ignore_errors=True)
