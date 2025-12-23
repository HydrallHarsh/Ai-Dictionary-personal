from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI

from services.authentication.dbs import User, create_db_and_tables
from services.authentication.schema import UserCreate, UserRead, UserUpdate
from services.authentication.users import (
    auth_backend,
    current_active_user,
    fastapi_users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Not needed if you setup a migration system like Alembic
    await create_db_and_tables()
    yield


router = APIRouter()


# app = FastAPI(lifespan=lifespan)

router.include_router(
    fastapi_users.get_auth_router(auth_backend), prefix="/auth/cookie", tags=["auth"]
)
router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)


@router.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):  # noqa: B008 for now
    return {"message": f"Hello {user.email}!"}
