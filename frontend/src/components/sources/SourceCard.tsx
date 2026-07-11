import { motion } from "framer-motion";
import { KeyRound, Plug, ArrowRight } from "lucide-react";
import { categoryColor, categoryLabel, SPHERE_COLOR, SPHERE_LABEL } from "@/lib/labels";
import type { SourceDefinition } from "@/lib/types";
import { Badge, GlassCard } from "@/components/ui/primitives";
import { useUI } from "@/store/ui";

export function SourceCard({
  source,
  score,
  index = 0,
}: {
  source: SourceDefinition;
  score?: number;
  index?: number;
}) {
  const { openDetail } = useUI();
  const accent = SPHERE_COLOR[source.sphere];

  return (
    <motion.button
      onClick={() => openDetail(source)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
      className="text-left"
    >
      <GlassCard interactive className="group h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
          >
            <Plug size={18} />
          </span>
          {score !== undefined && score < 1 && (
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.max(8, Math.round(score * 100))}%`, backgroundColor: accent }}
                />
              </span>
              {Math.round(score * 100)}%
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-[15px] font-bold leading-tight text-ink line-clamp-2">
          {source.name}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted line-clamp-2">
          {source.short_description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge color={accent}>{SPHERE_LABEL[source.sphere]}</Badge>
          {source.categories.slice(0, 2).map((c) => (
            <Badge key={c} color={categoryColor(c)}>
              {categoryLabel(c)}
            </Badge>
          ))}
          {source.requires_auth && (
            <Badge color="#f59e0b">
              <KeyRound size={11} /> token
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
          <span className="text-xs font-medium text-ink-muted">
            {source.has_connector ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> conector ativo
              </span>
            ) : (
              "catálogo"
            )}
          </span>
          <ArrowRight
            size={16}
            className="text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-600"
          />
        </div>
      </GlassCard>
    </motion.button>
  );
}
