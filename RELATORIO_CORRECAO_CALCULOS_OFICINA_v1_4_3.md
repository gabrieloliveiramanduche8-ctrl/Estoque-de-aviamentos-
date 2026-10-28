# Correção dos cálculos de saída para oficina — v1.4.3

## Corrigido
- A necessidade enviada agora desconta o saldo físico já registrado para a mesma oficina e produto, evitando enviar novamente cordões/rolos que já estão lá.
- A tela mostra necessidade bruta, saldo existente e quantidade física que falta enviar.
- A conferência de falta/excesso compara com a necessidade líquida depois do saldo da oficina.
- Correspondências aproximadas (por exemplo, “Elástico” com “Elástico preto”) aparecem para escolha, mas não selecionam automaticamente uma cor. Correspondências exatas continuam pré-selecionadas.
- Cabeçalho e versão do serviço atualizados para 1.4.3.

## Regras usadas
- Cordão: 1 unidade por peça; pacote = 1.000 cordões.
- Elástico: 0,8 m por peça; 25 m por rolo; 15 rolos por pacote.
- Refletivo: 1 m por peça; 50 m por rolo; 20 rolos por caixa/pacote.

## Atenção
A regra do elástico foi mantida como está cadastrada no código: 15 rolos de 25 m por pacote. Se “15 unidades por pacote” significar outra unidade física, essa equivalência precisa ser confirmada antes de mudar a regra.

## Validação
Os testes automatizados do projeto foram executados após a alteração. Eles não equivalem a teste de navegador nem a teste de banco PostgreSQL em produção. Faça backup dos dados antes de substituir arquivos/deploy. A API continua sem autenticação; não exponha publicamente com dados reais.
