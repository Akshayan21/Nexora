from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.database import build_engine, build_session_factory
from app.routes.campaigns import router as campaigns_router
from app.routes.health import router as health_router
from app.routes.leads import router as leads_router
from app.routes.mailboxes import router as mailboxes_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = build_engine(settings)
        app.state.engine = engine
        app.state.session_factory = build_session_factory(engine)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Outreach Control API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Workspace-ID"],
    )
    app.include_router(health_router, prefix="/api/v1")
    app.include_router(leads_router, prefix="/api/v1")
    app.include_router(campaigns_router, prefix="/api/v1")
    app.include_router(mailboxes_router, prefix="/api/v1")
    return app


app = create_app()
