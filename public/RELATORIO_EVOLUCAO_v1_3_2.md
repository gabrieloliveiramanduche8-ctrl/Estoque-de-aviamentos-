# Estoque de Aviamentos — versão 1.3.2

## Melhoria desta versão
- Previsão de reposição com prazo de reposição configurável.
- Margem de segurança configurável em dias.
- Sugestão estimada de quantidade para repor, calculada na unidade de estoque já cadastrada.
- Sinalização de reposição urgente/planejada considera o prazo e a margem definidos pelo usuário.
- Movimentações com data inválida ou futura não entram na média histórica.
- A sugestão não converte metros, unidades, rolos ou caixas e não altera o estoque.
- Mantidos os campos de dados existentes, a chave de armazenamento, as reservas, o rastreio de embalagens e as regras de consumo.

## Testes executados
- `node --check server.js`: passou.
- `node --check inline.js`: passou.
- `node unit_test.js`: 41 aprovados, 0 reprovados.
- Integridade do ZIP: verificada após empacotamento.

## Limitações conhecidas
- Não foi realizado teste real de navegador, deploy Render ou PostgreSQL conectado nesta sessão.
- A autenticação continua desativada. Não exponha a API publicamente com dados reais enquanto não houver autenticação ou restrição de acesso.
- A previsão é uma estimativa histórica, não uma garantia de demanda futura; com pouco histórico, pode ser imprecisa.
- A quantidade sugerida é uma estimativa na unidade de estoque cadastrada, não uma ordem de compra automática.
