from agents.summaryagent import *
from agentschema.stateschema import State
from langchain_core.messages import BaseMessage,HumanMessage


def summary_agent_node(state:State):
    last_message =  f"""Make the summary using the data given below 
    content: 
    Here is the data to summarize = {state['data']} 
    Here is the default title = {state['title']}
    Here is the default topic = {state['topic']}
    
    Keep it professional and easy to understand, cover main important topics to understand it.
    Only give the summary in the response nothing else.
    """

    response =  agent.invoke({"messages":[HumanMessage(content=last_message)]})



    # If agent returns dict with messages then extract them
    if isinstance(response, dict) and "messages" in response:
        summary = response["messages"][-1].content
        return {"messages": response["messages"],"summary":summary}
    return {"messages":[response],"summary":summary}
