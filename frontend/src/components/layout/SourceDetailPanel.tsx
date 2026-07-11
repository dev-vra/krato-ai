import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpenText,
  FileText,
  Info,
  KeyRound,
  Layers,
  Link2,
  Plug,
  X,
} from "lucide-react";
import { ACCESS_LABEL, BRANCH_LABEL, categoryColor, categoryLabel, SPHERE_LABEL } from "@/lib/labels";
import { useUI } from "@/store/ui";
import { Badge } from "@/components/ui/primitives";

export function SourceDetailPanel() {
  const { detail, closeDetail, openModal } = useUI();

  return (
    <AnimatePresence>
      {detail && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDetail}
          />
          <motion.aside
            initial={{ x: -380, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-[380px] flex-col glass-rail border-r"
          >
            {/* Cabeçalho */}
            <div className="flex items-start gap-3 px-5 py-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <Layers size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-bold leading-tight text-ink">
                  {detail.name}
                </h2>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{SPHERE_LABEL[detail.sphere]}</Badge>
                  <Badge>{BRANCH_LABEL[detail.branch]}</Badge>
                  {detail.requires_auth && (
                    <Badge color="#f59e0b">
                      <KeyRound size={11} /> Token
                    </Badge>
                  )}
                </div>
              </div>
              <button
                onClick={closeDetail}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-white/70"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto scroll-slim px-5 pb-8">
              <Section icon={Info} title="Sobre">
                <p className="text-sm leading-relaxed text-ink-soft">{detail.short_description}</p>
              </Section>

              <Section icon={BookOpenText} title="Categorias de dado">
                <div className="flex flex-wrap gap-1.5">
                  {detail.categories.length === 0 && (
                    <span className="text-sm text-ink-muted">Catálogo / meta-fonte</span>
                  )}
                  {detail.categories.map((c) => (
                    <Badge key={c} color={categoryColor(c)}>
                      {categoryLabel(c)}
                    </Badge>
                  ))}
                </div>
              </Section>

              <Section icon={Plug} title="Acesso & formatos">
                <div className="flex flex-wrap gap-1.5">
                  {detail.access.map((a) => (
                    <span
                      key={a}
                      className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-medium text-ink-soft"
                    >
                      {ACCESS_LABEL[a]}
                    </span>
                  ))}
                  {detail.formats.map((f) => (
                    <span key={f} className="rounded-lg bg-canvas px-2.5 py-1 text-xs text-ink-muted">
                      {f}
                    </span>
                  ))}
                </div>
              </Section>

              {detail.notes && (
                <Section icon={Info} title="Nota de engenharia">
                  <p className="rounded-xl bg-amber-50/80 px-3 py-2.5 text-sm leading-relaxed text-amber-900/90 border border-amber-100">
                    {detail.notes}
                  </p>
                </Section>
              )}

              <Section icon={Link2} title="Endpoints">
                <div className="space-y-1.5">
                  {detail.endpoints.map((e) => (
                    <a
                      key={e.url}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-2 rounded-xl bg-white/60 px-3 py-2 text-sm transition-colors hover:bg-white"
                    >
                      <span className="flex-1 truncate">
                        <span className="font-medium text-ink">{e.label}</span>
                        <span className="ml-2 text-xs text-ink-muted">{e.kind}</span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className="text-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:text-brand-600"
                      />
                    </a>
                  ))}
                </div>
              </Section>
            </div>

            {/* Rodapé de ações */}
            <div className="border-t border-line/60 p-4">
              <button
                onClick={() => openModal(detail)}
                disabled={!detail.has_connector}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-muted"
              >
                <FileText size={16} />
                {detail.has_connector ? "Consultar dados & documentos" : "Sem conector (catálogo)"}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <Icon size={13} /> {title}
      </div>
      {children}
    </div>
  );
}
