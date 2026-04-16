import { Bot, Context } from "grammy";
import { env } from "../config/env.js";
import { personalAgent } from "../agents/personal.js";
import { logger } from "../utils/logger.js";
import { globalMemory } from "../memory/global.js";
import { createReadStream, writeFileSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export interface TelegramSession {
  userId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  lastInteraction: Date;
  conversationHistory: Array<{ role: string; content: string; timestamp: Date }>;
  preferences: {
    voiceResponses?: boolean;
    language?: string;
  };
}

const sessions = new Map<string, TelegramSession>();

function getSession(ctx: Context): TelegramSession {
  const userId = String(ctx.from?.id);
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      userId,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      username: ctx.from?.username,
      lastInteraction: new Date(),
      conversationHistory: [],
      preferences: {
        voiceResponses: false,
        language: "pt-BR",
      },
    });
  }
  const session = sessions.get(userId)!;
  session.lastInteraction = new Date();
  return session;
}

function addToHistory(session: TelegramSession, role: string, content: string) {
  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
  });
  // Mantém apenas últimas 20 mensagens para contexto
  if (session.conversationHistory.length > 20) {
    session.conversationHistory.shift();
  }
}

export async function startTelegramBot() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not configured. Telegram bot disabled.");
    return null;
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Comando /start
  bot.command("start", async (ctx) => {
    const session = getSession(ctx);
    const welcomeMessage = `👋 Olá, ${session.firstName || 'usuário'}! 

Sou o Krato Personal, seu assistente pessoal inteligente.

Posso te ajudar com:
• 📝 **Tarefas**: "preciso comprar leite", "agendar reunião amanhã"
• 💰 **Gastos**: "gastei 50 reais no mercado", "compra de R$ 100"
• 📋 **Listar**: "o que tenho pra fazer?", "mostrar tarefas pendentes"
• 💡 **Notas/Ideias**: "lembrar que...", "ideia: criar app de..."
• ❓ **Dúvidas**: "qual a capital da França?", "como funciona..."
• 💬 **Conversar**: bate-papo geral

Experimente enviar uma mensagem!`;

    await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
    logger.info({ userId: session.userId }, "telegram: user started bot");
  });

  // Comando /help
  bot.command("help", async (ctx) => {
    const helpMessage = `📖 **Comandos disponíveis:**

/start - Iniciar interação
/help - Mostrar esta ajuda
/tasks - Listar tarefas pendentes
/expenses - Resumo de gastos
/profile - Meu perfil
/clear - Limpar histórico da conversa
/voice on|off - Ativar/desativar respostas em áudio
/lang pt|en - Mudar idioma (português/inglês)

**Exemplos de uso:**
- "Preciso entregar relatório até sexta"
- "Gastei 45 reais no almoço"
- "O que tenho pra fazer hoje?"
- "Qual a previsão do tempo?"

**Mídia suportada:**
📸 Fotos com descrição
🎤 Áudios (transcrição + resposta)
📄 Documentos (PDF, Word, TXT, MD)`;

    await ctx.reply(helpMessage, { parse_mode: "Markdown" });
  });

  // Comando /tasks
  bot.command("tasks", async (ctx) => {
    const session = getSession(ctx);
    await ctx.reply("🔄 Buscando suas tarefas...");
    
    try {
      const result = await personalAgent.run(
        {
          sessionId: `telegram-${session.userId}`,
          actorId: session.userId,
          projectId: "personal",
          goal: "listar tarefas pendentes",
          blackboard: { publish: () => {}, all: () => [] } as any,
        },
        "listar tarefas pendentes"
      );
      
      await ctx.reply(result.summary, { parse_mode: "Markdown" });
    } catch (error) {
      logger.error(error, "telegram: error listing tasks");
      await ctx.reply("❌ Erro ao buscar tarefas. Tente novamente.");
    }
  });

  // Comando /expenses
  bot.command("expenses", async (ctx) => {
    await ctx.reply("📊 **Resumo de gastos**\n\nEm implementação...");
  });

  // Comando /profile
  bot.command("profile", async (ctx) => {
    const session = getSession(ctx);
    const facts = globalMemory.listFacts(session.userId);
    
    let profile = `👤 **Seu Perfil**\n\n`;
    profile += `ID: \`${session.userId}\`\n`;
    if (session.username) profile += `Username: @${session.username}\n`;
    profile += `\n📚 **Fatos aprendidos:** ${facts.length}\n`;
    
    if (facts.length > 0) {
      profile += "\n" + facts.slice(0, 5).map(f => `• ${f.text}`).join("\n");
      if (facts.length > 5) profile += `\n• ... e mais ${facts.length - 5}`;
    }
    
    await ctx.reply(profile, { parse_mode: "Markdown" });
  });

  // Comando /clear
  bot.command("clear", async (ctx) => {
    const session = getSession(ctx);
    session.conversationHistory = [];
    await ctx.reply("🧹 Histórico da conversa limpo!");
    logger.info({ userId: session.userId }, "telegram: conversation history cleared");
  });

  // Comando /voice
  bot.command("voice", async (ctx) => {
    const session = getSession(ctx);
    const args = ctx.message?.text?.split(" ").slice(1).join(" ").toLowerCase() || "";
    
    if (args === "on") {
      session.preferences.voiceResponses = true;
      await ctx.reply("🎤 Respostas em áudio ativadas! Agora responderei com voz.");
    } else if (args === "off") {
      session.preferences.voiceResponses = false;
      await ctx.reply("🔇 Respostas em áudio desativadas. Responderei com texto.");
    } else {
      const status = session.preferences.voiceResponses ? "ativado" : "desativado";
      await ctx.reply(`🎤 Status atual: respostas em áudio ${status}.\nUse /voice on ou /voice off para mudar.`);
    }
  });

  // Comando /lang
  bot.command("lang", async (ctx) => {
    const session = getSession(ctx);
    const args = ctx.message?.text?.split(" ").slice(1).join(" ").toLowerCase() || "";
    
    if (args === "pt" || args === "pt-br" || args === "português") {
      session.preferences.language = "pt-BR";
      await ctx.reply("🇧🇷 Idioma alterado para Português (Brasil).");
    } else if (args === "en" || args === "english" || args === "inglês") {
      session.preferences.language = "en";
      await ctx.reply("🇺🇸 Language changed to English.");
    } else {
      await ctx.reply(`🌐 Idioma atual: ${session.preferences.language === 'pt-BR' ? 'Português' : 'English'}\nUse /lang pt ou /lang en para mudar.`);
    }
  });

  // Handler para mensagens de texto
  bot.on("message:text", async (ctx) => {
    const session = getSession(ctx);
    const message = ctx.message.text;
    
    logger.info(
      { userId: session.userId, message: message.substring(0, 50) },
      "telegram: received message"
    );

    // Adiciona mensagem do usuário ao histórico
    addToHistory(session, "user", message);

    // Envia indicador de "digitando..."
    await ctx.api.sendChatAction(ctx.chat.id, "typing");

    try {
      // Constrói contexto com histórico recente
      const context = {
        sessionId: `telegram-${session.userId}`,
        actorId: session.userId,
        projectId: "personal",
        goal: "assistir usuário em tarefas pessoais, gastos, notas e dúvidas",
        blackboard: { 
          publish: () => {}, 
          all: () => [],
        } as any,
      };

      // Executa o agente pessoal
      const result = await personalAgent.run(context, message);

      // Adiciona resposta ao histórico
      addToHistory(session, "assistant", result.summary);

      // Envia resposta (texto ou áudio)
      await sendResponse(ctx, session, result.summary);

      logger.info(
        { userId: session.userId, responseLength: result.summary.length },
        "telegram: sent response"
      );
    } catch (error) {
      logger.error(error, "telegram: error processing message");
      await ctx.reply(
        "❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
      );
    }
  });

  // Handler para áudios (voice messages)
  bot.on("message:voice", async (ctx) => {
    const session = getSession(ctx);
    
    logger.info(
      { userId: session.userId, fileId: ctx.message.voice.file_id },
      "telegram: received voice message"
    );

    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    await ctx.reply("🎤 Ouvindo seu áudio...");

    try {
      // Baixa o arquivo de áudio
      const file = await ctx.api.getFile(ctx.message.voice.file_id);
      const filePath = join(tmpdir(), `voice-${Date.now()}.ogg`);
      
      const response = await axios.get(file.file_path!, {
        responseType: 'arraybuffer',
        baseURL: `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/`,
      });
      
      writeFileSync(filePath, Buffer.from(response.data as ArrayBuffer));

      // Transcreve o áudio usando Whisper (Ollama)
      const transcription = await transcribeAudio(filePath);
      
      // Limpa arquivo temporário
      unlinkSync(filePath);

      logger.info({ transcription }, "telegram: audio transcribed");

      // Processa a transcrição como mensagem de texto
      addToHistory(session, "user", `[Áudio transcrito]: ${transcription}`);

      const context = {
        sessionId: `telegram-${session.userId}-voice-${Date.now()}`,
        actorId: session.userId,
        projectId: "personal",
        goal: "responder a mensagem de áudio do usuário",
        blackboard: { publish: () => {}, all: () => [] } as any,
      };

      const result = await personalAgent.run(context, transcription);
      addToHistory(session, "assistant", result.summary);

      // Responde em áudio se preferido, senão texto
      if (session.preferences.voiceResponses) {
        await sendVoiceResponse(ctx, result.summary);
      } else {
        await sendResponse(ctx, session, result.summary);
      }

    } catch (error) {
      logger.error(error, "telegram: error processing voice message");
      await ctx.reply("❌ Erro ao processar áudio. Tente enviar novamente.");
    }
  });

  // Handler para arquivos de áudio (documentos)
  bot.on("message:audio", async (ctx) => {
    const session = getSession(ctx);
    const caption = ctx.message.caption || "";
    
    logger.info(
      { userId: session.userId, hasCaption: !!caption },
      "telegram: received audio file"
    );

    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    await ctx.reply("🎵 Processando arquivo de áudio...");

    try {
      const file = await ctx.api.getFile(ctx.message.audio.file_id);
      const filePath = join(tmpdir(), `audio-${Date.now()}.${ctx.message.audio.file_name?.split('.').pop() || 'mp3'}`);
      
      const response = await axios.get(file.file_path!, {
        responseType: 'arraybuffer',
        baseURL: `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/`,
      });
      
      writeFileSync(filePath, Buffer.from(response.data as ArrayBuffer));

      const transcription = await transcribeAudio(filePath);
      unlinkSync(filePath);

      const message = caption ? `${caption}\n\n[Transcrição do áudio]: ${transcription}` : transcription;
      addToHistory(session, "user", message);

      const context = {
        sessionId: `telegram-${session.userId}-audio-${Date.now()}`,
        actorId: session.userId,
        projectId: "personal",
        goal: "processar arquivo de áudio",
        blackboard: { publish: () => {}, all: () => [] } as any,
      };

      const result = await personalAgent.run(context, message);
      addToHistory(session, "assistant", result.summary);

      if (session.preferences.voiceResponses) {
        await sendVoiceResponse(ctx, result.summary);
      } else {
        await sendResponse(ctx, session, result.summary);
      }

    } catch (error) {
      logger.error(error, "telegram: error processing audio file");
      await ctx.reply("❌ Erro ao processar arquivo de áudio.");
    }
  });

  // Handler para documentos (PDF, Word, TXT, MD)
  bot.on("message:document", async (ctx) => {
    const session = getSession(ctx);
    const caption = ctx.message.caption || "";
    const fileName = ctx.message.document.file_name || "documento";
    const mimeType = ctx.message.document.mime_type || "";
    
    logger.info(
      { userId: session.userId, fileName, mimeType },
      "telegram: received document"
    );

    await ctx.api.sendChatAction(ctx.chat.id, "typing");
    await ctx.reply(`📄 Recebido: ${fileName}\n\nLendo documento...`);

    try {
      const file = await ctx.api.getFile(ctx.message.document.file_id);
      const extension = fileName.split('.').pop()?.toLowerCase() || 'txt';
      const filePath = join(tmpdir(), `doc-${Date.now()}.${extension}`);
      
      const response = await axios.get(file.file_path!, {
        responseType: 'arraybuffer',
        baseURL: `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/`,
      });
      
      writeFileSync(filePath, Buffer.from(response.data as ArrayBuffer));

      // Extrai texto do documento
      const textContent = await extractDocumentText(filePath, extension);
      unlinkSync(filePath);

      logger.info(
        { fileName, textLength: textContent.length },
        "telegram: document text extracted"
      );

      const message = caption 
        ? `${caption}\n\n[Conteúdo do documento ${fileName}]:\n${textContent}`
        : `[Documento ${fileName}]:\n${textContent}`;
      
      addToHistory(session, "user", message);

      const context = {
        sessionId: `telegram-${session.userId}-doc-${Date.now()}`,
        actorId: session.userId,
        projectId: "personal",
        goal: "analisar documento e responder",
        blackboard: { publish: () => {}, all: () => [] } as any,
      };

      const result = await personalAgent.run(context, message);
      addToHistory(session, "assistant", result.summary);

      await sendResponse(ctx, session, result.summary);

    } catch (error) {
      logger.error(error, "telegram: error processing document");
      await ctx.reply("❌ Erro ao processar documento. Formatos suportados: PDF, DOC, DOCX, TXT, MD.");
    }
  });

  // Handler para fotos com legenda
  bot.on("message:photo", async (ctx) => {
    const session = getSession(ctx);
    const caption = ctx.message.caption || "";
    
    logger.info(
      { userId: session.userId, hasCaption: !!caption },
      "telegram: received photo"
    );

    await ctx.api.sendChatAction(ctx.chat.id, "typing");

    if (caption) {
      // Processa legenda como mensagem de texto
      await ctx.reply(`📸 Foto recebida com descrição!\n\nProcessando: "${caption}"`);
      
      try {
        const context = {
          sessionId: `telegram-${session.userId}-photo-${Date.now()}`,
          actorId: session.userId,
          projectId: "personal",
          goal: "processar descricao de foto",
          blackboard: { 
            publish: () => {}, 
            all: () => [],
          } as any,
        };

        const result = await personalAgent.run(context, caption);
        addToHistory(session, "assistant", result.summary);
        await sendResponse(ctx, session, result.summary);
      } catch (error) {
        logger.error(error, "telegram: error processing photo caption");
        await ctx.reply("❌ Erro ao processar descrição da foto.");
      }
    } else {
      await ctx.reply("📸 Foto recebida! Se quiser que eu faça algo com ela, adicione uma descrição na próxima vez.");
    }
  });

  // Error handler
  bot.catch((err) => {
    logger.error(err.ctx, "telegram: error while handling update");
  });

  // Inicia polling
  logger.info({ port: env.PORT }, "telegram: starting bot polling...");
  
  // Graceful shutdown
  process.once("SIGINT", () => bot.stop());
  process.once("SIGTERM", () => bot.stop());

  await bot.start({
    onStart: async () => {
      const botInfo = await bot.api.getMe();
      logger.info({ botInfo }, "telegram: bot started successfully");
    },
  });

  return bot;
}

