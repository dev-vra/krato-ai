import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Landmark,
  Plug,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { CategoryBars, SphereDonut } from "@/components/charts/CatalogCharts";
import { SourceCard } from "@/components/sources/SourceCard";
import { FadeIn, GlassCard, Skeleton } from "@/components/ui/primitives";
import { KpiCard } from "@/components/ui/KpiCard";
import { SPHERE_COLOR, SPHERE_LABEL } from "@/lib/labels";
import type { Sphere } from "@/lib/types";
import { useUI } from "@/store/ui";

export function DashboardView() {
  const { setView } = useUI();
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const { data: connectorsSources } = useQuery({
    queryKey: ["sources", { has_connector: true }],
    queryFn: () => api.sources({ has_connector: true }),
  });

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 xl:px-10">
      {/* Cabeçalho */}
      <FadeIn className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-600">
          <TrendingUp size={16} /> Painel de inteligência
        </div>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink xl:text-4xl">
          Todo o setor público brasileiro,{" "}
          <span className="text-gradient">em uma tela</span>
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Gastos, salários, cartões corporativos, licitações, empresas, campanhas e
          servidores — vinculados, analisados e pesquisáveis por semântica e filtros.
        </p>
      </FadeIn>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Fontes catalogadas"
          value={stats?.total_sources ?? "—"}
          icon={Database}
          accent="#6a5cf0"
          hint="federal · estadual · municipal"
          loading={isLoading}
          delay={0}
        />
        <KpiCard
          label="Conectores ativos"
          value={stats?.with_connector ?? "—"}
          icon={Plug}
          accent="#0ea5a4"
          hint="integração ao vivo via API"
          loading={isLoading}
          delay={0.05}
        />
        <KpiCard
          label="Fontes com API"
          value={stats?.with_api ?? "—"}
          icon={ShieldCheck}
          accent="#3b82f6"
          hint="acesso programático direto"
          loading={isLoading}
          delay={0.1}
        />
        <KpiCard
          label="Entes cobertos"
          value={stats ? Object.values(stats.by_sphere).reduce((a, b) => a + b, 0) : "—"}
          icon={Landmark}
          accent="#f59e0b"
          hint="3 esferas · 4 Poderes"
          loading={isLoading}
          delay={0.15}
        />
      </div>

      {/* Gráficos */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-1">
          <GlassCard className="h-full p-5">
            <h2 className="font-display text-base font-bold text-ink">Fontes por esfera</h2>
            <p className="text-xs text-ink-muted">distribuição federativa do catálogo</p>
            {isLoading || !stats ? (
              <Skeleton className="mt-4 h-[220px] w-full rounded-full" />
            ) : (
              <>
                <div className="mt-2">
                  <SphereDonut stats={stats} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.entries(stats.by_sphere).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: SPHERE_COLOR[k as Sphere] }}
                      />
                      <span className="text-ink-soft">{SPHERE_LABEL[k as Sphere]}</span>
                      <span className="ml-auto font-semibold text-ink">{v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.15} className="lg:col-span-2">
          <GlassCard className="h-full p-5">
            <h2 className="font-display text-base font-bold text-ink">
              Cobertura por categoria de dado
            </h2>
            <p className="text-xs text-ink-muted">
              quantas fontes oferecem cada tipo de informação
            </p>
            {isLoading || !stats ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <div className="mt-3">
                <CategoryBars stats={stats} />
              </div>
            )}
          </GlassCard>
        </FadeIn>
      </div>

      {/* Fontes com conector */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-ink">Fontes integradas</h2>
        <button
          onClick={() => setView("explore")}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Explorar todas →
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {!connectorsSources
          ? Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="h-44 p-5">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-1.5 h-3 w-2/3" />
              </GlassCard>
            ))
          : connectorsSources
              .filter((s) => s.has_connector)
              .map((s, i) => <SourceCard key={s.id} source={s} index={i} />)}
      </div>
    </div>
  );
}
