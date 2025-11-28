// ==================== CONTRATOS VR - SERVER.JS ====================
// Sistema de Distribuição de Metragem por Unidade
// Versão Standalone

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3002;

// ==================== MIDDLEWARES ====================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "contratosvr_secret_key_2025",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
  })
);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ==================== BANCO DE DADOS ====================

const dbPath = process.env.DATABASE_PATH || "/data/contratosvr.db";
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Erro ao conectar no banco:", err);
  } else {
    console.log("✅ Banco ContratosVR conectado em:", dbPath);
  }
});

// ==================== CRIAR TABELAS ====================

db.serialize(() => {
  
  // 1. TABELA DE USUÁRIOS
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'engenheiro', 'encarregado')),
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 2. TABELA DE EMPREENDIMENTOS
  db.run(`
    CREATE TABLE IF NOT EXISTS empreendimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      quantidade_blocos INTEGER NOT NULL DEFAULT 1,
      quantidade_pavimentos_por_bloco INTEGER NOT NULL,
      quantidade_apartamentos_por_pavimento INTEGER NOT NULL,
      existem_halls INTEGER DEFAULT 0,
      quantidade_halls_por_pavimento INTEGER DEFAULT 0,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 3. TABELA DE CONTRATOS
  db.run(`
    CREATE TABLE IF NOT EXISTS contratos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_contrato_oerp TEXT UNIQUE NOT NULL,
      empreendimento_id INTEGER NOT NULL,
      tipo_servico TEXT NOT NULL CHECK(tipo_servico IN ('piso', 'azulejo', 'ambos')),
      valor_total REAL NOT NULL,
      valor_por_m2 REAL NOT NULL,
      metragem_total REAL NOT NULL,
      metragem_por_pavimento TEXT NOT NULL,
      observacoes TEXT,
      status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'pausado', 'encerrado')),
      data_inicio TEXT,
      data_previsao_termino TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id)
    )
  `);

  // 4. TABELA DE UNIDADES
  db.run(`
    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empreendimento_id INTEGER NOT NULL,
      bloco TEXT NOT NULL,
      pavimento INTEGER NOT NULL,
      numero_unidade TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('apartamento', 'hall')),
      tipologia TEXT,
      area_total REAL,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id),
      UNIQUE(empreendimento_id, bloco, pavimento, numero_unidade)
    )
  `);

  // 5. TABELA DE DISTRIBUIÇÃO
  db.run(`
    CREATE TABLE IF NOT EXISTS distribuicao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contrato_id INTEGER NOT NULL,
      unidade_id INTEGER NOT NULL,
      bloco TEXT NOT NULL,
      pavimento INTEGER NOT NULL,
      metragem_contratada REAL NOT NULL,
      coeficiente REAL DEFAULT 1.0,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE,
      FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE,
      UNIQUE(contrato_id, unidade_id)
    )
  `);

  // 6. TABELA DE EXECUÇÃO
  db.run(`
    CREATE TABLE IF NOT EXISTS execucao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contrato_id INTEGER NOT NULL,
      unidade_id INTEGER NOT NULL,
      metragem_executada REAL NOT NULL,
      data_medicao TEXT NOT NULL,
      responsavel TEXT,
      observacoes TEXT,
      fotos TEXT,
      aprovado INTEGER DEFAULT 0,
      aprovado_por TEXT,
      data_aprovacao TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE,
      FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE
    )
  `);

  // 7. TABELA DE HISTÓRICO
  db.run(`
    CREATE TABLE IF NOT EXISTS historico_medicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      execucao_id INTEGER NOT NULL,
      contrato_id INTEGER NOT NULL,
      unidade_id INTEGER NOT NULL,
      metragem_anterior REAL,
      metragem_atual REAL NOT NULL,
      metragem_adicionada REAL NOT NULL,
      usuario TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (execucao_id) REFERENCES execucao(id) ON DELETE CASCADE,
      FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE,
      FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE
    )
  `);

  // 8. TABELA DE PAGAMENTOS
  db.run(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contrato_id INTEGER NOT NULL,
      numero_medicao INTEGER NOT NULL,
      valor_medido REAL NOT NULL,
      metragem_medida REAL NOT NULL,
      data_medicao TEXT NOT NULL,
      valor_pago REAL DEFAULT 0,
      data_pagamento TEXT,
      status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente', 'aprovado', 'pago')),
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON DELETE CASCADE,
      UNIQUE(contrato_id, numero_medicao)
    )
  `);

  // CRIAR ÍNDICES
  db.run(`CREATE INDEX IF NOT EXISTS idx_contratos_empreendimento ON contratos(empreendimento_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_distribuicao_contrato ON distribuicao(contrato_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_execucao_unidade ON execucao(contrato_id, unidade_id)`);

  // CRIAR USUÁRIO ADMIN PADRÃO
  db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync("admin123", 10);
      db.run(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        ["admin", hash, "admin"],
        (err) => {
          if (err) {
            console.log("❌ Erro ao criar usuário admin:", err);
          } else {
            console.log("✅ Usuário admin criado (senha: admin123)");
          }
        }
      );
    }
  });

  console.log("✅ Tabelas do ContratosVR criadas/verificadas");
});