/**
 * Envia resposta como texto ou áudio baseado na preferência do usuário
 */
async function sendResponse(ctx: Context, session: TelegramSession, text: string) {
  const maxLen = 4096;
  
  if (text.length <= maxLen) {
    await ctx.reply(text, { parse_mode: "Markdown" });
  } else {
    // Divide em múltiplas mensagens
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
      chunks.push(text.substring(i, i + maxLen));
    }
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: "Markdown" });
    }
  }
}

/**
 * Transcreve áudio usando Whisper via Ollama ou ffmpeg + whisper.cpp
 */
async function transcribeAudio(filePath: string): Promise<string> {
  try {
    // Opção 1: Usar OpenAI Whisper API (se OPENAI_API_KEY configurado)
    if (env.OPENAI_API_KEY) {
      logger.info("Transcribing audio with OpenAI Whisper API");
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        createReadStream(filePath),
        {
          headers: {
            'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data'
          },
          params: { model: 'whisper-1' }
        }
      ) as any;
      return response.data.text;
    }
    
    // Opção 2: Usar Whisper.cpp local (se instalado)
    try {
      const { stdout } = await execAsync(`which whisper-cpp`);
      if (stdout.trim()) {
        logger.info("Transcribing audio with whisper.cpp");
        const wavPath = filePath.replace('.ogg', '.wav');
        // Converte OGG para WAV
        await execAsync(`ffmpeg -y -i ${filePath} -ar 16000 -ac 1 -c:a pcm_s16le ${wavPath}`);
        const { stdout: transcription } = await execAsync(
          `whisper-cpp -m models/ggml-base.bin -f ${wavPath} -l pt --output-json`
        );
        unlinkSync(wavPath);
        return transcription || "[Áudio transcrito - conteúdo não extraído]";
      }
    } catch (e) {
      logger.debug("whisper.cpp not available");
    }
    
    // Opção 3: Usar Piper TTS (local) para síntese básica
    try {
      const { stdout } = await execAsync(`which piper`);
      if (stdout.trim()) {
        logger.info("Using Piper for audio processing");
        // Implementação futura para Piper
      }
    } catch (e) {
      logger.debug("Piper not available");
    }
    
    // Fallback: Retorna placeholder informativo
    logger.warn("No transcription service configured. Install whisper.cpp or set OPENAI_API_KEY");
    return "[Áudio recebido - configure OPENAI_API_KEY ou instale whisper.cpp para transcrição]";
    
  } catch (error) {
    logger.error(error, "Error transcribing audio");
    return `[Erro na transcrição: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`;
  }
}

