"""Compatibility entry point for the unified adapter-based ingestion runner."""

from backend.services.ingestion.runner import ADAPTERS, run_ingestion


def fetch_all_data():
    """Fetch normalized rows for older callers; persistence belongs to raw_repo."""
    from backend.db.repository.raw_repo import _to_row

    return [_to_row(item) for adapter in ADAPTERS for item in adapter.fetch()]


def run_fetch_and_store():
    return {"inserted": run_ingestion()}


if __name__ == "__main__":
    run_fetch_and_store()
