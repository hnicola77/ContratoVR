// ==================== CONTRATOS VR - SERVER.JS COMPLETO ====================
// Sistema de Distribuição de Metragem por Unidade
// Versão 3.0 - CORRIGIDA

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3002;

// ==================== MIDDLEWARES ====================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ==================== BANCO DE DADOS ====================

const dbPath = process.env.DATABASE_PATH || "./data";
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Erro ao conectar no banco:", err);
  } else {
    console.log("✅ Banco ContratosVR conectado em:", dbPath);
  }
});

// ==================== CRIAR TABELAS ====================

db.serialize(() => {
  
  // 1. TABELA DE EMPREENDIMENTOS (simplificada)
  db.run(`
    CREATE TABLE IF NOT EXISTS empreendimentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      observacoes TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 2. TABELA DE BLOCOS (novo - cada bloco pode ter config diferente)
  db.run(`
    CREATE TABLE IF NOT EXISTS blocos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empreendimento_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      quantidade_pavimentos INTEGER NOT NULL,
      quantidade_apartamentos_por_pavimento INTEGER NOT NULL,
      existem_halls INTEGER DEFAULT 0,
      quantidade_halls_por_pavimento INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id) ON DELETE CASCADE,
      UNIQUE(empreendimento_id, nome)
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
      bloco_id INTEGER NOT NULL,
      bloco_nome TEXT NOT NULL,
      pavimento INTEGER NOT NULL,
      numero_unidade TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('apartamento', 'hall')),
      tipologia TEXT,
      area_total REAL,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id) ON DELETE CASCADE,
      FOREIGN KEY (bloco_id) REFERENCES blocos(id) ON DELETE CASCADE,
      UNIQUE(empreendimento_id, bloco_nome, pavimento, numero_unidade)
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

  // CRIAR ÍNDICES
  db.run(`CREATE INDEX IF NOT EXISTS idx_contratos_empreendimento ON contratos(empreendimento_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_blocos_empreendimento ON blocos(empreendimento_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_unidades_bloco ON unidades(bloco_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_distribuicao_contrato ON distribuicao(contrato_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_execucao_contrato ON execucao(contrato_id)`);

  console.log("✅ Tabelas do ContratosVR criadas/verificadas");
});

// ==================== ROTAS DA API ====================

// ==================== EMPREENDIMENTOS ====================

// LISTAR EMPREENDIMENTOS
app.get("/api/empreendimentos", (req, res) => {
  db.all("SELECT * FROM empreendimentos WHERE ativo = 1 ORDER BY nome", [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar empreendimentos:", err);
      return res.status(500).json({ error: "Erro ao listar empreendimentos" });
    }
    res.json(rows);
  });
});

// BUSCAR UM EMPREENDIMENTO COM BLOCOS
app.get("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM empreendimentos WHERE id = ?", [id], (err, emp) => {
    if (err) {
      console.error("Erro ao buscar empreendimento:", err);
      return res.status(500).json({ error: "Erro ao buscar empreendimento" });
    }
    if (!emp) {
      return res.status(404).json({ error: "Empreendimento não encontrado" });
    }
    
    // Buscar blocos
    db.all("SELECT * FROM blocos WHERE empreendimento_id = ? ORDER BY nome", [id], (err2, blocos) => {
      if (err2) {
        console.error("Erro ao buscar blocos:", err2);
        return res.status(500).json({ error: "Erro ao buscar blocos" });
      }
      
      emp.blocos = blocos;
      res.json(emp);
    });
  });
});

