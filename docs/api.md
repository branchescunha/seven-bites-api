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

## Imagens

Produtos e categorias retornam `url` pronta para consumo pelo frontend.

- Em desenvolvimento local, `url` aponta para `/product-file/:filename` ou `/category-file/:filename`.
- Em producao com Cloudinary, `url` e a URL HTTPS publica retornada pelo provider.

O campo interno `path` pode conter filename legado ou URL Cloudinary. Clientes devem usar `url`.
