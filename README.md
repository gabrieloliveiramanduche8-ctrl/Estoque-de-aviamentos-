# Estoque de Aviamentos 1.4.5

## Atualização desta versão
- O saldo da oficina é exibido na unidade física que a equipe conta: cordões, rolos de elástico de 25 m ou rolos de refletivo de 50 m, quando a conversão é conhecida.
- O saldo interno continua armazenado na unidade cadastrada do produto para manter compatibilidade com dados e backups existentes.
- O formulário de consumo, devolução e saldo inicial solicita quantidade física e converte para a unidade de estoque.
- A tabela de saldos e a exportação CSV apresentam a quantidade física e sua unidade.
- Mantém envio parcial de corte e registro de itens pendentes.

## Regras de conversão mantidas
- Cordão: pacote = 1.000 cordões; caixa usa o conteúdo `packSize`; unidade = 1 cordão.
- Elástico: pacote = 15 rolos; rolo = 1 rolo de 25 m; unidade = 1 rolo; metro é convertido a 1/25 de rolo.
- Refletivo: caixa/pacote = 20 rolos; rolo/unidade = 1 rolo de 50 m; metro é convertido a 1/50 de rolo.

**Importante:** confirme se os conteúdos de pacote/caixa cadastrados correspondem ao material físico recebido. Faça backup antes de substituir arquivos.

## Executar
- `npm install`
- `npm test`
- `npm start`

Os testes automatizados não substituem a validação no navegador com o banco de produção.
