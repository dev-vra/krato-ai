"""Geração de embeddings para busca semântica.

Dois backends:

* ``SentenceTransformerEmbedder`` — embeddings semânticos reais (multilíngue PT-BR),
  usado quando ``sentence-transformers`` está instalado e o modelo pôde ser carregado.
* ``HashingEmbedder`` — fallback determinístico offline (hashing vectorizer com
  sublinear-TF + normalização L2). Não exige download de modelo. Captura similaridade
  lexical; é o suficiente para o sistema nunca ficar "sem busca".

``get_embedder()`` escolhe automaticamente e faz cache do resultado.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from functools import lru_cache
from typing import Protocol

import numpy as np

from ..config import get_settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# stopwords PT-BR mínimas para não poluir o sinal lexical
_STOP = {
    "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na",
    "nos", "nas", "para", "por", "com", "que", "um", "uma", "ao", "à", "se", "ou",
    "the", "of", "and",
}


def _normalize(text: str) -> list[str]:
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return [t for t in _TOKEN_RE.findall(text) if t not in _STOP and len(t) > 1]


class Embedder(Protocol):
    dim: int
    name: str

    def encode(self, texts: list[str]) -> np.ndarray:  # (n, dim), L2-normalizado
        ...


class HashingEmbedder:
    """Fallback offline: hashing vectorizer com sublinear TF e normalização L2."""

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim
        self.name = f"hashing-{dim}"

    def _vec(self, text: str) -> np.ndarray:
        counts: dict[int, float] = {}
        for tok in _normalize(text):
            h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if (h >> 8) % 2 == 0 else -1.0
            counts[idx] = counts.get(idx, 0.0) + sign
        v = np.zeros(self.dim, dtype=np.float32)
        for idx, c in counts.items():
            # sublinear TF
            v[idx] = np.sign(c) * (1.0 + np.log(abs(c))) if c != 0 else 0.0
        norm = np.linalg.norm(v)
        return v / norm if norm > 0 else v

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        return np.vstack([self._vec(t) for t in texts])


class SentenceTransformerEmbedder:
    """Embeddings semânticos reais via sentence-transformers."""

    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer  # import tardio

        self._model = SentenceTransformer(model_name)
        self.dim = self._model.get_sentence_embedding_dimension()
        self.name = model_name

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        vecs = self._model.encode(texts, normalize_embeddings=True,
                                  convert_to_numpy=True, show_progress_bar=False)
        return vecs.astype(np.float32)


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    settings = get_settings()
    try:
        embedder = SentenceTransformerEmbedder(settings.embedding_model)
        return embedder
    except Exception:  # noqa: BLE001 — qualquer falha cai para o fallback offline
        return HashingEmbedder(dim=settings.embedding_dim)
