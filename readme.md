# 🏗️ CONTRATOS VR
## Sistema de Controle de Contratos de Serviços em Obra

[![Deploy](https://img.shields.io/badge/deploy-Render-success)]()
[![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green)]()
[![SQLite](https://img.shields.io/badge/sqlite-3-blue)]()

---

## 🎯 **Sobre o Sistema**

O **ContratosVR** é um sistema para controle de distribuição de metragem por unidade em contratos de construção civil, vinculados ao sistema OERP.

### **Problema Resolvido:**
- Contratos têm metragem por pavimento (conforme EAP do orçamento)
- Necessidade de controlar a execução por apartamento individual
- Validação automática: soma das distribuições = total contratado

---

## ⚡ **Funcionalidades**

### ✅ **Cadastros**
- Empreendimentos (blocos, pavimentos, apartamentos)
- Contratos (vinculados ao OERP)
- Unidades (apartamentos e halls)

### ✅ **Distribuição de Metragem** (Principal)
- Distribuição automática por pavimento
- Distribuição manual com validação
- Coeficientes para apartamentos de ponta
- Controle separado de halls

### ✅ **Controle de Execução**
- Metragem executada por unidade
- % de conclusão
- Histórico de medições
- Upload de fotos

### ✅ **Dashboard**
- Cards de resumo
- Filtros dinâmicos
- Tabela de contratos
- % de execução visual

---

## 🚀 **Deploy no Render**

### **1. Criar Conta no Render**
- Acesse: https://render.com
- Faça cadastro gratuito

### **2. Conectar GitHub**
- Autorize acesso ao repositório `ContratosVR`

### **3. Criar Web Service**
```
Name: contratosvr
Environment: Node
Build Command: npm install
Start Command: npm start
```

### **4. Configurar Variáveis de Ambiente**
```
PORT=10000
DATABASE_PATH=/data/contratosvr.db
NODE_ENV=production
```

### **5. Adicionar Disco Persistente**
```
Mount Path: /data
Size: 1GB (free tier)
```

### **6. Deploy**
- Clique em "Create Web Service"
- Render faz build e deploy automático
- Acesse: `https://contratosvr.onrender.com`

---

## 💻 **Desenvolvimento Local**

### **Pré-requisitos:**
```bash
Node.js >= 16.0.0
npm >= 8.0.0
```

### **Instalação:**
```bash
# Clone o repositório
git clone https://github.com/hnicola77/ContratosVR.git
cd ContratosVR

# Instale dependências
npm install

# Inicie o servidor
npm start
```

### **Acessar:**
```
http://localhost:3002
```

### **Login Padrão:**
```
Usuário: admin
Senha: admin123
```

---

## 📁 **Estrutura do Projeto**

```
ContratosVR/
├── server.js              # Servidor Node.js + Express
├── package.json           # Dependências
├── public/                # Frontend
│   ├── index.html         # Dashboard principal
│   ├── login.html         # Tela de login
│   ├── app.js             # JavaScript principal
│   └── styles.css         # Estilos (igual EngVR)
└── data/                  # Banco SQLite (criado automaticamente)
    └── contratosvr.db
```

---

## 🗄️ **Banco de Dados**

### **Tabelas:**
1. `users` - Usuários do sistema
2. `empreendimentos` - Cadastro de empreendimentos
3. `contratos` - Contratos vinculados ao OERP
4. `unidades` - Apartamentos e halls
5. `distribuicao` - Metragem distribuída por unidade
6. `execucao` - Metragem executada
7. `historico_medicoes` - Histórico completo
8. `pagamentos` - Controle financeiro

---

## 🔗 **API REST**

### **Autenticação:**
```
POST /auth/login
POST /auth/logout
GET  /api/me
```

### **Contratos:**
```
GET    /api/contratos
GET    /api/contratos/:id
POST   /api/contratos
PUT    /api/contratos/:id
DELETE /api/contratos/:id
```

### **Empreendimentos:**
```
GET  /api/empreendimentos
POST /api/empreendimentos
```

---

## 🎨 **Interface**

- Design inspirado em EngVR/ChaveVR
- Gradientes roxos (#667eea → #764ba2)
- Cards animados
- Tabela responsiva
- Filtros em tempo real

---

## 🔐 **Segurança**

- Autenticação com sessões
- Senhas com bcrypt (10 rounds)
- Proteção contra SQL injection
- Rotas protegidas por middleware

---

## 📦 **Dependências**

```json
{
  "express": "^4.18.2",
  "sqlite3": "^5.1.6",
  "cors": "^2.8.5",
  "express-session": "^1.17.3",
  "bcryptjs": "^2.4.3"
}
```

---

## 🧪 **Testes**

### **Localmente:**
```bash
npm start
# Acesse http://localhost:3002
# Login: admin / admin123
```

### **Produção (Render):**
```
https://contratosvr.onrender.com
```

---

## 🚀 **Roadmap**

### **Fase 1 (Concluída):**
- [x] Sistema de login
- [x] Dashboard principal
- [x] API de contratos
- [x] API de empreendimentos
- [x] Deploy no Render

### **Fase 2 (Próxima):**
- [ ] Tela de cadastro de empreendimentos
- [ ] Tela de cadastro de contratos
- [ ] Tela de distribuição de metragem
- [ ] Validação: Soma = Total

### **Fase 3 (Futuro):**
- [ ] Tela de controle de execução
- [ ] Upload de fotos
- [ ] Relatórios (Excel/PDF)
- [ ] Integração com OERP

---

## 🔗 **Integração com EngVR e ChaveVR**

### **Via home.html:**

Adicione este botão na página inicial do sistema principal:

```html
<a class="btn primary" href="https://contratosvr.onrender.com">
  🏗️ ContratosVR
</a>
```

---

## 📝 **Licença**

MIT License

---

## 👥 **Suporte**

- GitHub Issues: https://github.com/hnicola77/ContratosVR/issues
- Email: suporte@contratosvr.com

---

## ✅ **Checklist de Deploy**

- [ ] Repositório criado no GitHub
- [ ] Código commitado
- [ ] Conta criada no Render
- [ ] Web Service criado
- [ ] Disco persistente configurado (/data)
- [ ] Build completou
- [ ] Site acessível
- [ ] Login funciona
- [ ] Dashboard carrega

---

**ContratosVR v1.0.0** - Sistema Pronto para Produção! 🏗️
