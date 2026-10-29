# Relatório de correções — Estoque de Aviamentos v1.4.4

## Alterações nesta versão
- Ao mudar a oficina selecionada, as sugestões de quantidade são recalculadas com base no saldo da oficina escolhida, evitando usar o saldo de outra oficina. O recálculo ocorre ao confirmar a mudança do campo da oficina.
- A saída de um corte pode ser parcial mesmo quando um aviamento não tem produto cadastrado no estoque: deixe o produto sem seleção e quantidade zero. Os demais aviamentos podem ser enviados normalmente.
- O aviamento sem envio é registrado no histórico do corte como pendência, com a necessidade estimada e sem baixar estoque central nem adicionar saldo à oficina.
- Se informar quantidade maior que zero sem selecionar o produto correspondente, a confirmação é bloqueada para evitar uma saída sem rastreabilidade.
- O sistema continua validando saldo disponível antes de baixar produtos selecionados.

## Regras de conversão mantidas
- Cordão: 1 por peça; pacote com 1.000 unidades.
- Elástico: 0,8 m por peça; rolo de 25 m; 15 rolos por pacote (regra existente, precisa corresponder ao cadastro físico real).
- Refletivo: 1 m por peça; rolo de 50 m; 20 rolos por caixa.

## Validação
Os testes automatizados do projeto foram executados após as alterações. Eles validam regras e regressões por testes unitários/estáticos; não substituem o teste manual no navegador com o banco real do Render. Não foi feito deploy no Render.
