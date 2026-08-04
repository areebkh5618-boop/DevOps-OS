from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.core.security import get_current_user
from app.models.user import User
from app.services.github_service import get_github_service

router = APIRouter(prefix="/github", tags=["GitHub"])


@router.get("/status")
async def github_status(current_user: User = Depends(get_current_user)):
    token = current_user.github_token
    svc = get_github_service(token)
    return {"available": svc.is_available()}


@router.get("/repos")
async def list_repos(
    username: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_repos(username)


@router.get("/repos/{owner}/{repo}")
async def get_repo(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    data = await svc.get_repo(owner, repo)
    if not data:
        raise HTTPException(status_code=404, detail="Repository not found")
    return data


@router.get("/repos/{owner}/{repo}/workflows")
async def list_workflows(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_workflows(owner, repo)


@router.get("/repos/{owner}/{repo}/runs")
async def list_runs(
    owner: str,
    repo: str,
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_workflow_runs(owner, repo, per_page)


@router.get("/repos/{owner}/{repo}/runs/{run_id}")
async def get_run(
    owner: str,
    repo: str,
    run_id: int,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    data = await svc.get_workflow_run(owner, repo, run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Run not found")
    return data


@router.get("/repos/{owner}/{repo}/runs/{run_id}/jobs")
async def list_jobs(
    owner: str,
    repo: str,
    run_id: int,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_workflow_jobs(owner, repo, run_id)


@router.get("/repos/{owner}/{repo}/commits")
async def list_commits(
    owner: str,
    repo: str,
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_commits(owner, repo, per_page)


@router.get("/repos/{owner}/{repo}/branches")
async def list_branches(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_branches(owner, repo)


@router.get("/repos/{owner}/{repo}/releases")
async def list_releases(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user),
):
    svc = get_github_service(current_user.github_token)
    return await svc.list_releases(owner, repo)
