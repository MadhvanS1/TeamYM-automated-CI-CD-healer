import requests
import logging

logger = logging.getLogger(__name__)


class PipelineMonitor:
    def __init__(self, token, repo):
        self.token = token
        self.repo = repo
        self.base_url = f"https://api.github.com/repos/{repo}"
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def get_workflow_run(self, run_id):
        url = f"{self.base_url}/actions/runs/{run_id}"
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()

    def get_workflow_jobs(self, run_id):
        url = f"{self.base_url}/actions/runs/{run_id}/jobs"
        resp = requests.get(url, headers=self.headers)
        resp.raise_for_status()
        return resp.json()["jobs"]

    def get_job_logs(self, job_id):
        url = f"{self.base_url}/actions/jobs/{job_id}/logs"
        resp = requests.get(url, headers=self.headers, allow_redirects=True)
        resp.raise_for_status()
        return resp.text

    def get_workflow_logs(self, run_id):
        jobs = self.get_workflow_jobs(run_id)
        logs = {}
        for job in jobs:
            if job["conclusion"] == "failure":
                job_log = self.get_job_logs(job["id"])
                logs[job["name"]] = {
                    "log": job_log,
                    "steps": job.get("steps", []),
                    "conclusion": job["conclusion"]
                }
        return logs

    def get_failed_steps(self, run_id):
        jobs = self.get_workflow_jobs(run_id)
        failed_steps = []
        for job in jobs:
            if job["conclusion"] == "failure":
                for step in job.get("steps", []):
                    if step["conclusion"] == "failure":
                        failed_steps.append({
                            "job_name": job["name"],
                            "step_name": step["name"],
                            "step_number": step["number"]
                        })
        return failed_steps
