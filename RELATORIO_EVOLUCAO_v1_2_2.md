# Estoque de Aviamentos — Evolução 1.2.2 (fase OC/corte → estoque)

## Alterações desta fase
- Bloqueia salvar dois cálculos com o mesmo número de corte não vazio, reduzindo ambiguidades na conferência.
- A saída em lote para oficina exige número de corte e que o cálculo esteja salvo; isso garante que a saída possa ser conciliada com o cálculo salvo.
- Adiciona uma guarda contra clique repetido no botão de confirmação durante o processamento síncrono da saída em lote.
- Mantém a validação anterior do saldo disponível para todos os itens antes de efetuar qualquer baixa.
- Mantém os consumos e conversões existentes; não cria regras novas para materiais.
- A senha continua desativada, conforme solicitado. Não exponha o servidor publicamente nessa configuração.

## Testes
- `node --check server.js`: aprovado.
- JavaScript inline extraído de `index.html` e validado com `node --check`: aprovado.
- `node unit_test.js`: 17 verificações automatizadas aprovadas (0 falhas).
- ZIP validado com `unzip -t`.

## Limitações
- Não houve deploy no Render nem teste real de PostgreSQL/servidor neste ambiente.
- Não foi executado teste de navegação visual real no navegador.
- A guarda de clique duplo cobre a execução síncrona no navegador; não substitui idempotência no servidor nem transações no banco.
- Esta fase vincula pelo número do corte já existente no sistema; não renomeia esse campo para OC, pois são identificadores potencialmente diferentes.
