"""Tipos de domínio do catálogo de fontes.

Cada fonte do guia de dados abertos vira uma ``SourceDefinition`` — uma entrada
estruturada, pesquisável e filtrável. É sobre este catálogo que a busca semântica
e os filtros operam primeiro.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Sphere(str, Enum):
    """Esfera federativa."""

    FEDERAL = "federal"
    ESTADUAL = "estadual"
    MUNICIPAL = "municipal"
    NACIONAL = "nacional"  # consolidadores que cruzam esferas


class Branch(str, Enum):
    """Poder."""

    EXECUTIVO = "executivo"
    LEGISLATIVO = "legislativo"
    JUDICIARIO = "judiciario"
    ELEITORAL = "eleitoral"
    INDEPENDENTE = "independente"  # ONGs / projetos abertos


class Access(str, Enum):
    """Como os dados são acessados programaticamente."""

    API = "api"          # API REST estruturada
    BULK = "bulk"        # download em lote (CSV/TXT/Parquet)
    CKAN = "ckan"        # catálogo CKAN
    SQL = "sql"          # SQL / BigQuery
    SCRAPE = "scrape"    # exige scraping de HTML
    WEB = "web"          # somente consulta manual na tela


class DataCategory(str, Enum):
    """Categorias de dado — usadas em filtros e no cruzamento entre fontes."""

    DESPESAS = "despesas"
    RECEITAS = "receitas"
    SALARIOS = "salarios"
    CARTOES = "cartoes_corporativos"
    LICITACOES = "licitacoes"
    CONTRATOS = "contratos"
    EMPRESAS = "empresas"
    SANCOES = "sancoes"
    CAMPANHAS = "campanhas_eleitorais"
    SERVIDORES = "servidores"
    LEGISLATIVO = "legislativo"
    DIARIOS = "diarios_oficiais"
    FISCAL = "fiscal_contabil"
    BENEFICIOS = "beneficios_sociais"
    CONVENIOS = "convenios_emendas"


class Endpoint(BaseModel):
    """Um ponto de acesso concreto de uma fonte."""

    label: str
    url: str
    kind: str = "portal"  # portal | api | swagger | dataset | download | esic


class SourceDefinition(BaseModel):
    """Definição estruturada de uma fonte de dados pública."""

    id: str = Field(..., description="Identificador estável, ex.: 'pncp'")
    name: str
    short_description: str
    sphere: Sphere
    branch: Branch
    access: list[Access]
    categories: list[DataCategory] = Field(default_factory=list)
    requires_auth: bool = False
    formats: list[str] = Field(default_factory=list)
    endpoints: list[Endpoint] = Field(default_factory=list)
    # UF quando a fonte é subnacional (estado/capital)
    uf: str | None = None
    # Nota prática de engenharia / limitações conhecidas
    notes: str | None = None
    # Existe conector implementado para esta fonte?
    has_connector: bool = False
    tags: list[str] = Field(default_factory=list)

    def search_text(self) -> str:
        """Texto denso para indexação semântica."""
        parts = [
            self.name,
            self.short_description,
            self.sphere.value,
            self.branch.value,
            " ".join(c.value.replace("_", " ") for c in self.categories),
            " ".join(self.tags),
            self.notes or "",
        ]
        return " · ".join(p for p in parts if p)
