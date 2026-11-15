"""Generation entry point; never renders diagrams or runs providers at import time."""

import logging
import os
import sys

from dotenv import load_dotenv
from langgraph_bot.worker import drain_queue


def check_configuration():
    load_dotenv()
    required = ("SUPABASE_URL", "SUPABASE_KEY", "GROQ_API_KEY", "GOOGLE_API_KEY", "TAVILY_API_KEY")
    missing = [name for name in required if not os.getenv(name, "").strip()]
    if missing:
        raise RuntimeError("Missing worker configuration: " + ", ".join(missing))


def run_entire_flow() -> dict:
    check_configuration()
    from backend.db.repository.fetch_raw_data import fetch_pending_items, update_status
    from langgraph_bot.insert_bot_data import find_published_post, insert_cleaned_data
    from langgraph_bot.workflow.complete_workflow import mjorgraph
    return drain_queue(
        fetch=fetch_pending_items, transition=update_status, invoke=mjorgraph.invoke,
        publish=insert_cleaned_data, find_existing=find_published_post,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    summary = run_entire_flow()
    print(
        f"Run complete: {summary['succeeded']} generated/reconciled, "
        f"{summary['skipped']} skipped, {summary['failed']} failed, "
        f"{summary['released']} released (of {summary['total']} claimed)"
    )
    sys.exit(1 if summary["halted"] or summary["failed"] else 0)
