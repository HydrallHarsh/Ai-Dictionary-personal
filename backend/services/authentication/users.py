import logging
import os
import uuid

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    CookieTransport,
    JWTStrategy,
)
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase

from services.authentication.dbs import User, get_user_db

logger = logging.getLogger(__name__)

# The secret that signs every login cookie and every reset/verify token.
#
# It used to be the literal string "SECRET". That is not a weak key, it is a
# published one: this repository is public, so anyone could mint a cookie for
# any account. The value now comes from the environment, and the app refuses to
# start without it unless it is explicitly running in development.
#
#     python -c "import secrets; print(secrets.token_urlsafe(48))"
#
# Rotating this signs everyone out, which is the intended cost of a leak.
_is_development = os.getenv("ENVIRONMENT", "development").lower() == "development"
SECRET = os.getenv("AUTH_SECRET")

if not SECRET:
    if not _is_development:
        raise RuntimeError(
            "AUTH_SECRET is not set. Generate one with "
            '`python -c "import secrets; print(secrets.token_urlsafe(48))"` '
            "and add it to the environment before starting in production."
        )
    # Kept only so a fresh clone runs without setup. Never used in production,
    # because the branch above raises first.
    SECRET = "development-only-secret"
    logger.warning(
        "AUTH_SECRET is not set; using a development-only secret. "
        "Set AUTH_SECRET before deploying."
    )


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user: User, request: Request | None = None):
        logger.info("User %s has registered.", user.id)

    # Password reset and verification have no delivery mechanism yet. Their
    # routes were removed rather than left printing secrets to the server log,
    # so there is nothing to implement here until an email sender exists.


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):  # noqa: B008
    """
    Provide a UserManager instance for dependency injection.

    Parameters:
        user_db (SQLAlchemyUserDatabase): The SQLAlchemy-backed user database used to
        construct the manager.

    Returns:
        user_manager (UserManager): A UserManager instance initialized with the given
        user_db, yielded for use as a FastAPI dependency.
    """
    yield UserManager(user_db)


cookie_transport = CookieTransport(
    cookie_max_age=3600, cookie_secure=True, cookie_samesite="none"
)


def get_jwt_strategy() -> JWTStrategy[models.UP, models.ID]:
    """
    Create a JWT strategy configured with the module SECRET
    and a 3600-second token lifetime.

    Returns:
        JWTStrategy[models.UP, models.ID]: JWT strategy instance that signs tokens with
        SECRET and sets tokens to expire after 3600 seconds.
    """
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
