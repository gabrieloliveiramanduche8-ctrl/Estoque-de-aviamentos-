# Estoque de Aviamentos — versão 1.3.5

## Melhoria adicionada
- A tabela **Cálculos salvos** agora oferece a ação **Apagar** em cada cálculo.
- O botão **Apagar todos os cálculos** remove em lote os registros de cálculo salvos, após confirmação explícita.
- As confirmações explicam que a ação apaga somente os cálculos salvos: não apaga produtos, movimentações, saídas para oficina, reservas ou saldos de estoque.
- Se o cálculo que está aberto for apagado, o resultado e o painel de envio são fechados para evitar reutilização acidental.
- A ação usa o mecanismo normal de persistência/sincronização do sistema.

## Testes
Verificação de sintaxe JavaScript e testes automatizados executados localmente. Não foi realizado deploy nem teste com PostgreSQL remoto. Faça backup antes de atualizar.
