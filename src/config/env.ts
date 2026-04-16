import "dotenv/config";
import { z } from "zod";

const bool = z
  .union([z.string(), z.boolean()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes"].includes(v.toLowerCase())));

const schema = z.object({
  PORT: z.coerce.number().default(7070),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),

  OLLAMA_HOST: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_KEEP_ALIVE: z.string().default("-1"),
  OLLAMA_NUM_THREAD: z.coerce.number().default(6),

  KRATO_MODEL_ROUTER: z.string().default("llama3.1:8b-instruct-q4_K_M"),
  KRATO_MODEL_CODER: z.string().default("qwen2.5-coder:7b-instruct-q4_K_M"),
  KRATO_MODEL_EVAL: z.string().default("deepseek-coder-v2:lite-q4_K_M"),
  KRATO_MODEL_EMBED: z.string().default("nomic-embed-text"),

  CLOUD_PROVIDER: z.enum(["anthropic", "openai", "google", "ollama-cloud", "none"]).default("none"),
  CLOUD_API_KEY: z.string().optional().default(""),
  CLOUD_BASE_URL: z.string().optional().default(""),
  CLOUD_MODEL: z.string().default("claude-sonnet-4-6"),
  CLOUD_ESCALATE_ON_MULTIMODAL: bool.default(true),
  CLOUD_ESCALATE_ON_TOKENS: z.coerce.number().default(6000),
  CLOUD_ESCALATE_ON_FAILURES: z.coerce.number().default(2),

  QDRANT_URL: z.string().default("http://127.0.0.1:6333"),
  QDRANT_API_KEY: z.string().optional().default(""),
  KRATO_DATA_DIR: z.string().default("./data"),
  KRATO_DB_PATH: z.string().default("./data/krato.db"),

  MCP_URL: z.string().default(""),
  MCP_TOKEN: z.string().default(""),
  MCP_WORKSPACE: z.string().default("~/workspace/krato-projects"),
  MCP_REQUIRE_APPROVAL: bool.default(true),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_ADMIN_ID: z.coerce.number().optional(),
  OPENAI_API_KEY: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  GOOGLE_TTS_API_KEY: z.string().optional().default(""),
  AZURE_SPEECH_KEY: z.string().optional().default(""),
  PIPER_MODEL_PATH: z.string().optional().default("/opt/piper/models/pt_BR-faber-medium.onnx"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
});

export type Env = z.infer<typeof schema>;
export const env: Env = schema.parse(process.env);
