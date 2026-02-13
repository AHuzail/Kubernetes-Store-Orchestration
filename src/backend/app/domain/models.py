from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid

class StoreType(str, Enum):
    WOOCOMMERCE = "woocommerce"
    MEDUSA = "medusa"

class StoreStatus(str, Enum):
    PROVISIONING = "PROVISIONING"
    READY = "READY"
    FAILED = "FAILED"
    DELETING = "DELETING"

class AuditAction(str, Enum):
    STORE_CREATED = "STORE_CREATED"
    STORE_DELETED = "STORE_DELETED"
    PROVISION_READY = "PROVISION_READY"
    PROVISION_FAILED = "PROVISION_FAILED"

class Store(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: StoreType
    status: StoreStatus = StoreStatus.PROVISIONING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    url: Optional[str] = None
    namespace: str

class CreateStoreRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, pattern="^[a-z0-9-]+$")
    type: StoreType

class AdminCredentials(BaseModel):
    store_url: str
    admin_url: str
    admin_user: str
    admin_password: str
    admin_email: str

class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: Optional[str] = None
    store_name: Optional[str] = None
    action: AuditAction
    message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
