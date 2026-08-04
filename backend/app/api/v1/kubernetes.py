from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.services.kubernetes_service import k8s_service
from app.schemas.kubernetes import (
    NamespaceInfo, PodInfo, DeploymentInfo, ServiceInfo,
    IngressInfo, ConfigMapInfo, SecretInfo, EventInfo, ScaleRequest
)

router = APIRouter(prefix="/kubernetes", tags=["Kubernetes"])


@router.get("/status")
async def k8s_status(current_user: User = Depends(get_current_user)):
    return {"available": k8s_service.is_available()}


@router.get("/namespaces", response_model=List[NamespaceInfo])
async def list_namespaces(current_user: User = Depends(get_current_user)):
    return k8s_service.list_namespaces()


@router.get("/pods", response_model=List[PodInfo])
async def list_pods(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_pods(namespace)


@router.get("/deployments", response_model=List[DeploymentInfo])
async def list_deployments(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_deployments(namespace)


@router.get("/services", response_model=List[ServiceInfo])
async def list_services(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_services(namespace)


@router.get("/ingresses", response_model=List[IngressInfo])
async def list_ingresses(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_ingresses(namespace)


@router.get("/configmaps", response_model=List[ConfigMapInfo])
async def list_configmaps(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_configmaps(namespace)


@router.get("/secrets", response_model=List[SecretInfo])
async def list_secrets(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_secrets(namespace)


@router.get("/events", response_model=List[EventInfo])
async def list_events(
    namespace: str = Query("default"),
    current_user: User = Depends(get_current_user),
):
    return k8s_service.list_events(namespace)


@router.get("/pods/{name}/logs")
async def get_pod_logs(
    name: str,
    namespace: str = Query("default"),
    container: Optional[str] = None,
    tail: int = Query(100, ge=1, le=5000),
    current_user: User = Depends(get_current_user),
):
    logs = k8s_service.get_pod_logs(name, namespace, container, tail)
    return {"logs": logs}


@router.post("/deployments/{name}/scale")
async def scale_deployment(
    name: str,
    data: ScaleRequest,
    namespace: str = Query("default"),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        k8s_service.scale_deployment(name, namespace, data.replicas)
        return {"message": f"Deployment {name} scaled to {data.replicas} replicas"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/deployments/{name}/restart")
async def restart_deployment(
    name: str,
    namespace: str = Query("default"),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        k8s_service.restart_deployment(name, namespace)
        return {"message": f"Deployment {name} restarted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/resources/{resource_type}/{name}")
async def delete_resource(
    resource_type: str,
    name: str,
    namespace: str = Query("default"),
    current_user: User = Depends(require_roles("admin", "operator")),
):
    try:
        k8s_service.delete_resource(resource_type, name, namespace)
        return {"message": f"{resource_type}/{name} deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