// CRIAR EMPREENDIMENTO COM BLOCOS
app.post("/api/empreendimentos", (req, res) => {
  const { nome, observacoes, blocos } = req.body;
  
  if (!nome) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }
  
  if (!blocos || !Array.isArray(blocos) || blocos.length === 0) {
    return res.status(400).json({ error: "Pelo menos um bloco é obrigatório" });
  }
  
  // Criar empreendimento
  const sqlEmp = "INSERT INTO empreendimentos (nome, observacoes) VALUES (?, ?)";
  
  db.run(sqlEmp, [nome, observacoes || null], function(err) {
    if (err) {
      console.error("Erro ao criar empreendimento:", err);
      return res.status(500).json({ error: "Erro ao criar empreendimento: " + err.message });
    }
    
    const empId = this.lastID;
    
    // Criar blocos
    const sqlBloco = `
      INSERT INTO blocos (
        empreendimento_id, nome, quantidade_pavimentos,
        quantidade_apartamentos_por_pavimento, existem_halls, quantidade_halls_por_pavimento
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    let savedBlocos = 0;
    let errors = [];
    
    blocos.forEach((bloco, index) => {
      db.run(sqlBloco, [
        empId,
        bloco.nome,
        bloco.quantidade_pavimentos,
        bloco.quantidade_apartamentos_por_pavimento,
        bloco.existem_halls ? 1 : 0,
        bloco.quantidade_halls_por_pavimento || 0
      ], function(err) {
        savedBlocos++;
        
        if (err) {
          console.error("Erro ao salvar bloco:", err);
          errors.push(err.message);
        }
        
        if (savedBlocos === blocos.length) {
          if (errors.length > 0) {
            return res.status(500).json({ error: "Erros ao salvar blocos: " + errors.join(", ") });
          }
          res.status(201).json({ 
            id: empId,
            message: "Empreendimento criado com sucesso" 
          });
        }
      });
    });
  });
});

// ATUALIZAR EMPREENDIMENTO
app.put("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  const { nome, observacoes } = req.body;
  
  const sql = `
    UPDATE empreendimentos SET
      nome = ?,
      observacoes = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `;
  
  db.run(sql, [nome, observacoes, id], function(err) {
    if (err) {
      console.error("Erro ao atualizar empreendimento:", err);
      return res.status(500).json({ error: "Erro ao atualizar empreendimento" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Empreendimento não encontrado" });
    }
    res.json({ message: "Empreendimento atualizado com sucesso" });
  });
});

// DELETAR EMPREENDIMENTO
app.delete("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM empreendimentos WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("Erro ao deletar empreendimento:", err);
      return res.status(500).json({ error: "Erro ao deletar empreendimento" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Empreendimento não encontrado" });
    }
    res.json({ message: "Empreendimento deletado com sucesso" });
  });
});

// ==================== BLOCOS ====================

// LISTAR BLOCOS DE UM EMPREENDIMENTO
app.get("/api/blocos/empreendimento/:empId", (req, res) => {
  const { empId } = req.params;
  db.all("SELECT * FROM blocos WHERE empreendimento_id = ? ORDER BY nome", [empId], (err, rows) => {
    if (err) {
      console.error("Erro ao listar blocos:", err);
      return res.status(500).json({ error: "Erro ao listar blocos" });
    }
    res.json(rows);
  });
});

// ==================== UNIDADES ====================

// LISTAR UNIDADES DE UM EMPREENDIMENTO
app.get("/api/unidades/empreendimento/:empId", (req, res) => {
  const { empId } = req.params;
  db.all(
    "SELECT * FROM unidades WHERE empreendimento_id = ? ORDER BY bloco_nome, pavimento, numero_unidade",
    [empId],
    (err, rows) => {
      if (err) {
        console.error("Erro ao listar unidades:", err);
        return res.status(500).json({ error: "Erro ao listar unidades" });
      }
      res.json(rows);
    }
  );
});

// CRIAR UNIDADES AUTOMATICAMENTE
app.post("/api/unidades/criar-automatico", (req, res) => {
  const { empreendimento_id } = req.body;
  
  if (!empreendimento_id) {
    return res.status(400).json({ error: "empreendimento_id é obrigatório" });
  }
  
  // Buscar blocos do empreendimento
  db.all("SELECT * FROM blocos WHERE empreendimento_id = ?", [empreendimento_id], (err, blocos) => {
    if (err || blocos.length === 0) {
      return res.status(404).json({ error: "Nenhum bloco encontrado para este empreendimento" });
    }
    
    const unidades = [];
    
    blocos.forEach(bloco => {
      for (let p = 1; p <= bloco.quantidade_pavimentos; p++) {
        // Apartamentos
        for (let a = 1; a <= bloco.quantidade_apartamentos_por_pavimento; a++) {
          const numeroUnidade = `${p}${String(a).padStart(2, '0')}`;
          unidades.push([
            empreendimento_id,
            bloco.id,
            bloco.nome,
            p,
            numeroUnidade,
            'apartamento',
            null
          ]);
        }
        
        // Halls
        if (bloco.existem_halls) {
          for (let h = 1; h <= bloco.quantidade_halls_por_pavimento; h++) {
            const numeroHall = bloco.quantidade_halls_por_pavimento > 1 ? `Hall ${h}` : 'Hall';
            unidades.push([
              empreendimento_id,
              bloco.id,
              bloco.nome,
              p,
              numeroHall,
              'hall',
              null
            ]);
          }
        }
      }
    });
    
    // Inserir unidades
    const sql = `INSERT OR IGNORE INTO unidades 
      (empreendimento_id, bloco_id, bloco_nome, pavimento, numero_unidade, tipo, observacoes) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    let inserted = 0;
    let processed = 0;
    
    unidades.forEach(unidade => {
      db.run(sql, unidade, function(err) {
        processed++;
        if (!err && this.changes > 0) inserted++;
        
        if (processed === unidades.length) {
          res.json({ 
            message: `${inserted} unidades criadas com sucesso`,
            total: unidades.length,
            inserted: inserted,
            duplicated: unidades.length - inserted
          });
        }
      });
    });
  });
});

