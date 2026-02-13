import logging
import uuid
import copy
import time
import base64
import os
from typing import List, Optional, Dict, Any
from ..domain.models import Store, StoreStatus, StoreType, AdminCredentials, AuditEvent, AuditAction
from ..domain.ports import StoreRepository
from ..adapters.k8s_adapter import K8sAdapter
from ..adapters.helm_adapter import HelmAdapter

logger = logging.getLogger(__name__)

class StoreService:
    def __init__(self, repo: StoreRepository, k8s: K8sAdapter, helm: HelmAdapter):
        self.repo = repo
        self.k8s = k8s
        self.helm = helm

    def create_store(self, name: str, store_type: StoreType) -> Store:
        max_stores = int(os.getenv("MAX_STORES", "20"))
        if len(self.repo.list()) >= max_stores:
            raise ValueError("Store limit reached")
        normalized_name = name.strip().lower()
        existing = self.repo.get_by_name(normalized_name)
        if existing:
            raise ValueError(f"Store with name '{normalized_name}' already exists")
        store = Store(
            name=normalized_name,
            type=store_type,
            namespace=f"store-{normalized_name}-{str(uuid.uuid4())[:8]}", # robust naming
            status=StoreStatus.PROVISIONING
        )
        self.repo.save(store)
        self.repo.add_audit_event(AuditEvent(
            store_id=store.id,
            store_name=store.name,
            action=AuditAction.STORE_CREATED
        ))
        return store

    def provision_store_task(self, store_id: str, env: str = "local"):
        logger.info(f"Starting provisioning for store {store_id}")
        store = self.repo.get(store_id)
        if not store:
            logger.error(f"Store {store_id} not found during provisioning")
            return

        max_attempts = 2
        last_error: Optional[Exception] = None

        for attempt in range(1, max_attempts + 1):
            try:
                # 1. Create Namespace
                self.k8s.create_namespace(store.namespace)

                # 2. Prepare Helm Values
                chart_path = f"charts/{store.type.value}" # e.g., charts/woocommerce
                
                # Load global env values
                # In a real app, we'd load these from the file system properly
                import yaml
                try:
                    with open(f"config/values-{env}.yaml", "r") as f:
                        global_values = yaml.safe_load(f) or {}
                except FileNotFoundError:
                    global_values = {}
                    logger.warning(f"Could not load values-{env}.yaml")

                # Store specific values
                host_suffix = global_values.get('ingress', {}).get('hostSuffix', '.127.0.0.1.nip.io')
                ingress_host = f"{store.namespace}{host_suffix}"
                
                store_values = {
                    "ingress": {
                        "enabled": True,
                        "host": ingress_host
                    },
                    "storeName": store.name
                }

                if store.type == StoreType.MEDUSA:
                    store_values["ingress"]["apiHost"] = f"api-{store.namespace}{host_suffix}"

                merged_values = self._deep_merge(copy.deepcopy(global_values), store_values)
                
                # 3. Install Chart
                self.helm.install_or_upgrade(
                    release_name=store.name,
                    chart_path=chart_path,
                    namespace=store.namespace,
                    values=merged_values
                )

                # 4. Update Status
                store.status = StoreStatus.READY
                store.url = f"http://{ingress_host}" 
                self.repo.save(store)
                self.repo.add_audit_event(AuditEvent(
                    store_id=store.id,
                    store_name=store.name,
                    action=AuditAction.PROVISION_READY
                ))
                logger.info(f"Provisioning complete for {store.name}")
                return

            except Exception as e:
                last_error = e
                logger.error(f"Provisioning failed for {store.name} (attempt {attempt}/{max_attempts}): {e}")
                self._cleanup_failed_provisioning(store)

                if attempt < max_attempts:
                    time.sleep(5)

        logger.error(f"Provisioning failed permanently for {store.name}: {last_error}")
        store.status = StoreStatus.FAILED
        self.repo.save(store)
        self.repo.add_audit_event(AuditEvent(
            store_id=store.id,
            store_name=store.name,
            action=AuditAction.PROVISION_FAILED,
            message=str(last_error) if last_error else None
        ))

    def _deep_merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(base.get(key), dict):
                base[key] = self._deep_merge(base[key], value)
            else:
                base[key] = value
        return base

    def _cleanup_failed_provisioning(self, store: Store) -> None:
        try:
            self.helm.uninstall(store.name, store.namespace)
        except Exception as e:
            logger.warning(f"Cleanup: helm uninstall failed for {store.name}: {e}")
        try:
            self.k8s.delete_namespace(store.namespace)
        except Exception as e:
            logger.warning(f"Cleanup: namespace delete failed for {store.namespace}: {e}")

    def get_store(self, store_id: str) -> Optional[Store]:
        return self.repo.get(store_id)

    def get_admin_credentials(self, store_id: str) -> AdminCredentials:
        store = self.repo.get(store_id)
        if not store:
            raise ValueError("Store not found")
        if store.type != StoreType.WOOCOMMERCE:
            raise ValueError("Admin credentials are only available for WooCommerce stores")

        secret_names = self.k8s.list_secret_names(
            namespace=store.namespace,
            label_selector=f"app.kubernetes.io/instance={store.name}"
        )
        secret_name = next((name for name in secret_names if name.endswith("-secret")), None)
        if not secret_name:
            raise ValueError("Admin credentials secret not found")

        data = self.k8s.get_secret_data(store.namespace, secret_name)

        def decode(key: str) -> str:
            value = data.get(key)
            if not value:
                return ""
            return base64.b64decode(value).decode("utf-8")

        store_url = store.url or ""
        admin_url = f"{store_url}/wp-admin" if store_url else ""

        return AdminCredentials(
            store_url=store_url,
            admin_url=admin_url,
            admin_user=decode("wp-admin-user"),
            admin_password=decode("wp-admin-password"),
            admin_email=decode("wp-admin-email")
        )

    def list_stores(self) -> List[Store]:
        return self.repo.list()

    def delete_store(self, store_id: str):
        store = self.repo.get(store_id)
        if not store:
            return
        
        store.status = StoreStatus.DELETING
        self.repo.save(store)
        
        try:
            # Uninstall
            self.helm.uninstall(store.name, store.namespace)
            self.k8s.delete_namespace(store.namespace)
            self.repo.delete(store_id)
            self.repo.add_audit_event(AuditEvent(
                store_id=store.id,
                store_name=store.name,
                action=AuditAction.STORE_DELETED
            ))
        except Exception as e:
            logger.error(f"Deletion failed for {store.name}: {e}")
            # Keep it in deleting state or mark failed? 
            # Ideally retry. For now, log.

    def list_audit_events(self, limit: int = 50) -> List[AuditEvent]:
        return self.repo.list_audit_events(limit)
