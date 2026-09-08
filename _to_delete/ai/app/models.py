"""Python's view of tables that Prisma owns.

These classes do NOT define the schema - schema.prisma does. They are a
read/write mapping onto tables that already exist, so this service can query
them. If a column here disagrees with Prisma, Prisma is right.

Note the naming: Prisma creates a table called "User" with camelCase columns,
so that is what we map. The Python attribute can be snake_case as long as the
column name in mapped_column() matches the database exactly.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    """A Buildora account. Created by the Express API, read by this one."""

    __tablename__ = "User"

    id: Mapped[str] = mapped_column("id", String, primary_key=True)
    email: Mapped[str] = mapped_column("email", String)
    name: Mapped[str] = mapped_column("name", String)
    plan: Mapped[str] = mapped_column("plan", String)
    approved: Mapped[bool] = mapped_column("approved", Boolean)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime(timezone=True))

    # The "learn by building" fields already in production - the seed of
    # everything this service is about to do.
    learn_tech: Mapped[str | None] = mapped_column("learnTech", String, nullable=True)
    learn_level: Mapped[str] = mapped_column("learnLevel", String)
    learn_streak: Mapped[int] = mapped_column("learnStreak", Integer)
