"""Where the data lives.

One database, two services. The Express API owns the schema through Prisma;
this service only reads and writes rows. Nothing in here creates a table - a
new table goes in schema.prisma and Prisma migrates it. Two services running
DDL against one database is how a schema quietly goes wrong.
"""

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

# Square brackets, not .get(): if DATABASE_URL is missing the service refuses
# to start, loudly, at boot - rather than starting fine and failing on the
# first request in front of a user.
DATABASE_URL = os.environ["DATABASE_URL"]

# Supabase hands out "postgresql://..." but SQLAlchemy needs to be told which
# driver to use, or it reaches for psycopg2, which isn't installed.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+psycopg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# pool_pre_ping: Supabase closes idle connections. Without this, the first
# query after a quiet period dies on a stale connection. With it, SQLAlchemy
# checks the connection is alive and quietly replaces it if not.
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=5)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Parent class for the models that mirror Prisma's tables."""


def get_db() -> Generator[Session, None, None]:
    """Hand one database session to one request, then close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
