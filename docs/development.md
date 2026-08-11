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
- `DATABASE_URL`
- `PG_SSL`
- `MONGO_URL`
- `CLOUDINARY_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `STRIPE_SECRET_KEY`
- `TRUST_PROXY`
- `RATE_LIMIT_AUTH_MAX`
- `RATE_LIMIT_PAYMENT_MAX`
- `RATE_LIMIT_WINDOW_MS`

## Scripts

- `npm run dev`: inicia com watch.
- `npm start`: inicia em modo normal.
- `npm run db:migrate`: executa migrations Sequelize.
- `npm run db:migrate:status`: lista status das migrations.
- `npm test`: executa testes Node.
- `npm run lint`: executa Biome sem escrita.
- `npm run format`: formata arquivos.
- `npm run check`: executa testes e lint sem escrita.

## Bancos

PostgreSQL usa migrations Sequelize. MongoDB armazena pedidos e cria indice parcial unico para `paymentIntentId` quando o schema e inicializado.

Para producao, use `DATABASE_URL` do Neon. Para desenvolvimento local, use as variaveis `PG_*`. Quando o provedor exigir TLS, configure `PG_SSL=true`.

## Stripe Test Mode

Use apenas chaves de teste no ambiente local. Nunca registre `STRIPE_SECRET_KEY`, `clientSecret`, tokens JWT ou dados de cartao em logs, screenshots ou documentos.

## Uploads

Uploads ficam em `uploads/` no disco local quando `CLOUDINARY_URL` nao esta configurada. Esse modo e aceitavel apenas para desenvolvimento.

Em producao, configure `CLOUDINARY_URL`. Novas imagens serao enviadas para folders `seven-bites/products` e `seven-bites/categories`, e o banco armazenara a URL HTTPS retornada pela Cloudinary. Arquivos legados locais continuam compativeis, mas nao devem ser a estrategia persistente de producao.

## Deploy

- Render: usar `corepack enable && pnpm install --frozen-lockfile` como build command, `pnpm start` como start command e `/health` como health check.
- Migrations: executar `pnpm run db:migrate` manualmente apos configurar o banco e antes do primeiro teste de producao.
- Admin inicial: criar usuario comum pelo app/API e promover no banco por procedimento manual controlado. Nao versionar seed com senha de producao.
- Stripe: manter Test Mode para demonstracao. Live Mode exige webhook e reconciliacao antes de operar dinheiro real.
