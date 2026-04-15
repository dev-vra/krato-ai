import { nanoid } from "nanoid";
import { logger } from "../utils/logger.js";
import { embed, qdrant } from "./vector.js";

/**
 * RAG isolado por projeto (Memoria Episodica).
 *
 * Cada projeto recebe uma "collection" propria no Qdrant, garantindo que
 * vetores do projeto X nunca vazem para o contexto do projeto Y. Chunks
 * sao segmentados pela sintaxe (funcao, export, bloco Markdown) usando
 * heuristicas simples — suficientes para manter escopos TS/JS coerentes.
 */

export interface Chunk {
  id: string;
  text: string;
  path: string;
  lang?: string;
  projectId: string;
  createdAt: string;
}

export class ProjectRAG {
  constructor(private projectId: string) {}

  private get collection(): string {
    return `krato-project-${this.projectId}`;
  }

  async init(): Promise<void> {
    await qdrant.ensureCollection(this.collection);
  }

  /** Indexa um arquivo quebrando em chunks sintaticos. */
  async indexFile(path: string, content: string, lang?: string): Promise<number> {
    const chunks = chunkBySyntax(content, lang);
    if (!chunks.length) return 0;

    const vectors = await Promise.all(chunks.map((c) => embed(c)));
    const points = chunks.map((text, i) => ({
      id: nanoid(),
      vector: vectors[i]!,
      payload: {
        text,
        path,
        lang,
        projectId: this.projectId,
        createdAt: new Date().toISOString(),
      },
    }));

    await qdrant.upsert(this.collection, points);
    logger.debug({ path, chunks: chunks.length, projectId: this.projectId }, "rag.indexFile");
    return chunks.length;
  }

  async retrieve(query: string, limit = 8): Promise<Chunk[]> {
    const vec = await embed(query);
    const hits = await qdrant.search(this.collection, vec, limit);
    return hits.map((h) => ({
      id: h.id,
      text: String(h.payload["text"] ?? ""),
      path: String(h.payload["path"] ?? ""),
      lang: h.payload["lang"] as string | undefined,
      projectId: this.projectId,
      createdAt: String(h.payload["createdAt"] ?? ""),
    }));
  }
}

/**
 * Chunker sensivel a sintaxe. Para arquivos JS/TS, tenta quebrar em blocos
 * de funcao/classe/export; para Markdown, em secoes de cabecalho. Para
 * outros tipos, cai em janelas deslizantes por linha (max 80 linhas,
 * overlap de 10).
 */
export function chunkBySyntax(content: string, lang?: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const isCode = lang && /^(ts|tsx|js|jsx|mjs|cjs)$/i.test(lang);
  if (isCode) return chunkCode(trimmed);

  const isMd = lang && /^(md|mdx|markdown)$/i.test(lang);
  if (isMd) return chunkMarkdown(trimmed);

  return chunkWindow(trimmed);
}

function chunkCode(src: string): string[] {
  // Quebra em blocos de nivel superior: export, function, class, const fn = ...
  const lines = src.split("\n");
  const boundaries: number[] = [0];
  const re = /^(export\s+|async\s+function\s+|function\s+|class\s+|interface\s+|type\s+|const\s+\w+\s*=\s*(async\s+)?\()/;
  for (let i = 1; i < lines.length; i++) {
    if (re.test(lines[i]!)) boundaries.push(i);
  }
  boundaries.push(lines.length);

  const chunks: string[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]!;
    const end = boundaries[i + 1]!;
    const slice = lines.slice(start, end).join("\n").trim();
    if (slice.length > 40) chunks.push(slice);
  }
  return chunks.length ? chunks : chunkWindow(src);
}

function chunkMarkdown(src: string): string[] {
  const parts = src.split(/\n(?=#{1,6}\s)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 20);
}

function chunkWindow(src: string, size = 80, overlap = 10): string[] {
  const lines = src.split("\n");
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += size - overlap) {
    const slice = lines.slice(i, i + size).join("\n").trim();
    if (slice) chunks.push(slice);
  }
  return chunks;
}
