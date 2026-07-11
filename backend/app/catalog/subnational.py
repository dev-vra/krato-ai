"""Fontes subnacionais: 26 estados + DF e as 27 capitais.

Dados extraídos das tabelas das seções 6 e 7 do guia. A maioria destes portais
não tem API — entram no catálogo com ``access=[SCRAPE]``, prontos para um adaptador
de scraping/ingestão, exceto quando indicado.
"""

from __future__ import annotations

from .types import Access, Branch, DataCategory, Endpoint, SourceDefinition, Sphere

C = DataCategory

# UF, nome, portal de transparência, canal LAI/e-SIC ("" quando não informado)
_STATES: list[tuple[str, str, str, str]] = [
    ("AC", "Acre", "transparencia.ac.gov.br", ""),
    ("AL", "Alagoas", "transparencia.al.gov.br", "e-sic.al.gov.br"),
    ("AP", "Amapá", "transparencia.ap.gov.br", "esic.ap.gov.br"),
    ("AM", "Amazonas", "transparencia.am.gov.br", "acessoainformacao.am.gov.br"),
    ("BA", "Bahia", "transparencia.ba.gov.br", "bahia.ba.gov.br/lei-de-acesso-a-informacao"),
    ("CE", "Ceará", "transparencia.ce.gov.br", "cearatransparente.ce.gov.br"),
    ("DF", "Distrito Federal", "transparencia.df.gov.br", "e-sic.df.gov.br"),
    ("ES", "Espírito Santo", "transparencia.es.gov.br", "acessoainformacao.es.gov.br"),
    ("GO", "Goiás", "transparencia.go.gov.br/portaldatransparencia", "cge.go.gov.br"),
    ("MA", "Maranhão", "transparencia.ma.gov.br", "e-sic.ma.gov.br"),
    ("MT", "Mato Grosso", "transparencia.mt.gov.br", "ouvidoria.cge.mt.gov.br/falecidadao"),
    ("MS", "Mato Grosso do Sul", "transparencia.ms.gov.br", "esic.ms.gov.br"),
    ("MG", "Minas Gerais", "transparencia.mg.gov.br", "acessoainformacao.mg.gov.br"),
    ("PA", "Pará", "transparencia.pa.gov.br", "sistemas.pa.gov.br/esic"),
    ("PB", "Paraíba", "transparencia.pb.gov.br", "sic.pb.gov.br"),
    ("PR", "Paraná", "transparencia.pr.gov.br", "transparencia.pr.gov.br/pte/acesso-a-informacao"),
    ("PE", "Pernambuco", "web.transparencia.pe.gov.br", "web.transparencia.pe.gov.br/acesso-a-informacao"),
    ("PI", "Piauí", "transparencia.pi.gov.br", "acessoainformacao.pi.gov.br/sigep"),
    ("RJ", "Rio de Janeiro", "transparencia.rj.gov.br", "esicrj.rj.gov.br"),
    ("RN", "Rio Grande do Norte", "transparencia.rn.gov.br", "sic.rn.gov.br"),
    ("RS", "Rio Grande do Sul", "transparencia.rs.gov.br/inicio", "ouvidoriageral.rs.gov.br/sic-lai"),
    ("RO", "Rondônia", "transparencia.ro.gov.br", "esic.cge.ro.gov.br"),
    ("RR", "Roraima", "transparencia.rr.gov.br", "ouvidoria.rr.gov.br"),
    ("SC", "Santa Catarina", "transparencia.sc.gov.br", "ouvidoria.sc.gov.br/cidadao"),
    ("SP", "São Paulo", "transparencia.sp.gov.br", "sic.sp.gov.br"),
    ("SE", "Sergipe", "transparencia.se.gov.br", "lai.se.gov.br/acesso"),
    ("TO", "Tocantins", "transparencia.to.gov.br", "to.gov.br/cge/acesso-a-informacao"),
]

