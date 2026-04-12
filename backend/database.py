from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Default to local SQLite if no Supabase/PostgreSQL URL is provided in .env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ecowatch.db")

# SQLite needs check_same_thread=False for FastAPI concurrency, Postgres doesn't
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get Db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
