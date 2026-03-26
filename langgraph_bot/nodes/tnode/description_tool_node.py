from langchain_core.messages import ToolMessage
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.tools.tools import arxiv_tool, pdfreader_tool, tavily_search_tool


def arxiv_node(state: State):
    papers = arxiv_tool.invoke(state["title"])

    return {
        "arxiv_urls": papers,  # directly into state
    }


def tavily_node(state: State):
    result = tavily_search_tool.invoke({"query": state["title"]})

    return {"tavily_search_result": result}


def pdf_parsing_node(state: State):
    # Safety check
    papers = state.get("arxiv_urls")
    if not papers:
        return {}

    papers_to_read = papers[:4]  # using top 4 pdfs only

    docs = pdfreader_tool.invoke({"pdf_list": papers_to_read})

    return {"documents": docs}
