"""
WebSocket terminal: exec into Docker containers or Kubernetes pods.

Protocol (client ↔ server):
  - Client connects with query params, then sends/receives raw terminal bytes as text.
  - Optional JSON control messages from client:
    {"type": "resize", "cols": N, "rows": N}
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Terminal"])


def _verify_ws_token(token: str | None) -> int | None:
    if not token:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        if payload.get("type") != "access":
            return None

        subject = payload.get("sub")

        if subject is None:
            return None

        return int(subject)

    except (JWTError, ValueError, TypeError):
        return None


@router.websocket("/ws/terminal/local")
async def ws_local_terminal(
    websocket: WebSocket,
    token: str | None = Query(None),
    cols: int = Query(120),
    rows: int = Query(30),
):
    """Always-available mock shell without Docker or Kubernetes."""

    await websocket.accept()

    user_id = _verify_ws_token(token)

    if user_id is None and not settings.DEBUG:
        await websocket.send_text(
            "\r\n"
            "\x1b[31mUnauthorized. Provide a valid JWT token."
            "\x1b[0m\r\n"
        )
        await websocket.close(code=4401)
        return

    await _mock_shell(websocket, "local")


@router.websocket("/ws/terminal/docker")
async def ws_docker_terminal(
    websocket: WebSocket,
    container_id: str = Query(
        ...,
        description="Container ID or name",
    ),
    token: str | None = Query(None),
    cmd: str = Query("/bin/sh"),
    cols: int = Query(120),
    rows: int = Query(30),
):
    await websocket.accept()

    user_id = _verify_ws_token(token)

    if user_id is None and not settings.DEBUG:
        await websocket.send_text(
            "\r\n"
            "\x1b[31mUnauthorized. Provide a valid JWT token."
            "\x1b[0m\r\n"
        )
        await websocket.close(code=4401)
        return

    local_mock_names = {
        "__local_mock__",
        "local",
        "__local__",
    }

    if (
        container_id in local_mock_names
        or container_id.startswith("__local")
    ):
        await _mock_shell(websocket, "local")
        return

    try:
        import docker
        from docker.errors import NotFound
    except ImportError:
        await websocket.send_text(
            "\r\n"
            "\x1b[33mDocker SDK not installed. "
            "Using mock shell."
            "\x1b[0m\r\n"
        )
        await _mock_shell(
            websocket,
            f"docker:{container_id}",
        )
        return

    docker_client = None
    docker_socket = None

    try:
        docker_client = docker.from_env()
        container = docker_client.containers.get(container_id)

        shell_cmd = cmd if cmd != "/bin/sh" else "/bin/sh"

        try:
            exit_code, _ = container.exec_run(
                "which bash",
                demux=True,
            )

            if exit_code == 0:
                shell_cmd = "/bin/bash"

        except Exception:
            logger.debug(
                "Bash is unavailable in container %s",
                container_id,
            )

        exec_data = docker_client.api.exec_create(
            container.id,
            shell_cmd,
            stdin=True,
            tty=True,
            stdout=True,
            stderr=True,
        )

        docker_socket = docker_client.api.exec_start(
            exec_data["Id"],
            socket=True,
            tty=True,
        )

        raw_socket = docker_socket._sock
        raw_socket.setblocking(False)

        await websocket.send_text(
            "\x1b[1;32m✔ Connected to container\x1b[0m "
            f"\x1b[1;36m{container.name}\x1b[0m "
            f"({container.short_id})\r\n"
            f"\x1b[90mShell: {shell_cmd} · "
            "type 'exit' to disconnect\x1b[0m\r\n\r\n"
        )

        await _bridge_socket(
            websocket,
            raw_socket,
        )

    except NotFound:
        await websocket.send_text(
            "\r\n"
            f"\x1b[31mContainer not found: {container_id}"
            "\x1b[0m\r\n"
        )
        await websocket.close()

    except Exception as error:
        logger.exception("Docker terminal error")

        await websocket.send_text(
            "\r\n"
            f"\x1b[31mError: {error!s}"
            "\x1b[0m\r\n"
        )

        await _mock_shell(
            websocket,
            f"docker:{container_id}",
        )

    finally:
        try:
            if (
                docker_socket
                and hasattr(docker_socket, "_sock")
            ):
                docker_socket._sock.close()

        except Exception:
            logger.debug(
                "Unable to close Docker terminal socket",
                exc_info=True,
            )

        try:
            if docker_client:
                docker_client.close()

        except Exception:
            logger.debug(
                "Unable to close Docker client",
                exc_info=True,
            )


@router.websocket("/ws/terminal/k8s")
async def ws_k8s_terminal(
    websocket: WebSocket,
    pod: str = Query(...),
    namespace: str = Query("default"),
    container: str | None = Query(None),
    token: str | None = Query(None),
    cols: int = Query(120),
    rows: int = Query(30),
):
    await websocket.accept()

    user_id = _verify_ws_token(token)

    if user_id is None and not settings.DEBUG:
        await websocket.send_text(
            "\r\n"
            "\x1b[31mUnauthorized."
            "\x1b[0m\r\n"
        )
        await websocket.close(code=4401)
        return

    try:
        from kubernetes import client, config
        from kubernetes.stream import stream
    except ImportError:
        await websocket.send_text(
            "\r\n"
            "\x1b[33mKubernetes client not installed. "
            "Using mock shell."
            "\x1b[0m\r\n"
        )
        await _mock_shell(
            websocket,
            f"k8s:{namespace}/{pod}",
        )
        return

    try:
        if settings.K8S_IN_CLUSTER:
            config.load_incluster_config()
        else:
            config.load_kube_config(
                config_file=settings.KUBECONFIG
            )

        core_api = client.CoreV1Api()
        container_name = container

        if not container_name:
            pod_data = core_api.read_namespaced_pod(
                pod,
                namespace,
            )

            if pod_data.spec.containers:
                container_name = (
                    pod_data.spec.containers[0].name
                )

        exec_command = [
            "/bin/sh",
            "-c",
            (
                "command -v bash >/dev/null "
                "&& exec bash || exec sh"
            ),
        ]

        response = stream(
            core_api.connect_get_namespaced_pod_exec,
            pod,
            namespace,
            command=exec_command,
            container=container_name,
            stderr=True,
            stdin=True,
            stdout=True,
            tty=True,
            _preload_content=False,
        )

        connection_message = (
            "\x1b[1;32m✔ Connected to pod\x1b[0m "
            f"\x1b[1;36m{namespace}/{pod}\x1b[0m"
        )

        if container_name:
            connection_message += (
                f" (container: {container_name})"
            )

        connection_message += (
            "\r\n"
            "\x1b[90mtype 'exit' to disconnect"
            "\x1b[0m\r\n\r\n"
        )

        await websocket.send_text(
            connection_message
        )

        await _bridge_k8s_stream(
            websocket,
            response,
        )

    except Exception as error:
        logger.exception("Kubernetes terminal error")

        await websocket.send_text(
            "\r\n"
            f"\x1b[31mError: {error!s}"
            "\x1b[0m\r\n"
        )

        await _mock_shell(
            websocket,
            f"k8s:{namespace}/{pod}",
        )


async def _bridge_socket(
    websocket: WebSocket,
    socket,
):
    """Bridge a WebSocket and a non-blocking raw socket."""

    loop = asyncio.get_running_loop()

    async def websocket_to_socket():
        try:
            while True:
                data = await websocket.receive_text()

                if data.startswith("{"):
                    try:
                        message = json.loads(data)

                        if message.get("type") == "resize":
                            continue

                    except json.JSONDecodeError:
                        pass

                await loop.sock_sendall(
                    socket,
                    data.encode(
                        "utf-8",
                        errors="replace",
                    ),
                )

        except (WebSocketDisconnect, Exception):
            return

    async def socket_to_websocket():
        try:
            while True:
                try:
                    chunk = await loop.sock_recv(
                        socket,
                        4096,
                    )

                except (
                    BlockingIOError,
                    InterruptedError,
                ):
                    await asyncio.sleep(0.01)
                    continue

                if not chunk:
                    break

                text = chunk.decode(
                    "utf-8",
                    errors="replace",
                )

                await websocket.send_text(text)

        except (WebSocketDisconnect, Exception):
            return

    task_websocket = asyncio.create_task(
        websocket_to_socket()
    )

    task_socket = asyncio.create_task(
        socket_to_websocket()
    )

    _done, pending = await asyncio.wait(
        {
            task_websocket,
            task_socket,
        },
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    await asyncio.gather(
        *pending,
        return_exceptions=True,
    )

    try:
        await websocket.close()
    except Exception:
        logger.debug(
            "WebSocket was already closed",
            exc_info=True,
        )


async def _bridge_k8s_stream(
    websocket: WebSocket,
    response,
):
    """Bridge a WebSocket and a Kubernetes stream."""

    async def websocket_to_kubernetes():
        try:
            while True:
                data = await websocket.receive_text()

                if data.startswith("{"):
                    try:
                        message = json.loads(data)

                        if message.get("type") == "resize":
                            continue

                    except json.JSONDecodeError:
                        pass

                if response.is_open():
                    response.write_stdin(data)
                else:
                    break

        except (WebSocketDisconnect, Exception):
            return

    async def kubernetes_to_websocket():
        try:
            while response.is_open():
                await asyncio.sleep(0.02)

                if response.peek_stdout():
                    await websocket.send_text(
                        response.read_stdout()
                    )

                if response.peek_stderr():
                    await websocket.send_text(
                        response.read_stderr()
                    )

            if response.peek_stdout():
                await websocket.send_text(
                    response.read_stdout()
                )

            if response.peek_stderr():
                await websocket.send_text(
                    response.read_stderr()
                )

        except (WebSocketDisconnect, Exception):
            return

        finally:
            try:
                response.close()
            except Exception:
                logger.debug(
                    "Unable to close Kubernetes stream",
                    exc_info=True,
                )

    task_websocket = asyncio.create_task(
        websocket_to_kubernetes()
    )

    task_kubernetes = asyncio.create_task(
        kubernetes_to_websocket()
    )

    _done, pending = await asyncio.wait(
        {
            task_websocket,
            task_kubernetes,
        },
        return_when=asyncio.FIRST_COMPLETED,
    )

    for task in pending:
        task.cancel()

    await asyncio.gather(
        *pending,
        return_exceptions=True,
    )

    try:
        response.close()
    except Exception:
        logger.debug(
            "Kubernetes stream was already closed",
            exc_info=True,
        )

    try:
        await websocket.close()
    except Exception:
        logger.debug(
            "WebSocket was already closed",
            exc_info=True,
        )


async def _mock_shell(
    websocket: WebSocket,
    label: str,
):
    """Interactive mock shell when Docker or Kubernetes is unavailable."""

    await websocket.send_text(
        f"\x1b[1;36mDevVerse Mock Shell\x1b[0m "
        f"[{label}]\r\n"
        "Docker/K8s not reachable — local mock mode.\r\n"
        "Commands: help, clear, date, echo, "
        "uname, ls, exit\r\n\r\n"
    )

    prompt = (
        "\x1b[1;35mdevverse\x1b[0m:"
        "\x1b[1;34m~\x1b[0m$ "
    )

    await websocket.send_text(prompt)

    line = ""

    try:
        while True:
            data = await websocket.receive_text()

            if data.startswith("{"):
                continue

            for character in data:
                character_code = ord(character)

                if character_code == 13:
                    command = line.strip()

                    await websocket.send_text("\r\n")

                    if command == "exit":
                        await websocket.send_text(
                            "Bye.\r\n"
                        )
                        await websocket.close()
                        return

                    if command == "help":
                        await websocket.send_text(
                            "help clear date echo "
                            "uname ls exit\r\n"
                        )

                    elif command == "clear":
                        await websocket.send_text(
                            "\x1b[2J\x1b[H"
                        )

                    elif command == "date":
                        current_time = (
                            datetime.now(UTC)
                            .isoformat()
                            .replace("+00:00", "Z")
                        )

                        await websocket.send_text(
                            f"{current_time}\r\n"
                        )

                    elif command.startswith("echo "):
                        await websocket.send_text(
                            f"{command[5:]}\r\n"
                        )

                    elif command == "uname":
                        await websocket.send_text(
                            "DevVerse MockOS 1.0 browser\r\n"
                        )

                    elif command == "ls":
                        await websocket.send_text(
                            "bin  etc  home  tmp  var\r\n"
                        )

                    elif command:
                        await websocket.send_text(
                            "\x1b[31mcommand not found: "
                            f"{command}\x1b[0m\r\n"
                        )

                    line = ""
                    await websocket.send_text(prompt)

                elif character_code == 127:
                    if line:
                        line = line[:-1]
                        await websocket.send_text(
                            "\b \b"
                        )

                elif character_code == 3:
                    line = ""

                    await websocket.send_text(
                        f"^C\r\n{prompt}"
                    )

                elif character_code >= 32:
                    line += character
                    await websocket.send_text(character)

    except WebSocketDisconnect:
        return