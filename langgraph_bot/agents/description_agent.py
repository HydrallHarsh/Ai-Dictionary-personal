from dotenv import load_dotenv

load_dotenv()
import asyncio
from pprint import pprint as pp

from langchain.agents import create_agent

from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.models.generativemodel import groqmodel
from langgraph_bot.tools.tools import (
    arxiv_tool,
    pdfreader_tool,
    scraper_tool,
    tavily_search_tool,
)
from langgraph_bot.utils.prompts import DESCRIPTION_PROMPT

agent = create_agent(
    model=groqmodel,
    state_schema=State,
    system_prompt=DESCRIPTION_PROMPT,
    # tools=[arxiv_tool,tavily_search_tool,pdfreader_tool] #scraper_tool will be added soon for web scraping.
)
