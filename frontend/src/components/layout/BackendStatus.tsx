import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Cloud, CloudOff } from "lucide-react";
import { api, isBackendOnline } from "@/lib/api";

// Indicador discreto: se o backend responde, "ao vivo"; senão, "modo demonstração".
export function BackendStatus() {
  useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const online = isBackendOnline();
  if (online === null) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-medium"
    >
      {online ? (
        <>
          <Cloud size={13} className="text-emerald-600" />
          <span className="text-ink-soft">Backend ao vivo</span>
        </>
      ) : (
        <>
          <CloudOff size={13} className="text-amber-600" />
          <span className="text-ink-soft">Modo demonstração (dados mock)</span>
        </>
      )}
    </motion.div>
  );
}
