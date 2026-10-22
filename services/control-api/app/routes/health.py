from fastapi import APIRouter, Request, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live():
    return {"status": "ok"}


@router.get("/health/ready")
def ready(request: Request, response: Response):
    try:
        with request.app.state.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if revision != "0003_campaign_details":
                response.status_code = 503
                return {"status": "not_ready"}
    except SQLAlchemyError:
        response.status_code = 503
        return {"status": "not_ready"}
    return {"status": "ok"}
