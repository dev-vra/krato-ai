# Node.js + Fastify + TypeScript Template

Template moderno para APIs REST rápidas e escaláveis com Krato-AI.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar em produção
npm run start
```

## 📁 Estrutura do Projeto

```
nodejs-fastify/
├── src/
│   ├── config/          # Configurações (env, database)
│   ├── models/          # Modelos de dados
│   ├── routes/          # Rotas da API
│   ├── services/        # Regras de negócio
│   ├── middleware/      # Middleware customizados
│   ├── utils/           # Utilitários (logger, helpers)
│   └── server.ts        # Entry point
├── tests/               # Testes unitários
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Tecnologias

- **Fastify** - Web framework performático
- **TypeScript** - Tipagem estática
- **Zod** - Validação de schemas
- **Pino** - Logger estruturado
- **Better-SQLite3** - Banco de dados embutido
- **Vitest** - Framework de testes

## 📝 Comandos Disponíveis

```bash
npm run dev          # Development mode com hot-reload
npm run build        # Compilar TypeScript
npm run start        # Iniciar servidor production
npm run test         # Executar testes
npm run test:watch   # Testes em watch mode
npm run lint         # Verificar código com ESLint
npm run lint:fix     # Corrigir problemas de lint
npm run format       # Formatar código com Prettier
```

## 🔌 Exemplo de Uso

### Criar nova rota

```typescript
// src/routes/products.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return { products: [] };
  });

  app.post('/', async (req, reply) => {
    const body = createProductSchema.parse(req.body);
    reply.status(201).send({ product: body });
  });
};
```

### Registrar rota no servidor

```typescript
// src/server.ts
import { productRoutes } from './routes/products.js';

await app.register(productRoutes, { prefix: '/api/products' });
```

## 🧪 Testes

```bash
# Rodar todos os testes
npm run test

# Rodar testes em watch mode
npm run test:watch

# Rodar testes com coverage
npm run test -- --coverage
```

## 🔒 Segurança

Este template inclui:
- Validação de input com Zod
- CORS configurado
- Error handling global
- Headers de segurança via @fastify/sensible

Para produção, considere adicionar:
- Rate limiting
- Autenticação JWT
- Helmet (headers de segurança)
- Input sanitization

## 📦 Deploy

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

### Variáveis de Ambiente (Produção)

```bash
NODE_ENV=production
PORT=3000
DATABASE_PATH=/data/app.db
LOG_LEVEL=warn
```

## 🤖 Integração com Krato-AI

Use os agentes do Krato para:
- Gerar novas rotas automaticamente
- Criar testes para seu código
- Refatorar e melhorar performance
- Adicionar autenticação e autorização

Exemplo:
```
Usuário: "Adicione autenticação JWT neste template"
Agente Developer: Implementa middleware de auth, rotas de login/register
Agente DevSecOps: Adiciona validações, rate limiting, security headers
Agente QA: Gera testes para os novos endpoints
```

## 📄 License

MIT
