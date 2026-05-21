"""AI Agent Service entrypoint."""
import logging

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import chat
from .config import get_settings

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(
    title="AI Agent Service",
    version="1.0.0",
    openapi_url=f"/api/{settings.API_VERSION}/openapi.json",
    docs_url=f"/api/{settings.API_VERSION}/docs",
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Message(BaseModel):
    role: str  # user | assistant | tool
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    reply: str
    jobs: list[dict] = []


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": settings.SERVICE_NAME}


@app.post(f"/api/{settings.API_VERSION}/agent/chat", response_model=ChatResponse)
async def agent_chat(body: ChatRequest, authorization: str | None = Header(default=None)):
    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    result = await chat([m.model_dump() for m in body.messages], bearer_token=bearer)
    return ChatResponse(**result)
