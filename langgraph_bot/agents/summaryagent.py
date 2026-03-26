from dotenv import load_dotenv

load_dotenv()
from pprint import pprint as pp

from langchain.agents import create_agent

from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.models.generativemodel import groqmodel
from langgraph_bot.tools.tools import title_tool
from langgraph_bot.utils.prompts import SUMMARY_PROMPT

s_agent = create_agent(  # s refers to summary
    model=groqmodel,
    state_schema=State,
    system_prompt=SUMMARY_PROMPT,
    tools=[title_tool],
)


# # response = agent.invoke({"messages":text})
# # res = agent.invoke({"messages":text})
# # print(res)
