import os
from database import SQLALCHEMY_DATABASE_URL, engine

print("SQLALCHEMY_DATABASE_URL:", SQLALCHEMY_DATABASE_URL)
print("Engine Dialect:", engine.dialect.name)
