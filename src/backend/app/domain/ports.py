from abc import ABC, abstractmethod
from typing import List, Optional
from .models import Store, AuditEvent

class StoreRepository(ABC):
    @abstractmethod
    def save(self, store: Store) -> Store:
        pass

    @abstractmethod
    def get(self, store_id: str) -> Optional[Store]:
        pass

    @abstractmethod
    def get_by_name(self, name: str) -> Optional[Store]:
        pass

    @abstractmethod
    def list(self) -> List[Store]:
        pass

    @abstractmethod
    def delete(self, store_id: str) -> None:
        pass

    @abstractmethod
    def add_audit_event(self, event: AuditEvent) -> AuditEvent:
        pass

    @abstractmethod
    def list_audit_events(self, limit: int = 50) -> List[AuditEvent]:
        pass

class Provisioner(ABC):
    @abstractmethod
    def provision(self, store: Store) -> None:
        pass

    @abstractmethod
    def deprovision(self, store: Store) -> None:
        pass
    
    @abstractmethod
    def get_status(self, store: Store) -> str:
        pass
