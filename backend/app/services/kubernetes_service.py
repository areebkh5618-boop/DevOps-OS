import logging
from datetime import UTC, datetime

from app.core.config import settings
from app.schemas.kubernetes import (
    ConfigMapInfo,
    DeploymentInfo,
    EventInfo,
    IngressInfo,
    NamespaceInfo,
    PodInfo,
    SecretInfo,
    ServiceInfo,
)

logger = logging.getLogger(__name__)

try:
    from kubernetes import client, config

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
                config.load_kube_config(
                    config_file=settings.KUBECONFIG
                )
            else:
                config.load_kube_config()

            self.core_v1 = client.CoreV1Api()
            self.apps_v1 = client.AppsV1Api()
            self.networking_v1 = client.NetworkingV1Api()
            self.connected = True

            logger.info(
                "Kubernetes client initialized successfully"
            )

        except Exception as error:
            logger.warning(
                "Kubernetes connection failed: %s. "
                "Running in mock mode.",
                error,
            )
            self.connected = False

    def is_available(self) -> bool:
        return self.connected

    def list_namespaces(self) -> list[NamespaceInfo]:
        if not self.is_available():
            return [
                NamespaceInfo(
                    name="default",
                    status="Active",
                    created="2024-01-01T00:00:00Z",
                ),
                NamespaceInfo(
                    name="kube-system",
                    status="Active",
                    created="2024-01-01T00:00:00Z",
                ),
                NamespaceInfo(
                    name="devverse",
                    status="Active",
                    created="2024-06-01T00:00:00Z",
                ),
            ]

        try:
            namespace_list = self.core_v1.list_namespace()

            return [
                NamespaceInfo(
                    name=namespace.metadata.name,
                    status=namespace.status.phase or "Active",
                    created=(
                        namespace.metadata.creation_timestamp.isoformat()
                        if namespace.metadata.creation_timestamp
                        else ""
                    ),
                    labels=namespace.metadata.labels or {},
                )
                for namespace in namespace_list.items
            ]

        except Exception as error:
            logger.error(
                "Error listing namespaces: %s",
                error,
            )
            return []

    def list_pods(
        self,
        namespace: str = "default",
    ) -> list[PodInfo]:
        if not self.is_available():
            return self._mock_pods(namespace)

        try:
            pods = self.core_v1.list_namespaced_pod(namespace)
            result = []

            for pod in pods.items:
                containers = []
                ready_count = 0
                total_containers = (
                    len(pod.spec.containers)
                    if pod.spec.containers
                    else 0
                )
                restarts = 0

                if pod.status.container_statuses:
                    for container_status in (
                        pod.status.container_statuses
                    ):
                        if container_status.ready:
                            ready_count += 1

                        restarts += (
                            container_status.restart_count or 0
                        )

                        container_state = "unknown"

                        if container_status.state:
                            state_data = (
                                container_status.state.to_dict()
                            )
                            container_state = next(
                                iter(state_data),
                                "unknown",
                            )

                        containers.append(
                            {
                                "name": container_status.name,
                                "ready": container_status.ready,
                                "restart_count": (
                                    container_status.restart_count
                                ),
                                "image": container_status.image,
                                "state": container_state,
                            }
                        )

                result.append(
                    PodInfo(
                        name=pod.metadata.name,
                        namespace=pod.metadata.namespace,
                        status=pod.status.phase or "Unknown",
                        phase=pod.status.phase or "Unknown",
                        node=pod.spec.node_name,
                        ip=pod.status.pod_ip,
                        restarts=restarts,
                        created=(
                            pod.metadata.creation_timestamp.isoformat()
                            if pod.metadata.creation_timestamp
                            else ""
                        ),
                        containers=containers,
                        labels=pod.metadata.labels or {},
                        ready=(
                            f"{ready_count}/{total_containers}"
                        ),
                    )
                )

            return result

        except Exception as error:
            logger.error(
                "Error listing pods: %s",
                error,
            )
            return []

    def list_deployments(
        self,
        namespace: str = "default",
    ) -> list[DeploymentInfo]:
        if not self.is_available():
            return self._mock_deployments(namespace)

        try:
            deployments = (
                self.apps_v1.list_namespaced_deployment(
                    namespace
                )
            )

            result = []

            for deployment in deployments.items:
                image = None

                if (
                    deployment.spec.template.spec.containers
                ):
                    image = (
                        deployment.spec.template.spec
                        .containers[0]
                        .image
                    )

                result.append(
                    DeploymentInfo(
                        name=deployment.metadata.name,
                        namespace=(
                            deployment.metadata.namespace
                        ),
                        replicas=(
                            deployment.spec.replicas or 0
                        ),
                        ready_replicas=(
                            deployment.status.ready_replicas
                            or 0
                        ),
                        available_replicas=(
                            deployment.status.available_replicas
                            or 0
                        ),
                        updated_replicas=(
                            deployment.status.updated_replicas
                            or 0
                        ),
                        strategy=(
                            deployment.spec.strategy.type
                            if deployment.spec.strategy
                            else "RollingUpdate"
                        ),
                        created=(
                            deployment.metadata
                            .creation_timestamp
                            .isoformat()
                            if deployment.metadata
                            .creation_timestamp
                            else ""
                        ),
                        labels=(
                            deployment.metadata.labels or {}
                        ),
                        selector=(
                            deployment.spec.selector
                            .match_labels
                            or {}
                        ),
                        image=image,
                    )
                )

            return result

        except Exception as error:
            logger.error(
                "Error listing deployments: %s",
                error,
            )
            return []

    def list_services(
        self,
        namespace: str = "default",
    ) -> list[ServiceInfo]:
        if not self.is_available():
            return [
                ServiceInfo(
                    name="nginx-svc",
                    namespace=namespace,
                    type="ClusterIP",
                    cluster_ip="10.96.0.10",
                    ports=[
                        {
                            "port": 80,
                            "target_port": 80,
                            "protocol": "TCP",
                        }
                    ],
                    selector={"app": "nginx"},
                    created="2024-06-01T00:00:00Z",
                )
            ]

        try:
            services = (
                self.core_v1.list_namespaced_service(
                    namespace
                )
            )

            return [
                ServiceInfo(
                    name=service.metadata.name,
                    namespace=service.metadata.namespace,
                    type=service.spec.type or "ClusterIP",
                    cluster_ip=service.spec.cluster_ip,
                    external_ips=(
                        service.spec.external_i_ps or []
                    ),
                    ports=[
                        {
                            "port": port.port,
                            "target_port": str(
                                port.target_port
                            ),
                            "protocol": port.protocol,
                            "node_port": port.node_port,
                        }
                        for port in (
                            service.spec.ports or []
                        )
                    ],
                    selector=service.spec.selector or {},
                    created=(
                        service.metadata.creation_timestamp
                        .isoformat()
                        if service.metadata
                        .creation_timestamp
                        else ""
                    ),
                    labels=service.metadata.labels or {},
                )
                for service in services.items
            ]

        except Exception as error:
            logger.error(
                "Error listing services: %s",
                error,
            )
            return []

    def list_ingresses(
        self,
        namespace: str = "default",
    ) -> list[IngressInfo]:
        if not self.is_available():
            return []

        try:
            ingresses = (
                self.networking_v1
                .list_namespaced_ingress(namespace)
            )

            result = []

            for ingress in ingresses.items:
                hosts = []
                paths = []

                if ingress.spec.rules:
                    for rule in ingress.spec.rules:
                        if rule.host:
                            hosts.append(rule.host)

                        if rule.http and rule.http.paths:
                            for path in rule.http.paths:
                                backend_service = (
                                    path.backend.service
                                )

                                paths.append(
                                    {
                                        "path": path.path,
                                        "path_type": (
                                            path.path_type
                                        ),
                                        "service": (
                                            backend_service.name
                                            if backend_service
                                            else None
                                        ),
                                        "port": (
                                            backend_service
                                            .port.number
                                            if (
                                                backend_service
                                                and backend_service.port
                                            )
                                            else None
                                        ),
                                    }
                                )

                result.append(
                    IngressInfo(
                        name=ingress.metadata.name,
                        namespace=(
                            ingress.metadata.namespace
                        ),
                        hosts=hosts,
                        paths=paths,
                        tls=[
                            {
                                "hosts": tls.hosts,
                                "secret": tls.secret_name,
                            }
                            for tls in (
                                ingress.spec.tls or []
                            )
                        ],
                        created=(
                            ingress.metadata
                            .creation_timestamp
                            .isoformat()
                            if ingress.metadata
                            .creation_timestamp
                            else ""
                        ),
                        labels=(
                            ingress.metadata.labels or {}
                        ),
                    )
                )

            return result

        except Exception as error:
            logger.error(
                "Error listing ingresses: %s",
                error,
            )
            return []

    def list_configmaps(
        self,
        namespace: str = "default",
    ) -> list[ConfigMapInfo]:
        if not self.is_available():
            return []

        try:
            config_maps = (
                self.core_v1
                .list_namespaced_config_map(namespace)
            )

            return [
                ConfigMapInfo(
                    name=config_map.metadata.name,
                    namespace=(
                        config_map.metadata.namespace
                    ),
                    data=config_map.data or {},
                    created=(
                        config_map.metadata
                        .creation_timestamp
                        .isoformat()
                        if config_map.metadata
                        .creation_timestamp
                        else ""
                    ),
                    labels=(
                        config_map.metadata.labels or {}
                    ),
                )
                for config_map in config_maps.items
            ]

        except Exception as error:
            logger.error(
                "Error listing configmaps: %s",
                error,
            )
            return []

    def list_secrets(
        self,
        namespace: str = "default",
    ) -> list[SecretInfo]:
        if not self.is_available():
            return []

        try:
            secret_list = (
                self.core_v1
                .list_namespaced_secret(namespace)
            )

            return [
                SecretInfo(
                    name=secret.metadata.name,
                    namespace=secret.metadata.namespace,
                    type=secret.type or "Opaque",
                    data_keys=list(
                        (secret.data or {}).keys()
                    ),
                    created=(
                        secret.metadata
                        .creation_timestamp
                        .isoformat()
                        if secret.metadata
                        .creation_timestamp
                        else ""
                    ),
                    labels=secret.metadata.labels or {},
                )
                for secret in secret_list.items
            ]

        except Exception as error:
            logger.error(
                "Error listing secrets: %s",
                error,
            )
            return []

    def list_events(
        self,
        namespace: str = "default",
    ) -> list[EventInfo]:
        if not self.is_available():
            return [
                EventInfo(
                    type="Normal",
                    reason="Scheduled",
                    message="Successfully assigned pod",
                    namespace=namespace,
                    involved_object="pod/nginx",
                    count=1,
                )
            ]

        try:
            events = (
                self.core_v1
                .list_namespaced_event(namespace)
            )

            return [
                EventInfo(
                    type=event.type or "Normal",
                    reason=event.reason or "",
                    message=event.message or "",
                    namespace=event.metadata.namespace,
                    involved_object=(
                        f"{event.involved_object.kind}/"
                        f"{event.involved_object.name}"
                        if event.involved_object
                        else ""
                    ),
                    count=event.count or 1,
                    first_timestamp=(
                        event.first_timestamp.isoformat()
                        if event.first_timestamp
                        else None
                    ),
                    last_timestamp=(
                        event.last_timestamp.isoformat()
                        if event.last_timestamp
                        else None
                    ),
                )
                for event in events.items
            ]

        except Exception as error:
            logger.error(
                "Error listing events: %s",
                error,
            )
            return []

    def scale_deployment(
        self,
        name: str,
        namespace: str,
        replicas: int,
    ) -> bool:
        if not self.is_available():
            return True

        try:
            body = {
                "spec": {
                    "replicas": replicas,
                }
            }

            self.apps_v1.patch_namespaced_deployment_scale(
                name,
                namespace,
                body,
            )

            return True

        except Exception as error:
            logger.error(
                "Error scaling deployment: %s",
                error,
            )
            raise

    def restart_deployment(
        self,
        name: str,
        namespace: str,
    ) -> bool:
        if not self.is_available():
            return True

        try:
            restart_time = datetime.now(UTC).isoformat()

            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                (
                                    "kubectl.kubernetes.io/"
                                    "restartedAt"
                                ): restart_time
                            }
                        }
                    }
                }
            }

            self.apps_v1.patch_namespaced_deployment(
                name,
                namespace,
                body,
            )

            return True

        except Exception as error:
            logger.error(
                "Error restarting deployment: %s",
                error,
            )
            raise

    def get_pod_logs(
        self,
        name: str,
        namespace: str,
        container: str | None = None,
        tail: int = 100,
    ) -> str:
        if not self.is_available():
            return (
                f"[MOCK] Logs for pod {name} "
                f"in {namespace}\n"
                "2024-01-01 INFO "
                "Pod started successfully"
            )

        try:
            logs = (
                self.core_v1
                .read_namespaced_pod_log(
                    name=name,
                    namespace=namespace,
                    container=container,
                    tail_lines=tail,
                    timestamps=True,
                )
            )

            return logs

        except Exception as error:
            logger.error(
                "Error getting pod logs: %s",
                error,
            )
            return f"Error: {error!s}"

    def delete_resource(
        self,
        resource_type: str,
        name: str,
        namespace: str = "default",
    ) -> bool:
        if not self.is_available():
            return True

        try:
            if resource_type == "pod":
                self.core_v1.delete_namespaced_pod(
                    name,
                    namespace,
                )

            elif resource_type == "deployment":
                self.apps_v1.delete_namespaced_deployment(
                    name,
                    namespace,
                )

            elif resource_type == "service":
                self.core_v1.delete_namespaced_service(
                    name,
                    namespace,
                )

            elif resource_type == "configmap":
                self.core_v1.delete_namespaced_config_map(
                    name,
                    namespace,
                )

            elif resource_type == "secret":
                self.core_v1.delete_namespaced_secret(
                    name,
                    namespace,
                )

            else:
                raise ValueError(
                    "Unsupported resource type: "
                    f"{resource_type}"
                )

            return True

        except Exception as error:
            logger.error(
                "Error deleting resource: %s",
                error,
            )
            raise

    def _mock_pods(
        self,
        namespace: str,
    ) -> list[PodInfo]:
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
                containers=[
                    {
                        "name": "nginx",
                        "ready": True,
                        "restart_count": 0,
                        "image": "nginx:1.25",
                        "state": "running",
                    }
                ],
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
                containers=[
                    {
                        "name": "api",
                        "ready": True,
                        "restart_count": 1,
                        "image": "devverse/api:v1.2",
                        "state": "running",
                    }
                ],
                labels={"app": "api"},
                ready="1/1",
            ),
        ]

    def _mock_deployments(
        self,
        namespace: str,
    ) -> list[DeploymentInfo]:
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