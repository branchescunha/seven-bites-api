# Seven Bites API - Contrato

O contrato principal esta disponivel em runtime:

- `GET /docs`
- `GET /openapi.json`

## Autenticacao

Rotas protegidas usam header:

```txt
Authorization: Bearer <token>
```

Nunca exponha tokens em logs ou documentacao.

## Status de pedido

Valores usados pela interface administrativa:

- `Pedido Realizado`
- `Em Preparacao`
- `Pedido Pronto`
- `Pedido a Caminho`
- `Entregue`

O backend ainda aceita o valor legado `Pedido realizado` e normaliza para `Pedido Realizado`.
