# Changelog

## [1.0.0]

### Added

- API Express com autenticacao JWT, usuarios, produtos, categorias e pedidos.
- Integracao Stripe Test Mode com validacao server-side de valores.
- Idempotencia de pedidos por `paymentIntentId`.
- Health check, readiness, request ID, rate limit e OpenAPI.
- Suporte a `DATABASE_URL` para PostgreSQL hospedado.
- Suporte a Cloudinary para novos uploads em producao.
- Scripts de migrations e workflow de CI.

### Changed

- Configuracao passou a ser definida por variaveis de ambiente.
- Upload local ficou restrito ao uso de desenvolvimento.
- CORS, proxy e rate limit ficaram preparados para ambiente hospedado.

### Fixed

- Bloqueio de criacao publica de administradores.
- Calculo de pagamento nao confia mais em preco enviado pelo cliente.
- Erros de autenticacao e pagamento retornam respostas controladas.
- Registros legados de imagem local continuam compativeis.

### Security

- Segredo JWT removido do codigo.
- Upload limitado a JPEG, PNG e WebP ate 2 MB.
- Logs e erros evitam exposicao de dados sensiveis.
