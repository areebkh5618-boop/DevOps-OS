from typing import Any

from pydantic import BaseModel, Field


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
    ports: dict[str, Any] = {}
    labels: dict[str, str] = {}
    mounts: list[dict[str, Any]] = []
    network_settings: dict[str, Any] = {}
    command: str | None = None
    stats: ContainerStats | None = None


class ContainerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    image: str
    command: str | None = None
    environment: dict[str, str] | None = None
    ports: dict[str, int] | None = None  # container_port: host_port
    volumes: dict[str, str] | None = None  # host_path: container_path
    network: str | None = None
    restart_policy: str = "no"
    detach: bool = True


class ImageInfo(BaseModel):
    id: str
    tags: list[str] = []
    size: int = 0
    created: str
    labels: dict[str, str] = {}


class VolumeInfo(BaseModel):
    name: str
    driver: str
    mountpoint: str
    created: str
    labels: dict[str, str] = {}
    scope: str = "local"


class NetworkInfo(BaseModel):
    id: str
    name: str
    driver: str
    scope: str
    ipam: dict[str, Any] = {}
    containers: dict[str, Any] = {}
    labels: dict[str, str] = {}
    created: str | None = None


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
