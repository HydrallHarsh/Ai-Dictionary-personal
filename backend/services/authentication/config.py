"""Account database configuration, independent of the public Supabase database."""

import os

from sqlalchemy.engine import URL, make_url


def account_database_url() -> URL:
    configured = os.getenv("DATABASE_URL")
    if configured:
        try:
            url = make_url(configured)
            if url.drivername not in {"postgres", "postgresql", "postgresql+asyncpg"}:
                raise ValueError("unsupported database driver")
            if not url.host or not url.database or not url.username:
                raise ValueError("missing connection fields")
            url = url.set(drivername="postgresql+asyncpg")
            if "sslmode" in url.query:
                ssl = url.query["sslmode"]
                url = url.difference_update_query(["sslmode"]).update_query_dict(
                    {"ssl": ssl}
                )
        except Exception:
            raise ValueError(
                "DATABASE_URL must be a valid PostgreSQL URL with host, user, and database."
            ) from None
        certificate_options = {"sslrootcert", "sslcert", "sslkey", "sslcrl"}
        unsupported = sorted(certificate_options.intersection(url.query))
        if unsupported:
            raise ValueError(
                "DATABASE_URL certificate options are not supported by asyncpg: "
                + ", ".join(unsupported)
                + ". Remove them; custom certificates require an SSL context in connect_args."
            )
        return url

    password = os.getenv("DB_PASSWORD")
    if not password:
        raise ValueError("Set DATABASE_URL or DB_PASSWORD for the account database.")
    try:
        port = int(os.getenv("DB_PORT", "5432"))
        if not 1 <= port <= 65535:
            raise ValueError
    except ValueError:
        raise ValueError("DB_PORT must be between 1 and 65535.") from None
    return URL.create(
        "postgresql+asyncpg",
        username=os.getenv("DB_USER", "postgres"),
        password=password,
        host=os.getenv("DB_HOST", "localhost"),
        port=port,
        database=os.getenv("DB_NAME", "postgres"),
    )