// ==================== CONTRATOS ====================

// LISTAR TODOS OS CONTRATOS
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

// BUSCAR UM CONTRATO
app.get("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT c.*, e.nome as empreendimento_nome
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

// CRIAR CONTRATO
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
    valor_por_m2 || 0,
    metragem_total,
    JSON.stringify(metragem_por_pavimento || {}),
    observacoes || null,
    data_inicio || null,
    data_previsao_termino || null
  ];
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Erro ao criar contrato:", err);
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: "Número de contrato já existe" });
      }
      return res.status(500).json({ error: "Erro ao criar contrato: " + err.message });
    }
    
    res.status(201).json({ 
      id: this.lastID,
      message: "Contrato criado com sucesso" 
    });
  });
});

// ATUALIZAR CONTRATO
app.put("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  const {
    numero_contrato_oerp,
    tipo_servico,
    valor_total,
    valor_por_m2,
    metragem_total,
    metragem_por_pavimento,
    observacoes,
    status,
    data_inicio,
    data_previsao_termino
  } = req.body;
  
  const sql = `
    UPDATE contratos SET
      numero_contrato_oerp = ?,
      tipo_servico = ?,
      valor_total = ?,
      valor_por_m2 = ?,
      metragem_total = ?,
      metragem_por_pavimento = ?,
      observacoes = ?,
      status = ?,
      data_inicio = ?,
      data_previsao_termino = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `;
  
  const params = [
    numero_contrato_oerp,
    tipo_servico,
    valor_total,
    valor_por_m2,
    metragem_total,
    JSON.stringify(metragem_por_pavimento),
    observacoes,
    status,
    data_inicio,
    data_previsao_termino,
    id
  ];
  
  db.run(sql, params, function(err) {
    if (err) {
      console.error("Erro ao atualizar contrato:", err);
      return res.status(500).json({ error: "Erro ao atualizar contrato" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    res.json({ message: "Contrato atualizado com sucesso" });
  });
});

// DELETAR CONTRATO
app.delete("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM contratos WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("Erro ao deletar contrato:", err);
      return res.status(500).json({ error: "Erro ao deletar contrato" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    res.json({ message: "Contrato deletado com sucesso" });
  });
});

// ==================== DISTRIBUIÇÃO ====================

// LISTAR DISTRIBUIÇÃO DE UM CONTRATO
app.get("/api/distribuicao/contrato/:contratoId", (req, res) => {
  const { contratoId } = req.params;
  
  const sql = `
    SELECT 
      d.*,
      u.numero_unidade,
      u.bloco_nome as bloco,
      u.pavimento,
      u.tipo
    FROM distribuicao d
    LEFT JOIN unidades u ON d.unidade_id = u.id
    WHERE d.contrato_id = ?
    ORDER BY u.bloco_nome, u.pavimento, u.numero_unidade
  `;
  
  db.all(sql, [contratoId], (err, rows) => {
    if (err) {
      console.error("Erro ao listar distribuição:", err);
      return res.status(500).json({ error: "Erro ao listar distribuição" });
    }
    res.json(rows);
  });
});

