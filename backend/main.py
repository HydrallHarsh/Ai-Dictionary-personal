import os
import logging

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.authentication.auth import lifespan
from services.authentication.auth import router as auth_router
from services.bookmarks.router import router as bookmarks_router

logging.basicConfig(
    level=logging.INFO,
    format=(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s | %(filename)s:%(lineno)d"
    ),
)

logger = logging.getLogger(__name__)

load_dotenv()

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # only for dev-purposes , change in the production.
    allow_headers=["*"],  # same as above
)

app.include_router(auth_router)
app.include_router(bookmarks_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info", reload=True)
