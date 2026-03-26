from langgraph_bot.agentschema.stateschema import State


def load_data(_state: State):
    ### write logic for the data coming from db.

    # async def load_data_node(state: State):
    # data = await async_fetch_from_db(state["post_id"])
    # return {"data": data}

    # use this example for better loading and prevent session timeout or session crash.

    # FOR PRODUCTHUNT API ONLY.
    node = {
        "id": "1044782",
        "name": "8bitcn/ui",
        "tagline": "8‑bit UI components that work in any framework",
        "createdAt": "2025-12-05T08:01:00Z",
        "votesCount": 403,
        "description": "A set of retro-designed, accessible components and a code distribution platform. Open Source. Open Code.",
        "reviewsCount": 1,
        "slug": "8bitcn-ui",
        "website": "https://www.producthunt.com/r/KMXWABRQLUE5JD?utm_campaign=producthunt-api&utm_medium=api-v2&utm_source=Application%3A+RecentAI+%28ID%3A+249620%29",
    }

    data = node["description"]
    topic = node["name"]
    title = node["tagline"]
    return {"data": data, "title": title, "topic": topic}
