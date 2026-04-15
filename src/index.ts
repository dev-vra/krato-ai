/**
 * Entrypoint agregador — exporta as principais APIs para integracao programatica.
 */
export { orchestrator, Orchestrator, type RunOptions, type RunResult, type OrchestratorEvent } from "./orchestrator/graph.js";
export { Blackboard } from "./orchestrator/blackboard.js";
export { ProductAgent } from "./agents/product.js";
export { DesignAgent } from "./agents/design.js";
export { DeveloperAgent } from "./agents/developer.js";
export { QAAgent } from "./agents/qa.js";
export { DevSecOpsAgent } from "./agents/devsecops.js";
export { globalMemory, GlobalMemory, type GlobalFact } from "./memory/global.js";
export { ProjectRAG } from "./memory/rag.js";
export { router as llmRouter, HybridRouter } from "./llm/router.js";
export { ollama, OllamaProvider } from "./llm/ollama.js";
export { cloud, CloudProvider } from "./llm/cloud.js";
export { mcp, McpClient } from "./execution/mcp-client.js";
export { defaultPolicy, decide as policyDecide, type ExecPolicy } from "./execution/policy.js";
export { env } from "./config/env.js";
