# Krato-AI Templates Multi-Stack

Templates prontos para diferentes stacks de desenvolvimento. Use com o comando:
```bash
krato new <template-name> --project my-project
```

## 📦 Templates Disponíveis

### 1. **Node.js + Fastify + TypeScript** (`nodejs-fastify`)
Stack moderna para APIs REST rápidas e escaláveis.

**Estrutura:**
```
src/
├── routes/
│   ├── health.ts
│   └── users.ts
├── services/
│   └── UserService.ts
├── models/
│   └── User.ts
├── middleware/
│   ├── auth.ts
│   └── errorHandler.ts
├── config/
│   └── env.ts
├── utils/
│   └── logger.ts
└── server.ts
```

**Tecnologias:**
- Fastify (web framework)
- Zod (validação)
- Pino (logging)
- Better-SQLite3 (banco de dados)
- Vitest (testes)
- ESLint + Prettier

**Comandos:**
```bash
npm run dev      # Development mode
npm run build    # Build production
npm run start    # Start production
npm run test     # Run tests
npm run lint     # Lint code
```

---

### 2. **Python + FastAPI + PostgreSQL** (`python-fastapi`)
API Python assíncrona com banco relacional.

**Estrutura:**
```
app/
├── api/
│   ├── routes/
│   │   ├── health.py
│   │   └── users.py
│   └── deps.py
├── core/
│   ├── config.py
│   └── security.py
├── db/
│   ├── base.py
│   ├── session.py
│   └── crud.py
├── models/
│   └── user.py
├── schemas/
│   └── user.py
├── services/
│   └── email.py
└── main.py
```

**Tecnologias:**
- FastAPI (web framework)
- SQLAlchemy (ORM)
- Pydantic (validação)
- Alembic (migrations)
- PostgreSQL (banco de dados)
- Pytest (testes)

**Comandos:**
```bash
poetry install   # Install dependencies
poetry run dev   # Development mode
alembic upgrade head  # Run migrations
pytest           # Run tests
```

---

### 3. **Go + Gin + GORM** (`go-gin`)
API Go performática com banco de dados.

**Estrutura:**
```
cmd/
└── server/
    └── main.go
internal/
├── handlers/
│   ├── health.go
│   └── users.go
├── models/
│   └── user.go
├── repository/
│   └── user_repository.go
├── service/
│   └── user_service.go
├── middleware/
│   ├── auth.go
│   └── cors.go
└── config/
    └── config.go
pkg/
└── database/
    └── connection.go
```

**Tecnologias:**
- Gin (web framework)
- GORM (ORM)
- Viper (configuração)
- Zap (logging)
- PostgreSQL (banco de dados)
- Testify (testes)

**Comandos:**
```bash
go mod download  # Download dependencies
go run cmd/server/main.go  # Run development
go build         # Build binary
go test ./...    # Run tests
```

---

### 4. **React + Vite + TypeScript** (`react-vite`)
Frontend moderno com build ultra-rápido.

**Estrutura:**
```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Input.tsx
│   └── layout/
│       ├── Header.tsx
│       └── Footer.tsx
├── pages/
│   ├── Home.tsx
│   └── Dashboard.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useApi.ts
├── services/
│   └── api.ts
├── store/
│   └── index.ts
├── types/
│   └── index.ts
├── utils/
│   └── helpers.ts
├── App.tsx
└── main.tsx
```

**Tecnologias:**
- React 18
- Vite (build tool)
- TypeScript
- TanStack Query (data fetching)
- Zustand (state management)
- TailwindCSS (styling)
- React Router (routing)

**Comandos:**
```bash
npm install      # Install dependencies
npm run dev      # Development mode
npm run build    # Build production
npm run preview  # Preview production
npm run lint     # Lint code
```

---

### 5. **Next.js 14 + App Router** (`nextjs-app`)
Full-stack React com Server Components.

**Estrutura:**
```
app/
├── (auth)/
│   ├── login/
│   └── register/
├── (dashboard)/
│   ├── dashboard/
│   └── settings/
├── api/
│   ├── auth/
│   └── users/
├── layout.tsx
├── page.tsx
└── globals.css
components/
├── ui/
├── forms/
└── dashboard/
lib/
├── db.ts
├── auth.ts
└── utils.ts
```

**Tecnologias:**
- Next.js 14 (App Router)
- Server Components
- Prisma (ORM)
- NextAuth (authentication)
- TailwindCSS
- shadcn/ui (components)

**Comandos:**
```bash
npm install      # Install dependencies
npm run dev      # Development mode
npm run build    # Build production
npm run start    # Start production
npx prisma migrate dev  # Run migrations
```

---

### 6. **Rust + Actix + Diesel** (`rust-actix`)
API Rust de alta performance.

**Estrutura:**
```
src/
├── main.rs
├── lib.rs
├── config/
│   └── mod.rs
├── handlers/
│   ├── health.rs
│   └── users.rs
├── models/
│   └── user.rs
├── schema/
│   └── user.rs
├── services/
│   └── user_service.rs
└── db/
    └── pool.rs
```

**Tecnologias:**
- Actix-web (web framework)
- Diesel (ORM)
- Serde (serialization)
- Tokio (async runtime)
- PostgreSQL (banco de dados)

**Comandos:**
```bash
cargo build      # Build project
cargo run        # Run development
cargo test       # Run tests
cargo clippy     # Lint code
diesel migration run  # Run migrations
```

---

### 7. **Microserviço Docker** (`microservice-docker`)
Template para microserviços containerizados.

**Estrutura:**
```
Dockerfile
docker-compose.yml
src/
├── main.ts
├── config/
├── routes/
└── services/
tests/
├── unit/
└── integration/
.github/
└── workflows/
    └── ci.yml
```

**Tecnologias:**
- Docker & Docker Compose
- Health checks
- Structured logging
- Prometheus metrics
- Graceful shutdown

**Comandos:**
```bash
docker-compose up        # Start all services
docker-compose up --build  # Rebuild and start
docker-compose down      # Stop services
docker-compose logs -f   # View logs
```

---

## 🚀 Como Usar

### Via CLI do Krato:
```bash
# Criar novo projeto com template
krato new nodejs-fastify --project my-api

# Listar templates disponíveis
krato templates list

# Ver detalhes de um template
krato templates show nodejs-fastify
```

### Manualmente:
1. Copie a pasta do template desejado
2. Cole no seu projeto
3. Execute `npm install` ou equivalente
4. Configure variáveis de ambiente
5. Execute `npm run dev`

---

## 📝 Criando Templates Customizados

Para criar seu próprio template:

1. Crie uma pasta em `/templates/seu-template`
2. Adicione estrutura de arquivos
3. Crie `template.json` com metadados:
```json
{
  "name": "seu-template",
  "description": "Descrição do template",
  "version": "1.0.0",
  "language": "typescript",
  "dependencies": ["fastify", "zod", "pino"],
  "devDependencies": ["vitest", "eslint"],
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

4. Use no Krato: `krato new seu-template --project my-project`

---

## 🔄 Integração com Krato-AI

Os agentes do Krato podem:
- Gerar código baseado nestes templates
- Adaptar templates para necessidades específicas
- Migrar entre stacks diferentes
- Sugerir melhorias baseadas em padrões

Exemplo:
```
Usuário: "Crie uma API de usuários baseada no template nodejs-fastify"
Agente Developer: Gera estrutura completa com rotas, serviços e modelos
Agente DevSecOps: Adiciona validações, autenticação e segurança
Agente QA: Gera testes unitários e de integração
```
