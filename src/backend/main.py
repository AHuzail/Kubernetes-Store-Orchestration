from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .app.api.endpoints import router
from .app.db import Base, engine

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Store Orchestrator", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/health")
def health_check():
    return {"status": "ok"}
