import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./TopBar";
import { CommandSearch } from "./CommandSearch";
import { FiltersPanel } from "./FiltersPanel";
import { SourceDetailPanel } from "./SourceDetailPanel";
import { DataModal } from "./DataModal";
import { BackendStatus } from "./BackendStatus";
import { DashboardView } from "@/views/DashboardView";
import { ExploreView } from "@/views/ExploreView";
import { useUI } from "@/store/ui";

export function AppShell() {
  const { view } = useUI();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />

      <main className="relative flex-1 overflow-y-auto scroll-slim">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "dashboard" ? <DashboardView /> : <ExploreView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Painéis laterais e overlays */}
      <SourceDetailPanel />
      <FiltersPanel />
      <CommandSearch />
      <DataModal />
      <BackendStatus />
    </div>
  );
}
