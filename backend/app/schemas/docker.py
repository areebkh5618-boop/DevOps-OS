from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ContainerStats(BaseModel):
    cpu_percent: float = 0.0
    memory_usage: int = 0
    memory_limit: int = 0
    memory_percent: float = 0.0
    network_rx: int = 0
    network_tx: int = 0
    block_read: int = 0
    block_write: int = 0


class ContainerInfo(BaseModel):
    id: str
    name: str
    image: str
    status: str
    state: str
    created: str
    ports: Dict[str, Any] = {}
    labels: Dict[str, str] = {}
    mounts: List[Dict[str, Any]] = []
    network_settings: Dict[str, Any] = {}
    command: Optional[str] = None
    stats: Optional[ContainerStats] = None


class ContainerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    image: str
    command: Optional[str] = None
    environment: Optional[Dict[str, str]] = None
    ports: Optional[Dict[str, int]] = None  # container_port: host_port
    volumes: Optional[Dict[str, str]] = None  # host_path: container_path
    network: Optional[str] = None
    restart_policy: str = "no"
    detach: bool = True


class ImageInfo(BaseModel):
    id: str
    tags: List[str] = []
    size: int = 0
    created: str
    labels: Dict[str, str] = {}


class VolumeInfo(BaseModel):
    name: str
    driver: str
    mountpoint: str
    created: str
    labels: Dict[str, str] = {}
    scope: str = "local"


class NetworkInfo(BaseModel):
    id: str
    name: str
    driver: str
    scope: str
    ipam: Dict[str, Any] = {}
    containers: Dict[str, Any] = {}
    labels: Dict[str, str] = {}
    created: Optional[str] = None


class DockerSystemInfo(BaseModel):
    containers: int = 0
    containers_running: int = 0
    containers_paused: int = 0
    containers_stopped: int = 0
    images: int = 0
    driver: str = ""
    memory_total: int = 0
    memory_available: int = 0
    cpus: int = 0
    kernel_version: str = ""
    operating_system: str = ""
    architecture: str = ""
    docker_version: str = ""
    server_version: str = ""
