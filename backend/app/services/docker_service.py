from typing import List, Optional, Dict, Any
import logging
from datetime import datetime

from app.core.config import settings
from app.schemas.docker import (
    ContainerInfo, ContainerStats, ImageInfo, VolumeInfo,
    NetworkInfo, DockerSystemInfo, ContainerCreate
)

logger = logging.getLogger(__name__)

try:
    import docker
    from docker.errors import NotFound, APIError
    DOCKER_SDK = True
except ImportError:
    DOCKER_SDK = False
    NotFound = Exception
    APIError = Exception


class DockerService:
    def __init__(self):
        self.client = None
        if not DOCKER_SDK:
            logger.warning("docker package not installed. Running in mock mode.")
            return
        try:
            self.client = docker.from_env()
            self.client.ping()
        except Exception as e:
            logger.warning(f"Docker connection failed: {e}. Running in mock mode.")
            self.client = None

    def is_available(self) -> bool:
        if self.client is None:
            return False
        try:
            self.client.ping()
            return True
        except Exception:
            return False

    def get_system_info(self) -> DockerSystemInfo:
        if not self.is_available():
            return DockerSystemInfo()
        try:
            info = self.client.info()
            version = self.client.version()
            return DockerSystemInfo(
                containers=info.get("Containers", 0),
                containers_running=info.get("ContainersRunning", 0),
                containers_paused=info.get("ContainersPaused", 0),
                containers_stopped=info.get("ContainersStopped", 0),
                images=info.get("Images", 0),
                driver=info.get("Driver", ""),
                memory_total=info.get("MemTotal", 0),
                memory_available=info.get("MemTotal", 0) - info.get("MemTotal", 0) // 4,  # approximate
                cpus=info.get("NCPU", 0),
                kernel_version=info.get("KernelVersion", ""),
                operating_system=info.get("OperatingSystem", ""),
                architecture=info.get("Architecture", ""),
                docker_version=version.get("Version", ""),
                server_version=version.get("Version", ""),
            )
        except Exception as e:
            logger.error(f"Error getting Docker info: {e}")
            return DockerSystemInfo()

    def list_containers(self, all: bool = True) -> List[ContainerInfo]:
        if not self.is_available():
            return self._mock_containers()
        try:
            containers = self.client.containers.list(all=all)
            result = []
            for c in containers:
                ports = {}
                if c.ports:
                    for k, v in c.ports.items():
                        if v:
                            ports[k] = v
                result.append(ContainerInfo(
                    id=c.short_id,
                    name=c.name,
                    image=c.image.tags[0] if c.image.tags else c.image.short_id,
                    status=c.status,
                    state=c.attrs.get("State", {}).get("Status", c.status),
                    created=c.attrs.get("Created", ""),
                    ports=ports,
                    labels=c.labels or {},
                    mounts=[{"Source": m.get("Source"), "Destination": m.get("Destination"), "Type": m.get("Type")} for m in c.attrs.get("Mounts", [])],
                    network_settings=c.attrs.get("NetworkSettings", {}).get("Networks", {}),
                    command=" ".join(c.attrs.get("Config", {}).get("Cmd") or []) if c.attrs.get("Config", {}).get("Cmd") else None,
                ))
            return result
        except Exception as e:
            logger.error(f"Error listing containers: {e}")
            return []

    def get_container(self, container_id: str) -> Optional[ContainerInfo]:
        if not self.is_available():
            return None
        try:
            c = self.client.containers.get(container_id)
            ports = {}
            if c.ports:
                for k, v in c.ports.items():
                    if v:
                        ports[k] = v
            return ContainerInfo(
                id=c.short_id,
                name=c.name,
                image=c.image.tags[0] if c.image.tags else c.image.short_id,
                status=c.status,
                state=c.attrs.get("State", {}).get("Status", c.status),
                created=c.attrs.get("Created", ""),
                ports=ports,
                labels=c.labels or {},
                mounts=[{"Source": m.get("Source"), "Destination": m.get("Destination"), "Type": m.get("Type")} for m in c.attrs.get("Mounts", [])],
                network_settings=c.attrs.get("NetworkSettings", {}).get("Networks", {}),
                command=" ".join(c.attrs.get("Config", {}).get("Cmd") or []) if c.attrs.get("Config", {}).get("Cmd") else None,
            )
        except NotFound:
            return None
        except Exception as e:
            logger.error(f"Error getting container: {e}")
            return None

    def get_container_stats(self, container_id: str) -> Optional[ContainerStats]:
        if not self.is_available():
            return ContainerStats(cpu_percent=12.5, memory_usage=256000000, memory_limit=1073741824, memory_percent=23.8)
        try:
            c = self.client.containers.get(container_id)
            stats = c.stats(stream=False)
            
            # CPU calculation
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            system_delta = stats["cpu_stats"]["system_cpu_usage"] - stats["precpu_stats"]["system_cpu_usage"]
            cpu_count = len(stats["cpu_stats"]["cpu_usage"].get("percpu_usage", [1]))
            cpu_percent = 0.0
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0

            mem_usage = stats["memory_stats"].get("usage", 0)
            mem_limit = stats["memory_stats"].get("limit", 1)
            mem_percent = (mem_usage / mem_limit) * 100.0 if mem_limit else 0

            networks = stats.get("networks", {})
            rx = sum(n.get("rx_bytes", 0) for n in networks.values())
            tx = sum(n.get("tx_bytes", 0) for n in networks.values())

            blk = stats.get("blkio_stats", {}).get("io_service_bytes_recursive") or []
            read = sum(b.get("value", 0) for b in blk if b.get("op") == "Read")
            write = sum(b.get("value", 0) for b in blk if b.get("op") == "Write")

            return ContainerStats(
                cpu_percent=round(cpu_percent, 2),
                memory_usage=mem_usage,
                memory_limit=mem_limit,
                memory_percent=round(mem_percent, 2),
                network_rx=rx,
                network_tx=tx,
                block_read=read,
                block_write=write,
            )
        except Exception as e:
            logger.error(f"Error getting container stats: {e}")
            return None

    def get_container_logs(self, container_id: str, tail: int = 100, since: Optional[str] = None) -> str:
        if not self.is_available():
            return f"[MOCK] Logs for container {container_id}\n2024-01-01T00:00:00Z INFO Application started\n2024-01-01T00:00:01Z INFO Listening on port 8080"
        try:
            c = self.client.containers.get(container_id)
            logs = c.logs(tail=tail, timestamps=True, since=since).decode("utf-8", errors="replace")
            return logs
        except Exception as e:
            logger.error(f"Error getting logs: {e}")
            return f"Error retrieving logs: {str(e)}"

    def start_container(self, container_id: str) -> bool:
        if not self.is_available():
            return True
        try:
            c = self.client.containers.get(container_id)
            c.start()
            return True
        except Exception as e:
            logger.error(f"Error starting container: {e}")
            raise

    def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        if not self.is_available():
            return True
        try:
            c = self.client.containers.get(container_id)
            c.stop(timeout=timeout)
            return True
        except Exception as e:
            logger.error(f"Error stopping container: {e}")
            raise

    def restart_container(self, container_id: str, timeout: int = 10) -> bool:
        if not self.is_available():
            return True
        try:
            c = self.client.containers.get(container_id)
            c.restart(timeout=timeout)
            return True
        except Exception as e:
            logger.error(f"Error restarting container: {e}")
            raise

    def remove_container(self, container_id: str, force: bool = False) -> bool:
        if not self.is_available():
            return True
        try:
            c = self.client.containers.get(container_id)
            c.remove(force=force)
            return True
        except Exception as e:
            logger.error(f"Error removing container: {e}")
            raise

    def create_container(self, data: ContainerCreate) -> ContainerInfo:
        if not self.is_available():
            return ContainerInfo(
                id="mock123",
                name=data.name,
                image=data.image,
                status="created",
                state="created",
                created=datetime.utcnow().isoformat(),
            )
        try:
            port_bindings = None
            if data.ports:
                port_bindings = {f"{k}/tcp": v for k, v in data.ports.items()}
            
            volumes = None
            if data.volumes:
                volumes = {host: {"bind": cont, "mode": "rw"} for host, cont in data.volumes.items()}

            container = self.client.containers.create(
                image=data.image,
                name=data.name,
                command=data.command,
                environment=data.environment,
                ports=port_bindings,
                volumes=volumes,
                network=data.network,
                restart_policy={"Name": data.restart_policy},
                detach=data.detach,
            )
            if data.detach:
                container.start()
            
            return self.get_container(container.short_id)
        except Exception as e:
            logger.error(f"Error creating container: {e}")
            raise

    def list_images(self) -> List[ImageInfo]:
        if not self.is_available():
            return [
                ImageInfo(id="sha256:abc", tags=["nginx:latest"], size=142000000, created="2024-01-01"),
                ImageInfo(id="sha256:def", tags=["postgres:16"], size=380000000, created="2024-01-02"),
            ]
        try:
            images = self.client.images.list()
            return [
                ImageInfo(
                    id=img.short_id,
                    tags=img.tags or [],
                    size=img.attrs.get("Size", 0),
                    created=img.attrs.get("Created", ""),
                    labels=img.labels or {},
                )
                for img in images
            ]
        except Exception as e:
            logger.error(f"Error listing images: {e}")
            return []

    def list_volumes(self) -> List[VolumeInfo]:
        if not self.is_available():
            return [VolumeInfo(name="data_vol", driver="local", mountpoint="/var/lib/docker/volumes/data_vol", created="2024-01-01")]
        try:
            volumes = self.client.volumes.list()
            return [
                VolumeInfo(
                    name=v.name,
                    driver=v.attrs.get("Driver", "local"),
                    mountpoint=v.attrs.get("Mountpoint", ""),
                    created=v.attrs.get("CreatedAt", ""),
                    labels=v.attrs.get("Labels") or {},
                    scope=v.attrs.get("Scope", "local"),
                )
                for v in volumes
            ]
        except Exception as e:
            logger.error(f"Error listing volumes: {e}")
            return []

    def list_networks(self) -> List[NetworkInfo]:
        if not self.is_available():
            return [NetworkInfo(id="bridge", name="bridge", driver="bridge", scope="local")]
        try:
            networks = self.client.networks.list()
            return [
                NetworkInfo(
                    id=n.short_id,
                    name=n.name,
                    driver=n.attrs.get("Driver", ""),
                    scope=n.attrs.get("Scope", ""),
                    ipam=n.attrs.get("IPAM", {}),
                    containers=n.attrs.get("Containers") or {},
                    labels=n.attrs.get("Labels") or {},
                    created=n.attrs.get("Created", ""),
                )
                for n in networks
            ]
        except Exception as e:
            logger.error(f"Error listing networks: {e}")
            return []

    def _mock_containers(self) -> List[ContainerInfo]:
        return [
            ContainerInfo(
                id="abc123",
                name="nginx-proxy",
                image="nginx:latest",
                status="running",
                state="running",
                created="2024-06-01T10:00:00Z",
                ports={"80/tcp": [{"HostPort": "8080"}]},
                labels={"app": "web"},
            ),
            ContainerInfo(
                id="def456",
                name="postgres-db",
                image="postgres:16",
                status="running",
                state="running",
                created="2024-06-01T09:00:00Z",
                ports={"5432/tcp": [{"HostPort": "5432"}]},
                labels={"app": "database"},
            ),
            ContainerInfo(
                id="ghi789",
                name="redis-cache",
                image="redis:7",
                status="exited",
                state="exited",
                created="2024-05-28T14:00:00Z",
            ),
        ]


docker_service = DockerService()
