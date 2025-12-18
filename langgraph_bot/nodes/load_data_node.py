from agentschema.stateschema import State


def load_data(state:State):
    ### write logic for the data coming from db.

    # async def load_data_node(state: State):
    # data = await async_fetch_from_db(state["post_id"])
    # return {"data": data}

    # use this example for better loading and prevent session timeout or session crash.

    # FOR PRODUCTHUNT API ONLY.
    node = {
        "id": "1042085",
        "name": "Qoder JetBrains Plugin",
        "tagline": "Understands your backend's real complexity, not just syntax",
        "createdAt": "2025-11-28T08:01:00Z",
        "votesCount": 382,
        "description": "AI plugin for JetBrains that understands backend projects architecturally. Accesses Spring Bean graphs, database schemas, and framework semantics directly — not just superficial code. Provides context-aware suggestions for complex systems with 100K+ files.",
        "reviewsCount": 6,
    }

    data= node['description']
    topic = node['name']
    title = node['tagline']
    return {"data":data ,"title": title,"topic": topic}
