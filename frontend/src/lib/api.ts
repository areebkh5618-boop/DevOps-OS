import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, null, {
            params: { refresh_token: refresh },
          });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.access_token}`;
          }
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: { email: string; username: string; password: string; full_name?: string }) =>
    api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
  updateMe: (data: Record<string, unknown>) => api.patch("/auth/me", data),
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change-password", { current_password, new_password }),
  forgotPassword: (email: string) => api.post("/auth/forgot-password", { email }),
};

// Dashboard
export const dashboardApi = {
  overview: () => api.get("/dashboard/overview"),
  metrics: () => api.get("/dashboard/metrics"),
};

// Docker
export const dockerApi = {
  status: () => api.get("/docker/status"),
  system: () => api.get("/docker/system"),
  containers: (all = true) => api.get("/docker/containers", { params: { all } }),
  container: (id: string) => api.get(`/docker/containers/${id}`),
  stats: (id: string) => api.get(`/docker/containers/${id}/stats`),
  logs: (id: string, tail = 100) => api.get(`/docker/containers/${id}/logs`, { params: { tail } }),
  start: (id: string) => api.post(`/docker/containers/${id}/start`),
  stop: (id: string) => api.post(`/docker/containers/${id}/stop`),
  restart: (id: string) => api.post(`/docker/containers/${id}/restart`),
  remove: (id: string, force = false) => api.delete(`/docker/containers/${id}`, { params: { force } }),
  create: (data: Record<string, unknown>) => api.post("/docker/containers", data),
  images: () => api.get("/docker/images"),
  volumes: () => api.get("/docker/volumes"),
  networks: () => api.get("/docker/networks"),
};

// Kubernetes
export const k8sApi = {
  status: () => api.get("/kubernetes/status"),
  namespaces: () => api.get("/kubernetes/namespaces"),
  pods: (namespace = "default") => api.get("/kubernetes/pods", { params: { namespace } }),
  deployments: (namespace = "default") => api.get("/kubernetes/deployments", { params: { namespace } }),
  services: (namespace = "default") => api.get("/kubernetes/services", { params: { namespace } }),
  ingresses: (namespace = "default") => api.get("/kubernetes/ingresses", { params: { namespace } }),
  configmaps: (namespace = "default") => api.get("/kubernetes/configmaps", { params: { namespace } }),
  secrets: (namespace = "default") => api.get("/kubernetes/secrets", { params: { namespace } }),
  events: (namespace = "default") => api.get("/kubernetes/events", { params: { namespace } }),
  podLogs: (name: string, namespace = "default", tail = 100) =>
    api.get(`/kubernetes/pods/${name}/logs`, { params: { namespace, tail } }),
  scale: (name: string, replicas: number, namespace = "default") =>
    api.post(`/kubernetes/deployments/${name}/scale`, { replicas }, { params: { namespace } }),
  restart: (name: string, namespace = "default") =>
    api.post(`/kubernetes/deployments/${name}/restart`, null, { params: { namespace } }),
  deleteResource: (type: string, name: string, namespace = "default") =>
    api.delete(`/kubernetes/resources/${type}/${name}`, { params: { namespace } }),
};

// GitHub
export const githubApi = {
  status: () => api.get("/github/status"),
  repos: (username?: string) => api.get("/github/repos", { params: { username } }),
  workflows: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}/workflows`),
  runs: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}/runs`),
  commits: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}/commits`),
  branches: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}/branches`),
  releases: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}/releases`),
  getRepo: (owner: string, repo: string) => api.get(`/github/repos/${owner}/${repo}`),
};
