"""Testes de integridade do catálogo e da busca."""

from app.catalog import Access, Sphere, get_registry
from app.connectors import get_connector_registry
from app.search import get_search_service


def test_catalog_has_all_entes():
    reg = get_registry()
    stats = reg.stats()
    # 26 estados + DF
    assert stats["by_sphere"][Sphere.ESTADUAL.value] == 27
    # 27 capitais (a de Brasília usa portal do DF, mas é catalogada como municipal)
    assert stats["by_sphere"][Sphere.MUNICIPAL.value] >= 27
    assert stats["total_sources"] > 60


def test_source_ids_are_unique():
    ids = [s.id for s in get_registry().all()]
    assert len(ids) == len(set(ids))


def test_every_connector_points_to_catalog_source():
    reg = get_registry()
    for source_id in get_connector_registry().source_ids():
        assert reg.get(source_id) is not None, f"conector órfão: {source_id}"


def test_connector_sources_flagged_in_catalog():
    reg = get_registry()
    conn_ids = set(get_connector_registry().source_ids())
    for src in reg.all():
        if src.has_connector:
            assert src.id in conn_ids, f"{src.id} marcado com conector inexistente"


def test_filter_by_uf():
    sp = get_registry().filter(uf="SP")
    assert {s.sphere for s in sp} == {Sphere.ESTADUAL, Sphere.MUNICIPAL}
    assert all(s.uf == "SP" for s in sp)


def test_semantic_search_returns_hits():
    svc = get_search_service()
    hits = svc.search("comparar finanças entre estados", top_k=5)
    assert hits
    assert hits[0].score >= hits[-1].score  # ordenado por score


def test_search_respects_filters():
    svc = get_search_service()
    hits = svc.search("contratos", access=Access.API, top_k=10)
    assert all(Access.API in h.source.access for h in hits)
