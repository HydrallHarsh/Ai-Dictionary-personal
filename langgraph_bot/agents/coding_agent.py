from dotenv import load_dotenv

load_dotenv()
import asyncio
from langgraph_bot.agentschema.stateschema import State
from langchain.agents import create_agent
from langgraph_bot.models.generativemodel import groqmodel
from pprint import pprint as pp
from langgraph_bot.tools.tools import python_executor
from langgraph_bot.utils.prompts import CODING_PROMPT


code_agent = create_agent(
    model=groqmodel,
    state_schema=State,
    system_prompt=CODING_PROMPT,
    tools=[python_executor],  # scraper_tool will be added soon for web scraping.
)
