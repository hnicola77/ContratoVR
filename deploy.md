# 🚀 GUIA DE DEPLOY - CONTRATOS VR NO RENDER

## ✅ Passo a Passo Completo

---

## 📋 **PRÉ-REQUISITOS**

- [x] Repositório criado no GitHub: `hnicola77/ContratosVR`
- [x] Código commitado e pushed
- [x] Conta no Render (grátis)

---

## 🔥 **PASSO 1: SUBIR CÓDIGO PARA O GITHUB**

### **1.1 - Inicializar Git (se ainda não fez)**
```bash
cd ContratosVR
git init
git add .
git commit -m "Initial commit - ContratosVR v1.0.0"
```

### **1.2 - Conectar ao GitHub**
```bash
git remote add origin https://github.com/hnicola77/ContratosVR.git
git branch -M main
git push -u origin main
```

✅ **Verificar:** Acesse https://github.com/hnicola77/ContratosVR e veja os arquivos

---

## 🌐 **PASSO 2: CRIAR WEB SERVICE NO RENDER**

### **2.1 - Acessar Render**
1. Vá em: https://render.com
2. Faça login (ou crie conta grátis)
3. Clique em "New +"
4. Selecione "Web Service"

### **2.2 - Conectar GitHub**
1. Autorize acesso ao GitHub
2. Selecione o repositório: `hnicola77/ContratosVR`

### **2.3 - Configurar Web Service**

Preencha os campos:

```
Name: contratosvr
Environment: Node
Region: Ohio (US East)
Branch: main
Root Directory: (deixe vazio)
Runtime: Node

Build Command: npm install
Start Command: npm start
```

### **2.4 - Plano**
```
Instance Type: Free
```

### **2.5 - Variáveis de Ambiente (Environment Variables)**

Clique em "Add Environment Variable" e adicione:

```
PORT=10000
DATABASE_PATH=/data/contratosvr.db
NODE_ENV=production
```

---

## 💾 **PASSO 3: ADICIONAR DISCO PERSISTENTE**

### **3.1 - Criar Disco**
1. No painel do Render, vá em "Disks"
2. Clique em "Add Disk"
3. Configure:
```
Name: contratosvr-data
Mount Path: /data
Size: 1 GB (free tier)
```
4. Clique em "Save"

✅ **IMPORTANTE:** O banco SQLite será salvo em `/data/contratosvr.db` e não será apagado nos redeploys!

---

## 🚀 **PASSO 4: DEPLOY**

### **4.1 - Iniciar Deploy**
1. Clique em "Create Web Service"
2. Render vai:
   - Clonar seu repositório
   - Executar `npm install`
   - Executar `npm start`
   - Criar o disco `/data`

### **4.2 - Acompanhar Build**
```
Building...
⏳ npm install
⏳ Installing dependencies...
✅ Build complete!

Starting...
⏳ npm start
✅ Server running on port 10000
✅ Deploy successful!
```

### **4.3 - Ver Logs**
Clique em "Logs" para ver o console:
```
✅ Banco ContratosVR conectado em: /data/contratosvr.db
✅ Tabelas do ContratosVR criadas/verificadas
✅ Usuário admin criado (senha: admin123)
╔═══════════════════════════════════════════╗
║     CONTRATOS VR - SERVIDOR INICIADO      ║
╠═══════════════════════════════════════════╣
║  Porta: 10000                             ║
║  URL: http://localhost:10000              ║
╚═══════════════════════════════════════════╝
```

---

## ✅ **PASSO 5: ACESSAR O SISTEMA**

### **5.1 - URL do Deploy**

Render vai gerar uma URL:
```
https://contratosvr.onrender.com
```

### **5.2 - Testar Login**
```
Usuário: admin
Senha: admin123
```

### **5.3 - Verificar**
- [x] Página de login abre
- [x] Login funciona
- [x] Dashboard aparece
- [x] Cards mostram "0" (normal, sem dados)
- [x] Tabela vazia (normal)

---

## 🔧 **CONFIGURAÇÕES ADICIONAIS**

### **Auto-Deploy (Opcional)**
1. Vá em "Settings" do Web Service
2. Em "Build & Deploy", ative:
```
Auto-Deploy: Yes
```

Agora todo `git push` faz deploy automático! 🚀

### **Custom Domain (Opcional)**
1. Vá em "Settings" → "Custom Domains"
2. Adicione seu domínio

---

## 🧪 **TESTAR TUDO**

### **Teste 1: Login**
```
✅ Acesse https://contratosvr.onrender.com/login.html
✅ Use: admin / admin123
✅ Deve redirecionar para /index.html
```

### **Teste 2: Dashboard**
```
✅ Cards aparecem (com valores zerados)
✅ Tabela vazia (normal)
✅ Filtros aparecem
✅ Botão "Novo Contrato" aparece
```

### **Teste 3: API**
```bash
# Fazer login e pegar cookie
curl -c cookies.txt -X POST https://contratosvr.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Listar contratos
curl -b cookies.txt https://contratosvr.onrender.com/api/contratos
# Deve retornar: []
```

### **Teste 4: Banco de Dados**
```
✅ No Render Logs, veja:
"✅ Banco ContratosVR conectado em: /data/contratosvr.db"
"✅ Tabelas do ContratosVR criadas/verificadas"
```

---

## 🔄 **ATUALIZAR CÓDIGO**

### **Fazer mudanças:**
```bash
# Edite arquivos
nano server.js

# Commit
git add .
git commit -m "Atualização X"
git push origin main
```

### **Render faz deploy automático:**
```
✅ Detecting new commit...
✅ Building...
✅ Deploying...
✅ Live!
```

---

## ⚠️ **TROUBLESHOOTING**

### **❌ Erro: "Build Failed"**
```
Solução:
1. Verifique package.json
2. Veja logs do build
3. Confirme Node >= 16
```

### **❌ Erro: "Service Unavailable"**
```
Solução:
1. Veja logs do Render
2. Verifique se server.js usa PORT correta
3. Confirme disco /data configurado
```

### **❌ Banco não persiste**
```
Solução:
1. Confirme disco montado em /data
2. Veja se DATABASE_PATH=/data/contratosvr.db
3. Verifique logs
```

### **❌ Login não funciona**
```
Solução:
1. Limpe cookies do navegador
2. Tente modo anônimo
3. Veja logs do servidor
```

---

## 📊 **MONITORAMENTO**

### **Ver Logs:**
```
Render Dashboard → Seu Service → Logs (tab)
```

### **Ver Métricas:**
```
Render Dashboard → Seu Service → Metrics (tab)
- CPU Usage
- Memory Usage
- Request Count
```

---

## 🎯 **RESULTADO FINAL**

✅ **ContratosVR rodando em produção!**

```
URL: https://contratosvr.onrender.com
Login: admin / admin123
Banco: Persistente em /data/contratosvr.db
Auto-Deploy: Ativo
Custo: GRÁTIS (Free Tier)
```

---

## 🔗 **INTEGRAÇÃO COM ENGVR/CHAVEVR**

Depois, na página home.html do sistema principal, adicione:

```html
<a class="btn primary" href="https://contratosvr.onrender.com">
  🏗️ ContratosVR
</a>
```

---

## ✅ **CHECKLIST FINAL**

- [ ] Código no GitHub
- [ ] Web Service criado no Render
- [ ] Disco `/data` configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Build completou com sucesso
- [ ] Site acessível
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] Banco persiste
- [ ] Auto-deploy ativo

---

**Deploy Completo!** 🎉
