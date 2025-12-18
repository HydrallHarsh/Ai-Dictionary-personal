load_dotenv()
from agentschema.stateschema import State
from dotenv import load_dotenv
from typing import Optional
from models.generativemodel import groqmodel
from utils.prompts import TITLE_PROMPT
from langchain.tools import  tool,ToolRuntime
from langchain.messages import ToolMessage
from langgraph.types import Command


@tool
def title_tool(posttitle:str,postdata:str):
    """
    name :title_tool
    work : generates title from the given data, or the existing title.
    
    - if no title is given then generate the title around 5 words
    - if the length of  the original title exceeds 8 words or doesn't contain minimum 4 words.
    -      for large title more than 8
    -        make it to nearly 8 or 7 with professional flow
    -      for small title less than 4 
    -        make it large to around 7 words with professional flow

    after doing all the process return only new title in string format.without anything extra.
    """
    final_prompt = TITLE_PROMPT.format(postdata = postdata,posttitle=posttitle )
    response = groqmodel.invoke(final_prompt)
    return response.content.strip()