# UF, capital, portal municipal
_CAPITALS: list[tuple[str, str, str]] = [
    ("AC", "Rio Branco", "transparencia.riobranco.ac.gov.br"),
    ("AL", "Maceió", "transparencia.maceio.al.gov.br"),
    ("AP", "Macapá", "transparencia2.macapa.ap.gov.br"),
    ("AM", "Manaus", "transparencia.manaus.am.gov.br"),
    ("BA", "Salvador", "transparencia.salvador.ba.gov.br"),
    ("CE", "Fortaleza", "transparencia.fortaleza.ce.gov.br"),
    ("DF", "Brasília", "transparencia.df.gov.br"),
    ("ES", "Vitória", "transparencia.vitoria.es.gov.br"),
    ("GO", "Goiânia", "www10.goiania.go.gov.br/TransWeb"),
    ("MA", "São Luís", "transparencia.saoluis.ma.gov.br"),
    ("MT", "Cuiabá", "transparencia.cuiaba.mt.gov.br/portaltransparencia"),
    ("MS", "Campo Grande", "transparencia.campogrande.ms.gov.br"),
    ("MG", "Belo Horizonte", "prefeitura.pbh.gov.br/transparencia"),
    ("PA", "Belém", "belem.pa.gov.br/transparencia"),
    ("PB", "João Pessoa", "transparencia.joaopessoa.pb.gov.br"),
    ("PR", "Curitiba", "transparencia.curitiba.pr.gov.br"),
    ("PE", "Recife", "transparencia.recife.pe.gov.br"),
    ("PI", "Teresina", "transparencia.teresina.pi.gov.br"),
    ("RJ", "Rio de Janeiro", "riotransparente.rio.rj.gov.br"),
    ("RN", "Natal", "natal.rn.gov.br/transparencia"),
    ("RS", "Porto Alegre", "www2.portoalegre.rs.gov.br/transparencia"),
    ("RO", "Porto Velho", "transparencia.portovelho.ro.gov.br"),
    ("RR", "Boa Vista", "transparencia.boavista.rr.gov.br"),
    ("SC", "Florianópolis", "pmf.sc.gov.br/transparencia"),
    ("SP", "São Paulo", "transparencia.prefeitura.sp.gov.br"),
    ("SE", "Aracaju", "transparencia.aracaju.se.gov.br"),
    ("TO", "Palmas", "portaldatransparencia.palmas.to.gov.br"),
]

_STATE_CATEGORIES = [C.DESPESAS, C.RECEITAS, C.SALARIOS, C.SERVIDORES, C.LICITACOES, C.FISCAL]


def _url(host: str) -> str:
    return host if host.startswith("http") else f"https://{host}"


def _build_states() -> list[SourceDefinition]:
    out: list[SourceDefinition] = []
    for uf, name, portal, esic in _STATES:
        endpoints = [Endpoint(label="Portal de Transparência", url=_url(portal), kind="portal")]
        if esic:
            endpoints.append(Endpoint(label="Canal LAI / e-SIC", url=_url(esic), kind="esic"))
        notes = None
        if uf == "MT":
            notes = ("Além do portal tradicional, lançou Política de Dados Abertos própria "
                     "(Decreto 1.691/2025) com datasets reutilizáveis em dadosabertos.mt.gov.br.")
        out.append(SourceDefinition(
            id=f"uf_{uf.lower()}",
            name=f"Transparência {name} ({uf})",
            short_description=(
                f"Portal de transparência ativa do estado {'do' if uf != 'DF' else ''} {name}, "
                "com despesas, receitas, remuneração de servidores e licitações estaduais."
            ),
            sphere=Sphere.ESTADUAL,
            branch=Branch.EXECUTIVO,
            access=[Access.SCRAPE],
            categories=_STATE_CATEGORIES,
            uf=uf,
            formats=["HTML", "CSV"],
            endpoints=endpoints,
            notes=notes,
            tags=["estado", uf.lower(), name.lower(), "lai", "e-sic"],
        ))
    return out


def _build_capitals() -> list[SourceDefinition]:
    out: list[SourceDefinition] = []
    for uf, city, portal in _CAPITALS:
        out.append(SourceDefinition(
            id=f"cap_{uf.lower()}",
            name=f"Transparência {city} ({uf})",
            short_description=(
                f"Portal de transparência municipal da capital {city}: gastos, "
                "remuneração de servidores e contratações da prefeitura."
            ),
            sphere=Sphere.MUNICIPAL,
            branch=Branch.EXECUTIVO,
            access=[Access.SCRAPE],
            categories=[C.DESPESAS, C.SALARIOS, C.SERVIDORES, C.LICITACOES],
            uf=uf,
            formats=["HTML", "CSV"],
            endpoints=[Endpoint(label="Portal Municipal", url=_url(portal), kind="portal")],
            notes=("Qualidade varia por prefeitura; para municípios sem portal estruturado, "
                   "usar o Querido Diário."),
            tags=["capital", "município", uf.lower(), city.lower()],
        ))
    return out


SUBNATIONAL_SOURCES: list[SourceDefinition] = _build_states() + _build_capitals()
