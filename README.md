# Seven Bites API

API RESTful desenvolvida para o Seven Bites, uma aplicação fullstack para gerenciamento de hamburgueria, com autenticação, controle administrativo, produtos, categorias, pedidos, upload de imagens e integração com pagamentos.

O projeto foi construído com Node.js e Express, utilizando PostgreSQL com Sequelize para dados relacionais, MongoDB com Mongoose para pedidos, Docker para ambiente local e Stripe para processamento de pagamentos.

## Funcionalidades

- Cadastro de usuários
- Login com autenticação JWT
- Controle de acesso por administrador
- Cadastro de produtos
- Atualização de produtos
- Listagem de produtos
- Cadastro de categorias
- Atualização de categorias
- Listagem de categorias
- Upload de imagens com Multer
- Criação de pedidos
- Listagem de pedidos
- Atualização de status dos pedidos
- Integração com Stripe
- Integração com PostgreSQL e MongoDB

## Tecnologias utilizadas

- Node.js
- Express
- PostgreSQL
- Sequelize
- MongoDB
- Mongoose
- Docker
- JWT
- Bcrypt
- Multer
- Yup
- Stripe
- Biome
- Insomnia
- Beekeeper Studio
- MongoDB Compass

## Estrutura do projeto

```txt
seven-bites-api
├── src
│   ├── app
│   │   ├── controllers
│   │   ├── middlewares
│   │   ├── models
│   │   └── schemas
│   ├── config
│   ├── database
│   │   ├── migrations
│   │   └── index.js
│   ├── app.js
│   ├── routes.js
│   └── server.js
├── uploads
├── .gitignore
├── .sequelizerc
├── biome.json
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
└── README.md
```