# Nano Banana Studio — Infrastructure & Kubernetes Manifests (`infra/`)

This directory contains the **Kubernetes deployment manifests** (`infra/deployment.yaml` and `infra/k8s/`), **Nginx reverse proxy configuration** (`infra/nginx/nginx.conf`), and **PostgreSQL initialization SQL** (`infra/postgres/init.sql`) for **Nano Banana Studio**.

> **Root Compose Layout (`podman-compose.yml`, `podman-compose.dev.yml`, `docker-compose.yml`, `docker-compose.dev.yml`):**
> At the repository root, Compose files are provided for both `podman-compose` and `docker-compose` using the universal **`PORT_PAD`** prefix (`${PORT_PAD}8080`, `${PORT_PAD}3000`, `${PORT_PAD}8000`, `${PORT_PAD}5432`, `${PORT_PAD}9000`, `${PORT_PAD}9001`):
> - **`podman-compose.yml` / `docker-compose.yml`**: Production Compose stack (`target: production` on `backend` with Gunicorn and `frontend` with `next start`, `REQUIRE_AUTH=true`, `restart: unless-stopped`, default `PORT_PAD=2` -> `28080`, `23000`, `28000`, `25432`, `29000`, `29001`, or override with `PORT_PAD=1 podman-compose -f podman-compose.yml up -d`).
> - **`podman-compose.dev.yml` / `docker-compose.dev.yml`**: Local Development Compose stack (`target: development` with hot-reload bind mounts, `REQUIRE_AUTH=false` auto-provisioning `usr_local_dev`, default `PORT_PAD=1` -> `18080`, `13000`, `18000`, `15432`, `19000`, `19001`).

---

## Directory Structure

```text
infra/
├── README.md                       # Infrastructure & Kubernetes overview (this file)
├── deployment.yaml                 # All-in-one Kubernetes manifest (Application tier only)
├── k8s/                            # Modular Kustomize Kubernetes manifests
│   ├── namespace.yaml              # Namespace: nanobanana
│   ├── configmap.yaml              # App ConfigMap & Nginx reverse proxy ConfigMap
│   ├── secret.example.yaml         # External PostgreSQL & External Bucket Secret template
│   ├── backend-deployment.yaml     # Flask + SQLAlchemy Backend Deployment (replicas: 2) + Service
│   ├── frontend-deployment.yaml    # Next.js Frontend Deployment (replicas: 2) + Service
│   ├── nginx-deployment.yaml       # Nginx Gateway Deployment (replicas: 2) + Service
│   ├── ingress.yaml                # Kubernetes Ingress (networking.k8s.io/v1)
│   ├── hpa.yaml                    # HorizontalPodAutoscaler for Backend & Frontend
│   └── kustomization.yaml          # Kustomize entrypoint (kubectl apply -k infra/k8s/)
├── nginx/
│   └── nginx.conf                  # Nginx 1.27 reverse proxy config used by root Compose files
└── postgres/
    └── init.sql                    # PostgreSQL 16 initialization script used by root Compose files
```

---

## Kubernetes Deployment (`infra/deployment.yaml` & `infra/k8s/`)

### Architectural Scope: Stateless Application Tier Only

In Kubernetes environments, **PostgreSQL 16** and the **S3-Compatible Object Storage Bucket (RustFS / AWS S3 / GCS / MinIO)** are **already provisioned externally**. Therefore, `infra/deployment.yaml` and `infra/k8s/` deploy **only the stateless application tier**:

1. **`nanobanana-backend` (`Deployment` + `Service` on port `8000`)**:
   - Includes a `nanobanana-db-migrate` Kubernetes `initContainer` that runs `alembic upgrade head` against the externally provisioned PostgreSQL database before starting the application containers.
   - **Flask + SQLAlchemy** (`wsgi:app`) Interactive Prompt Co-Pilot, Google & Facebook OAuth verifier, conversation history service, and S3 bucket client (served by **Gunicorn**).
   - Connects outbound to the externally provisioned PostgreSQL database (`DATABASE_URL`) via SQLAlchemy 2.0 and external S3/RustFS bucket (`BUCKET_ENDPOINT_URL`, `BUCKET_ACCESS_KEY`, `BUCKET_SECRET_KEY`).
   - Enforces `REQUIRE_AUTH="true"` and the `zero_storage_api_key_guard` before-request hook (rejects any request carrying a Gemini API key with HTTP `400`).
2. **`nanobanana-frontend` (`Deployment` + `Service` on port `3000`)**:
   - Next.js 14 App Router UI (`PublicLanding` + `InteractiveStudio`) with `NEXT_PUBLIC_REQUIRE_AUTH="true"`.
   - Calls Google's **Nano Banana (`gemini-2.5-flash-image`)** API **directly from the user's browser** (`https://generativelanguage.googleapis.com`) using an API key held strictly in volatile browser RAM (`useState`).
3. **`nanobanana-nginx` / `nanobanana-gateway` (`Deployment` + `Service` on port `80`) & `nanobanana-ingress` (`Ingress`)**:
   - Routes `/api/*` to `nanobanana-backend:8000` and `/` to `nanobanana-frontend:3000`.
4. **`HorizontalPodAutoscaler` (`nanobanana-backend-hpa`, `nanobanana-frontend-hpa`)**:
   - Scales backend and frontend pods between `2` and `10` replicas based on 75% CPU utilization.

### Deploying to Kubernetes

```bash
# Single-file manifest:
kubectl apply -f infra/deployment.yaml

# Or via Kustomize:
kubectl apply -k infra/k8s/
```
