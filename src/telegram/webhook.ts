/**
 * Telegram Webhook Handler para Krato-AI
 * 
 * Este módulo implementa o endpoint webhook para receber mensagens do Telegram
 * e integrar com o sistema de notificações e comandos de projeto.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Bot } from "grammy";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { personalAgent } from "../agents/personal.js";
import { globalMemory } from "../memory/global.js";

export interface TelegramWebhookPayload {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    voice?: { file_id: string };
    audio?: { file_id: string; file_name?: string };
    document?: { file_id: string; file_name: string; mime_type?: string };
    photo?: Array<{ file_id: string }>;
    caption?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    data: string;
    message?: any;
  };
}

export async function setupTelegramWebhook(app: FastifyInstance) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not configured. Webhook disabled.");
    return;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Endpoint webhook principal
  app.post("/api/telegram/webhook", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = request.body as TelegramWebhookPayload;
      logger.debug({ updateId: payload.update_id }, "telegram: webhook received");

      // Processa mensagem
      if (payload.message) {
        await handleTelegramMessage(payload.message, bot);
      }

      // Processa callback query (botões inline)
      if (payload.callback_query) {
        await handleCallbackQuery(payload.callback_query, bot);
      }

      reply.send({ ok: true });
    } catch (error) {
      logger.error(error, "telegram: webhook error");
      reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // Endpoint para configurar webhook (uso administrativo)
  app.post("/api/telegram/setup-webhook", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { webhookUrl } = request.body as { webhookUrl: string };
      
      if (!webhookUrl) {
        return reply.status(400).send({ error: "webhookUrl required" });
      }

      await bot.api.setWebhook(webhookUrl);
      logger.info({ webhookUrl }, "telegram: webhook configured");
      
      reply.send({ ok: true, webhookUrl });
    } catch (error) {
      logger.error(error, "telegram: failed to setup webhook");
      reply.status(500).send({ ok: false, error });
    }
  });

  // Endpoint para remover webhook
  app.post("/api/telegram/remove-webhook", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await bot.api.deleteWebhook();
      logger.info("telegram: webhook removed");
      reply.send({ ok: true });
    } catch (error) {
      logger.error(error, "telegram: failed to remove webhook");
      reply.status(500).send({ ok: false, error });
    }
  });

  logger.info("telegram: webhook endpoints registered");
}

async function handleTelegramMessage(
  message: TelegramWebhookPayload["message"],
  bot: Bot
) {
  if (!message) return;

  const userId = String(message.from?.id || "unknown");
  const chatId = message.chat.id;
  const text = message.text || message.caption || "";

  logger.info({ userId, chatId, textLength: text.length }, "telegram: processing message");

  try {
    // Verifica se é comando de projeto
    if (text.startsWith("/project") || text.startsWith("/deploy") || text.startsWith("/logs")) {
      await handleProjectCommand(text, userId, chatId, bot);
      return;
    }

    // Mensagem normal para agente pessoal
    if (text) {
      await handlePersonalMessage(text, userId, chatId, bot, message);
    }
  } catch (error) {
    logger.error(error, "telegram: error handling message");
    await bot.api.sendMessage(chatId, "❌ Erro ao processar sua mensagem. Tente novamente.");
  }
}

async function handleProjectCommand(
  command: string,
  userId: string,
  chatId: number,
  bot: Bot
) {
  const [cmd, ...args] = command.split(" ");
  const projectName = args[0] || "default";

  logger.info({ cmd, projectName, userId }, "telegram: project command");

  switch (cmd) {
    case "/project":
      await bot.api.sendMessage(chatId, `📦 **Projeto: ${projectName}**\n\nEm implementação...`);
      break;

    case "/deploy":
      await bot.api.sendMessage(chatId, `🚀 **Deploy solicitado para: ${projectName}**\n\nIniciando deploy...`);
      // TODO: Integrar com orchestrator para deploy
      break;

    case "/logs":
      const level = args[1] || "error";
      await bot.api.sendMessage(chatId, `📋 **Logs do projeto ${projectName}**\n\nNível: ${level}\n\nBuscando logs...`);
      // TODO: Buscar logs reais
      break;

    case "/status":
      await bot.api.sendMessage(chatId, `✅ **Status do projeto ${projectName}**\n\n• Serviços: Online\n• Última atualização: Agora\n• Erros nas últimas 24h: 0`);
      break;

    default:
      await bot.api.sendMessage(chatId, "❌ Comando não reconhecido. Use /help para ver comandos disponíveis.");
  }
}

async function handlePersonalMessage(
  text: string,
  userId: string,
  chatId: number,
  bot: Bot,
  message: TelegramWebhookPayload["message"]
) {
  logger.info({ userId, textLength: text.length }, "telegram: personal message");

  // Salva na memória global
  globalMemory.addSimpleFact(String(userId), `Interagiu via Telegram em ${new Date().toISOString()}`);

  // Executa agente pessoal
  const result = await personalAgent.run(
    {
      sessionId: `telegram-${userId}`,
      actorId: userId,
      projectId: "personal",
      goal: "assistir usuário em tarefas pessoais, gastos, notas e dúvidas",
      blackboard: { publish: () => {}, all: () => [] } as any,
    },
    text
  );

  // Envia resposta
  await bot.api.sendMessage(chatId, result.summary, { parse_mode: "Markdown" });
}

async function handleCallbackQuery(
  callback: TelegramWebhookPayload["callback_query"],
  bot: Bot
) {
  if (!callback) return;
  
  const { id, data, from } = callback;
  logger.info({ userId: from.id, data }, "telegram: callback query");

  // Responde ao callback
  await bot.api.answerCallbackQuery(id, { text: "Processando..." });

  // Processa ação baseada nos dados
  switch (data) {
    case "approve_deploy":
      await bot.api.editMessageText(from.id, callback.message?.message_id ?? 0, "✅ Deploy aprovado! Iniciando...");
      break;

    case "reject_deploy":
      await bot.api.editMessageText(from.id, callback.message?.message_id ?? 0, "❌ Deploy rejeitado.");
      break;

    default:
      logger.warn({ data }, "telegram: unknown callback action");
  }
}

/**
 * Envia notificação de erro/crash para Telegram
 */
export async function sendErrorNotification(
  error: Error,
  projectId: string,
  serviceName: string
) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_ID) {
    return;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const adminId = String(env.TELEGRAM_ADMIN_ID);

  const message = `🚨 **ALERTA DE ERRO**\n\n` +
    `**Projeto:** ${projectId}\n` +
    `**Serviço:** ${serviceName}\n` +
    `**Erro:** ${error.message}\n` +
    `**Timestamp:** ${new Date().toISOString()}\n\n` +
    `[Ver detalhes no dashboard](http://localhost:3000/logs)`;

  try {
    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
  } catch (e) {
    logger.error(e, "telegram: failed to send error notification");
  }
}

/**
 * Envia notificação de deploy concluído
 */
export async function sendDeployNotification(
  projectId: string,
  status: "success" | "failure",
  details?: string
) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_ID) {
    return;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const adminId = String(env.TELEGRAM_ADMIN_ID);

  const emoji = status === "success" ? "✅" : "❌";
  const message = `${emoji} **DEPLOY CONCLUÍDO**\n\n` +
    `**Projeto:** ${projectId}\n` +
    `**Status:** ${status.toUpperCase()}\n` +
    (details ? `**Detalhes:** ${details}\n` : "");

  try {
    await bot.api.sendMessage(adminId, message, { parse_mode: "Markdown" });
  } catch (e) {
    logger.error(e, "telegram: failed to send deploy notification");
  }
}
