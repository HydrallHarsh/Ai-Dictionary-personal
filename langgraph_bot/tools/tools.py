from dotenv import load_dotenv

load_dotenv()
import os
import subprocess
import tempfile
from typing import Dict, List

import requests

# from langchain.messages import ToolMessage
from langchain.tools import tool
from langchain_community.document_loaders import (
    ArxivLoader,
    FireCrawlLoader,
    UnstructuredPDFLoader,
)
from langchain_tavily import TavilySearch
from langgraph.types import Command
from langgraph_bot.models.generativemodel import groqmodel
from langgraph_bot.utils.prompts import TITLE_PROMPT


## SUMMMARY AGENT TOOLS
@tool
def title_tool(posttitle: str, postdata: str):
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
    final_prompt = TITLE_PROMPT.format(postdata=postdata, posttitle=posttitle)
    response = groqmodel.invoke(final_prompt)
    return response.content.strip()


## DESCRIPTION AGENT TOOLS


tavily_search_tool = TavilySearch(
    max_results=5,
    topic="general",
    search_depth="advanced",
    # include_answer=False,
    # include_raw_content=False,
    # include_images=False,
    # include_image_descriptions=False,
    # time_range="day",
    # include_domains=None,
    # exclude_domains=None,
    # country=None
    # include_favicon=False
    # include_usage=False
)


# @tool
# def pdfreader_tool(list:List[Dict]):
#     """
#     NAME : PDFREADER_TOOL
#     WORK : It is used to read from the pdfs. it loads the data from the pdfs and you can read from it for better understanding.
#            it will be mostly used to read some newly published articals or the existing ones from gathering necessory infromation for post generation.

#     """
#     all_docs = []

#     for values in list:
#         pdf_url = values.get("pdf_url")
#         if "/abs/" in pdf_url:
#             pdf_url = pdf_url.replace("/abs/", "/pdf/") + ".pdf"

#         response = requests.get(pdf_url)

#         with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
#             f.write(response.content)
#             pdf_path = f.name

#         loader = UnstructuredPDFLoader(pdf_path)
#         docs = loader.load()
#         all_docs.extend(docs)


#     return all_docs
@tool
def pdfreader_tool(pdf_list: List[Dict]) -> List:
    """
    NAME : PDFREADER_TOOL
    WORK : It is used to read from the pdfs. it loads the data from the pdfs and you can read from it for better understanding.
           it will be mostly used to read some newly published articals or the existing ones from gathering necessory infromation for post generation.
    """
    all_docs = []

    for values in pdf_list:
        pdf_url = values.get("pdf_url")
        if not pdf_url:
            continue
        if "/abs/" in pdf_url:
            pdf_url = pdf_url.replace("/abs/", "/pdf/") + ".pdf"

        pdf_path = None
        try:
            response = requests.get(pdf_url, timeout=30)
            response.raise_for_status()

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
                f.write(response.content)
                pdf_path = f.name

            loader = UnstructuredPDFLoader(pdf_path)
            docs = loader.load()
            all_docs.extend(docs)
        except (requests.RequestException, Exception) as e:
            # Log error or handle gracefully - skip this PDF and continue
            pass
        finally:
            if pdf_path and os.path.exists(pdf_path):
                os.remove(pdf_path)

    return all_docs


@tool
def arxiv_tool(query: str) -> List[Dict]:
    """
    NAME : ARXIV_TOOL
    WORK : It is used to fetch the pdfs from the arxiv platform. it will be userful to load the pdfs from the arxiv website.
            the newly published researches will be found using this tool.to find new topics  or if some topic require prior konwledge which llm or agent doesn't have
            and it's research paper if available you can make a query or search to find those document and read from it to understand and generate better understanding post.
            so the new person in ai domain can understand better.
    """
    loader = ArxivLoader(
        query=query,
        doc_content_chars_max=None,
        sort_by="relevance",
    )

    docs = loader.load()
    papers = []
    for d in docs:
        papers.append(
            {
                "title": d.metadata.get("title"),
                "authors": d.metadata.get("authors"),
                "published": d.metadata.get("published"),
                "abstract": d.page_content,
                "pdf_url": d.metadata.get("source"),
            }
        )

    return papers


@tool
def scraper_tool(
    url,
) -> List:  # for static html rich content scrapping or page loading.
    """
    NAME : SCAPER_TOOL
    WORK : It is used to scarp from the web.
           it scrapes data from the websites like W3Schools,medium,geeksforgeeks blogs,producthunt blogs,deepmind blogs,openai blogs,antropic blogs,TechCrunch etc.
           you scrap the data build the knowledge fully by reading from it and generate meaningfull technical understadable blog/post.
    """
    if not url:
        url = "https://techcrunch.com/latest/"
    loader = FireCrawlLoader(url=url, mode="crawl")
    pages = []
    for doc in loader.lazy_load():
        pages.append(doc)

    return pages


# CODING AGENT TOOLS
@tool
def python_executor(code: str) -> Dict:
    """
    Securely execute Python code and return structured output.
    """
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        file_path = f.name

    try:
        process = subprocess.run(
            ["python", file_path], capture_output=True, text=True, timeout=8
        )

        return {
            "success": process.returncode == 0,
            "stdout": process.stdout.strip(),
            "stderr": process.stderr.strip(),
            "exit_code": process.returncode,
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Execution timed out",
            "exit_code": -1,
        }

    finally:
        os.remove(file_path)
