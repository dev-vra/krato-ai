"""Configuração da aplicação (env-driven)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    kratos_env: str = "development"
    database_url: str = "postgresql+psycopg://kratos:kratos@localhost:5432/kratos"

    # busca semântica
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    # credenciais de fontes
    portal_transparencia_token: str = ""
    billing_project_id: str = ""

    # http
    http_timeout: float = 30.0
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
