import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from config import get_settings
from database import engine, Base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)-22s │ %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
logging.getLogger("theos.deepsearch").setLevel(logging.DEBUG)
logging.getLogger("theos.router").setLevel(logging.DEBUG)

import shared.models  # noqa: F401
import adam.models  # noqa: F401
import theos.models  # noqa: F401
import mercury.models  # noqa: F401
import knowledge.models  # noqa: F401
import chat.models  # noqa: F401
import notifications.models  # noqa: F401

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        try:
            await conn.execute(text("SELECT 1"))
            print("[startup] Database connection verified")
        except Exception as e:
            print(f"[startup] Database connection failed: {e}")
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            print("[startup] pgvector extension enabled")
        except Exception:
            print("[startup] pgvector extension already exists or cannot be created")
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Agnostos API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from auth.router import router as auth_router
from adam.router import router as adam_router
from theos.router import router as theos_router
from mercury.router import router as mercury_router
from analytics.router import router as analytics_router
from knowledge.router import router as knowledge_router
from chat.router import router as chat_router
from notifications.router import router as notifications_router
from settings.router import router as settings_router

app.include_router(auth_router)
app.include_router(adam_router)
app.include_router(theos_router)
app.include_router(mercury_router)
app.include_router(analytics_router)
app.include_router(knowledge_router)
app.include_router(chat_router)
app.include_router(notifications_router)
app.include_router(settings_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "agnostos"}


@app.get("/api/health/db")
async def health_db():
    from database import async_session
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}
