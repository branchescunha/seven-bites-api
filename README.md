# Seven Bites API

Seven Bites API e o backend da plataforma Seven Bites, responsavel por autenticacao, catalogo, pedidos, pagamentos, recuperacao de senha, midia e autorizacao administrativa.

A API foi estruturada para sustentar uma experiencia comercial completa de restaurante: cliente monta o pedido no frontend, o servidor valida valores sensiveis, integra pagamento, registra pedidos e protege as operacoes administrativas.

## Responsabilidades

- Cadastro e login de usuarios.
- Autenticacao com JWT.
- Recuperacao de senha por e-mail.
- Controle de acesso administrativo.
- Listagem publica de categorias e produtos.
- Criacao e edicao de produtos por administradores.
- Upload e armazenamento de imagens.
- Criacao e consulta de pedidos.
- Atualizacao de status de pedidos.
- Criacao de Payment Intents.
- Validacao server-side de valores do carrinho.
- Health check, readiness, CORS, rate limit e tratamento centralizado de erros.

## Tecnologias

- Node.js
- Express
- Sequelize
- PostgreSQL / Neon
- MongoDB / Mongoose
- Stripe
- Cloudinary
- Resend
- JWT
- Bcrypt
- Multer
- Yup
- Biome
- Node Test Runner

## Arquitetura

```txt
seven-bites-api
|-- scripts
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
|-- package.json
|-- pnpm-lock.yaml
`-- render.yaml
```

Controllers recebem as requisicoes e delegam regras reutilizaveis para services. Middlewares concentram autenticacao, autorizacao, CORS, rate limit, headers de seguranca, contexto de request e tratamento de erros. Models Sequelize representam usuarios, categorias e produtos; pedidos ficam em MongoDB.

## Seguranca

- Senhas armazenadas com hash.
- JWT assinado por segredo de ambiente.
- Criacao publica de administradores bloqueada.
- Rotas administrativas protegidas por middleware dedicado.
- Precos e totais recalculados no backend antes do pagamento.
- Idempotencia de pedidos por identificador de pagamento.
- Recuperacao de senha com token opaco, hash, expiracao curta e uso unico.
- Rate limit em autenticacao e pagamento.
- CORS controlado por origem configurada.
- Segredos mantidos fora do repositorio.

## Integracoes

- Stripe para inicializacao e confirmacao do pagamento.
- Cloudinary para armazenamento de imagens de produtos e categorias.
- Resend para e-mails transacionais de recuperacao de senha.
- Neon como PostgreSQL gerenciado.
- MongoDB para persistencia de pedidos.

## Testes

A suite automatizada cobre autenticacao, recuperacao de senha, autorizacao, pagamento, validacao de carrinho, pedidos, upload/midia, CORS, rate limit, erros e configuracoes criticas.

Validacao atual: 63 testes automatizados passando.

## API em producao

https://seven-bites-api.onrender.com

Endpoints publicos principais:

- `GET /health`
- `GET /ready`
- `GET /categories`
- `GET /products`
- `GET /docs`
- `GET /openapi.json`

## Autor

Andre Vinicius Branches Cunha
