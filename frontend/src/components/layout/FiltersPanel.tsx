import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import { ACCESS_LABEL, BRANCH_LABEL, CATEGORY_LABEL, SPHERE_LABEL } from "@/lib/labels";
import type { Access, Branch, Sphere } from "@/lib/types";
import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function FiltersPanel() {
  const { filtersOpen, setFiltersOpen, filters, patchFilters, clearFilters, activeFilterCount } =
    useUI();

  return (
    <AnimatePresence>
      {filtersOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFiltersOpen(false)}
          />
          <motion.aside
            initial={{ x: 360, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-[340px] flex-col glass-rail border-l"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-display text-base font-bold text-ink">Filtros & ajustes</h2>
              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-soft hover:bg-white/70"
                  >
                    <RotateCcw size={12} /> Limpar
                  </button>
                )}
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-white/70"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto scroll-slim px-5 pb-8">
              <Chips
                label="Esfera"
                value={filters.sphere}
                options={Object.entries(SPHERE_LABEL) as [Sphere, string][]}
                onPick={(v) => patchFilters({ sphere: v as Sphere })}
              />
              <Chips
                label="Poder"
                value={filters.branch}
                options={Object.entries(BRANCH_LABEL) as [Branch, string][]}
                onPick={(v) => patchFilters({ branch: v as Branch })}
              />
              <Chips
                label="Tipo de acesso"
                value={filters.access}
                options={Object.entries(ACCESS_LABEL) as [Access, string][]}
                onPick={(v) => patchFilters({ access: v as Access })}
              />
              <Chips
                label="Categoria de dado"
                value={filters.category}
                options={Object.entries(CATEGORY_LABEL)}
                onPick={(v) => patchFilters({ category: v })}
              />

              {/* UF */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Unidade federativa
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {UFS.map((uf) => (
                    <button
                      key={uf}
                      onClick={() => patchFilters({ uf: filters.uf === uf ? undefined : uf })}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-semibold transition-colors",
                        filters.uf === uf
                          ? "bg-brand-600 text-white"
                          : "bg-white/60 text-ink-soft hover:bg-white",
                      )}
                    >
                      {uf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Somente com conector */}
              <label className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2.5">
                <span className="text-sm font-medium text-ink-soft">Somente com conector</span>
                <Toggle
                  on={!!filters.has_connector}
                  onClick={() =>
                    patchFilters({ has_connector: filters.has_connector ? undefined : true })
                  }
                />
              </label>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Chips<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string | undefined;
  options: [T, string][];
  onPick: (v: T | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([key, lbl]) => {
          const active = value === key;
          return (
            <button
              key={key}
              onClick={() => onPick(active ? undefined : key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white shadow-soft"
                  : "bg-white/60 text-ink-soft hover:bg-white",
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        on ? "bg-brand-600" : "bg-line",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}
