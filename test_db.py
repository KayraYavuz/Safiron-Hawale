import os
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL')
print(f"Connecting to {db_url}")
engine = create_engine(db_url)
try:
    with engine.connect() as conn:
        print("Connected!")
except Exception as e:
    print(f"Failed: {e}")
