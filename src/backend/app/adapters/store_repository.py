from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.orm import Session
from ..domain.models import Store, StoreType, StoreStatus, AuditEvent, AuditAction
from ..domain.ports import StoreRepository
from ..db import Base, engine
from typing import List, Optional
import datetime

class StoreModel(Base):
    __tablename__ = "stores"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(Enum(StoreType))
    status = Column(Enum(StoreStatus))
    created_at = Column(DateTime)
    url = Column(String, nullable=True)
    namespace = Column(String)

    def to_domain(self) -> Store:
        return Store(
            id=self.id,
            name=self.name,
            type=self.type,
            status=self.status,
            created_at=self.created_at,
            url=self.url,
            namespace=self.namespace
        )

    @staticmethod
    def from_domain(store: Store) -> "StoreModel":
        return StoreModel(
            id=store.id,
            name=store.name,
            type=store.type,
            status=store.status,
            created_at=store.created_at,
            url=store.url,
            namespace=store.namespace
        )

class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    store_id = Column(String, nullable=True, index=True)
    store_name = Column(String, nullable=True, index=True)
    action = Column(Enum(AuditAction))
    message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    def to_domain(self) -> AuditEvent:
        return AuditEvent(
            id=self.id,
            store_id=self.store_id,
            store_name=self.store_name,
            action=self.action,
            message=self.message,
            created_at=self.created_at
        )

    @staticmethod
    def from_domain(event: AuditEvent) -> "AuditEventModel":
        return AuditEventModel(
            id=event.id,
            store_id=event.store_id,
            store_name=event.store_name,
            action=event.action,
            message=event.message,
            created_at=event.created_at
        )

# Create tables
Base.metadata.create_all(bind=engine)

class SqlAlchemyStoreRepository(StoreRepository):
    def __init__(self, db: Session):
        self.db = db

    def save(self, store: Store) -> Store:
        db_store = self.db.query(StoreModel).filter(StoreModel.id == store.id).first()
        if db_store:
            # update
            db_store.status = store.status
            db_store.url = store.url
            # other fields if mutable
        else:
            db_store = StoreModel.from_domain(store)
            self.db.add(db_store)
        
        self.db.commit()
        self.db.refresh(db_store)
        return db_store.to_domain()

    def get(self, store_id: str) -> Optional[Store]:
        db_store = self.db.query(StoreModel).filter(StoreModel.id == store_id).first()
        if db_store:
            return db_store.to_domain()
        return None

    def get_by_name(self, name: str) -> Optional[Store]:
        db_store = self.db.query(StoreModel).filter(StoreModel.name == name).first()
        if db_store:
            return db_store.to_domain()
        return None

    def list(self) -> List[Store]:
        db_stores = self.db.query(StoreModel).all()
        return [s.to_domain() for s in db_stores]

    def delete(self, store_id: str) -> None:
        db_store = self.db.query(StoreModel).filter(StoreModel.id == store_id).first()
        if db_store:
            self.db.delete(db_store)
            self.db.commit()

    def add_audit_event(self, event: AuditEvent) -> AuditEvent:
        db_event = AuditEventModel.from_domain(event)
        self.db.add(db_event)
        self.db.commit()
        self.db.refresh(db_event)
        return db_event.to_domain()

    def list_audit_events(self, limit: int = 50) -> List[AuditEvent]:
        events = (
            self.db.query(AuditEventModel)
            .order_by(AuditEventModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [event.to_domain() for event in events]
