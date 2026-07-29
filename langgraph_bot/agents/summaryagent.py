from dotenv import load_dotenv

from langchain.agents import create_agent
from langgraph_bot.agentschema.stateschema import State
from langgraph_bot.models.generativemodel import summarymodel
from langgraph_bot.utils.prompts import SUMMARY_PROMPT
load_dotenv()

s_agent = create_agent(  # s refers to summary
    # Own model instance so that, when several Groq keys are configured, this agent
    # and the concurrently-running description agent don't share a per-minute budget.
    model=summarymodel,
    state_schema=State,
    system_prompt=SUMMARY_PROMPT,
    tools=[],
)


# # response = agent.invoke({"messages":text})
# # res = agent.invoke({"messages":text})
# # print(res)
