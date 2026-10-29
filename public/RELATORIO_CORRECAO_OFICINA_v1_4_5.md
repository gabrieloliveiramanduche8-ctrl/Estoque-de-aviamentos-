# Relatório de correção — v1.4.5

## Problema corrigido
Os saldos da oficina eram armazenados em unidade de estoque (por exemplo, pacotes) e exibidos dessa mesma forma, dificultando visualizar as sobras físicas. O lançamento manual de consumo, devolução e saldo inicial também recebia quantidades na unidade cadastrada, não necessariamente na unidade física usada pela equipe.

## Correção
- Adicionadas funções explícitas para converter saldo entre unidade cadastrada e unidade física.
- Saldo de oficina e CSV agora mostram cordões/rolos quando as regras de conversão são conhecidas.
- O formulário de controle de oficina pede quantidade física, converte internamente para a unidade cadastrada e valida consumo/devolução contra o saldo físico disponível.
- Mantida a representação interna dos saldos em unidade cadastrada para preservar compatibilidade com dados existentes.
- Mantidas as regras atuais de conversão e o fluxo de envio parcial.

## Testes
- 84 testes automatizados passaram; 0 falharam.
- JavaScript inline do index.html passou em `node --check`.
- Testados exemplos: 1,4 pacotes de cordão = 1.400 cordões; 1 pacote de elástico = 15 rolos; 1 caixa de refletivo = 20 rolos.

## Limitações
Não foi feito deploy nem teste ponta a ponta com banco real/Render. Os conteúdos por pacote são as regras atuais do sistema e devem ser confirmados com a embalagem física. Faça backup antes da atualização.
