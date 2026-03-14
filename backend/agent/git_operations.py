import subprocess
import os
import logging

logger = logging.getLogger(__name__)


class GitOperations:
    def __init__(self, token, repo):
        self.token = token
        self.repo = repo
        self._run(["git", "config", "user.name", "CI/CD Healing Agent"])
        self._run(["git", "config", "user.email", "healing-agent@automated.bot"])
        remote_url = f"https://x-access-token:{token}@github.com/{repo}.git"
        self._run(["git", "remote", "set-url", "origin", remote_url])

    def create_branch(self, branch_name, base="main"):
        self._run(["git", "checkout", base])
        self._run(["git", "checkout", "-b", branch_name])
        logger.info(f"Created branch: {branch_name}")

    def write_file(self, filepath, content):
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, 'w') as f:
            f.write(content)
        self._run(["git", "add", filepath])
        logger.info(f"Modified: {filepath}")

    def commit_and_push(self, branch, message):
        self._run(["git", "commit", "-m", message])
        self._run(["git", "push", "origin", branch, "--force"])
        logger.info(f"Pushed to {branch}")

    def _run(self, cmd):
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode != 0:
            logger.error(f"Git error: {result.stderr}")
            raise RuntimeError(f"Git command failed: {' '.join(cmd)}")
        return result.stdout