/**
 * Extrai texto de documentos (PDF, DOC, DOCX, TXT, MD)
 */
async function extractDocumentText(filePath: string, extension: string): Promise<string> {
  try {
    // Implementação para diferentes formatos
    switch (extension) {
      case 'txt':
      case 'md':
      case 'markdown': {
        // Leitura direta de arquivos de texto
        return readFileSync(filePath, 'utf-8');
      }
      
      case 'pdf': {
        // PDF usando pdf-parse (ESM module)
        const { PDFParse } = await import('pdf-parse');
        const dataBuffer = readFileSync(filePath);
        // PDFParse é uma classe que precisa ser instanciada
        const parser = new (PDFParse as any)({ data: dataBuffer });
        const doc: any = await (parser as any).load();
        const textContent = await doc.getTextContent();
        let text = '';
        for (const item of textContent.items) {
          text += item.str + ' ';
        }
        return text.trim() || '[PDF sem texto extraível]';
      }
      
      case 'docx': {
        // DOCX usando mammoth
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '[DOCX sem texto extraível]';
      }
      
      case 'doc': {
        // DOC antigo - tenta converter via pandoc se disponível
        try {
          const { stdout } = await execAsync(`which pandoc`);
          if (stdout.trim()) {
            const txtPath = filePath.replace('.doc', '.txt');
            await execAsync(`pandoc -s ${filePath} -o ${txtPath}`);
            const content = readFileSync(txtPath, 'utf-8');
            unlinkSync(txtPath);
            return content;
          }
        } catch (e) {
          logger.debug("pandoc not available for .doc conversion");
        }
        return `[Documento .doc detectado. Instale pandoc ou converta para .docx/.txt]`;
      }
      
      default:
        return `[Formato ${extension} não suportado. Use PDF, DOCX, DOC, TXT ou MD]`;
    }
  } catch (error) {
    logger.error(error, "Error extracting text from document");
    return `[Erro ao ler documento: ${error instanceof Error ? error.message : 'Erro desconhecido'}]`;
  }
}

