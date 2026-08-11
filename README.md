# Seven Bites API

API REST do Seven Bites, uma aplicação fullstack para catálogo, carrinho, checkout, pedidos e administração de uma hamburgueria.

O backend centraliza autenticação, autorização administrativa, regras de pagamento, persistência relacional, persistência de pedidos e upload de imagens.

## Funcionalidades

- Cadastro e login de usuarios com JWT.
- Bloqueio de criacao publica de administradores.
- Controle de acesso administrativo.
- CRUD de produtos e categorias.
- Upload de imagens com validacao de tipo e tamanho.
- Storage local em desenvolvimento e Cloudinary em producao.
- Listagem publica de catalogo.
- Criacao e gerenciamento de pedidos.
- Payment Intents com Stripe Test Mode.
- Validacao server-side de valores do carrinho.
- Idempotencia por `paymentIntentId`.
- Health check, readiness, request ID, CORS controlado e rate limit.
- Contrato OpenAPI em `/openapi.json`.

## Tecnologias utilizadas

- Node.js
- Express
- PostgreSQL
- Sequelize
- MongoDB
- Mongoose
- JWT
- Bcrypt
- Multer
- Stripe
- Cloudinary API
- Biome
- Node Test Runner

## Arquitetura

```txt
seven-bites-api
|-- .github
|   |-- dependabot.yml
|   `-- workflows
|       `-- ci.yml
|-- docs
|   |-- api.md
|   |-- architecture.md
|   `-- development.md
|-- src
|   |-- app
|   |   |-- controllers
|   |   |-- middlewares
|   |   |-- models
|   |   |-- schemas
|   |   `-- services
|   |-- config
|   |-- database
|   |-- docs
|   |-- app.js
|   |-- routes.js
|   `-- server.js
|-- test
|-- uploads
|-- .env.example
|-- package.json
|-- pnpm-lock.yaml
|-- render.yaml
`-- README.md
```

## Seguranca

- Segredos ficam em variaveis de ambiente.
- `JWT_SECRET`, `STRIPE_SECRET_KEY`, `DATABASE_URL`, `MONGO_URL` e `CLOUDINARY_URL` nunca devem ser versionados.
- CORS usa `APP_ORIGIN` por ambiente.
- Rate limit protege login, cadastro e pagamento.
- Upload aceita apenas JPEG, PNG e WebP ate 2 MB.
- Logs nao devem registrar tokens, senhas, `clientSecret`, URIs de banco ou segredos de provedores.
- Pagamentos reais exigem webhook e reconciliacao antes de ativar Stripe live.

## API / documentacao

Com a aplicacao em execucao:

- `GET /health`
- `GET /ready`
- `GET /docs`
- `GET /openapi.json`

Documentacao tecnica complementar:

- `docs/architecture.md`
- `docs/development.md`
- `docs/api.md`

## Autor

André Vinícius Branches Cunha
