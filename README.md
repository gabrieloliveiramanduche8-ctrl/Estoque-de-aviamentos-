# Estoque de Aviamentos — PostgreSQL no Render

## Arquivos
- `server.js`: API Node.js com Express e PostgreSQL.
- `package.json`: dependências e comando de inicialização.
- `public/index.html`: interface servida pelo backend.

## Configurar no Render
1. Envie os arquivos deste pacote para a raiz do repositório GitHub. O `index.html` deve ficar em `public/index.html`.
2. Crie um **Web Service** ligado ao repositório.
3. Runtime: **Node** (não Docker).
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Em Environment Variables, crie `DATABASE_URL` usando o valor **Internal Database URL** do PostgreSQL do Render. Não coloque credenciais no HTML nem publique-as no GitHub.
7. Implante e teste `https://SEU-SERVICO.onrender.com/api/health`.

## Atenção sobre os dados
Esta API guarda o estado do estoque como um documento JSONB no PostgreSQL. Ela é um primeiro passo para persistência, não um sistema completo de autenticação. Não exponha a URL pública da API para uso por várias pessoas sem implementar autenticação e autorização. O HTML incluído deve ser adaptado para ler/gravar em `/api/state`; até essa adaptação, a interface pode continuar usando o armazenamento local do navegador.
