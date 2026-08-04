
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.schemas.docker import (
    ContainerCreate,
    ContainerInfo,
    ContainerStats,
    DockerSystemInfo,
    ImageInfo,
    NetworkInfo,
    VolumeInfo,
)
from app.services.docker_service import docker_service

router = APIRouter(prefix="/docker", tags=["Docker"])


@router.get("/status")
async def docker_status(current_user: User = Depends(get_current_user)):
    return {
        "available": docker_service.is_available(),
        "info": docker_service.get_system_info() if docker_service.is_available() else None,
    }


@router.get("/system", response_model=DockerSystemInfo)
async def get_system_info(current_user: User = Depends(get_current_user)):
    return docker_service.get_system_info()


@router.get("/containers", response_model=list[ContainerInfo])
async def list_containers(
    all: bool = Query(True),
    current_user: User = Depends(get_current_user),
):
    return docker_service.list_containers(all=all)


@router.get("/containers/{container_id}", response_model=ContainerInfo)
async def get_container(
    container_id: str,
    current_user: User = Depends(get_current_user),
):
    container = docker_service.get_container(container_id)
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return container


@router.get("/containers/{container_id}/stats", response_model=ContainerStats)
async def get_container_stats(
    container_id: str,
    current_user: User = Depends(get_current_user),
):
    stats = docker_service.get_container_stats(container_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Container not found or stats unavailable")
    return stats


@router.get("/containers/{container_id}/logs")
async def get_container_logs(
    container_id: str,
    tail: int = Query(100, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
):
    logs = docker_service.get_container_logs(container_id, tail=tail)
    return {"logs": logs}


@router.post("/containers/{container_id}/start")
async def start_container(
    container_id: str,
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        docker_service.start_container(container_id)
        return {"message": f"Container {container_id} started"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/containers/{container_id}/stop")
async def stop_container(
    container_id: str,
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        docker_service.stop_container(container_id)
        return {"message": f"Container {container_id} stopped"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/containers/{container_id}/restart")
async def restart_container(
    container_id: str,
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        docker_service.restart_container(container_id)
        return {"message": f"Container {container_id} restarted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/containers/{container_id}")
async def remove_container(
    container_id: str,
    force: bool = Query(False),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        docker_service.remove_container(container_id, force=force)
        return {"message": f"Container {container_id} removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/containers", response_model=ContainerInfo, status_code=status.HTTP_201_CREATED)
async def create_container(
    data: ContainerCreate,
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        return docker_service.create_container(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/images", response_model=list[ImageInfo])
async def list_images(current_user: User = Depends(get_current_user)):
    return docker_service.list_images()


@router.get("/volumes", response_model=list[VolumeInfo])
async def list_volumes(current_user: User = Depends(get_current_user)):
    return docker_service.list_volumes()


@router.get("/networks", response_model=list[NetworkInfo])
async def list_networks(current_user: User = Depends(get_current_user)):
    return docker_service.list_networks()
