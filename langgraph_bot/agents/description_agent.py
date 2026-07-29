from dotenv import load_dotenv

from langchain.agents import create_agent
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.models.generativemodel import descriptionmodel
from langgraph_bot.utils.prompts import DESCRIPTION_PROMPT
load_dotenv()

agent = create_agent(
    # See the note in summaryagent.py: separate instance = separate key when available.
    model=descriptionmodel,
    state_schema=State,
    system_prompt=DESCRIPTION_PROMPT,
)
