# Estoque de Aviamentos — versão 1.3.3

## Melhorias
- A saída de corte para oficina agora aceita quantidades parciais ou extras em relação ao consumo calculado, desde que não ultrapassem o saldo disponível após reservas.
- É possível informar zero para um item que não será enviado. O sistema não cria uma movimentação de saída com zero nem reduz o saldo, mas grava o resumo do envio no corte salvo.
- O registro de corte guarda quantidade necessária, enviada, falta e excesso por produto; a descrição da saída destaca faltas ou envio extra para facilitar a conferência.
- A interface informa que o envio pode ser parcial e permite revisar a falta na conferência calculado × enviado.
- Painel inicial aprimorado com gráfico de atividade dos últimos sete dias, separando número de registros de entrada e saída. Não soma quantidades de unidades diferentes.
- Corrigido o agrupamento por data local no gráfico para evitar deslocamento de dia causado pelo fuso horário.

## Preservado
- Identificador de armazenamento existente e formato compatível com dados antigos.
- Regras de consumo e conversões existentes; não foram criadas novas conversões de unidade.
- Reservas continuam protegidas e o estoque físico não pode ficar negativo por uma saída.
- Botão e courinho continuam direcionados à categoria Acabamento pela regra de inicialização já existente.

## Testes
- 47 testes automatizados aprovados, 0 falhas.
- `node --check server.js`: aprovado.
- `node --check inline.js`: aprovado.
- ZIP validado após empacotamento.

## Limitações conhecidas
- Não foi executado teste em navegador real nem deploy com PostgreSQL/Render nesta sessão.
- A autenticação permanece desativada conforme a versão-base; não exponha a API publicamente com dados reais sem proteção adicional.
- O envio zero registra a pendência no último envio do corte; não é uma movimentação física, pois nenhum material saiu.
