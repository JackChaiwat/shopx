import logging
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from starlette.middleware.sessions import SessionMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppException
from app.db.session import engine
from app.core.logging import configure_logging
from app.websocket.manager import connection_manager

configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    logger.info("Starting application", version=settings.APP_VERSION, env=settings.APP_ENV)

    # Initialize Prometheus multiprocess dir
    import os
    os.makedirs(settings.PROMETHEUS_MULTIPROC_DIR, exist_ok=True)

    # Test DB connection
    from app.db.session import check_db_connection
    await check_db_connection()
    logger.info("Database connection verified")

    # Test Redis connection
    from app.core.cache import check_redis_connection
    await check_redis_connection()
    logger.info("Redis connection verified")

    # Initialize MinIO buckets
    from app.services.storage import storage_service
    await storage_service.initialize_buckets()
    logger.info("Storage buckets initialized")

    yield

    # Shutdown
    await engine.dispose()
    logger.info("Application shutdown complete")


def create_app() -> FastAPI:
    is_prod = settings.APP_ENV == "production"
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="E-Commerce Marketplace API",
        openapi_url=None if is_prod else "/api/v1/openapi.json",
        docs_url=None if is_prod else "/api/v1/docs",
        redoc_url=None if is_prod else "/api/v1/redoc",
        lifespan=lifespan,
    )

    # ── Middleware (order matters) ──────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(SessionMiddleware, secret_key=settings.APP_SECRET_KEY)

    # ── Request ID + timing middleware ──────────────────────
    @app.middleware("http")
    async def request_middleware(request: Request, call_next):
        import uuid
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.time()

        response = await call_next(request)

        duration = time.time() - start
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(round(duration * 1000, 2))
        return response

    # ── Exception handlers ──────────────────────────────────
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception", exc_info=exc, path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "details": None,
                },
            },
        )

    # ── Routes ──────────────────────────────────────────────
    app.include_router(api_router, prefix="/api/v1")

    # WebSocket endpoint
    from app.websocket.router import ws_router
    app.include_router(ws_router, prefix="/ws")

    # ── Health check ─────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
        }

    @app.get("/health/ready", tags=["Health"])
    async def readiness_check():
        from app.db.session import check_db_connection
        from app.core.cache import check_redis_connection
        try:
            await check_db_connection()
            await check_redis_connection()
            return {"status": "ready"}
        except Exception as e:
            return JSONResponse(status_code=503, content={"status": "not ready", "error": str(e)})

    # ── Prometheus ───────────────────────────────────────────
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

    return app


app = create_app()
