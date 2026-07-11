import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Database, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { categoryColor, categoryLabel, SPHERE_LABEL } from "@/lib/labels";
import type { SourceHit } from "@/lib/types";
import { useUI } from "@/store/ui";
import { Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function CommandSearch() {
  const { commandOpen, setCommandOpen, setQuery, setView, openDetail } = useUI();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  // Atalho global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 220);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["command-search", debounced],
    queryFn: () => api.search(debounced || null),
    enabled: commandOpen,
  });

  const hits = data?.hits ?? [];

  function pick(hit: SourceHit) {
    setQuery(term);
    setView("explore");
    openDetail(hit.source);
    setCommandOpen(false);
  }

  return (
    <AnimatePresence>
      {commandOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
            onClick={() => setCommandOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl glass-strong rounded-2xl overflow-hidden"
          >
            {/* Campo */}
            <div className="flex items-center gap-3 border-b border-line/70 px-4">
              {isFetching ? <Spinner /> : <Search size={18} className="text-brand-600" />}
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Descreva o que procura — a busca é por significado…"
                className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
              />
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Sparkles size={12} /> {data?.embedder ?? "semântico"}
              </span>
            </div>

            {/* Resultados */}
            <div className="max-h-[52vh] overflow-y-auto scroll-slim p-2">
              {hits.length === 0 && !isFetching && (
                <div className="px-4 py-10 text-center text-sm text-ink-muted">
                  Nenhuma fonte encontrada. Tente "licitações municipais" ou "salários de servidores".
                </div>
              )}
              {hits.map((hit) => (
                <button
                  key={hit.source.id}
                  onClick={() => pick(hit)}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-50/70"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700">
                    <Database size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {hit.source.name}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {SPHERE_LABEL[hit.source.sphere]} ·{" "}
                      {hit.source.categories.slice(0, 3).map(categoryLabel).join(", ") || "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ScoreBar score={hit.score} color={categoryColor(hit.source.categories[0])} />
                    <CornerDownLeft
                      size={14}
                      className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-line/70 px-4 py-2 text-[11px] text-ink-muted">
              <span>Busca semântica + filtros sobre {data?.total ?? 0} resultados</span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-line bg-canvas px-1">esc</kbd> fechar
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const pct = Math.max(6, Math.min(100, Math.round(score * 100)));
  return (
    <span className={cn("hidden h-1.5 w-14 overflow-hidden rounded-full bg-line sm:block")}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </span>
  );
}
