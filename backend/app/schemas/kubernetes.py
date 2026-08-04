from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class NamespaceInfo(BaseModel):
    name: str
    status: str
    created: str
    labels: Dict[str, str] = {}


class PodInfo(BaseModel):
    name: str
    namespace: str
    status: str
    phase: str
    node: Optional[str] = None
    ip: Optional[str] = None
    restarts: int = 0
    created: str
    containers: List[Dict[str, Any]] = []
    labels: Dict[str, str] = {}
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
    labels: Dict[str, str] = {}
    selector: Dict[str, str] = {}
    image: Optional[str] = None


class ServiceInfo(BaseModel):
    name: str
    namespace: str
    type: str
    cluster_ip: Optional[str] = None
    external_ips: List[str] = []
    ports: List[Dict[str, Any]] = []
    selector: Dict[str, str] = {}
    created: str
    labels: Dict[str, str] = {}


class IngressInfo(BaseModel):
    name: str
    namespace: str
    hosts: List[str] = []
    paths: List[Dict[str, Any]] = []
    tls: List[Dict[str, Any]] = []
    created: str
    labels: Dict[str, str] = {}


class ConfigMapInfo(BaseModel):
    name: str
    namespace: str
    data: Dict[str, str] = {}
    created: str
    labels: Dict[str, str] = {}


class SecretInfo(BaseModel):
    name: str
    namespace: str
    type: str
    data_keys: List[str] = []
    created: str
    labels: Dict[str, str] = {}


class PersistentVolumeInfo(BaseModel):
    name: str
    capacity: str
    access_modes: List[str] = []
    status: str
    claim: Optional[str] = None
    storage_class: Optional[str] = None
    created: str


class EventInfo(BaseModel):
    type: str
    reason: str
    message: str
    namespace: str
    involved_object: str
    count: int = 1
    first_timestamp: Optional[str] = None
    last_timestamp: Optional[str] = None


class ScaleRequest(BaseModel):
    replicas: int = Field(..., ge=0, le=100)


class ResourceDeleteRequest(BaseModel):
    name: str
    namespace: str = "default"
    resource_type: str
