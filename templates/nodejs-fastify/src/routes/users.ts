import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().int().positive().optional(),
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Listar usuários
  app.get('/', async () => {
    // Em produção, buscar do banco de dados
    return {
      users: [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
      ],
    };
  });

  // Buscar usuário por ID
  app.get('/:id', async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    
    // Em produção, buscar do banco de dados
    return {
      user: {
        id: params.id,
        name: 'John Doe',
        email: 'john@example.com',
      },
    };
  });

  // Criar usuário
  app.post('/', async (req, reply) => {
    const body = createUserSchema.parse(req.body);
    
    // Em produção, salvar no banco de dados
    reply.status(201).send({
      user: {
        id: crypto.randomUUID(),
        ...body,
      },
    });
  });

  // Atualizar usuário
  app.patch('/:id', async (req, reply) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = updateUserSchema.parse(req.body);
    
    // Em produção, atualizar no banco de dados
    return {
      user: {
        id: params.id,
        ...body,
      },
    };
  });

  // Deletar usuário
  app.delete('/:id', async (req, reply) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    
    // Em produção, deletar do banco de dados
    reply.status(204).send();
  });
};
