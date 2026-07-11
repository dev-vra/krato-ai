"""Índice vetorial em memória (cosine via produto interno de vetores normalizados).

Espelha a semântica do pgvector para funcionar sem banco durante desenvolvimento e
testes; em produção o mesmo vetor é persistido em Postgres/pgvector.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class VectorIndex:
    dim: int
    ids: list[str] = field(default_factory=list)
    _matrix: np.ndarray | None = None

    def build(self, ids: list[str], vectors: np.ndarray) -> None:
        if vectors.shape[0] != len(ids):
            raise ValueError("ids e vetores com tamanhos diferentes")
        self.ids = list(ids)
        self._matrix = vectors.astype(np.float32)

    def query(self, vector: np.ndarray, top_k: int = 10) -> list[tuple[str, float]]:
        if self._matrix is None or len(self.ids) == 0:
            return []
        q = vector.astype(np.float32).reshape(-1)
        scores = self._matrix @ q  # cosine (vetores já normalizados)
        k = min(top_k, len(self.ids))
        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top])]
        return [(self.ids[i], float(scores[i])) for i in top]

    def __len__(self) -> int:
        return len(self.ids)
