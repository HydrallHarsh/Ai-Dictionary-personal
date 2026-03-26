from dotenv import load_dotenv
from langchain.rate_limiters import InMemoryRateLimiter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

load_dotenv()


limiter = InMemoryRateLimiter(
    requests_per_second=0.5, check_every_n_seconds=10, max_bucket_size=1
)
# model = ChatGoogleGenerativeAI(
#     model="gemini-2.5-flash",
#     temperature=1.0,  # Gemini 3.0+ defaults to 1.0
#     max_retries=5)

# aimodel=ChatOpenAI(
#     model = "gpt-4o-mini",
#     temperature=1.0,
#     max_retries=5,
#     verbose=True,
#     rate_limiter=limiter
# )
groqmodel = ChatGroq(
    model="meta-llama/llama-4-scout-17b-16e-instruct",  # "qwen/qwen3-32b",
    temperature=0.7,
    # reasoning_format="parsed",
    max_retries=2,
)
codemodel = ChatGroq(
    model="qwen/qwen3-32b",
    temperature=0.7,
    reasoning_format="parsed",
    max_retries=3,
)
