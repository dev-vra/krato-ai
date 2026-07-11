import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const COMPACT = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

export const formatBRL = (v: number | null | undefined): string =>
  v == null ? "—" : BRL.format(v);

export const formatCompact = (v: number | null | undefined): string =>
  v == null ? "—" : COMPACT.format(v);

export const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
