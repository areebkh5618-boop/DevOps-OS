from typing import Any

from pydantic import BaseModel, Field


class NamespaceInfo(BaseModel):
    name: str
    status: str
    created: str
    labels: dict[str, str] = {}


class PodInfo(BaseModel):
    name: str
    namespace: str
    status: str
    phase: str
    node: str | None = None
    ip: str | None = None
    restarts: int = 0
    created: str
    containers: list[dict[str, Any]] = []
    labels: dict[str, str] = {}
    ready: str = "0/0"


class DeploymentInfo(BaseModel):
    name: str
    namespace: str
    replicas: int = 0
    ready_replicas: int = 0
    available_replicas: int = 0
    updated_replicas: int = 0
    strategy: str = ""
    created: str
    labels: dict[str, str] = {}
    selector: dict[str, str] = {}
    image: str | None = None


class ServiceInfo(BaseModel):
    name: str
    namespace: str
    type: str
    cluster_ip: str | None = None
    external_ips: list[str] = []
    ports: list[dict[str, Any]] = []
    selector: dict[str, str] = {}
    created: str
    labels: dict[str, str] = {}


class IngressInfo(BaseModel):
    name: str
    namespace: str
    hosts: list[str] = []
    paths: list[dict[str, Any]] = []
    tls: list[dict[str, Any]] = []
    created: str
    labels: dict[str, str] = {}


class ConfigMapInfo(BaseModel):
    name: str
    namespace: str
    data: dict[str, str] = {}
    created: str
    labels: dict[str, str] = {}


class SecretInfo(BaseModel):
    name: str
    namespace: str
    type: str
    data_keys: list[str] = []
    created: str
    labels: dict[str, str] = {}


class PersistentVolumeInfo(BaseModel):
    name: str
    capacity: str
    access_modes: list[str] = []
    status: str
    claim: str | None = None
    storage_class: str | None = None
    created: str


class EventInfo(BaseModel):
    type: str
    reason: str
    message: str
    namespace: str
    involved_object: str
    count: int = 1
    first_timestamp: str | None = None
    last_timestamp: str | None = None


class ScaleRequest(BaseModel):
    replicas: int = Field(..., ge=0, le=100)


class ResourceDeleteRequest(BaseModel):
    name: str
    namespace: str = "default"
    resource_type: str
