"""Catálogo de fontes federais, dos Poderes e consolidadores nacionais.

Derivado do guia "Dados Abertos do Setor Público Brasileiro". As fontes
subnacionais (26 estados + DF + 27 capitais) ficam em ``subnational.py``.
"""

from __future__ import annotations

from .types import (
    Access,
    Branch,
    DataCategory,
    Endpoint,
    SourceDefinition,
    Sphere,
)

C = DataCategory

FEDERAL_SOURCES: list[SourceDefinition] = [
    # ─── Federal · Executivo ──────────────────────────────────────────
    SourceDefinition(
        id="portal_transparencia",
        name="Portal da Transparência (CGU)",
        short_description=(
            "Hub central do Executivo Federal: despesas, servidores e pensionistas, "
            "cartões de pagamento (CPGF), viagens, convênios, emendas e benefícios sociais."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.EXECUTIVO,
        access=[Access.API, Access.BULK],
        categories=[C.DESPESAS, C.SALARIOS, C.CARTOES, C.SERVIDORES,
                    C.CONVENIOS, C.BENEFICIOS],
        requires_auth=True,
        formats=["JSON", "CSV"],
        endpoints=[
            Endpoint(label="Portal", url="https://portaldatransparencia.gov.br", kind="portal"),
            Endpoint(label="Download de dados", kind="download",
                     url="https://portaldatransparencia.gov.br/download-de-dados"),
            Endpoint(label="API de Dados", kind="api",
                     url="https://api.portaldatransparencia.gov.br"),
        ],
        notes=("Consultas na tela limitam 20 mil registros — usar download em lote para "
               "volume. Servidores cobrem apenas SIAPE, BACEN, MRE e Militares."),
        has_connector=True,
        tags=["cgu", "federal", "gastos", "remuneração", "cpgf"],
    ),
    SourceDefinition(
        id="siafi_siop",
        name="SIAFI / SIOP (Orçamento e execução fiscal)",
        short_description=(
            "Sistemas internos de administração financeira (SIAFI) e planejamento "
            "orçamentário (SIOP, ciclo PPA/LDO/LOA). Dados consolidados chegam ao "
            "público via Portal da Transparência e Tesouro Transparente."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.EXECUTIVO,
        access=[Access.WEB],
        categories=[C.DESPESAS, C.RECEITAS, C.FISCAL],
        formats=["—"],
        endpoints=[
            Endpoint(label="Tesouro Transparente", kind="portal",
                     url="https://www.tesourotransparente.gov.br"),
        ],
        notes="Sistemas internos; acesso público é indireto (via consolidadores).",
        tags=["orçamento", "execução", "ppa", "ldo", "loa"],
    ),

    # ─── Contratações, licitações e fornecedores ──────────────────────
    SourceDefinition(
        id="pncp",
        name="PNCP — Portal Nacional de Contratações Públicas",
        short_description=(
            "Repositório unificado de licitações e contratos de todos os entes e Poderes "
            "(Lei 14.133/2021): editais, contratos, atas de registro de preço, PCA, "
            "dispensas e inexigibilidades."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.API],
        categories=[C.LICITACOES, C.CONTRATOS, C.EMPRESAS],
        requires_auth=False,
        formats=["JSON"],
        endpoints=[
            Endpoint(label="Portal", url="https://pncp.gov.br", kind="portal"),
            Endpoint(label="API (Swagger)", kind="swagger",
                     url="https://pncp.gov.br/api/consulta/swagger-ui/index.html"),
        ],
        notes=("Obrigatório desde 2023/24; fonte mais completa para compras públicas em "
               "qualquer nível. Sem login para consulta. Não cobre histórico pré-2021."),
        has_connector=True,
        tags=["licitações", "contratos", "compras", "14133"],
    ),
    SourceDefinition(
        id="comprasnet",
        name="ComprasNet / Compras.gov.br (legado)",
        short_description=(
            "Sistema histórico de compras federais sob a Lei 8.666/93 (pregões, "
            "dispensas, RDC). Em descontinuação; acervo permanece em dados.gov.br."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.EXECUTIVO,
        access=[Access.API, Access.BULK],
        categories=[C.LICITACOES, C.CONTRATOS],
        formats=["JSON", "CSV"],
        endpoints=[
            Endpoint(label="Dataset (dados.gov.br)", kind="dataset",
                     url="https://dados.gov.br/dados/conjuntos-dados/compras-publicas-do-governo-federal"),
        ],
        notes="Dados novos migram para o PNCP; usar para histórico anterior a 2021.",
        tags=["8666", "pregão", "rdc", "legado"],
    ),
    SourceDefinition(
        id="sancoes",
        name="Cadastros de sanções (CEIS / CNEP / CEPIM / CEAF)",
        short_description=(
            "Empresas e pessoas impedidas de contratar (CEIS), punidas pela Lei "
            "Anticorrupção (CNEP, inclui leniência), entidades sem fins lucrativos "
            "impedidas (CEPIM) e expulsões da administração federal (CEAF)."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.API, Access.WEB],
        categories=[C.SANCOES, C.EMPRESAS],
        formats=["JSON", "CSV"],
        endpoints=[
            Endpoint(label="Consulta consolidada", kind="portal",
                     url="https://portaldatransparencia.gov.br/sancoes/consulta"),
            Endpoint(label="Registro (CEIS/CNEP)", kind="portal",
                     url="https://ceiscadastro.cgu.gov.br"),
        ],
        notes="Due diligence de fornecedores; alimentado por todos os entes e Poderes.",
        tags=["ceis", "cnep", "cepim", "ceaf", "anticorrupção", "due diligence"],
    ),
    SourceDefinition(
        id="cnpj_receita",
        name="CNPJ e quadro societário (Receita Federal)",
        short_description=(
            "Base completa de CNPJ em formato aberto: sócios, capital social, situação "
            "cadastral, CNAE. Dado-base para cruzar 'empresa contratada' com 'donos'."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.EXECUTIVO,
        access=[Access.BULK],
        categories=[C.EMPRESAS],
        formats=["CSV"],
        endpoints=[
            Endpoint(label="Dados abertos CNPJ", kind="download",
                     url="https://www.gov.br/receitafederal/dados/cnpj"),
        ],
        notes="Download em lote (arquivos grandes). Chave para cruzamentos societários.",
        tags=["cnpj", "sócios", "cnae", "receita"],
    ),

    # ─── Legislativo ──────────────────────────────────────────────────
    SourceDefinition(
        id="camara",
        name="Câmara dos Deputados — Dados Abertos",
        short_description=(
            "Cota para Exercício da Atividade Parlamentar (CEAP) com nota fiscal por "
            "despesa desde 2008, além de proposições, votações, órgãos e servidores."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.LEGISLATIVO,
        access=[Access.API],
        categories=[C.DESPESAS, C.LEGISLATIVO, C.SERVIDORES],
        requires_auth=False,
        formats=["XML", "JSON", "CSV"],
        endpoints=[
            Endpoint(label="Portal", url="https://dadosabertos.camara.leg.br", kind="portal"),
            Endpoint(label="API (Swagger)", kind="swagger",
                     url="https://dadosabertos.camara.leg.br/swagger/api.html"),
        ],
        notes="Sem autenticação, atualização diária.",
        has_connector=True,
        tags=["ceap", "deputados", "cota parlamentar", "verba indenizatória"],
    ),
    SourceDefinition(
        id="senado",
        name="Senado Federal — Dados Abertos",
        short_description=(
            "Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS) em CSV "
            "anual, além de API legislativa (matérias, votações, senadores)."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.LEGISLATIVO,
        access=[Access.API, Access.BULK],
        categories=[C.DESPESAS, C.LEGISLATIVO],
        requires_auth=False,
        formats=["XML", "JSON", "CSV"],
        endpoints=[
            Endpoint(label="Dados abertos CEAPS", kind="download",
                     url="https://www12.senado.leg.br/transparencia/dados-abertos-transparencia/dados-abertos-ceaps"),
            Endpoint(label="API legislativa (Swagger)", kind="swagger",
                     url="https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html"),
        ],
        tags=["ceaps", "senadores", "cota parlamentar"],
    ),

    # ─── Judiciário e Eleições ────────────────────────────────────────
    SourceDefinition(
        id="cnj_datajud",
        name="CNJ / DataJud",
        short_description=(
            "Portal de transparência do Judiciário (remuneração de magistrados por "
            "tribunal) e DataJud, repositório nacional de metadados processuais."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.JUDICIARIO,
        access=[Access.API, Access.WEB],
        categories=[C.SALARIOS, C.SERVIDORES],
        formats=["JSON"],
        endpoints=[
            Endpoint(label="CNJ", url="https://www.cnj.jus.br", kind="portal"),
        ],
        notes="Padrão de publicação varia bastante entre tribunais (STF, STJ, TJs, TREs).",
        tags=["cnj", "datajud", "magistrados", "judiciário"],
    ),
    SourceDefinition(
        id="tse",
        name="TSE — Dados Abertos (financiamento de campanha)",
        short_description=(
            "Prestação de contas eleitorais de candidatos, partidos e comitês: receitas "
            "e despesas de campanha, CNPJ de campanha, extratos, além de estatísticas de "
            "candidaturas, eleitorado e resultados."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.ELEITORAL,
        access=[Access.BULK, Access.CKAN],
        categories=[C.CAMPANHAS, C.RECEITAS, C.DESPESAS],
        formats=["CSV", "TXT"],
        endpoints=[
            Endpoint(label="Dados Abertos TSE", url="https://dadosabertos.tse.jus.br", kind="portal"),
            Endpoint(label="DivulgaCandContas", kind="web",
                     url="https://divulgacandcontas.tse.jus.br"),
            Endpoint(label="Estatísticas eleitorais", kind="web",
                     url="https://www.tse.jus.br/eleicoes/estatisticas"),
        ],
        notes="Arquivos grandes (alguns excedem o limite do Excel).",
        tags=["tse", "eleições", "campanha", "prestação de contas"],
    ),

    # ─── Consolidadores nacionais ─────────────────────────────────────
    SourceDefinition(
        id="siconfi",
        name="SICONFI — Tesouro Nacional",
        short_description=(
            "Único ponto com dados contábeis e fiscais padronizados e comparáveis entre "
            "União, 26 estados, DF e ~5.570 municípios: RREO, RGF e balanços."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.API, Access.BULK],
        categories=[C.FISCAL, C.RECEITAS, C.DESPESAS],
        requires_auth=False,
        formats=["JSON", "CSV"],
        endpoints=[
            Endpoint(label="Portal", url="https://siconfi.tesouro.gov.br", kind="portal"),
            Endpoint(label="API", kind="api",
                     url="https://apidatalake.tesouro.gov.br/ords/siconfi/tt"),
        ],
        notes="Ideal para comparar finanças entre entes; não tem despesa por fornecedor.",
        has_connector=True,
        tags=["siconfi", "tesouro", "rreo", "rgf", "comparável"],
    ),
    SourceDefinition(
        id="dados_gov_br",
        name="dados.gov.br — Portal Brasileiro de Dados Abertos",
        short_description=(
            "Catálogo geral (CKAN) que agrega datasets de vários órgãos federais e "
            "alguns entes subnacionais. Ponto de partida para descobrir datasets tratados."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.CKAN, Access.API],
        categories=[],
        requires_auth=False,
        formats=["múltiplos"],
        endpoints=[
            Endpoint(label="Portal", url="https://dados.gov.br", kind="portal"),
            Endpoint(label="API CKAN", kind="api",
                     url="https://dados.gov.br/api/3/action"),
        ],
        has_connector=True,
        tags=["ckan", "catálogo", "descoberta"],
    ),
    SourceDefinition(
        id="mbt",
        name="Mapa Brasil Transparente (CGU)",
        short_description=(
            "Escala Brasil Transparente: nota de 0 a 10 para transparência ativa e passiva "
            "dos 27 estados e de centenas de municípios (>50 mil hab.). Ranking + diretório."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.WEB],
        categories=[],
        endpoints=[
            Endpoint(label="Portal", url="https://mbt.cgu.gov.br", kind="portal"),
        ],
        tags=["ranking", "escala brasil transparente", "qualidade"],
    ),

    # ─── Bases para análise em escala ─────────────────────────────────
    SourceDefinition(
        id="querido_diario",
        name="Querido Diário (Open Knowledge Brasil)",
        short_description=(
            "Rastreia e centraliza diários oficiais de milhares de municípios. Busca por "
            "palavra-chave, filtrando por código IBGE do município e período."
        ),
        sphere=Sphere.MUNICIPAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.API],
        categories=[C.DIARIOS],
        requires_auth=False,
        formats=["JSON"],
        endpoints=[
            Endpoint(label="Site", url="https://queridodiario.ok.org.br", kind="portal"),
            Endpoint(label="API pública", kind="api",
                     url="https://queridodiario.ok.org.br/api"),
            Endpoint(label="Documentação", kind="api",
                     url="https://docs.queridodiario.ok.org.br/pt-br/latest/utilizando/api-publica.html"),
            Endpoint(label="Código-fonte", kind="portal",
                     url="https://github.com/okfn-brasil/querido-diario-api"),
        ],
        notes="Resolve o problema de prefeituras que só publicam PDF sem estrutura.",
        has_connector=True,
        tags=["diários oficiais", "okbr", "municípios", "ibge"],
    ),
    SourceDefinition(
        id="base_dos_dados",
        name="Base dos Dados",
        short_description=(
            "Centenas de datasets públicos tratados e padronizados (eleições TSE, CPGF e "
            "outros) para consulta via SQL/BigQuery. Camada gratuita e BD Pro."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.SQL, Access.API],
        categories=[],
        formats=["SQL", "Parquet"],
        endpoints=[
            Endpoint(label="Site", url="https://basedosdados.org", kind="portal"),
        ],
        notes="Poupa o parsing de arquivos brutos.",
        tags=["bigquery", "sql", "datasets tratados"],
    ),
    SourceDefinition(
        id="serenata",
        name="Operação Serenata de Amor",
        short_description=(
            "Projeto open source (OKBR) cujo robô Rosie audita automaticamente os "
            "reembolsos da CEAP da Câmara em busca de padrões suspeitos."
        ),
        sphere=Sphere.FEDERAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.BULK],
        categories=[C.DESPESAS],
        endpoints=[
            Endpoint(label="Projeto", url="https://serenata.ai", kind="portal"),
        ],
        tags=["rosie", "auditoria", "ceap", "anomalias"],
    ),
    SourceDefinition(
        id="transparencia_brasil",
        name="Transparência Brasil",
        short_description=(
            "ONG com ferramentas próprias: Excelências (histórico de políticos) e "
            "acompanhamento de gastos com merenda escolar e obras públicas."
        ),
        sphere=Sphere.NACIONAL,
        branch=Branch.INDEPENDENTE,
        access=[Access.WEB],
        categories=[],
        endpoints=[
            Endpoint(label="Site", url="https://www.transparencia.org.br", kind="portal"),
        ],
        tags=["ong", "excelências", "políticos", "obras"],
    ),
]
