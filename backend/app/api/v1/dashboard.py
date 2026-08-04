import platform

import psutil
from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User
from app.services.docker_service import docker_service
from app.services.github_service import get_github_service
from app.services.kubernetes_service import k8s_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/overview")
async def get_overview(current_user: User = Depends(get_current_user)):
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    docker_info = docker_service.get_system_info() if docker_service.is_available() else None
    k8s_available = k8s_service.is_available()
    
    github_svc = get_github_service(current_user.github_token)
    github_available = github_svc.is_available()

    # Health score calculation (simple)
    health = 100
    if not docker_service.is_available():
        health -= 20
    if not k8s_available:
        health -= 15
    if cpu_percent > 90:
        health -= 20
    elif cpu_percent > 70:
        health -= 10
    if memory.percent > 90:
        health -= 20
    elif memory.percent > 75:
        health -= 10

    containers = docker_service.list_containers(all=False) if docker_service.is_available() else []
    recent_containers = containers[:5]

    return {
        "system": {
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
            "cpu_percent": cpu_percent,
            "cpu_count": psutil.cpu_count(),
            "memory": {
                "total": memory.total,
                "used": memory.used,
                "percent": memory.percent,
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "percent": disk.percent,
            },
        },
        "docker": {
            "available": docker_service.is_available(),
            "info": docker_info.model_dump() if docker_info else None,
            "running_containers": len(containers),
        },
        "kubernetes": {
            "available": k8s_available,
        },
        "github": {
            "available": github_available,
        },
        "health_score": max(0, health),
        "recent_containers": [c.model_dump() for c in recent_containers],
        "recent_deployments": [
            {"name": "nginx", "status": "success", "time": "2 hours ago", "namespace": "default"},
            {"name": "api-server", "status": "success", "time": "5 hours ago", "namespace": "default"},
            {"name": "worker", "status": "failed", "time": "1 day ago", "namespace": "prod"},
        ],
        "pipeline_summary": {
            "total": 42,
            "success": 38,
            "failed": 3,
            "running": 1,
        },
    }


@router.get("/metrics")
async def get_metrics(current_user: User = Depends(get_current_user)):
    cpu = psutil.cpu_percent(interval=0.1, percpu=True)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()

    return {
        "cpu": {
            "overall": psutil.cpu_percent(),
            "per_cpu": cpu,
        },
        "memory": {
            "total": memory.total,
            "used": memory.used,
            "available": memory.available,
            "percent": memory.percent,
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net.bytes_sent,
            "bytes_recv": net.bytes_recv,
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv,
        },
    }
