import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SearchFilters, SourceDefinition } from "@/lib/types";

export type ViewId = "dashboard" | "explore";

interface UIState {
  view: ViewId;
  setView: (v: ViewId) => void;

  query: string;
  setQuery: (q: string) => void;

  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  patchFilters: (f: Partial<SearchFilters>) => void;
  clearFilters: () => void;
  activeFilterCount: number;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;

  detail: SourceDefinition | null;
  openDetail: (s: SourceDefinition) => void;
  closeDetail: () => void;

  modalSource: SourceDefinition | null;
  openModal: (s: SourceDefinition) => void;
  closeModal: () => void;
}

const Ctx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewId>("dashboard");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [commandOpen, setCommandOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<SourceDefinition | null>(null);
  const [modalSource, setModalSource] = useState<SourceDefinition | null>(null);

  const value = useMemo<UIState>(() => {
    const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== "")
      .length;
    return {
      view,
      setView,
      query,
      setQuery,
      filters,
      setFilters,
      patchFilters: (f) => setFilters((prev) => ({ ...prev, ...f })),
      clearFilters: () => setFilters({}),
      activeFilterCount,
      commandOpen,
      setCommandOpen,
      filtersOpen,
      setFiltersOpen,
      detail,
      openDetail: setDetail,
      closeDetail: () => setDetail(null),
      modalSource,
      openModal: setModalSource,
      closeModal: () => setModalSource(null),
    };
  }, [view, query, filters, commandOpen, filtersOpen, detail, modalSource]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UIState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI deve ser usado dentro de <UIProvider>");
  return ctx;
}
