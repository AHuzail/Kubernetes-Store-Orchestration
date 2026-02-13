from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Dict
import os
import time

from ..domain.models import Store, CreateStoreRequest, AdminCredentials, AuditEvent
from ..db import get_db
from ..adapters.store_repository import SqlAlchemyStoreRepository
from ..adapters.k8s_adapter import K8sAdapter
from ..adapters.helm_adapter import HelmAdapter
from ..service.store_service import StoreService

router = APIRouter()

_rate_limit_state: Dict[str, List[float]] = {}

def _check_rate_limit(request: Request) -> None:
    max_requests = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "5"))
    window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    client_ip = request.client.host if request.client else "unknown"

    now = time.time()
    window_start = now - window_seconds
    timestamps = [t for t in _rate_limit_state.get(client_ip, []) if t >= window_start]
    if len(timestamps) >= max_requests:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    timestamps.append(now)
    _rate_limit_state[client_ip] = timestamps

# Dependency Injection
def get_service(db: Session = Depends(get_db)) -> StoreService:
    repo = SqlAlchemyStoreRepository(db)
    k8s = K8sAdapter()
    helm = HelmAdapter()
    return StoreService(repo, k8s, helm)

@router.post("/stores", response_model=Store, status_code=202)
def create_store(
    request: CreateStoreRequest, 
    http_request: Request,
    background_tasks: BackgroundTasks,
    service: StoreService = Depends(get_service)
):
    _check_rate_limit(http_request)
    try:
        store = service.create_store(request.name, request.type)
    except ValueError as exc:
        status_code = 409 if "already exists" in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc))
    # Trigger async provisioning
    background_tasks.add_task(service.provision_store_task, store.id, "local") # default to local for now
    return store

@router.get("/stores", response_model=List[Store])
def list_stores(service: StoreService = Depends(get_service)):
    return service.list_stores()

@router.get("/stores/{store_id}", response_model=Store)
def get_store(store_id: str, service: StoreService = Depends(get_service)):
    store = service.get_store(store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store

@router.delete("/stores/{store_id}", status_code=204)
def delete_store(
    store_id: str, 
    background_tasks: BackgroundTasks, # In case deletion is heavy, though currently synchronous in service
    service: StoreService = Depends(get_service)
):
    # Ideally async too
    service.delete_store(store_id)
    return None

@router.get("/stores/{store_id}/admin-credentials", response_model=AdminCredentials)
def get_admin_credentials(store_id: str, service: StoreService = Depends(get_service)):
    if os.getenv("ALLOW_ADMIN_CREDS", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="Admin credentials endpoint is disabled")
    try:
        return service.get_admin_credentials(store_id)
    except ValueError as exc:
        status_code = 404 if str(exc) == "Store not found" else 400
        raise HTTPException(status_code=status_code, detail=str(exc))

@router.get("/audit-events", response_model=List[AuditEvent])
def list_audit_events(limit: int = 50, service: StoreService = Depends(get_service)):
    return service.list_audit_events(limit)
