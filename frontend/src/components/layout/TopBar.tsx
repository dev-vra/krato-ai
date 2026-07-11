import { motion } from "framer-motion";
import { BarChart3, Compass, Search, SlidersHorizontal, Zap } from "lucide-react";
import { useUI, type ViewId } from "@/store/ui";
import { cn } from "@/lib/utils";

const NAV: { id: ViewId; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Painel", icon: BarChart3 },
  { id: "explore", label: "Explorar fontes", icon: Compass },
];

export function TopBar() {
  const { view, setView, setCommandOpen, filtersOpen, setFiltersOpen, activeFilterCount } = useUI();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 px-5 glass-rail border-b backdrop-blur-2xl">
      {/* Marca */}
      <button
        onClick={() => setView("dashboard")}
        className="flex items-center gap-2.5 pr-2"
        aria-label="Kratos — início"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft animate-pulse-ring">
          <Zap size={18} strokeWidth={2.5} fill="white" />
        </span>
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          Kratos
        </span>
        <span className="hidden lg:inline text-xs font-medium text-ink-muted">
          dados públicos
        </span>
      </button>

      {/* Navegação */}
      <nav className="flex items-center gap-1 rounded-xl bg-white/40 p-1">
        {NAV.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                active ? "text-brand-700" : "text-ink-soft hover:text-ink",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow-soft"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon size={16} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Busca textual global */}
      <button
        onClick={() => setCommandOpen(true)}
        className="group ml-auto flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-white/60 px-3.5 text-left text-sm text-ink-muted transition-all hover:border-brand-300 hover:bg-white"
      >
        <Search size={16} className="text-ink-muted group-hover:text-brand-600" />
        <span className="flex-1">Buscar por semântica: "gastos comparados entre estados"…</span>
        <kbd className="hidden md:inline rounded-md border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
          ⌘K
        </kbd>
      </button>

      {/* Filtros */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all",
          filtersOpen
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "border-line bg-white/60 text-ink-soft hover:bg-white",
        )}
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Filtros</span>
        {activeFilterCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>
    </header>
  );
}
