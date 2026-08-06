# Seven Bites API - Desenvolvimento

## Ambiente

Crie um `.env` local a partir de `.env.example` e preencha valores reais apenas no arquivo ignorado pelo Git.

Variaveis principais:

- `PORT`
- `APP_URL`
- `APP_ORIGIN`
- `PG_HOST`
- `PG_PORT`
- `PG_USERNAME`
- `PG_PASSWORD`
- `PG_DATABASE`
- `MONGO_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `STRIPE_SECRET_KEY`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_PAYMENT_MAX`
- `RATE_LIMIT_WINDOW_MS`

## Scripts

- `npm run dev`: inicia com watch.
- `npm start`: inicia em modo normal.
- `npm test`: executa testes Node.
- `npm run lint`: executa Biome sem escrita.
- `npm run format`: formata arquivos.
- `npm run check`: executa testes e lint sem escrita.

## Bancos

PostgreSQL usa migrations Sequelize. MongoDB armazena pedidos e cria indice parcial unico para `paymentIntentId` quando o schema e inicializado.

## Stripe Test Mode

Use apenas chaves de teste no ambiente local. Nunca registre `STRIPE_SECRET_KEY`, `clientSecret`, tokens JWT ou dados de cartao em logs, screenshots ou documentos.

## Uploads

Uploads ficam em `uploads/` no disco local. Esse storage e aceitavel para desenvolvimento; producao deve usar volume persistente ou storage gerenciado.
