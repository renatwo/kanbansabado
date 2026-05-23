# Guia de Deploy no Render - Kanban App

Este guia descreve as configurações e o passo a passo necessário para colocar sua aplicação Kanban no ar usando o serviço gratuito do **Render** (Web Service).

## 1. Alterações Realizadas no Código

Para que a aplicação rode corretamente na nuvem, algumas padronizações foram feitas no arquivo `server.js`:

- **PORTA (Port):** O Render define a porta automaticamente através da variável de ambiente `PORT`. Atualizamos o código para:
  ```javascript
  const PORT = process.env.PORT || 3000;
  ```
- **Chave Secreta JWT:** Para segurança, chaves secretas não devem ficar expostas no código. Atualizamos para buscar de uma variável de ambiente:
  ```javascript
  const SECRET_KEY = process.env.SECRET_KEY || 'super-secret-key-for-jwt-do-not-use-in-prod';
  ```

> ⚠️ **Atenção sobre os arquivos JSON:** 
> Atualmente, os dados (usuários, tarefas) são salvos em arquivos `.json` na própria pasta do projeto (`users.json`, `tasks.json`). 
> O plano gratuito do Render utiliza um sistema de arquivos **efêmero**. Isso significa que a cada novo deploy ou reinicialização do servidor (o que ocorre frequentemente no plano free por inatividade), **seus dados serão apagados e voltarão ao estado original do GitHub**.
> Para resolver isso de forma definitiva no futuro, será necessário integrar um banco de dados (como MongoDB, PostgreSQL ou Firebase).

---

## 2. Passo a Passo para Deploy no Render

### Passo 2.1: Criar o Web Service
1. Acesse o [Dashboard do Render](https://dashboard.render.com/) e faça login (pode usar sua conta do GitHub).
2. Clique no botão **"New +"** no canto superior direito e selecione **"Web Service"**.
3. Escolha a opção **"Build and deploy from a Git repository"** e clique em Next.
4. Conecte sua conta do GitHub (caso ainda não tenha feito) e selecione o repositório **`renatwo/kanbansabado`**.
5. Clique em **"Connect"**.

### Passo 2.2: Configurações do Serviço
Preencha os dados conforme abaixo:
- **Name:** O nome do seu app (ex: `kanbansabado`)
- **Region:** Escolha a mais próxima (ex: `Ohio (US East)`)
- **Branch:** `main`
- **Root Directory:** *(deixe em branco)*
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start` *(ou `node server.js`)*

### Passo 2.3: Configurar Variáveis de Ambiente (Environment Variables)
Role a página para baixo até encontrar a seção **Environment Variables** e adicione as seguintes chaves e valores:

| Key | Value | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Informa ao Node que está em ambiente de produção |
| `SECRET_KEY` | *(Gere uma chave segura)* | Uma string aleatória para assinar o JWT. Você pode usar algo como `hD82j#k9s!Lp92k@9281` |

> 💡 Você **não** precisa configurar a variável `PORT`. O Render a injeta automaticamente para você.

### Passo 2.4: Finalizar Deploy
1. Certifique-se de que o plano **Free** está selecionado na seção "Instance Type".
2. Clique no botão **"Create Web Service"**.

A partir deste momento, o Render começará a baixar seu código, rodar o `npm install` e iniciar o serviço. No painel, você verá os logs (terminal) do processo.

---

## 3. Acessando a Aplicação
Quando o status ficar verde marcando **"Live"**, a URL da sua aplicação aparecerá no topo, abaixo do nome do serviço (algo como `https://kanbansabado.onrender.com`).

Como seu backend já está configurado para servir os arquivos estáticos (`public`), basta abrir a URL fornecida pelo Render no navegador para ver o seu Kanban rodando na nuvem!
