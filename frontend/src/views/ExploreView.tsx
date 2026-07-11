import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { SourceCard } from "@/components/sources/SourceCard";
import { FadeIn, GlassCard, Skeleton } from "@/components/ui/primitives";
import { ACCESS_LABEL, BRANCH_LABEL, CATEGORY_LABEL, SPHERE_LABEL } from "@/lib/labels";
import type { SearchFilters } from "@/lib/types";
import { useUI } from "@/store/ui";

const FILTER_LABEL: Record<keyof SearchFilters, (v: string) => string> = {
  sphere: (v) => SPHERE_LABEL[v as keyof typeof SPHERE_LABEL] ?? v,
  branch: (v) => BRANCH_LABEL[v as keyof typeof BRANCH_LABEL] ?? v,
  access: (v) => ACCESS_LABEL[v as keyof typeof ACCESS_LABEL] ?? v,
  category: (v) => CATEGORY_LABEL[v] ?? v,
  uf: (v) => v,
  has_connector: () => "com conector",
};

export function ExploreView() {
  const { query, setCommandOpen, filters, patchFilters, activeFilterCount } = useUI();

  const { data, isFetching } = useQuery({
    queryKey: ["explore", query, filters],
    queryFn: () => api.search(query || null, filters),
  });

  const hits = data?.hits ?? [];

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6 xl:px-10">
      <FadeIn className="mb-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          Explorar fontes
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-line bg-white/70 px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-brand-300"
          >
            <Search size={15} className="text-brand-600" />
            {query ? (
              <span className="font-medium text-ink">"{query}"</span>
            ) : (
              <span className="text-ink-muted">Buscar por semântica…</span>
            )}
          </button>

          {/* Chips de filtros ativos */}
          {(Object.keys(filters) as (keyof SearchFilters)[]).map((key) => {
            const val = filters[key];
            if (val === undefined || val === "") return null;
            return (
              <motion.button
                key={key}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => patchFilters({ [key]: undefined } as Partial<SearchFilters>)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"
              >
                {FILTER_LABEL[key](String(val))}
                <X size={13} />
              </motion.button>
            );
          })}

          {data && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles size={13} />
              {data.total} resultado(s)
              {data.embedder !== "mock" && ` · ${data.embedder}`}
            </span>
          )}
        </div>
      </FadeIn>

      {/* Resultados */}
      {isFetching ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <GlassCard key={i} className="h-48 p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-2/3" />
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : hits.length === 0 ? (
        <GlassCard className="grid place-items-center py-20 text-center">
          <div>
            <Search size={32} className="mx-auto mb-3 text-ink-muted opacity-40" />
            <p className="font-medium text-ink">Nenhuma fonte corresponde aos critérios.</p>
            <p className="mt-1 text-sm text-ink-muted">
              Ajuste os filtros{activeFilterCount > 0 ? " ativos" : ""} ou refine a busca.
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {hits.map((hit, i) => (
            <SourceCard key={hit.source.id} source={hit.source} score={hit.score} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