// ==================== SEM AUTENTICAÇÃO - ACESSO DIRETO ====================
// Sistema sem login - integrado com EngVR/ChaveVR

// ==================== ROTAS DA API ====================

// 1. LISTAR TODOS OS CONTRATOS
app.get("/api/contratos", (req, res) => {
  const sql = `
    SELECT 
      c.*,
      e.nome as empreendimento_nome,
      COALESCE(
        (SELECT ROUND((SUM(ex.metragem_executada) / c.metragem_total) * 100, 2)
         FROM execucao ex
         WHERE ex.contrato_id = c.id), 0
      ) as percentual_executado
    FROM contratos c
    LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id
    ORDER BY c.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar contratos:", err);
      return res.status(500).json({ error: "Erro ao listar contratos" });
    }
    res.json(rows);
  });
});

// 2. BUSCAR UM CONTRATO
app.get("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT 
      c.*,
      e.nome as empreendimento_nome,
      e.quantidade_blocos,
      e.quantidade_pavimentos_por_bloco,
      e.quantidade_apartamentos_por_pavimento,
      e.existem_halls,
      e.quantidade_halls_por_pavimento
    FROM contratos c
    LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id
    WHERE c.id = ?
  `;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error("Erro ao buscar contrato:", err);
      return res.status(500).json({ error: "Erro ao buscar contrato" });
    }
    if (!row) {
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    res.json(row);
  });
});

// 3. CRIAR CONTRATO
app.post("/api/contratos", (req, res) => {
  const {
    numero_contrato_oerp,
    empreendimento_id,
    tipo_servico,
    valor_total,
    valor_por_m2,
    metragem_total,
    metragem_por_pavimento,
    observacoes,
    data_inicio,
    data_previsao_termino
  } = req.body;
  
  if (!numero_contrato_oerp || !empreendimento_id || !tipo_servico || !valor_total || !metragem_total) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }
  
  const sql = `
    INSERT INTO contratos (
      numero_contrato_oerp, empreendimento_id, tipo_servico, valor_total, 
      valor_por_m2, metragem_total, metragem_por_pavimento, observacoes,
      data_inicio, data_previsao_termino
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    numero_contrato_oerp,
    empreendimento_id,
    tipo_servico,
    valor_total,
    valor_por_m2,
    metragem_total,
    JSON.stringify(metragem_por_pavimento),
    observacoes || null,
    data_inicio || null,
    data_previsao_termino || null
  ];
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Erro ao criar contrato:", err);
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: "Número de contrato já existe" });
      }
      return res.status(500).json({ error: "Erro ao criar contrato" });
    }
    
    res.status(201).json({ 
      id: this.lastID,
      message: "Contrato criado com sucesso" 
    });
  });
});

// 4. LISTAR EMPREENDIMENTOS
app.get("/api/empreendimentos", (req, res) => {
  db.all("SELECT * FROM empreendimentos WHERE ativo = 1 ORDER BY nome", [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar empreendimentos:", err);
      return res.status(500).json({ error: "Erro ao listar empreendimentos" });
    }
    res.json(rows);
  });
});

// 5. CRIAR EMPREENDIMENTO
app.post("/api/empreendimentos", (req, res) => {
  const {
    nome,
    quantidade_blocos,
    quantidade_pavimentos_por_bloco,
    quantidade_apartamentos_por_pavimento,
    existem_halls,
    quantidade_halls_por_pavimento,
    observacoes
  } = req.body;
  
  if (!nome || !quantidade_pavimentos_por_bloco || !quantidade_apartamentos_por_pavimento) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }
  
  const sql = `
    INSERT INTO empreendimentos (
      nome, quantidade_blocos, quantidade_pavimentos_por_bloco,
      quantidade_apartamentos_por_pavimento, existem_halls,
      quantidade_halls_por_pavimento, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    nome,
    quantidade_blocos || 1,
    quantidade_pavimentos_por_bloco,
    quantidade_apartamentos_por_pavimento,
    existem_halls ? 1 : 0,
    quantidade_halls_por_pavimento || 0,
    observacoes || null
  ];
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Erro ao criar empreendimento:", err);
      return res.status(500).json({ error: "Erro ao criar empreendimento" });
    }
    
    res.status(201).json({ 
      id: this.lastID,
      message: "Empreendimento criado com sucesso" 
    });
  });
});

// ==================== ROTA RAIZ - ACESSO DIRETO ====================
app.get("/", (req, res) => {
  res.redirect("/index.html");
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     CONTRATOS VR - SERVIDOR INICIADO      ║
╠═══════════════════════════════════════════╣
║  Porta: ${PORT.toString().padEnd(34)}  ║
║  URL: http://localhost:${PORT.toString().padEnd(23)}  ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
