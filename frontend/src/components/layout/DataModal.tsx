import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Database, ExternalLink, Play, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ConnectorParam, NormalizedRecord } from "@/lib/types";
import { formatBRL, formatDate } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { Skeleton, Spinner } from "@/components/ui/primitives";

export function DataModal() {
  const { modalSource, closeModal } = useUI();
  const sourceId = modalSource?.id;

  const { data: connectors, isLoading: loadingConnectors } = useQuery({
    queryKey: ["connectors"],
    queryFn: () => api.connectors(),
    enabled: !!modalSource,
  });

  const connector = useMemo(
    () => connectors?.find((c) => c.source_id === sourceId),
    [connectors, sourceId],
  );

  const [params, setParams] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<NormalizedRecord[] | null>(null);

  const fetchMut = useMutation({
    mutationFn: () => api.runConnector(sourceId!, params),
    onSuccess: (res) => setRecords(res.records),
  });

  if (!modalSource) return null;

  return (
    <AnimatePresence>
      {modalSource && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-md" onClick={closeModal} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-[82vh] w-full max-w-4xl flex-col glass-strong rounded-3xl overflow-hidden"
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 border-b border-line/70 px-6 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Database size={18} />
              </span>
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold text-ink">{modalSource.name}</h2>
                <p className="text-xs text-ink-muted">
                  Consulta ao vivo via conector · {connector?.label ?? "carregando…"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-white/70"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corpo */}
            <div className="grid flex-1 grid-cols-[280px_1fr] overflow-hidden">
              {/* Parâmetros */}
              <div className="border-r border-line/60 p-5 overflow-y-auto scroll-slim">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Parâmetros
                </h3>
                {loadingConnectors ? (
                  <div className="space-y-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(connector?.params ?? []).map((p) => (
                      <ParamField
                        key={p.name}
                        param={p}
                        value={params[p.name] ?? ""}
                        onChange={(v) => setParams((prev) => ({ ...prev, [p.name]: v }))}
                      />
                    ))}
                    <button
                      onClick={() => fetchMut.mutate()}
                      disabled={fetchMut.isPending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                    >
                      {fetchMut.isPending ? <Spinner className="border-white/60 border-t-white" /> : <Play size={15} />}
                      Consultar
                    </button>
                    {fetchMut.isError && (
                      <p className="text-xs text-rose-600">
                        Falha ao consultar. Verifique os parâmetros ou o token.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Resultados */}
              <div className="overflow-y-auto scroll-slim p-5">
                {fetchMut.isPending && <RecordsSkeleton />}
                {!fetchMut.isPending && records === null && (
                  <div className="grid h-full place-items-center text-center text-sm text-ink-muted">
                    <div>
                      <Database size={28} className="mx-auto mb-2 opacity-40" />
                      Preencha os parâmetros e consulte para ver os registros normalizados.
                    </div>
                  </div>
                )}
                {!fetchMut.isPending && records !== null && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-ink-muted">{records.length} registro(s)</p>
                    {records.map((r) => (
                      <RecordRow key={r.id} r={r} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ConnectorParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const type = param.kind === "date" ? "date" : param.kind === "number" ? "number" : "text";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">
        {param.label}
        {param.required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-white/70 px-3 text-sm text-ink outline-none focus:border-brand-400 focus-ring"
      />
      {param.help && <span className="mt-1 block text-[11px] text-ink-muted">{param.help}</span>}
    </label>
  );
}

function RecordRow({ r }: { r: NormalizedRecord }) {
  return (
    <div className="rounded-xl border border-line/70 bg-white/60 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug text-ink">{r.title}</p>
        {r.amount != null && (
          <span className="shrink-0 font-display text-sm font-bold text-brand-700">
            {formatBRL(r.amount)}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {r.entity_name && <span>🏛 {r.entity_name}</span>}
        {r.counterparty_name && <span>→ {r.counterparty_name}</span>}
        {r.municipality && <span>📍 {r.municipality}{r.uf ? `/${r.uf}` : ""}</span>}
        {r.occurred_on && <span>{formatDate(r.occurred_on)}</span>}
        {r.source_url && (
          <a
            href={r.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
          >
            fonte <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function RecordsSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line/70 bg-white/50 p-3.5">
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-2 flex gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
