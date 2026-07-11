import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GlassCard, Skeleton } from "./primitives";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  hint?: string;
  loading?: boolean;
  delay?: number;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "#6a5cf0",
  hint,
  loading,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard interactive className="relative overflow-hidden p-5">
        <div
          className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-xl"
          style={{ backgroundColor: accent }}
        />
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium text-ink-muted">{label}</span>
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{ backgroundColor: `${accent}1f`, color: accent }}
          >
            <Icon size={18} strokeWidth={2.2} />
          </span>
        </div>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <div className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {value}
            </div>
          )}
        </div>
        {hint && !loading && (
          <div className={cn("mt-1 text-xs text-ink-muted")}>{hint}</div>
        )}
      </GlassCard>
    </motion.div>
  );
}
