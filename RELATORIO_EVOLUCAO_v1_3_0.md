# Estoque de Aviamentos — versão 1.3.0 (fase 1)

## Base e preservação
- Base utilizada: versão 1.2.2 sem senha, recebida na conversa.
- A chave local existente `estoque_aviamentos_indep_v1` foi mantida.
- Produtos, movimentações, cortes e auditorias existentes continuam no mesmo formato; `reservations` e `packages` são coleções adicionais opcionais.
- Backup antigo sem as novas coleções continua aceito. Exportação/restauração inclui as coleções novas.
- A sincronização remota passa a incluir as novas coleções e cria backup local se encontrar dados locais diferentes antes de substituir estado remoto.
- Cópia da base 1.2.2 incluída em `backup_before_v1_3/`.

## O que já existia e foi mantido
- Leitura OCR de texto por foto e cadastro por voz para listas de aviamentos.
- Inventário físico de um produto por vez, comparação antes de ajustar e histórico de ajustes.
- Conferência de consumo calculado versus saídas por número do corte na página Oficinas.
- Scanner de código/QR, relatórios e exportação CSV.

## Novas funções implementadas
1. **Reservas por OC:** registra produto, quantidade e OC; não altera o saldo físico. O saldo livre é físico menos reservas ativas. Bloqueia reservas acima do saldo livre. Ao enviar um corte que tenha a mesma OC, a baixa permite usar a própria reserva e marca a parcela utilizada como consumida; reserva remanescente fica ativa. A saída comum e a saída em lote respeitam reservas de outras OCs.
2. **Rastreio físico de embalagens:** cadastro de código único, produto, tipo, quantidade inicial/restante, unidade, localização e histórico de atualização. Não altera o saldo geral e não converte unidades automaticamente.
3. **Previsão simples de reposição:** estima média diária e dias de cobertura a partir das saídas registradas na janela escolhida, sempre na unidade do produto e descontando reservas ativas. Não estima consumo se não houver saída registrada.
4. **Leitura de ficha por foto:** aproveita o OCR existente e adiciona interpretação de texto para sugerir OC, número do corte, pares, total de peças e grade 38–48. O usuário precisa revisar e aplicar os campos; nada é salvo automaticamente. A extração depende da qualidade do OCR e não substitui conferência manual.
5. **Assistente local:** responde perguntas básicas sobre saldo, disponibilidade, alertas, reservas e últimas movimentações por regras locais. **Não é uma IA generativa conectada a um modelo externo**; não executa ações.
6. **Consumo previsto versus real:** mantida a conferência existente na página Oficinas; agora saídas por lote podem registrar OC separada do número do corte, sem confundir os identificadores.
7. **Inventário guiado:** mantida a ferramenta existente de contagem, comparação e confirmação com histórico. Ainda é uma contagem de um produto por vez, não uma sessão em lote.

## Regras de negócio
- Nenhuma regra de consumo existente foi alterada.
- Não foram criadas conversões de pacote/caixa/rolo além das regras que já existiam.
- Quantidades de embalagens físicas são independentes do saldo geral para evitar dupla contagem.

## Testes executados
- `node --check server.js`: aprovado.
- `node --check inline.js` (JavaScript embutido extraído do HTML): aprovado.
- `node unit_test.js`: **32 testes aprovados, 0 falhas**.
- ZIP: verificação de integridade executada após geração.

## Limitações e testes pendentes
- Não foi possível fazer teste visual real com navegador automatizado neste ambiente.
- Não houve deploy no Render nem teste de ponta a ponta com PostgreSQL real.
- A previsão é estatística simples, não usa sazonalidade, calendário de produção nem compras em trânsito.
- O assistente é local por regras, não IA generativa.
- A autenticação permanece desativada a pedido do usuário. Não expor publicamente com dados reais enquanto não houver autenticação e autorização no servidor.
- Antes de substituir arquivos, exportar backup dos dados reais atuais. O backup de código incluído não contém o banco/estoque atual.


## Correções de auditoria — versão 1.3.1
- Saídas por foto/voz agora verificam o saldo disponível após reservas.
- Se o mesmo produto aparece em mais de uma linha, a quantidade é somada antes de permitir a saída, evitando ultrapassar o saldo livre.
- A restauração de backup verifica se reservas e embalagens apontam para produtos existentes e valida saldos de embalagem.
- A API valida tipos, identificadores, quantidades, tipos de movimento, referências de reservas/embalagens e códigos de embalagem antes de gravar.
- As regras de consumo e as unidades cadastradas não foram alteradas.
- Limitação intencional ainda aberta: a autenticação permanece desativada conforme a configuração anterior solicitada. A API não deve ficar pública com dados reais até que seja adicionada autenticação.
- Os testes automatizados foram ampliados; ainda não foi possível executar um teste real de navegador, Render ou PostgreSQL conectado.
