ESTOQUE DE AVIAMENTOS — PACOTE DE MELHORIAS

Arquivo principal: index.html

Incluído nesta versão:
- Inventário físico: compara saldo do sistema com contagem e só ajusta após confirmação.
- Histórico de auditoria de ajustes e registro de movimento do tipo ajuste.
- Relatórios de entradas/saídas por período e exportação CSV.
- Scanner de QR/códigos compatível com BarcodeDetector, quando suportado pelo navegador; busca manual como alternativa.
- Campo opcional para código único no cadastro do produto.
- Área para testar conexão com API e exportar dados para migração.
- Preserva as páginas/funções existentes e mantém backup/restauração.

IMPORTANTE SOBRE LOGIN E NUVEM:
A tela de configuração de API é apenas um ponto de conexão. Ela NÃO implementa autenticação real, permissões seguras ou sincronização de dados por si só. Essas funções exigem backend publicado, banco de dados, sessões/tokens seguros, autorização no servidor e migração controlada. Não coloque senhas ou chaves secretas neste HTML. Nenhum dado existente foi enviado a um servidor.

TESTES EXECUTADOS:
- node --check no JavaScript inline: aprovado.
- Verificação de IDs HTML duplicados: nenhum encontrado.
- Não foi possível executar teste completo em navegador real, testar a câmera no aparelho ou validar um backend/PostgreSQL publicado.

COMO USAR:
1. Faça backup pelo botão “Exportar backup” antes de substituir qualquer versão.
2. Abra index.html no navegador para testar as funções locais.
3. Para usar a câmera, o navegador normalmente precisa suportar BarcodeDetector e acesso seguro (HTTPS); caso contrário, use a busca manual.
4. A versão não publica nem sincroniza dados automaticamente.
