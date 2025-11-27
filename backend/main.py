import uvicorn
import asyncio

if __name__ == "__main__":
    uvicorn.run("services.authentication.auth:app", host="127.0.0.1", log_level="info")
    # asyncio.run(create_user("king.arthur@camelot.bt", "guinevere"))
