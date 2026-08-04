# DevVerse

**The Ultimate Browser-Based DevOps Operating System**

> Dark theme · Glassmorphism · VS Code + Portainer + Kubernetes Dashboard + GitHub

![DevVerse](https://img.shields.io/badge/DevVerse-1.0.0-indigo)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Overview

DevVerse is a production-grade, browser-based DevOps operating system that unifies:

- **Docker** management (containers, images, volumes, networks, logs, stats)
- **Kubernetes** cluster operations (pods, deployments, services, scale, restart, logs)
- **GitHub** integration (repos, workflows, runs, commits, branches)
- **CI/CD** pipeline analytics and timeline
- **YAML Builder** for Kubernetes resources
- **Network Visualizer** (React Flow)
- **Monitoring** (CPU, RAM, Disk, Network)
- **Logs** aggregation & search
- **Browser Terminal** (xterm.js)
- **Monaco Editor** for YAML/JSON
- **Deployment History** & rollback views
- **RBAC** (Admin / Operator / Viewer)
- **JWT Authentication** with refresh tokens
- **Audit Logs** & Rate Limiting

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Next.js 15)                  │
│  Dashboard · Docker · K8s · GitHub · CI/CD · Terminal · ... │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST / JWT
┌──────────────────────────▼──────────────────────────────────┐
│                     FastAPI Backend                          │
│  Auth · Docker SDK · K8s Client · GitHub API · Metrics       │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
   PostgreSQL       Redis        Docker Socket / Kubeconfig
```

---

## Tech Stack

| Layer        | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | Next.js 15, React 19, TypeScript, TailwindCSS, Framer Motion, Zustand, React Query, Monaco, Xterm.js, Recharts, React Flow |
| Backend     | FastAPI, SQLAlchemy, Alembic, Docker SDK, Kubernetes Python Client, httpx |
| Auth        | JWT (access + refresh), RBAC (admin/operator/viewer) |
| Database    | PostgreSQL 16                                    |
| Cache       | Redis 7                                          |
| Deploy      | Docker Compose, GitHub Actions                   |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.12+ (for local backend dev)

### 1. Clone & Configure

```bash
cd devverse
cp backend/.env.example backend/.env
# Edit SECRET_KEY and optional GITHUB_TOKEN / KUBECONFIG
```

### 2. Start with Docker Compose

```bash
docker compose up --build -d
```

| Service   | URL                    |
|-----------|------------------------|
| Frontend  | http://localhost:3000  |
| Backend   | http://localhost:8000  |
| API Docs  | http://localhost:8000/docs |
| PostgreSQL| localhost:5432         |
| Redis     | localhost:6379         |

## Running with Docker (development)

There is a `docker-compose.yml` configured for local development (bind-mounts, fast rebuilds).

Start dev services:

```bash
docker compose up -d
```

This brings up Postgres, Redis, backend and frontend. The compose file uses volumes for Postgres and Redis so data persists across restarts.

## Running in production with Docker

For a production-like deployment that builds images and avoids host bind-mounts, use the production compose file in the repo.

1. Copy `backend/.env.prod.example` to `backend/.env` and fill in secret values (especially `SECRET_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI`).
2. Optionally create a top-level `.env` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `NEXT_PUBLIC_API_URL`, etc.

Start production services (build images):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Notes:
- The production compose file uses Postgres with a named volume `postgres_data` so the database persists after container restarts or host reboots.
- If you deploy to a cloud host, consider using a managed Postgres (RDS/Cloud SQL) for backups, scaling, and reliability. In that case point `DATABASE_URL` at the managed DB instead of the `db` service.
- Make sure `GITHUB_REDIRECT_URI` in your GitHub OAuth App matches the callback URL used by the backend (e.g. `https://your-backend-domain.example/api/v1/auth/github/callback`).

### 3. Create First User

Open http://localhost:3000/register and create an account.  
First user can be promoted to `admin` via database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---


## GitHub OAuth Setup (Login with GitHub)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name:** DevVerse
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:8000/api/v1/auth/github/callback`
3. Copy **Client ID** and generate a **Client Secret**
4. Put them in `backend/.env`:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/github/callback
FRONTEND_URL=http://localhost:3000
```

5. Restart the backend.

You can then:
- Click **Continue with GitHub** on the login page (creates account + logs in)
- Or click **Connect GitHub** on the GitHub dashboard page (links account for real repos)


## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Start Postgres & Redis (or use docker compose up db redis -d)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000 and proxies `/api/*` to the backend.

---

## Features by Module

### Authentication
- Register / Login / Forgot Password
- JWT access + refresh tokens
- Roles: `admin`, `operator`, `viewer`
- Protected routes & API RBAC

### Dashboard
- Live CPU / RAM / Disk metrics
- Docker / Kubernetes / GitHub status
- Health score
- Recent deployments & pipeline summary
- Resource usage charts (Recharts)

### Docker
- List running & stopped containers
- Start / Stop / Restart / Remove
- Create container
- Container logs & stats
- Images, Volumes, Networks

### Kubernetes
- Namespaces, Pods, Deployments, Services
- Scale & Restart deployments
- Pod logs
- Events
- Delete resources

### GitHub
- Repositories
- Workflow runs & jobs
- Commit history
- Branches & Releases

### CI/CD
- Pipeline timeline
- Success / failure analytics
- Duration metrics

### Terminal (WebSocket)
- Local mock shell (always works)
- Docker: `/api/v1/ws/terminal/docker?container_id=...`
- Kubernetes: `/api/v1/ws/terminal/k8s?pod=...&namespace=default`
- xterm.js ↔ FastAPI WebSocket ↔ docker exec / kubectl exec
- JWT via query `token=` (required when DEBUG=false)

### Other Modules
- YAML Builder, Network Visualizer, Monitoring, Logs, Terminal, Monaco Editor, Deployment History, Settings

---

## API Overview

| Prefix                    | Description              |
|---------------------------|--------------------------|
| `POST /api/v1/auth/login` | Login                    |
| `POST /api/v1/auth/register` | Register              |
| `GET  /api/v1/dashboard/overview` | System overview |
| `GET  /api/v1/docker/containers` | List containers   |
| `POST /api/v1/docker/containers/{id}/start` | Start |
| `GET  /api/v1/kubernetes/pods` | List pods         |
| `POST /api/v1/kubernetes/deployments/{name}/scale` | Scale |
| `GET  /api/v1/github/repos` | List repositories |

Full interactive docs: http://localhost:8000/docs

---

## Security

- JWT authentication with short-lived access tokens
- Refresh token rotation
- Role-based access control on mutating endpoints
- Rate limiting (60 req/min per IP)
- Password hashing with bcrypt
- Audit logging of auth and critical actions
- CORS configuration
- Input validation via Pydantic

---

## Environment Variables

| Variable          | Description                          | Default                          |
|-------------------|--------------------------------------|----------------------------------|
| `SECRET_KEY`      | JWT signing key                      | (change in production)           |
| `DATABASE_URL`    | PostgreSQL connection string         | postgresql://devverse:...        |
| `REDIS_URL`       | Redis connection                     | redis://localhost:6379/0         |
| `GITHUB_TOKEN`    | GitHub PAT for API access            | —                                |
| `KUBECONFIG`      | Path to kubeconfig                   | —                                |
| `K8S_IN_CLUSTER`  | Use in-cluster config                | false                            |
| `DEBUG`           | Enable debug mode                    | true                             |

---

## Project Structure

```
devverse/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Route modules
│   │   ├── core/            # Config, security
│   │   ├── db/              # SQLAlchemy session
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Docker, K8s, GitHub services
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # UI, layout, domain components
│   │   ├── hooks/
│   │   ├── lib/             # API client, utils
│   │   ├── stores/          # Zustand stores
│   │   └── styles/
│   ├── package.json
│   └── Dockerfile
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

---

## Deployment

### Docker Compose (recommended for single-node)

```bash
docker compose -f docker-compose.yml up -d --build
```

### Kubernetes

Apply the manifests under `k8s/` (create namespace, deployments, services, ingress).  
Mount Docker socket or use a privileged sidecar only in trusted environments.

### Production Checklist

- [ ] Change `SECRET_KEY`
- [ ] Use strong DB password
- [ ] Set `DEBUG=false`
- [ ] Configure real CORS origins
- [ ] Enable HTTPS (Traefik / nginx / cloud LB)
- [ ] Provide valid `GITHUB_TOKEN` and kubeconfig
- [ ] Restrict Docker socket access
- [ ] Enable backup for PostgreSQL volume

---

## License

MIT

---

Built with ❤️ for DevOps engineers who want everything in one beautiful browser window.
