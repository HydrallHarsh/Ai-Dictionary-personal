# from markdown import markdown
# from bs4 import BeautifulSoup
from agents.description_agent import agent
from workflow.description_workflow import g


inputs = {
    "messages": [],
}

final_state = g.invoke(inputs)


for msg in final_state:
    print("------------------------------------------")
    print(msg)
    print("------------------------------------------")
    # if msg == "arxiv_urls":
    #     print(final_state[msg][0]["abstract"])
    #     print()
    if msg == "tavily_search_result":
        i = 0
        for result in final_state[msg]["results"]:
            print(f"result {i}")
            i += 1
            print(result["content"])
            # print(result['url'])
            print()
    if msg == "description":
        print(
            "=================================================================================================================================="
        )
        print(final_state[msg])
        print(
            "=================================================================================================================================="
        )
        print()
