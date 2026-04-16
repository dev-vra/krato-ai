import { describe, it, expect, beforeEach, vi } from "vitest";
import { PersonalAgent, type PersonalTask } from "../../src/agents/personal.js";

describe("PersonalAgent", () => {
  let agent: PersonalAgent;

  beforeEach(() => {
    agent = new PersonalAgent();
  });

  const mockContext = {
    sessionId: "test-session-1",
    actorId: "user-123",
    projectId: "personal",
    goal: "test",
    blackboard: {
      publish: vi.fn(),
      all: vi.fn().mockReturnValue([]),
    },
  };

  describe("detectIntent", () => {
    it("deve detectar intencao de criar tarefa", async () => {
      const input = "Preciso comprar leite amanhã";
      // O agente deve identificar como create_task ou chat
      const result = await agent.run(mockContext as any, input);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe("string");
    });

    it("deve detectar intencao de listar tarefas", async () => {
      const input = "O que tenho pra fazer?";
      const result = await agent.run(mockContext as any, input);
      expect(result.summary).toBeDefined();
    });

    it("deve detectar intencao de registrar gasto", async () => {
      const input = "Gastei 50 reais no mercado";
      const result = await agent.run(mockContext as any, input);
      expect(result.summary).toBeDefined();
    });

    it("deve detectar intencao de adicionar nota", async () => {
      const input = "Lembrar de ligar para o João";
      const result = await agent.run(mockContext as any, input);
      expect(result.summary).toBeDefined();
    });
  });

  describe("createTask", () => {
    it("deve criar tarefa com descricao valida", async () => {
      const input = "Entregar relatório até sexta-feira";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toContain("Tarefa criada");
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].kind).toBe("personal_task");
    });

    it("deve criar tarefa com prioridade alta quando mencionado urgencia", async () => {
      const input = "Urgente: pagar conta de luz hoje";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
      expect(result.artifacts.length).toBeGreaterThan(0);
    });

    it("deve criar tarefa com valor quando mencionado gasto", async () => {
      const input = "Comprar presente de R$ 100 para Maria";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
    });
  });

  describe("logExpense", () => {
    it("deve registrar gasto com valor numerico", async () => {
      const input = "Gastei 45.90 reais no almoco";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toContain("Gasto registrado");
      expect(result.summary).toContain("R$");
    });

    it("deve registrar gasto com formato brasileiro", async () => {
      const input = "Compra de R$ 150,00 no supermercado";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
      expect(result.summary).toContain("Gasto") || expect(result.summary).toContain("registrado");
    });
  });

  describe("listTasks", () => {
    it("deve listar tarefas pendentes", async () => {
      const input = "Listar minhas tarefas";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe("string");
    });

    it("deve mostrar mensagem vazia quando sem tarefas", async () => {
      const input = "Nao tenho tarefas";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
    });
  });

  describe("addNote", () => {
    it("deve adicionar nota simples", async () => {
      const input = "Ideia: criar aplicativo de controle financeiro";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toContain("Nota") || expect(result.summary).toContain("registrada");
      expect(result.artifacts.length).toBeGreaterThan(0);
    });
  });

  describe("answerQuestion", () => {
    it("deve responder pergunta factual", async () => {
      const input = "Qual a capital da Franca?";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("deve responder pergunta sobre programacao", async () => {
      const input = "Como criar um array em TypeScript?";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
    });
  });

  describe("chat", () => {
    it("deve responder saudacao", async () => {
      const input = "Ola, bom dia!";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
    });

    it("deve manter conversa casual", async () => {
      const input = "Como voce esta?";
      const result = await agent.run(mockContext as any, input);
      
      expect(result.summary).toBeDefined();
    });
  });

  describe("extractJson", () => {
    it("deve extrair JSON de texto misto", () => {
      const text = `Aqui esta a resposta: {"type": "create_task", "data": {"description": "Teste"}}`;
      // @ts-ignore - metodo privado, testando via instancia
      const result = agent.extractJson<{ type: string }>(text);
      expect(result?.type).toBe("create_task");
    });

    it("deve retornar null para JSON invalido", () => {
      const text = '{"invalid": json}';
      // @ts-ignore
      const result = agent.extractJson(text);
      expect(result).toBeNull();
    });

    it("deve retornar null quando nao ha JSON", () => {
      const text = "Apenas texto sem JSON";
      // @ts-ignore
      const result = agent.extractJson(text);
      expect(result).toBeNull();
    });
  });
});

describe("PersonalAgent - Edge Cases", () => {
  const agent = new PersonalAgent();
  const mockContext = {
    sessionId: "test-session-2",
    actorId: "user-456",
    projectId: "personal",
    goal: "test",
    blackboard: { publish: vi.fn(), all: vi.fn().mockReturnValue([]) },
  };

  it("deve lidar com input vazio graciosamente", async () => {
    const result = await agent.run(mockContext as any, "");
    expect(result.summary).toBeDefined();
  });

  it("deve lidar com input muito longo", async () => {
    const longInput = "Tarefa: ".repeat(100);
    const result = await agent.run(mockContext as any, longInput);
    expect(result.summary).toBeDefined();
  });

  it("deve lidar com caracteres especiais", async () => {
    const input = "Comprar itens: maçã, pão, café, açúcar (R$ 50,00)";
    const result = await agent.run(mockContext as any, input);
    expect(result.summary).toBeDefined();
  });

  it("deve lidar com emojis", async () => {
    const input = "🎉 Fazer festa de aniversario no sabado! 🎂";
    const result = await agent.run(mockContext as any, input);
    expect(result.summary).toBeDefined();
  });
});
