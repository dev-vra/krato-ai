# Mapa de fontes — Dados abertos do setor público brasileiro

Base legal: LAI (12.527/2011), LRF (LC 101/2000 + 131/2009), Nova Lei de Licitações
(14.133/2021), Lei Anticorrupção (12.846/2013). Este mapa é a fonte da verdade do
catálogo (`backend/app/catalog/sources.py`).

## Federal — Poder Executivo

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **Portal da Transparência (CGU)** — despesas, servidores, CPGF, viagens, convênios, emendas, benefícios | API REST (token) + download em massa | JSON / CSV | Tela limita 20 mil registros; usar download para volume. Servidores cobrem só SIAPE, BACEN, MRE, Militares. |
| **SIAFI / SIOP** | interno → consolidado | — | Chegam ao público via Portal da Transparência e Tesouro Transparente. |

## Contratações, licitações e fornecedores

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **PNCP** — editais, contratos, atas, PCA, dispensas | API REST pública (Swagger) | JSON | Obrigatório desde 2023/24; cobre todos os entes e Poderes. Sem login p/ consulta. |
| **ComprasNet / Compras.gov.br** (legado 8.666/93) | API + dados abertos | JSON / CSV | Descontinuado gradualmente; acervo em dados.gov.br. |
| **CEIS / CNEP / CEPIM / CEAF** — sanções | consulta consolidada + registro | JSON / web | Empresas inidôneas, punidas, entidades impedidas, expulsões. |
| **CNPJ — Receita Federal** | download em lote | CSV | Base para cruzar favorecido → sócios/quadro societário. |

## Federal — Poder Legislativo

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **Câmara dos Deputados** — CEAP, proposições, servidores | API REST pública (Swagger) | XML / JSON / CSV | Sem auth, atualização diária. Nota fiscal por despesa desde 2008. |
| **Senado Federal** — CEAPS, matérias, votações | API (Swagger) + CSV anual | XML / JSON / CSV | CEAPS por arquivo CSV anual. |

## Judiciário e Eleições

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **CNJ / DataJud** — remuneração de magistrados, metadados processuais | portais próprios | varia | Padrão de publicação varia por tribunal. |
| **TSE — Dados Abertos** — prestação de contas de campanha | download em massa (CKAN) | CSV / TXT | Arquivos grandes; DivulgaCandContas p/ consulta individual. |

## Estados (26 + DF) e Capitais (27)

Cada ente mantém portal de transparência próprio + canal e-SIC (LAI). A lista completa
(UF, portal, canal LAI) está codificada em `catalog/subnational.py`. Nem todos têm API —
muitos exigem scraping de HTML ou download de planilhas.

## Consolidadores nacionais

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **SICONFI (Tesouro)** — RREO, RGF, balanços | API REST + download | JSON / CSV | Único ponto padronizado e comparável entre União, estados e municípios. |
| **dados.gov.br** | catálogo CKAN + API | múltiplos | Ponto de partida p/ descobrir datasets tratados. |
| **Mapa Brasil Transparente (CGU)** | web / avaliação | — | Escala Brasil Transparente (nota 0–10) + diretório indireto. |

## Bases para análise em escala

| Fonte | Acesso | Formato | Observação |
|-------|--------|---------|------------|
| **Querido Diário** (OKBR) | API REST pública | JSON | Diários oficiais municipais, filtro por código IBGE + período. |
| **Base dos Dados** | SQL/BigQuery + API | SQL / Parquet | Centenas de datasets tratados; camada free + BD Pro. |
| **Serenata de Amor** (robô Rosie) | open source | — | Auditoria automática da CEAP. |
| **Transparência Brasil** | ferramentas próprias | web | Excelências (histórico de políticos), merenda, obras. |

## Notas de engenharia

- Nenhuma fonte cobre tudo: Portal Federal não tem servidores estaduais/municipais;
  SICONFI não tem despesa por fornecedor; PNCP não tem histórico pré-2021.
- Cruzamento fornecedor↔dono: favorecido (Portal/PNCP) → CNPJ Receita → CEIS/CNEP.
- Downloads em lote quase sempre superam limites da tela de consulta.
- Verificar periodicidade antes de desenhar pipeline: mensal (servidores/cartões),
  diária (legislativo), por evento (licitações PNCP).
