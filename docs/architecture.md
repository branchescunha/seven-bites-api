# Seven Bites API - Arquitetura

## Visao geral

A API usa Express 5 com JavaScript ESM, Sequelize/PostgreSQL para usuarios, produtos e categorias, Mongoose/MongoDB para pedidos, JWT para autenticacao e Stripe para Payment Intents.

Em producao, a arquitetura prevista usa Render para o web service, Neon para PostgreSQL, MongoDB Atlas para pedidos e Cloudinary para imagens.

## Camadas

- `src/app.js`: configura middlewares globais, CORS, arquivos estaticos, rotas e tratamento de erros.
- `src/routes.js`: declara rotas publicas, autenticadas e administrativas.
- `src/app/controllers`: orquestra validacao HTTP e chamadas aos models/services.
- `src/app/services`: concentra regras criticas de carrinho, pagamento e payload de usuario.
- `src/app/middlewares`: autenticacao, autorizacao, request ID, rate limit, headers e erros.
- `src/database`: inicializa PostgreSQL e MongoDB.
- `src/docs/openapi.js`: contrato OpenAPI 3 sem segredos.

## Fluxos criticos

- Cadastro publico ignora criacao de admin.
- Login retorna JWT assinado com `JWT_SECRET`.
- Carrinho e pagamento usam precos buscados no banco, nunca valores enviados pelo cliente.
- Pedido exige Payment Intent aprovado, moeda `brl`, valor consistente e metadata do usuario autenticado.
- `paymentIntentId` tem indice unico parcial no Mongo para idempotencia.

## Operacao

- `GET /health`: verifica o processo.
- `GET /ready`: verifica PostgreSQL e MongoDB.
- `GET /docs`: pagina simples apontando para `GET /openapi.json`.
- Cada resposta inclui `x-request-id`.
- Erros 5xx sao logados com request ID, metodo, rota e status, sem body sensivel.

## Producao

- PostgreSQL aceita `DATABASE_URL` com SSL via `PG_SSL=true` ou `NODE_ENV=production`.
- Desenvolvimento local continua aceitando `PG_HOST`, `PG_PORT`, `PG_USERNAME`, `PG_PASSWORD` e `PG_DATABASE`.
- MongoDB usa `MONGO_URL`, incluindo connection strings SRV do Atlas.
- Novos uploads usam Cloudinary quando `CLOUDINARY_URL` esta configurada.
- Registros legados com filename local continuam servidos por `/product-file` e `/category-file`.
- `TRUST_PROXY=1` deve ser usado no Render para preservar IP correto atras do proxy.
- Rate limit em memoria e aceitavel para uma unica instancia inicial; multiplas instancias exigem store distribuida.
