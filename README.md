# Estoque de Aviamentos 1.4.2

## Arquivos principais
- `index.html`: interface
- `server.js`: servidor Express e persistência
- `package.json`: dependências e comandos
- `unit_test.js`: testes automatizados (`npm test`)

## Executar
1. Instale Node.js.
2. Execute `npm install`.
3. Configure `DATABASE_URL` se for usar PostgreSQL.
4. Execute `npm start`.
5. Execute `npm test` para os testes automatizados.

Antes de atualizar uma instalação real, exporte um backup pelo sistema. A autenticação continua desativada nesta versão; não exponha a API publicamente com dados reais.
