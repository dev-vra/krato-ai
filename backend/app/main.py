"""Ponto de entrada da API Kratos (FastAPI)."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import router
from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="Kratos API",
    version=__version__,
    description=(
        "Inteligência sobre dados abertos do setor público brasileiro — "
        "catálogo de fontes, conectores, busca semântica e KPIs."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root() -> dict:
    return {"name": "Kratos", "version": __version__, "docs": "/docs"}