/**
 * Envia resposta como áudio usando TTS (Text-to-Speech)
 */
async function sendVoiceResponse(ctx: Context, text: string) {
  try {
    // Remove formatação Markdown para TTS
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .substring(0, 4000); // Limite do Telegram

    // Gera áudio usando serviço TTS (ex: Google TTS, Azure, ou local)
    // Esta é uma implementação simplificada
    const audioPath = join(tmpdir(), `tts-${Date.now()}.ogg`);
    
    // Em produção, integrar com serviço TTS real
    // Exemplo com ffmpeg e sistema TTS do SO:
    // execSync(`echo "${cleanText}" | espeak -v pt-br --stdout | ffmpeg -i - -f ogg -codec:a libopus ${audioPath}`);
    
    // Placeholder: envia mensagem explicativa
    await ctx.reply(
      `🎤 **Resposta em áudio**\n\n` +
      `Para ativar respostas em áudio reais, configure um serviço TTS:\n` +
      `- Google Cloud Text-to-Speech\n` +
      `- Amazon Polly\n` +
      `- Azure Cognitive Services\n` +
      `- Ou use Piper TTS local\n\n` +
      `Texto da resposta:\n${cleanText}`,
      { parse_mode: "Markdown" }
    );
    
    // Se arquivo de áudio fosse gerado:
    // await ctx.replyWithVoice({ source: createReadStream(audioPath) });
    // unlinkSync(audioPath);
    
  } catch (error) {
    logger.error(error, "Error generating voice response");
    await ctx.reply(text, { parse_mode: "Markdown" });
  }
}
