# Estoque de Aviamentos 1.4.2 — correção de Preparar saída para oficina

## Problema tratado
A interface usava a quantidade equivalente da unidade cadastrada (por exemplo, 1,250 caixa ou 1,224 pacote) diretamente como a quantidade digitada para o envio, misturando embalagem equivalente e quantidade física.

## Alterações
- Cordão: campo físico em cordões; conversão interna para estoque por pacote de 1.000 (ou unidade de estoque compatível).
- Elástico: campo físico em rolos de 25 m; conversão interna por pacote de 15 rolos, quando o produto está cadastrado em pacote.
- Refletivo: campo físico em rolos de 50 m; conversão interna por caixa/pacote de 20 rolos.
- Produtos não especiais continuam usando a unidade cadastrada no estoque.
- As quantidades físicas de cordão/rolo precisam ser inteiras.
- A gravação mantém separadamente a quantidade física enviada e a quantidade equivalente debitada na unidade do estoque.
- O saldo disponível continua validado antes da baixa; envios parciais e zero continuam permitidos.
- A descrição de falta/sobra usa a unidade física de envio para esses três materiais.

## Limites e cautelas
- Não foi alterado o modelo legado de saldo de estoque, que pode guardar frações equivalentes de pacote/caixa. A baixa central é convertida para essa unidade cadastrada. Para mostrar e gerir pacotes abertos/sobras da oficina como saldo físico independente, seria necessária uma migração de dados separada; não se inventaram saldos físicos históricos.
- A lógica usa as regras informadas: cordão 1.000 por pacote; elástico 15 rolos por pacote e 25 m por rolo; refletivo 20 rolos por caixa e 50 m por rolo. Se produtos existentes estiverem cadastrados com unidade/conteúdo diferente, revise antes de publicar.
- Testes locais de sintaxe e automatizados executados; não foi feito deploy real no Render nem teste com PostgreSQL conectado.
