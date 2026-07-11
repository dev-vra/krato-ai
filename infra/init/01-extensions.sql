-- Extensões necessárias para o Kratos
CREATE EXTENSION IF NOT EXISTS vector;      -- busca semântica (pgvector)
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- busca textual fuzzy / trigram
CREATE EXTENSION IF NOT EXISTS unaccent;    -- normalização de acentos (PT-BR)