// SALVAR DISTRIBUIÇÃO
app.post("/api/distribuicao/salvar", (req, res) => {
  const { contrato_id, distribuicoes } = req.body;
  
  if (!contrato_id || !Array.isArray(distribuicoes) || distribuicoes.length === 0) {
    return res.status(400).json({ error: "Dados inválidos" });
  }
  
  // Deletar distribuições antigas
  db.run("DELETE FROM distribuicao WHERE contrato_id = ?", [contrato_id], (err) => {
    if (err) {
      console.error("Erro ao deletar distribuições antigas:", err);
      return res.status(500).json({ error: "Erro ao salvar distribuição" });
    }
    
    // Inserir novas distribuições
    const sql = `
      INSERT INTO distribuicao (
        contrato_id, unidade_id, bloco, pavimento, metragem_contratada, coeficiente
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    let saved = 0;
    let errors = 0;
    
    distribuicoes.forEach(dist => {
      db.run(sql, [
        contrato_id,
        dist.unidade_id,
        dist.bloco,
        dist.pavimento,
        dist.metragem_contratada,
        dist.coeficiente || 1.0
      ], function(err) {
        if (err) {
          console.error("Erro ao salvar distribuição:", err);
          errors++;
        } else {
          saved++;
        }
        
        if (saved + errors === distribuicoes.length) {
          res.json({ 
            message: `${saved} distribuições salvas com sucesso`,
            saved: saved,
            errors: errors
          });
        }
      });
    });
  });
});

// ==================== EXECUÇÃO ====================

// LISTAR EXECUÇÕES DE UM CONTRATO
app.get("/api/execucao/contrato/:contratoId", (req, res) => {
  const { contratoId } = req.params;
  
  const sql = `
    SELECT 
      e.*,
      u.numero_unidade,
      u.bloco_nome as bloco,
      u.pavimento,
      u.tipo
    FROM execucao e
    LEFT JOIN unidades u ON e.unidade_id = u.id
    WHERE e.contrato_id = ?
    ORDER BY e.created_at DESC
  `;
  
  db.all(sql, [contratoId], (err, rows) => {
    if (err) {
      console.error("Erro ao listar execuções:", err);
      return res.status(500).json({ error: "Erro ao listar execuções" });
    }
    res.json(rows);
  });
});

// REGISTRAR EXECUÇÃO
app.post("/api/execucao/registrar", (req, res) => {
  const {
    contrato_id,
    unidade_id,
    metragem_executada,
    data_medicao,
    responsavel,
    observacoes
  } = req.body;
  
  if (!contrato_id || !unidade_id || !metragem_executada || !data_medicao) {
    return res.status(400).json({ error: "Campos obrigatórios faltando" });
  }
  
  const sql = `
    INSERT INTO execucao (
      contrato_id, unidade_id, metragem_executada, data_medicao, responsavel, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [contrato_id, unidade_id, metragem_executada, data_medicao, responsavel, observacoes], function(err) {
    if (err) {
      console.error("Erro ao registrar execução:", err);
      return res.status(500).json({ error: "Erro ao registrar execução: " + err.message });
    }
    
    res.status(201).json({ 
      id: this.lastID,
      message: "Execução registrada com sucesso" 
    });
  });
});

// ==================== ROTA RAIZ ====================
app.get("/", (req, res) => {
  res.redirect("/index.html");
});

// ==================== HEALTH CHECK ====================
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "online", 
    version: "3.0.0",
    database: dbPath
  });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║     CONTRATOS VR - SERVIDOR INICIADO      ║
╠═══════════════════════════════════════════╣
║  Porta: ${PORT.toString().padEnd(34)} ║
║  URL: http://localhost:${PORT.toString().padEnd(23)} ║
║  Banco: ${dbPath.substring(0, 28).padEnd(30)}║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
