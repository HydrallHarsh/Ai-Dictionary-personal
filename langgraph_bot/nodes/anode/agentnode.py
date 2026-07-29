from langchain_core.messages import AIMessage, HumanMessage
from langgraph_bot.agents.description_agent import agent
from langgraph_bot.agents.summaryagent import s_agent
from langgraph_bot.agentschema.stateschema import State

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

    # If agent returns dict with messages then extract them
    if isinstance(response, dict) and "messages" in response:
        summary = response["messages"][-1].content
        return {"messages": response["messages"], "summary": summary}
    summary = response.content if hasattr(response, "content") else str(response)
    return {"messages": [response], "summary": summary}


def _primary_source(state: State) -> str:
    """The best article text we have, in order of quality.

    `content` is the real article body (RSS content:encoded, persisted to
    `raw_api_data.content` by the ingestion layer). When present it is far richer
    than `data`, which is just the feed blurb. Preferring it explicitly is what stops
    a post from being written off a two-line summary — the agent used to only *hope*
    it would call a scraper tool.
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

    The source article is the primary material — the search results are supporting
    context only. Provide a detailed, well-structured description.
    """

    try:
        response = agent.invoke({"messages": [HumanMessage(content=last_message)]})
        if isinstance(response, dict) and "messages" in response:
            return {
                "messages": response["messages"],
                "description": response["messages"][-1].content,
            }
        if response is not None:
            description = (
                response.content if hasattr(response, "content") else str(response)
            )
            return {"messages": [response], "description": description}
        # Returning None from a node is an error in LangGraph; return an empty update
        # and let the caller notice `description` is missing.
        return {}
    except Exception as e:
        return {
            "messages": [
                AIMessage(
                    content=f"the agent can not perform this action due to error {e}"
                )
            ],
        }
