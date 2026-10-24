# Auditoria de melhorias — Estoque de Aviamentos 1.2.1

## O que foi alterado nesta rodada

1. **Validação de backup antes da restauração:** valida objeto JSON, listas obrigatórias, estrutura básica dos registros, nome dos produtos, saldos, conteúdo de embalagem e quantidades de movimentações; rejeita códigos repetidos no arquivo importado. A tela de confirmação informa quantos produtos, movimentos e cortes serão substituídos.
2. **Conferência calculado × enviado:** usa tolerância numérica pequena para evitar marcar diferença residual de ponto flutuante como falta/sobra. A regra de consumo não foi alterada.
3. **Versão do backup:** a exportação agora identifica a versão 1.2.1.
4. **Cadastro de produto:** foi conferido que o bloqueio de códigos duplicados já existia; não foi duplicada a funcionalidade.
5. **Regras de consumo:** preservadas. Cordão continua manual quando não há consumo informado; não foram inventadas conversões de pacote/caixa.

## Recursos existentes confirmados no código

- Gráfico do estoque e alertas por saldo mínimo/zerado.
- Histórico de movimentações e relatórios.
- Exportar e restaurar backup.
- Pesquisa e scanner por código, sujeito ao suporte do navegador.
- Cálculo de corte e aviamentos.
- Tema claro/escuro na versão 1.2.0.

## Verificações realizadas

- `node --check server.js`: aprovado.
- `node --check inline.js` (JavaScript embutido extraído do HTML): aprovado.
- `node unit_test.js`: testes focados de validação de backup, códigos duplicados, tolerância de conferência e preservação das regras de consumo.
- JSON do `package.json`: parse válido.
- Integridade do ZIP: verificada após empacotamento.

## Limitações e riscos restantes

- **A senha está desativada conforme solicitado.** Enquanto isso permanecer, o servidor não deve ser exposto publicamente com dados reais: as rotas de estado não exigem login.
- Não foi possível executar teste real ponta a ponta com PostgreSQL/Render nesta sessão; dependências/credenciais e ambiente de deploy não foram verificados.
- O sistema ainda não rastreia individualmente cada pacote/rolo físico aberto.
- A validação do backup é mais forte, mas não substitui validação de esquema completa de todas as relações históricas.
- A conferência compara quantidades convertidas já registradas; não resolve por si só a representação de sobras físicas de rolos parcialmente usados.

## Antes de publicar

1. Exporte um backup atual do estoque e guarde-o fora do celular.
2. Faça cópia dos arquivos atuais do GitHub.
3. Teste em ambiente privado: cadastro, entrada, saída, cálculo, exportação e restauração.
4. Não publique o servidor sem senha na internet com estoque real.
