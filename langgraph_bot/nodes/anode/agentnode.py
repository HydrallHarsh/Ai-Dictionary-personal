import logging

from langchain_core.messages import AIMessage, HumanMessage

from langgraph_bot.agents.description_agent import agent
from langgraph_bot.agents.summaryagent import s_agent
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.utils.errors import is_deterministic_provider_error, raise_provider_error

logger = logging.getLogger(__name__)

# The description agent gets the article body when we have it. Bodies can be very
# long (a full lab blog post or a paper abstract page); truncate so one item can't
# blow the context window or the token budget.
# needs to be tuned and tested more here, so we dont miss critical context pieces
MAX_SOURCE_CHARS = 12000


def summary_agent_node(state: State):
    last_message = f"""Make the summary using the data given below
    content:
    Here is the data to summarize = {state["data"]}
    Here is the default title = {state["title"]}
    Here is the default topic = {state["topic"]}
    """
    response = s_agent.invoke({"messages": [HumanMessage(content=last_message)]})

    if isinstance(response, dict) and "messages" in response:
        messages = response["messages"]
        if not messages:
            raise RuntimeError("summary agent returned an empty messages list")
        return {"messages": messages, "summary": messages[-1].content}

    summary = response.content if hasattr(response, "content") else str(response)
    return {"messages": [response], "summary": summary}


def _primary_source(state: State) -> str:
    """Return the best article text available.

    ``content`` is the persisted article body. It is richer than ``data``, which is
    normally only the feed blurb, but is truncated to protect the context budget.
    """
    body = state.get("content")
    if body:
        return body[:MAX_SOURCE_CHARS]
    return state.get("data") or ""


def description_agent_node(state: State):
    source_url = state.get("source_url") or "unknown"
    last_message = f"""
    Generate a comprehensive technical description using the following information:

    Source article ({source_url}):
    {_primary_source(state)}

    Additional context from a web search:
    {state.get("tavily_search_result")}

    The source article is the primary material - the search results are supporting
    context only. Provide a detailed, well-structured description.
    """

    try:
        response = agent.invoke({"messages": [HumanMessage(content=last_message)]})

        if isinstance(response, dict) and "messages" in response:
            messages = response["messages"]
            if not messages:
                logger.error("description agent returned an empty messages list")
                return {}

            description = messages[-1].content
            if not isinstance(description, str) or not description.strip():
                logger.error("description agent returned empty message content")
                return {}

            return {
                "messages": messages,
                "description": description,
            }

        if response is not None:
            description = (
                response.content if hasattr(response, "content") else str(response)
            )
            if not isinstance(description, str) or not description.strip():
                logger.error("description agent returned empty content")
                return {}
            return {"messages": [response], "description": description}

        logger.error("description agent returned no response")
        return {}
    except Exception as error:
        if is_deterministic_provider_error(error):
            raise_provider_error(error, "Description input exceeds provider limits")
        logger.exception("description agent invocation failed")
        return {
            "messages": [
                AIMessage(
                    content=f"the agent can not perform this action due to error {error}"
                )
            ],
        }
