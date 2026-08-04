"""
WebSocket terminal: exec into Docker containers or Kubernetes pods.
Protocol (client ↔ server):
  - Client connects with query params, then sends/receives raw terminal bytes as text.
  - Optional JSON control messages from client: {"type":"resize","cols":N,"rows":N}
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Terminal"])


def _verify_ws_token(token: Optional[str]) -> Optional[int]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        return None



@router.websocket("/ws/terminal/local")
async def ws_local_terminal(
    websocket: WebSocket,
    token: str = Query(None),
    cols: int = Query(120),
    rows: int = Query(30),
):
    """Always-available mock shell (no Docker/K8s required)."""
    await websocket.accept()
    user_id = _verify_ws_token(token)
    if user_id is None and not settings.DEBUG:
        await websocket.send_text("\r\n\x1b[31mUnauthorized. Provide a valid JWT token.\x1b[0m\r\n")
        await websocket.close(code=4401)
        return
    await _mock_shell(websocket, "local")


@router.websocket("/ws/terminal/docker")
async def ws_docker_terminal(
    websocket: WebSocket,
    container_id: str = Query(..., description="Container ID or name"),
    token: str = Query(None),
    cmd: str = Query("/bin/sh"),
    cols: int = Query(120),
    rows: int = Query(30),
):
    await websocket.accept()
    user_id = _verify_ws_token(token)
    if user_id is None and not settings.DEBUG:
        await websocket.send_text("\r\n\x1b[31mUnauthorized. Provide a valid JWT token.\x1b[0m\r\n")
        await websocket.close(code=4401)
        return

    # Local mock mode — never hit Docker
    if container_id in ("__local_mock__", "local", "__local__") or container_id.startswith("__local"):
        await _mock_shell(websocket, "local")
        return

    try:
        import docker
        from docker.errors import NotFound
    except ImportError:
        await websocket.send_text("\r\n\x1b[33mDocker SDK not installed. Using mock shell.\x1b[0m\r\n")
        await _mock_shell(websocket, f"docker:{container_id}")
        return

    client = None
    socket = None
    try:
        client = docker.from_env()
        container = client.containers.get(container_id)
        # Prefer bash if available
        shell_cmd = cmd if cmd != "/bin/sh" else "/bin/sh"
        try:
            # Test if bash exists
            exit_code, _ = container.exec_run("which bash", demux=True)
            if exit_code == 0:
                shell_cmd = "/bin/bash"
        except Exception:
            pass

        exec_id = client.api.exec_create(
            container.id,
            shell_cmd,
            stdin=True,
            tty=True,
            stdout=True,
            stderr=True,
        )
        socket = client.api.exec_start(exec_id["Id"], socket=True, tty=True)
        sock = socket._sock
        sock.setblocking(False)

        await websocket.send_text(
            f"\x1b[1;32m✔ Connected to container\x1b[0m \x1b[1;36m{container.name}\x1b[0m ({container.short_id})\r\n"
            f"\x1b[90mShell: {shell_cmd} · type 'exit' to disconnect\x1b[0m\r\n\r\n"
        )

        await _bridge_socket(websocket, sock)

    except NotFound:
        await websocket.send_text(f"\r\n\x1b[31mContainer not found: {container_id}\x1b[0m\r\n")
        await websocket.close()
    except Exception as e:
        logger.exception("Docker terminal error")
        await websocket.send_text(f"\r\n\x1b[31mError: {e}\x1b[0m\r\n")
        # Fallback mock so UI still works without Docker
        await _mock_shell(websocket, f"docker:{container_id}")
    finally:
        try:
            if socket and hasattr(socket, "_sock"):
                socket._sock.close()
        except Exception:
            pass


@router.websocket("/ws/terminal/k8s")
async def ws_k8s_terminal(
    websocket: WebSocket,
    pod: str = Query(...),
    namespace: str = Query("default"),
    container: str = Query(None),
    token: str = Query(None),
    cols: int = Query(120),
    rows: int = Query(30),
):
    await websocket.accept()
    user_id = _verify_ws_token(token)
    if user_id is None and not settings.DEBUG:
        await websocket.send_text("\r\n\x1b[31mUnauthorized.\x1b[0m\r\n")
        await websocket.close(code=4401)
        return

    try:
        from kubernetes import client, config
        from kubernetes.stream import stream
    except ImportError:
        await websocket.send_text("\r\n\x1b[33mKubernetes client not installed. Using mock shell.\x1b[0m\r\n")
        await _mock_shell(websocket, f"k8s:{namespace}/{pod}")
        return

    try:
        if settings.K8S_IN_CLUSTER:
            config.load_incluster_config()
        else:
            config.load_kube_config(config_file=settings.KUBECONFIG)

        v1 = client.CoreV1Api()
        # Resolve container name if not given
        cont_name = container
        if not cont_name:
            p = v1.read_namespaced_pod(pod, namespace)
            if p.spec.containers:
                cont_name = p.spec.containers[0].name

        exec_command = ["/bin/sh", "-c", "command -v bash >/dev/null && exec bash || exec sh"]

        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod,
            namespace,
            command=exec_command,
            container=cont_name,
            stderr=True,
            stdin=True,
            stdout=True,
            tty=True,
            _preload_content=False,
        )

        await websocket.send_text(
            f"\x1b[1;32m✔ Connected to pod\x1b[0m \x1b[1;36m{namespace}/{pod}\x1b[0m"
            + (f" (container: {cont_name})" if cont_name else "")
            + "\r\n\x1b[90mtype 'exit' to disconnect\x1b[0m\r\n\r\n"
        )

        await _bridge_k8s_stream(websocket, resp)

    except Exception as e:
        logger.exception("K8s terminal error")
        await websocket.send_text(f"\r\n\x1b[31mError: {e}\x1b[0m\r\n")
        await _mock_shell(websocket, f"k8s:{namespace}/{pod}")


async def _bridge_socket(websocket: WebSocket, sock):
    """Bidirectional bridge between WebSocket and a non-blocking raw socket."""
    loop = asyncio.get_event_loop()

    async def ws_to_sock():
        try:
            while True:
                data = await websocket.receive_text()
                if data.startswith("{"):
                    try:
                        msg = json.loads(data)
                        if msg.get("type") == "resize":
                            # Docker TTY resize would need resize_exec API; skip for now
                            continue
                    except json.JSONDecodeError:
                        pass
                await loop.sock_sendall(sock, data.encode("utf-8", errors="replace"))
        except (WebSocketDisconnect, Exception):
            return

    async def sock_to_ws():
        try:
            while True:
                try:
                    chunk = await loop.sock_recv(sock, 4096)
                except (BlockingIOError, InterruptedError):
                    await asyncio.sleep(0.01)
                    continue
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="replace")
                await websocket.send_text(text)
        except (WebSocketDisconnect, Exception):
            return

    t1 = asyncio.create_task(ws_to_sock())
    t2 = asyncio.create_task(sock_to_ws())
    done, pending = await asyncio.wait({t1, t2}, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
    try:
        await websocket.close()
    except Exception:
        pass


async def _bridge_k8s_stream(websocket: WebSocket, resp):
    """Bridge WebSocket ↔ kubernetes stream response."""

    async def ws_to_k8s():
        try:
            while True:
                data = await websocket.receive_text()
                if data.startswith("{"):
                    try:
                        msg = json.loads(data)
                        if msg.get("type") == "resize":
                            continue
                    except json.JSONDecodeError:
                        pass
                if resp.is_open():
                    resp.write_stdin(data)
                else:
                    break
        except (WebSocketDisconnect, Exception):
            return

    async def k8s_to_ws():
        try:
            while resp.is_open():
                # Non-blocking peek
                await asyncio.sleep(0.02)
                if resp.peek_stdout():
                    await websocket.send_text(resp.read_stdout())
                if resp.peek_stderr():
                    await websocket.send_text(resp.read_stderr())
            # Drain remaining
            if resp.peek_stdout():
                await websocket.send_text(resp.read_stdout())
            if resp.peek_stderr():
                await websocket.send_text(resp.read_stderr())
        except (WebSocketDisconnect, Exception):
            return
        finally:
            try:
                resp.close()
            except Exception:
                pass

    t1 = asyncio.create_task(ws_to_k8s())
    t2 = asyncio.create_task(k8s_to_ws())
    done, pending = await asyncio.wait({t1, t2}, return_when=asyncio.FIRST_COMPLETED)
    for t in pending:
        t.cancel()
    try:
        resp.close()
    except Exception:
        pass
    try:
        await websocket.close()
    except Exception:
        pass


async def _mock_shell(websocket: WebSocket, label: str):
    """Interactive mock shell when Docker/K8s is unavailable."""
    await websocket.send_text(
        f"\x1b[1;36mDevVerse Mock Shell\x1b[0m [{label}]\r\n"
        "Docker/K8s not reachable — local mock mode.\r\n"
        "Commands: help, clear, date, echo, uname, ls, exit\r\n\r\n"
    )
    prompt = "\x1b[1;35mdevverse\x1b[0m:\x1b[1;34m~\x1b[0m$ "
    await websocket.send_text(prompt)
    line = ""
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith("{"):
                continue
            for ch in data:
                code = ord(ch)
                if code == 13:  # Enter
                    cmd = line.strip()
                    await websocket.send_text("\r\n")
                    if cmd == "exit":
                        await websocket.send_text("Bye.\r\n")
                        await websocket.close()
                        return
                    elif cmd == "help":
                        await websocket.send_text("help clear date echo uname ls exit\r\n")
                    elif cmd == "clear":
                        await websocket.send_text("\x1b[2J\x1b[H")
                    elif cmd == "date":
                        from datetime import datetime
                        await websocket.send_text(datetime.utcnow().isoformat() + "Z\r\n")
                    elif cmd.startswith("echo "):
                        await websocket.send_text(cmd[5:] + "\r\n")
                    elif cmd == "uname":
                        await websocket.send_text("DevVerse MockOS 1.0 browser\r\n")
                    elif cmd == "ls":
                        await websocket.send_text("bin  etc  home  tmp  var\r\n")
                    elif cmd:
                        await websocket.send_text(f"\x1b[31mcommand not found: {cmd}\x1b[0m\r\n")
                    line = ""
                    await websocket.send_text(prompt)
                elif code == 127:  # Backspace
                    if line:
                        line = line[:-1]
                        await websocket.send_text("\b \b")
                elif code == 3:  # Ctrl+C
                    line = ""
                    await websocket.send_text("^C\r\n" + prompt)
                elif code >= 32:
                    line += ch
                    await websocket.send_text(ch)
    except WebSocketDisconnect:
        return
