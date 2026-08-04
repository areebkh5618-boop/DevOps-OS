from typing import List, Optional, Dict, Any
import logging
from datetime import datetime

from app.core.config import settings
from app.schemas.kubernetes import (
    NamespaceInfo, PodInfo, DeploymentInfo, ServiceInfo,
    IngressInfo, ConfigMapInfo, SecretInfo, PersistentVolumeInfo,
    EventInfo, ScaleRequest
)

logger = logging.getLogger(__name__)

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    K8S_AVAILABLE = True
except ImportError:
    K8S_AVAILABLE = False


class KubernetesService:
    def __init__(self):
        self.core_v1 = None
        self.apps_v1 = None
        self.networking_v1 = None
        self.connected = False
        self._init_client()

    def _init_client(self):
        if not K8S_AVAILABLE:
            logger.warning("Kubernetes client not installed")
            return
        try:
            if settings.K8S_IN_CLUSTER:
                config.load_incluster_config()
            elif settings.KUBECONFIG:
                config.load_kube_config(config_file=settings.KUBECONFIG)
            else:
                config.load_kube_config()
            
            self.core_v1 = client.CoreV1Api()
            self.apps_v1 = client.AppsV1Api()
            self.networking_v1 = client.NetworkingV1Api()
            self.connected = True
            logger.info("Kubernetes client initialized successfully")
        except Exception as e:
            logger.warning(f"Kubernetes connection failed: {e}. Running in mock mode.")
            self.connected = False

    def is_available(self) -> bool:
        return self.connected

    def list_namespaces(self) -> List[NamespaceInfo]:
        if not self.is_available():
            return [
                NamespaceInfo(name="default", status="Active", created="2024-01-01T00:00:00Z"),
                NamespaceInfo(name="kube-system", status="Active", created="2024-01-01T00:00:00Z"),
                NamespaceInfo(name="devverse", status="Active", created="2024-06-01T00:00:00Z"),
            ]
        try:
            ns_list = self.core_v1.list_namespace()
            return [
                NamespaceInfo(
                    name=ns.metadata.name,
                    status=ns.status.phase or "Active",
                    created=ns.metadata.creation_timestamp.isoformat() if ns.metadata.creation_timestamp else "",
                    labels=ns.metadata.labels or {},
                )
                for ns in ns_list.items
            ]
        except Exception as e:
            logger.error(f"Error listing namespaces: {e}")
            return []

    def list_pods(self, namespace: str = "default") -> List[PodInfo]:
        if not self.is_available():
            return self._mock_pods(namespace)
        try:
            pods = self.core_v1.list_namespaced_pod(namespace)
            result = []
            for pod in pods.items:
                containers = []
                ready_count = 0
                total = len(pod.spec.containers) if pod.spec.containers else 0
                restarts = 0
                if pod.status.container_statuses:
                    for cs in pod.status.container_statuses:
                        ready_count += 1 if cs.ready else 0
                        restarts += cs.restart_count or 0
                        containers.append({
                            "name": cs.name,
                            "ready": cs.ready,
                            "restart_count": cs.restart_count,
                            "image": cs.image,
                            "state": list(cs.state.to_dict().keys())[0] if cs.state else "unknown",
                        })
                
                result.append(PodInfo(
                    name=pod.metadata.name,
                    namespace=pod.metadata.namespace,
                    status=pod.status.phase or "Unknown",
                    phase=pod.status.phase or "Unknown",
                    node=pod.spec.node_name,
                    ip=pod.status.pod_ip,
                    restarts=restarts,
                    created=pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else "",
                    containers=containers,
                    labels=pod.metadata.labels or {},
                    ready=f"{ready_count}/{total}",
                ))
            return result
        except Exception as e:
            logger.error(f"Error listing pods: {e}")
            return []

    def list_deployments(self, namespace: str = "default") -> List[DeploymentInfo]:
        if not self.is_available():
            return self._mock_deployments(namespace)
        try:
            deps = self.apps_v1.list_namespaced_deployment(namespace)
            result = []
            for d in deps.items:
                image = None
                if d.spec.template.spec.containers:
                    image = d.spec.template.spec.containers[0].image
                result.append(DeploymentInfo(
                    name=d.metadata.name,
                    namespace=d.metadata.namespace,
                    replicas=d.spec.replicas or 0,
                    ready_replicas=d.status.ready_replicas or 0,
                    available_replicas=d.status.available_replicas or 0,
                    updated_replicas=d.status.updated_replicas or 0,
                    strategy=d.spec.strategy.type if d.spec.strategy else "RollingUpdate",
                    created=d.metadata.creation_timestamp.isoformat() if d.metadata.creation_timestamp else "",
                    labels=d.metadata.labels or {},
                    selector=d.spec.selector.match_labels or {},
                    image=image,
                ))
            return result
        except Exception as e:
            logger.error(f"Error listing deployments: {e}")
            return []

    def list_services(self, namespace: str = "default") -> List[ServiceInfo]:
        if not self.is_available():
            return [
                ServiceInfo(
                    name="nginx-svc",
                    namespace=namespace,
                    type="ClusterIP",
                    cluster_ip="10.96.0.10",
                    ports=[{"port": 80, "target_port": 80, "protocol": "TCP"}],
                    selector={"app": "nginx"},
                    created="2024-06-01T00:00:00Z",
                )
            ]
        try:
            svcs = self.core_v1.list_namespaced_service(namespace)
            return [
                ServiceInfo(
                    name=s.metadata.name,
                    namespace=s.metadata.namespace,
                    type=s.spec.type or "ClusterIP",
                    cluster_ip=s.spec.cluster_ip,
                    external_ips=s.spec.external_i_ps or [],
                    ports=[{"port": p.port, "target_port": str(p.target_port), "protocol": p.protocol, "node_port": p.node_port} for p in (s.spec.ports or [])],
                    selector=s.spec.selector or {},
                    created=s.metadata.creation_timestamp.isoformat() if s.metadata.creation_timestamp else "",
                    labels=s.metadata.labels or {},
                )
                for s in svcs.items
            ]
        except Exception as e:
            logger.error(f"Error listing services: {e}")
            return []

    def list_ingresses(self, namespace: str = "default") -> List[IngressInfo]:
        if not self.is_available():
            return []
        try:
            ings = self.networking_v1.list_namespaced_ingress(namespace)
            result = []
            for ing in ings.items:
                hosts = []
                paths = []
                if ing.spec.rules:
                    for rule in ing.spec.rules:
                        if rule.host:
                            hosts.append(rule.host)
                        if rule.http and rule.http.paths:
                            for p in rule.http.paths:
                                paths.append({
                                    "path": p.path,
                                    "path_type": p.path_type,
                                    "service": p.backend.service.name if p.backend.service else None,
                                    "port": p.backend.service.port.number if p.backend.service and p.backend.service.port else None,
                                })
                result.append(IngressInfo(
                    name=ing.metadata.name,
                    namespace=ing.metadata.namespace,
                    hosts=hosts,
                    paths=paths,
                    tls=[{"hosts": t.hosts, "secret": t.secret_name} for t in (ing.spec.tls or [])],
                    created=ing.metadata.creation_timestamp.isoformat() if ing.metadata.creation_timestamp else "",
                    labels=ing.metadata.labels or {},
                ))
            return result
        except Exception as e:
            logger.error(f"Error listing ingresses: {e}")
            return []

    def list_configmaps(self, namespace: str = "default") -> List[ConfigMapInfo]:
        if not self.is_available():
            return []
        try:
            cms = self.core_v1.list_namespaced_config_map(namespace)
            return [
                ConfigMapInfo(
                    name=cm.metadata.name,
                    namespace=cm.metadata.namespace,
                    data=cm.data or {},
                    created=cm.metadata.creation_timestamp.isoformat() if cm.metadata.creation_timestamp else "",
                    labels=cm.metadata.labels or {},
                )
                for cm in cms.items
            ]
        except Exception as e:
            logger.error(f"Error listing configmaps: {e}")
            return []

    def list_secrets(self, namespace: str = "default") -> List[SecretInfo]:
        if not self.is_available():
            return []
        try:
            secrets = self.core_v1.list_namespaced_secret(namespace)
            return [
                SecretInfo(
                    name=s.metadata.name,
                    namespace=s.metadata.namespace,
                    type=s.type or "Opaque",
                    data_keys=list((s.data or {}).keys()),
                    created=s.metadata.creation_timestamp.isoformat() if s.metadata.creation_timestamp else "",
                    labels=s.metadata.labels or {},
                )
                for s in secrets.items
            ]
        except Exception as e:
            logger.error(f"Error listing secrets: {e}")
            return []

    def list_events(self, namespace: str = "default") -> List[EventInfo]:
        if not self.is_available():
            return [
                EventInfo(type="Normal", reason="Scheduled", message="Successfully assigned pod", namespace=namespace, involved_object="pod/nginx", count=1),
            ]
        try:
            events = self.core_v1.list_namespaced_event(namespace)
            return [
                EventInfo(
                    type=e.type or "Normal",
                    reason=e.reason or "",
                    message=e.message or "",
                    namespace=e.metadata.namespace,
                    involved_object=f"{e.involved_object.kind}/{e.involved_object.name}" if e.involved_object else "",
                    count=e.count or 1,
                    first_timestamp=e.first_timestamp.isoformat() if e.first_timestamp else None,
                    last_timestamp=e.last_timestamp.isoformat() if e.last_timestamp else None,
                )
                for e in events.items
            ]
        except Exception as e:
            logger.error(f"Error listing events: {e}")
            return []

    def scale_deployment(self, name: str, namespace: str, replicas: int) -> bool:
        if not self.is_available():
            return True
        try:
            body = {"spec": {"replicas": replicas}}
            self.apps_v1.patch_namespaced_deployment_scale(name, namespace, body)
            return True
        except Exception as e:
            logger.error(f"Error scaling deployment: {e}")
            raise

    def restart_deployment(self, name: str, namespace: str) -> bool:
        if not self.is_available():
            return True
        try:
            # Trigger a rolling restart by annotating
            now = datetime.utcnow().isoformat()
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": now
                            }
                        }
                    }
                }
            }
            self.apps_v1.patch_namespaced_deployment(name, namespace, body)
            return True
        except Exception as e:
            logger.error(f"Error restarting deployment: {e}")
            raise

    def get_pod_logs(self, name: str, namespace: str, container: Optional[str] = None, tail: int = 100) -> str:
        if not self.is_available():
            return f"[MOCK] Logs for pod {name} in {namespace}\n2024-01-01 INFO Pod started successfully"
        try:
            logs = self.core_v1.read_namespaced_pod_log(
                name=name,
                namespace=namespace,
                container=container,
                tail_lines=tail,
                timestamps=True,
            )
            return logs
        except Exception as e:
            logger.error(f"Error getting pod logs: {e}")
            return f"Error: {str(e)}"

    def delete_resource(self, resource_type: str, name: str, namespace: str = "default") -> bool:
        if not self.is_available():
            return True
        try:
            if resource_type == "pod":
                self.core_v1.delete_namespaced_pod(name, namespace)
            elif resource_type == "deployment":
                self.apps_v1.delete_namespaced_deployment(name, namespace)
            elif resource_type == "service":
                self.core_v1.delete_namespaced_service(name, namespace)
            elif resource_type == "configmap":
                self.core_v1.delete_namespaced_config_map(name, namespace)
            elif resource_type == "secret":
                self.core_v1.delete_namespaced_secret(name, namespace)
            else:
                raise ValueError(f"Unsupported resource type: {resource_type}")
            return True
        except Exception as e:
            logger.error(f"Error deleting resource: {e}")
            raise

    def _mock_pods(self, namespace: str) -> List[PodInfo]:
        return [
            PodInfo(
                name="nginx-7d8f9c6b5-x2k4p",
                namespace=namespace,
                status="Running",
                phase="Running",
                node="node-1",
                ip="10.244.0.5",
                restarts=0,
                created="2024-06-01T10:00:00Z",
                containers=[{"name": "nginx", "ready": True, "restart_count": 0, "image": "nginx:1.25", "state": "running"}],
                labels={"app": "nginx"},
                ready="1/1",
            ),
            PodInfo(
                name="api-server-5f6d7e8c9-abc12",
                namespace=namespace,
                status="Running",
                phase="Running",
                node="node-2",
                ip="10.244.1.8",
                restarts=1,
                created="2024-06-02T08:00:00Z",
                containers=[{"name": "api", "ready": True, "restart_count": 1, "image": "devverse/api:v1.2", "state": "running"}],
                labels={"app": "api"},
                ready="1/1",
            ),
        ]

    def _mock_deployments(self, namespace: str) -> List[DeploymentInfo]:
        return [
            DeploymentInfo(
                name="nginx",
                namespace=namespace,
                replicas=3,
                ready_replicas=3,
                available_replicas=3,
                updated_replicas=3,
                strategy="RollingUpdate",
                created="2024-06-01T10:00:00Z",
                labels={"app": "nginx"},
                selector={"app": "nginx"},
                image="nginx:1.25",
            ),
            DeploymentInfo(
                name="api-server",
                namespace=namespace,
                replicas=2,
                ready_replicas=2,
                available_replicas=2,
                updated_replicas=2,
                strategy="RollingUpdate",
                created="2024-06-02T08:00:00Z",
                labels={"app": "api"},
                selector={"app": "api"},
                image="devverse/api:v1.2",
            ),
        ]


k8s_service = KubernetesService()
