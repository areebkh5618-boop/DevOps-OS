import httpx
from typing import List, Optional, Dict, Any
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class GitHubService:
    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = settings.GITHUB_API_URL
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def is_available(self) -> bool:
        return bool(self.token)

    async def _request(self, method: str, path: str, params: Optional[Dict] = None) -> Any:
        if not self.is_available():
            return None
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.request(
                    method,
                    f"{self.base_url}{path}",
                    headers=self.headers,
                    params=params,
                    timeout=30.0,
                )
                if resp.status_code == 404:
                    return None
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"GitHub API error: {e}")
                return None

    async def list_repos(self, username: Optional[str] = None, per_page: int = 30) -> List[Dict]:
        if not self.is_available():
            return self._mock_repos()
        path = f"/users/{username}/repos" if username else "/user/repos"
        data = await self._request("GET", path, {"per_page": per_page, "sort": "updated"})
        return data or []

    async def get_repo(self, owner: str, repo: str) -> Optional[Dict]:
        if not self.is_available():
            return {"name": repo, "full_name": f"{owner}/{repo}", "private": False}
        return await self._request("GET", f"/repos/{owner}/{repo}")

    async def list_workflows(self, owner: str, repo: str) -> List[Dict]:
        if not self.is_available():
            return self._mock_workflows()
        data = await self._request("GET", f"/repos/{owner}/{repo}/actions/workflows")
        return (data or {}).get("workflows", [])

    async def list_workflow_runs(self, owner: str, repo: str, per_page: int = 20) -> List[Dict]:
        if not self.is_available():
            return self._mock_runs()
        data = await self._request("GET", f"/repos/{owner}/{repo}/actions/runs", {"per_page": per_page})
        return (data or {}).get("workflow_runs", [])

    async def get_workflow_run(self, owner: str, repo: str, run_id: int) -> Optional[Dict]:
        if not self.is_available():
            return None
        return await self._request("GET", f"/repos/{owner}/{repo}/actions/runs/{run_id}")

    async def list_workflow_jobs(self, owner: str, repo: str, run_id: int) -> List[Dict]:
        if not self.is_available():
            return []
        data = await self._request("GET", f"/repos/{owner}/{repo}/actions/runs/{run_id}/jobs")
        return (data or {}).get("jobs", [])

    async def get_workflow_run_logs(self, owner: str, repo: str, run_id: int) -> str:
        # Logs are returned as a zip redirect usually; for simplicity return status
        if not self.is_available():
            return "[MOCK] Workflow run logs\nBuild succeeded in 2m 34s"
        return f"Logs for run {run_id} - use GitHub UI for full download"

    async def list_commits(self, owner: str, repo: str, per_page: int = 20) -> List[Dict]:
        if not self.is_available():
            return self._mock_commits()
        data = await self._request("GET", f"/repos/{owner}/{repo}/commits", {"per_page": per_page})
        return data or []

    async def list_branches(self, owner: str, repo: str) -> List[Dict]:
        if not self.is_available():
            return [{"name": "main", "protected": True}, {"name": "develop", "protected": False}]
        data = await self._request("GET", f"/repos/{owner}/{repo}/branches")
        return data or []

    async def list_releases(self, owner: str, repo: str) -> List[Dict]:
        if not self.is_available():
            return [{"tag_name": "v1.0.0", "name": "Initial Release", "published_at": "2024-01-01T00:00:00Z"}]
        data = await self._request("GET", f"/repos/{owner}/{repo}/releases")
        return data or []

    def _mock_repos(self) -> List[Dict]:
        return [
            {
                "id": 1,
                "name": "devverse",
                "full_name": "org/devverse",
                "private": False,
                "description": "The Ultimate Browser-Based DevOps OS",
                "html_url": "https://github.com/org/devverse",
                "stargazers_count": 128,
                "forks_count": 24,
                "language": "TypeScript",
                "updated_at": "2024-07-15T10:00:00Z",
                "default_branch": "main",
            },
            {
                "id": 2,
                "name": "infra-configs",
                "full_name": "org/infra-configs",
                "private": True,
                "description": "Infrastructure as Code",
                "html_url": "https://github.com/org/infra-configs",
                "stargazers_count": 12,
                "forks_count": 3,
                "language": "HCL",
                "updated_at": "2024-07-10T14:00:00Z",
                "default_branch": "main",
            },
        ]

    def _mock_workflows(self) -> List[Dict]:
        return [
            {"id": 1, "name": "CI Pipeline", "path": ".github/workflows/ci.yml", "state": "active"},
            {"id": 2, "name": "Deploy Production", "path": ".github/workflows/deploy.yml", "state": "active"},
        ]

    def _mock_runs(self) -> List[Dict]:
        return [
            {
                "id": 1001,
                "name": "CI Pipeline",
                "status": "completed",
                "conclusion": "success",
                "html_url": "https://github.com/org/devverse/actions/runs/1001",
                "created_at": "2024-07-15T09:00:00Z",
                "updated_at": "2024-07-15T09:05:00Z",
                "run_number": 142,
                "head_branch": "main",
                "event": "push",
            },
            {
                "id": 1002,
                "name": "Deploy Production",
                "status": "completed",
                "conclusion": "success",
                "html_url": "https://github.com/org/devverse/actions/runs/1002",
                "created_at": "2024-07-14T16:00:00Z",
                "updated_at": "2024-07-14T16:12:00Z",
                "run_number": 38,
                "head_branch": "main",
                "event": "workflow_dispatch",
            },
            {
                "id": 1003,
                "name": "CI Pipeline",
                "status": "completed",
                "conclusion": "failure",
                "html_url": "https://github.com/org/devverse/actions/runs/1003",
                "created_at": "2024-07-13T11:00:00Z",
                "updated_at": "2024-07-13T11:03:00Z",
                "run_number": 141,
                "head_branch": "feature/auth",
                "event": "pull_request",
            },
        ]

    def _mock_commits(self) -> List[Dict]:
        return [
            {
                "sha": "a1b2c3d",
                "commit": {
                    "message": "feat: add Kubernetes module dashboard",
                    "author": {"name": "DevVerse Team", "date": "2024-07-15T08:00:00Z"},
                },
                "html_url": "https://github.com/org/devverse/commit/a1b2c3d",
            },
            {
                "sha": "e4f5g6h",
                "commit": {
                    "message": "fix: resolve container stats calculation",
                    "author": {"name": "DevVerse Team", "date": "2024-07-14T15:30:00Z"},
                },
                "html_url": "https://github.com/org/devverse/commit/e4f5g6h",
            },
        ]


def get_github_service(token: Optional[str] = None) -> GitHubService:
    return GitHubService(token)
