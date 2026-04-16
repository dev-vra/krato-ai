import { z } from "zod";
import { Agent, type AgentContext, type AgentResult, type Artifact } from "./base.js";

export interface PersonalTask {
  id: string;
  description: string;
  category: "task" | "note" | "expense" | "reminder" | "idea";
  priority: "low" | "medium" | "high";
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  amount?: number;
  tags: string[];
}

export interface PersonalProfile {
  actorId: string;
  name?: string;
  preferences: Record<string, string>;
  habits: string[];
  goals: string[];
}

const taskSchema = z.object({
  description: z.string().min(1),
  category: z.enum(["task", "note", "expense", "reminder", "idea"]),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional(),
  amount: z.number().optional(),
  tags: z.array(z.string()).default([]),
});

export class PersonalAgent extends Agent {
  constructor() {
    super({
      role: "product",
      title: "Assistente Pessoal Inteligente",
      preferredModel: "llama3.1:8b",
      temperature: 0.7,
      systemPrompt: `Você é um assistente pessoal inteligente e empático chamado Krato Personal.
      
Suas funções principais:
1. **Gerenciamento de Tarefas**: Criar, listar, atualizar e concluir tarefas pessoais
2. **Registro de Gastos**: Controlar despesas pessoais e fornecer insights financeiros
3. **Notas e Ideias**: Capturar pensamentos, ideias e informações importantes
4. **Lembretes**: Configurar lembretes e acompanhar compromissos
5. **Dúvidas Gerais**: Responder perguntas sobre diversos temas
6. **Acompanhamento de Projetos**: Ajudar no gerenciamento de projetos pessoais e profissionais

Diretrizes de comportamento:
- Seja prestativo, empático e direto
- Adapte o tom de voz ao contexto (formal para trabalho, casual para pessoal)
- Forneça resumos claros e acionáveis
- Sugira próximos passos quando apropriado
- Mantenha privacidade e confidencialidade

Formato de respostas:
- Para tarefas: use listas claras com status
- Para gastos: inclua valores formatados e totais
- Para dúvidas: seja informativo mas conciso
- Sempre identifique o tipo de conteúdo (tarefa, nota, gasto, etc.)`,
    });
  }

  async run(ctx: AgentContext, input: string): Promise<AgentResult> {
    const intent = await this.detectIntent(input);
    
    switch (intent.type) {
      case "create_task":
        return this.createTask(ctx, input, intent.data);
      case "list_tasks":
        return this.listTasks(ctx, intent.data);
      case "log_expense":
        return this.logExpense(ctx, input, intent.data);
      case "add_note":
        return this.addNote(ctx, input);
      case "answer_question":
        return this.answerQuestion(ctx, input);
      case "chat":
        return this.chat(ctx, input);
      default:
        return this.chat(ctx, input);
    }
  }

  private async detectIntent(input: string): Promise<{ type: string; data?: Record<string, unknown> }> {
    const prompt = `Analise a intenção do usuário nesta mensagem: "${input}"
    
Classifique em uma destas categorias:
- create_task: criar nova tarefa (ex: "preciso comprar leite", "agendar reunião")
- list_tasks: listar tarefas pendentes (ex: "o que tenho pra fazer?", "mostrar tarefas")
- log_expense: registrar gasto (ex: "gastei 50 reais no mercado", "compra de R$ 100")
- add_note: adicionar nota/ideia (ex: "lembrar que...", "ideia: criar app de...")
- answer_question: responder dúvida (ex: "qual a capital da França?", "como funciona...")
- chat: conversa geral (saudações, bate-papo, etc.)

Responda APENAS com JSON: {"type": "categoria", "data": {...}}`;

    const response = await this.generate({ 
      sessionId: "detect-intent", 
      actorId: "system", 
      projectId: "personal", 
      goal: "detect intent",
      blackboard: { publish: () => {}, all: () => [] } as any,
    }, [{ role: "user", content: prompt }], {
      temperature: 0.3,
    });

    const extracted = this.extractJson<{ type: string; data?: Record<string, unknown> }>(response);
    return extracted ?? { type: "chat" };
  }

  private async createTask(ctx: AgentContext, input: string, data?: Record<string, unknown>): Promise<AgentResult> {
    const parseResult = taskSchema.safeParse(data);
    
    if (!parseResult.success) {
      // Tenta extrair informações do input natural
      const extractionPrompt = `Extraia informações desta solicitação de tarefa: "${input}"
      
Retorne JSON com:
- description: descrição clara da tarefa
- category: uma destas [task, note, expense, reminder, idea]
- priority: low, medium ou high
- dueDate: data se mencionada (formato YYYY-MM-DD) ou null
- tags: array de palavras-chave relevantes

Exemplo input: "Preciso entregar o relatório até sexta, é urgente"
Exemplo output: {"description": "Entregar relatório", "category": "task", "priority": "high", "dueDate": "2024-01-19", "tags": ["relatório", "trabalho"]}

Responda APENAS com JSON válido.`;

      const extracted = await this.generate(ctx, [{ role: "user", content: extractionPrompt }], {
        temperature: 0.2,
      });
      
      const parsed = this.extractJson<z.infer<typeof taskSchema>>(extracted);
      if (!parsed) {
        return {
          summary: "Não consegui entender completamente sua tarefa. Pode reformular?",
          artifacts: [],
          nextAgent: "done",
        };
      }
      data = parsed;
    }

    const task: PersonalTask = {
      id: crypto.randomUUID(),
      description: (data as z.infer<typeof taskSchema>).description,
      category: (data as z.infer<typeof taskSchema>).category,
      priority: (data as z.infer<typeof taskSchema>).priority,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: (data as z.infer<typeof taskSchema>).dueDate,
      amount: (data as z.infer<typeof taskSchema>).amount,
      tags: (data as z.infer<typeof taskSchema>).tags,
    };

    const artifact: Artifact<PersonalTask> = {
      kind: "personal_task",
      author: "product",
      data: task,
      createdAt: task.createdAt,
    };

    this.publish(ctx, artifact);

    const summary = `✅ Tarefa criada: "${task.description}"
Categoria: ${task.category} | Prioridade: ${task.priority}${task.dueDate ? ` | Vencimento: ${task.dueDate}` : ""}${task.amount ? ` | Valor: R$ ${task.amount.toFixed(2)}` : ""}`;

    return {
      summary,
      artifacts: [artifact],
      nextAgent: "done",
    };
  }

