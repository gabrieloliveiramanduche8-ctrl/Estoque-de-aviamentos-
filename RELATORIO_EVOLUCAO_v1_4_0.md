# Estoque de Aviamentos v1.4.1 — evolução funcional

## Escopo
Esta versão implementa as melhorias funcionais priorizadas pelo usuário, exceto a opção 6 (segurança/autenticação). A autenticação permanece desativada; não publicar a API aberta com dados reais.

## Melhorias
1. **Painel inicial:** filtro de gráfico por 7, 30 e 90 dias; gráfico de atividade por registros diários; gráfico de menores saldos, com comparação por unidade para não somar metros, unidades, rolos, caixas e pacotes entre si; gráfico por categoria preservado.
2. **Controle de oficina:** novo saldo por oficina/produto/unidade; envios novos de corte alimentam o saldo da oficina; operação para registrar consumo (reduz apenas o saldo da oficina), devolução (reduz saldo da oficina e cria entrada no estoque central) e saldo inicial/conferido. Histórico guarda data, operação, quantidade, unidade, antes/depois, OC/corte e observação.
3. **Pacotes/caixas:** preservada a página existente de rastreio de embalagens, sem conversões automáticas ou alteração silenciosa do estoque central.
4. **Conferência de divergências:** preservados inventário físico, auditoria e tabela calculado × enviado; o relatório agora também exibe contagem de itens pendentes registrados nos últimos envios dos cálculos salvos.
5. **Busca e relatórios:** filtros de busca, tipo e período no histórico de movimentações; busca de envios por oficina/produto/OC/corte; tabela de estoque atual e exportação CSV do estoque e dos saldos de oficina.
6. **Compatibilidade:** backup/restauração e sincronização incluem a coleção opcional `workshopStock`; arquivos antigos sem essa coleção continuam aceitos. O servidor valida formato, vínculo com produto, saldo não negativo e histórico da nova coleção.

## Regras de integridade
- Nenhuma unidade é convertida automaticamente na nova função de oficina.
- Consumo na oficina não altera o saldo central.
- Devolução só é permitida até o saldo registrado na oficina; cria uma entrada central auditável.
- Envio parcial continua limitado ao saldo central disponível e respeita reservas existentes.
- Os saldos de oficina antigos **não são inventados nem reconstruídos automaticamente** a partir de envios históricos, porque não há registros confiáveis do consumo passado. Para iniciar, informe o saldo conhecido em “Saldo atual da oficina”. Os envios feitos a partir desta versão passam a ser registrados no saldo da oficina.
- Apagar um cálculo salvo continua sem apagar movimentações nem alterar estoque.

## Verificações realizadas
- `node --check server.js`: aprovado.
- JavaScript embutido extraído de `index.html` e verificado com `node --check`: aprovado.
- `npm test`: **68 testes aprovados, 0 falhas**.
- Integridade do ZIP: verificada após criação.

## Limitações não cobertas
- Não foi executado teste de navegador real, nem deploy no Render com PostgreSQL conectado.
- Não foi implementada a opção 6 de segurança/autenticação, conforme pedido.
- A previsão de reposição continua sendo uma estimativa baseada no histórico de saídas, não uma garantia de demanda.
