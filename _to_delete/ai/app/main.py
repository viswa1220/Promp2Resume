"""The Buildora AI service.

A second service beside the Express API, sharing one Supabase Postgres.
Express owns auth, users and resumes; this owns the AI half - profile
extraction, embeddings and matching.

This file stays small on purpose: build the app, plug in the routers.
"""

from fastapi import Depends, FastAPI
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.database import get_db

app = FastAPI(title="Buildora AI service")


@app.get("/health")
def health() -> dict[str, str]:
    """Is the service alive? No database needed to answer."""
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, object]:
    """Is the database reachable, and how many accounts are in it?

    Worth having separately from /health: a service can be perfectly alive
    while its database is unreachable, and you want to be able to tell those
    two situations apart at 2am.
    """
    users = db.scalar(select(func.count()).select_from(models.User))
    return {"status": "ok", "users": users}
