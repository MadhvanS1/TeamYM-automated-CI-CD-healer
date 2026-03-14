import requests
import logging

logger = logging.getLogger(__name__)


class PRCreator:
    """Creates GitHub PRs following open-source contribution standards."""

    def __init__(self, token, repo_owner, repo_name):
        self.token = token
        self.owner = repo_owner
        self.name = repo_name
        self.base_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def get_authenticated_user(self):
        """Get the authenticated user's login."""
        resp = requests.get("https://api.github.com/user", headers=self.headers)
        resp.raise_for_status()
        return resp.json()["login"]

    def fork_repo(self):
        """Fork the repo to the authenticated user's account."""
        url = f"{self.base_url}/forks"
        resp = requests.post(url, headers=self.headers)
        if resp.status_code == 202:
            return resp.json()
        elif resp.status_code == 200:
            return resp.json()
        resp.raise_for_status()

    def get_default_branch(self):
        """Get the repo's default branch."""
        resp = requests.get(self.base_url, headers=self.headers)
        resp.raise_for_status()
        return resp.json().get("default_branch", "main")

    def get_branch_sha(self, branch, fork_owner=None):
        """Get the SHA of a branch's HEAD."""
        owner = fork_owner or self.owner
        url = f"https://api.github.com/repos/{owner}/{self.name}/git/ref/heads/{branch}"
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()["object"]["sha"]

    def create_branch(self, branch_name, base_sha, fork_owner=None):
        """Create a new branch from a SHA."""
        owner = fork_owner or self.owner
        url = f"https://api.github.com/repos/{owner}/{self.name}/git/refs"
        data = {"ref": f"refs/heads/{branch_name}", "sha": base_sha}
        resp = requests.post(url, json=data, headers=self.headers)
        if resp.status_code == 422:
            # Branch already exists, update it
            url = f"https://api.github.com/repos/{owner}/{self.name}/git/refs/heads/{branch_name}"
            resp = requests.patch(url, json={"sha": base_sha, "force": True}, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def create_or_update_file(self, file_path, content, message, branch, fork_owner=None):
        """Create or update a file via GitHub API."""
        owner = fork_owner or self.owner
        url = f"https://api.github.com/repos/{owner}/{self.name}/contents/{file_path}"

        # Check if file exists to get its SHA
        existing_sha = None
        resp = requests.get(url, params={"ref": branch}, headers=self.headers)
        if resp.status_code == 200:
            existing_sha = resp.json()["sha"]

        import base64
        data = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch,
        }
        if existing_sha:
            data["sha"] = existing_sha

        resp = requests.put(url, json=data, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def create_pull_request(self, head, base, title, body, fork_owner=None):
        """Create a PR following open-source standards."""
        # Check for existing PR
        existing = self._find_existing_pr(head, base, fork_owner)
        if existing:
            logger.info(f"PR already exists: {existing['html_url']}")
            return existing

        url = f"{self.base_url}/pulls"
        head_ref = f"{fork_owner}:{head}" if fork_owner else head
        data = {
            "title": title,
            "body": body,
            "head": head_ref,
            "base": base,
            "maintainer_can_modify": True
        }

        resp = requests.post(url, json=data, headers=self.headers)
        resp.raise_for_status()
        pr = resp.json()

        # Add labels
        self._add_labels(pr["number"], ["ai-generated", "automated-fix", "bot"])

        return pr

    def _find_existing_pr(self, head, base, fork_owner=None):
        url = f"{self.base_url}/pulls"
        head_ref = f"{fork_owner}:{head}" if fork_owner else f"{self.owner}:{head}"
        params = {"head": head_ref, "base": base, "state": "open"}
        resp = requests.get(url, params=params, headers=self.headers)
        if resp.status_code == 200:
            prs = resp.json()
            return prs[0] if prs else None
        return None

    def _add_labels(self, pr_number, labels):
        """Add labels to a PR, creating them if needed."""
        # Ensure labels exist
        for label in labels:
            self._ensure_label(label)
        url = f"{self.base_url}/issues/{pr_number}/labels"
        try:
            requests.post(url, json={"labels": labels}, headers=self.headers)
        except Exception:
            pass

    def _ensure_label(self, label_name):
        """Create a label if it doesn't exist."""
        url = f"{self.base_url}/labels"
        colors = {
            "ai-generated": "D946EF",
            "automated-fix": "8B5CF6",
            "bot": "3B82F6",
        }
        data = {
            "name": label_name,
            "color": colors.get(label_name, "ededed"),
            "description": f"Auto-generated by CI/CD Healing Agent"
        }
        try:
            requests.post(url, json=data, headers=self.headers)
        except Exception:
            pass

    @staticmethod
    def format_pr_body(issue, fix, tests=None):
        """Format PR body following open-source standards."""
        test_section = ""
        if tests:
            test_section = f"""
### Tests Added
- **Test File:** `{tests.get('test_file_path', 'N/A')}`
- **Test Count:** {tests.get('test_count', 0)}
- **Framework:** {tests.get('test_framework', 'N/A')}

<details>
<summary>Test Descriptions</summary>

{chr(10).join(['- ' + t for t in tests.get('test_descriptions', [])])}
</details>
"""

        return f"""## Automated Bug Fix

> This PR was generated by an AI-powered CI/CD Healing Agent.

### Issue
**{issue.get('title', 'Unknown Issue')}**

{issue.get('description', 'No description')}

- **Type:** `{issue.get('type', 'bug')}`
- **Severity:** `{issue.get('severity', 'medium')}`
- **File:** `{issue.get('file_path', 'N/A')}`
{f"- **Lines:** {issue.get('line_start', '?')}-{issue.get('line_end', '?')}" if issue.get('line_start') else ""}

### Root Cause
{fix.get('explanation', 'See diff for details')}

### Changes Made
{fix.get('diff_summary', 'See diff for details')}

**Files Modified:**
{chr(10).join(['- `' + f + '`' for f in fix.get('files_changed', [])])}
{test_section}
### Risk Assessment
- **Breaking Changes:** {'Yes' if fix.get('breaking_changes') else 'No'}

---

<sub>Generated by [CI/CD Healing Agent](https://github.com) | AI-powered automated fixes</sub>
<sub>Please review carefully before merging. AI-generated fixes should always be validated by a human.</sub>
"""
