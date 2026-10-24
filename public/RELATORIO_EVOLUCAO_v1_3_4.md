# Estoque de Aviamentos — versão 1.3.4

## Correções
- Cordão: cálculo automático de 1 cordão por peça e pacote com 1.000 cordões; detalha pacote aberto e sobra.
- Elástico: mantém o cálculo de consumo em metros para estimar necessidade, mas a retirada física é calculada por rolos de 25 m e pacotes de 15 rolos. O saldo do estoque é baixado em equivalente de pacote quando o pacote é aberto; o detalhe informa os rolos restantes.
- Refletivo: considera 50 m por rolo e 20 rolos por caixa/pacote; a baixa é expressa em caixas/pacotes equivalentes e informa os rolos sobrando na caixa aberta.
- Categoria Acabamento: mantém botão e courinho separados da categoria de aviamentos nos produtos iniciais.
- Mantidos dados, reservas, baixas parciais e demais regras de consumo já existentes.

## Importante sobre unidades
Para elástico e refletivo, os cálculos de necessidade ainda mostram metros porque as regras de consumo existentes estão cadastradas nessa unidade. A baixa física não exige enviar metros: converte para rolos/pacotes/caixas conforme as regras documentadas. Um saldo fracionário de pacote/caixa representa embalagem aberta e saldo parcial, não uma embalagem física fracionada.

## Validação
Verificações de sintaxe e testes automatizados foram executados localmente. Não houve deploy nem teste de navegador real ou PostgreSQL conectado. Autenticação continua desativada.