  private async listTasks(ctx: AgentContext, data?: Record<string, unknown>): Promise<AgentResult> {
    const filter = (data?.filter as string) ?? "pending";
    
    // Em produção, buscaria do banco de dados
    const mockTasks: PersonalTask[] = [
      {
        id: "1",
        description: "Comprar mantimentos",
        category: "task",
        priority: "medium",
        completed: false,
        createdAt: new Date().toISOString(),
        tags: ["casa", "compras"],
      },
      {
        id: "2",
        description: "Pagar conta de luz",
        category: "expense",
        priority: "high",
        completed: false,
        createdAt: new Date().toISOString(),
        dueDate: "2024-01-20",
        amount: 150.00,
        tags: ["contas", "urgente"],
      },
    ];

    const filtered = mockTasks.filter(t => 
      filter === "all" ? true : filter === "pending" ? !t.completed : t.completed
    );

    const summary = filtered.length > 0
      ? `📋 Você tem ${filtered.length} ${filtered.length === 1 ? 'tarefa' : 'tarefas'}:\n\n` +
        filtered.map(t => `• ${t.completed ? '✅' : '⏳'} ${t.description}${t.dueDate ? ` (vence: ${t.dueDate})` : ""}`).join("\n")
      : "✨ Nenhuma tarefa encontrada!";

    return {
      summary,
      artifacts: [],
      nextAgent: "done",
    };
  }

  private async logExpense(ctx: AgentContext, input: string, data?: Record<string, unknown>): Promise<AgentResult> {
    const extractionPrompt = `Extraia informações deste registro de gasto: "${input}"
    
Retorne JSON com:
- description: descrição do gasto
- amount: valor numérico
- category: categoria sugerida (alimentacao, transporte, lazer, contas, outros)
- date: data se mencionada (YYYY-MM-DD) ou hoje

Exemplo input: "Gastei 45 reais no almoço de hoje"
Exemplo output: {"description": "Almoço", "amount": 45, "category": "alimentacao", "date": "2024-01-15"}

Responda APENAS com JSON válido.`;

    const extracted = await this.generate(ctx, [{ role: "user", content: extractionPrompt }], {
      temperature: 0.2,
    });
    
    const parsed = this.extractJson<{ description: string; amount: number; category?: string; date?: string }>(extracted);
    
    if (!parsed || !parsed.amount) {
      return {
        summary: "Não consegui entender o valor do gasto. Pode reformular? Ex: 'Gastei 50 reais no mercado'",
        artifacts: [],
        nextAgent: "done",
      };
    }

    const expense: PersonalTask = {
      id: crypto.randomUUID(),
      description: parsed.description,
      category: "expense",
      priority: "medium",
      completed: true,
      createdAt: new Date().toISOString(),
      amount: parsed.amount,
      tags: [parsed.category ?? "outros"],
    };

    const artifact: Artifact<PersonalTask> = {
      kind: "personal_expense",
      author: "product",
      data: expense,
      createdAt: expense.createdAt,
    };

    this.publish(ctx, artifact);

    const summary = `💰 Gasto registrado: R$ ${parsed.amount.toFixed(2)}
Descrição: ${parsed.description}
Categoria: ${parsed.category ?? "outros"}`;

    return {
      summary,
      artifacts: [artifact],
      nextAgent: "done",
    };
  }

  private async addNote(ctx: AgentContext, input: string): Promise<AgentResult> {
    const note: PersonalTask = {
      id: crypto.randomUUID(),
      description: input.replace(/^add\s+note:\s*/i, ""),
      category: "note",
      priority: "low",
      completed: true,
      createdAt: new Date().toISOString(),
      tags: ["nota"],
    };

    const artifact: Artifact<PersonalTask> = {
      kind: "personal_note",
      author: "product",
      data: note,
      createdAt: note.createdAt,
    };

    this.publish(ctx, artifact);

    return {
      summary: `📝 Nota registrada: "${note.description.substring(0, 50)}${note.description.length > 50 ? '...' : ''}"`,
      artifacts: [artifact],
      nextAgent: "done",
    };
  }

  private async answerQuestion(ctx: AgentContext, input: string): Promise<AgentResult> {
    const response = await this.generate(ctx, [{ role: "user", content: input }]);
    
    return {
      summary: response,
      artifacts: [],
      nextAgent: "done",
    };
  }

  private async chat(ctx: AgentContext, input: string): Promise<AgentResult> {
    const response = await this.generate(ctx, [{ role: "user", content: input }]);
    
    return {
      summary: response,
      artifacts: [],
      nextAgent: "done",
    };
  }

  private extractJson<T>(text: string): T | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export const personalAgent = new PersonalAgent();
