import requests
import logging

logger = logging.getLogger(__name__)


class PRCreator:
    def __init__(self, token, repo):
        self.token = token
        self.repo = repo
        self.base_url = f"https://api.github.com/repos/{repo}"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def create(self, head, base, title, body):
        existing = self._find_existing_pr(head, base)
        if existing:
            logger.info(f"PR already exists: {existing['html_url']}")
            return existing["html_url"]

        url = f"{self.base_url}/pulls"
        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "maintainer_can_modify": True
        }
        resp = requests.post(url, json=data, headers=self.headers)
        resp.raise_for_status()
        pr = resp.json()
        self._add_labels(pr["number"], ["auto-heal", "bot", "ci-fix"])
        return pr["html_url"]

    def _find_existing_pr(self, head, base):
        url = f"{self.base_url}/pulls"
        params = {"head": f"{self.repo.split('/')[0]}:{head}", "base": base, "state": "open"}
        resp = requests.get(url, params=params, headers=self.headers)
        prs = resp.json()
        return prs[0] if prs else None

    def _add_labels(self, pr_number, labels):
        url = f"{self.base_url}/issues/{pr_number}/labels"
        try:
            requests.post(url, json={"labels": labels}, headers=self.headers)
        except Exception:
            pass
