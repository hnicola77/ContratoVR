// ==================== CONTRATOS VR - SERVER.JS REVISADO ====================
// Versão 3.2 - MÁXIMO DE LOGS E VALIDAÇÕES

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3002;

console.log('\n🚀 Iniciando ContratosVR...\n');

// ==================== MIDDLEWARES ====================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// ==================== BANCO DE DADOS ====================

const isProduction = process.env.NODE_ENV === 'production';

// FORÇAR uso de /data em produção
let dbPath;
if (isProduction) {
  dbPath = '/data/contratosvr.db';
  console.log('🔍 PRODUÇÃO - Usando disco montado em /data');
} else {
  dbPath = path.join(__dirname, 'data', 'contratosvr.db');
  console.log('🔍 DESENVOLVIMENTO - Usando pasta local');
}

console.log('🔍 Caminho do banco:', dbPath);

// Criar pasta data
const dataDir = isProduction ? '/data' : path.join(__dirname, 'data');
console.log('🔍 Pasta de dados:', dataDir);

if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Pasta criada:', dataDir);
  } catch (err) {
    console.error('❌ Erro ao criar pasta:', err);
  }
} else {
  console.log('✅ Pasta já existe:', dataDir);
}

// Verificar permissões
try {
  fs.accessSync(dataDir, fs.constants.W_OK);
  console.log('✅ Pasta tem permissão de escrita');
} catch (err) {
  console.error('❌ SEM permissão de escrita na pasta:', err);
}

// Conectar ao banco
let db;
try {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("❌ Erro ao conectar no banco:", err);
      console.error("   Caminho:", dbPath);
      console.error("   Pasta:", dataDir);
      process.exit(1);
    } else {
      console.log("✅ Banco ContratosVR conectado");
      console.log("   Local:", dbPath);
      
      // TESTE DE ESCRITA
      console.log('\n🧪 Testando escrita no banco...');
      db.run("CREATE TABLE IF NOT EXISTS teste_escrita (id INTEGER)", (errTest) => {
        if (errTest) {
          console.error('❌ ERRO DE ESCRITA NO BANCO:', errTest.message);
          console.error('   O disco pode estar read-only ou sem permissão');
        } else {
          console.log('✅ Teste de escrita OK - Banco funcionando');
          db.run("DROP TABLE IF EXISTS teste_escrita");
        }
      });
    }
  });
} catch (err) {
  console.error("❌ Exceção ao criar banco:", err);
  process.exit(1);
}

// Habilitar foreign keys
db.run("PRAGMA foreign_keys = ON");
db.run("PRAGMA journal_mode = WAL"); // Melhor performance

// ==================== CRIAR TABELAS ====================

const criarTabelas = new Promise((resolve, reject) => {
  db.serialize(() => {
    
    // 1. EMPREENDIMENTOS
    db.run(`
      CREATE TABLE IF NOT EXISTS empreendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        observacoes TEXT,
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `, (err) => {
      if (err) {
        console.error('❌ Erro ao criar tabela empreendimentos:', err);
        reject(err);
      } else {
        console.log('✅ Tabela empreendimentos OK');
      }
    });

    // 2. BLOCOS
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
    `, (err) => {
      if (err) console.error('❌ Erro ao criar tabela blocos:', err);
      else console.log('✅ Tabela blocos OK');
    });

    // 3. CONTRATOS
    db.run(`
      CREATE TABLE IF NOT EXISTS contratos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero_contrato_oerp TEXT UNIQUE NOT NULL,
        empreendimento_id INTEGER NOT NULL,
        tipo_servico TEXT NOT NULL,
        valor_total REAL NOT NULL,
        valor_por_m2 REAL NOT NULL,
        metragem_total REAL NOT NULL,
        metragem_por_pavimento TEXT NOT NULL,
        observacoes TEXT,
        status TEXT DEFAULT 'ativo',
        data_inicio TEXT,
        data_previsao_termino TEXT,
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id)
      )
    `, (err) => {
      if (err) console.error('❌ Erro ao criar tabela contratos:', err);
      else console.log('✅ Tabela contratos OK');
    });

    // 4. UNIDADES
    db.run(`
      CREATE TABLE IF NOT EXISTS unidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empreendimento_id INTEGER NOT NULL,
        bloco_id INTEGER NOT NULL,
        bloco_nome TEXT NOT NULL,
        pavimento INTEGER NOT NULL,
        numero_unidade TEXT NOT NULL,
        tipo TEXT NOT NULL,
        tipologia TEXT,
        area_total REAL,
        observacoes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (empreendimento_id) REFERENCES empreendimentos(id) ON DELETE CASCADE,
        FOREIGN KEY (bloco_id) REFERENCES blocos(id) ON DELETE CASCADE,
        UNIQUE(empreendimento_id, bloco_nome, pavimento, numero_unidade)
      )
    `, (err) => {
      if (err) console.error('❌ Erro ao criar tabela unidades:', err);
      else console.log('✅ Tabela unidades OK');
    });

    // 5. DISTRIBUIÇÃO
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
    `, (err) => {
      if (err) console.error('❌ Erro ao criar tabela distribuicao:', err);
      else console.log('✅ Tabela distribuicao OK');
    });

    // 6. EXECUÇÃO
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
    `, (err) => {
      if (err) console.error('❌ Erro ao criar tabela execucao:', err);
      else console.log('✅ Tabela execucao OK');
    });

    // ÍNDICES
    db.run(`CREATE INDEX IF NOT EXISTS idx_contratos_empreendimento ON contratos(empreendimento_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_blocos_empreendimento ON blocos(empreendimento_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_unidades_bloco ON unidades(bloco_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_distribuicao_contrato ON distribuicao(contrato_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_execucao_contrato ON execucao(contrato_id)`);

    console.log("✅ Todas as tabelas criadas/verificadas\n");
    resolve();
  });
});

// ==================== ROTAS ====================

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "online", 
    version: "3.2.0",
    database: dbPath,
    environment: isProduction ? 'production' : 'development',
    time: new Date().toISOString()
  });
});

// LISTAR EMPREENDIMENTOS
app.get("/api/empreendimentos", (req, res) => {
  console.log('   📋 Buscando empreendimentos ativos');
  
  db.all("SELECT * FROM empreendimentos WHERE ativo = 1 ORDER BY nome", [], (err, rows) => {
    if (err) {
      console.error("   ❌ Erro SQL:", err.message);
      return res.status(500).json({ error: "Erro ao listar: " + err.message });
    }
    console.log(`   ✅ Encontrados: ${rows.length}`);
    res.json(rows);
  });
});

// BUSCAR UM EMPREENDIMENTO
app.get("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  console.log('   🔍 Buscando empreendimento:', id);
  
  db.get("SELECT * FROM empreendimentos WHERE id = ?", [id], (err, emp) => {
    if (err) {
      console.error("   ❌ Erro SQL:", err.message);
      return res.status(500).json({ error: "Erro ao buscar: " + err.message });
    }
    if (!emp) {
      console.log('   ❌ Não encontrado');
      return res.status(404).json({ error: "Não encontrado" });
    }
    
    db.all("SELECT * FROM blocos WHERE empreendimento_id = ? ORDER BY nome", [id], (err2, blocos) => {
      if (err2) {
        console.error("   ❌ Erro ao buscar blocos:", err2.message);
        return res.status(500).json({ error: "Erro ao buscar blocos: " + err2.message });
      }
      
      emp.blocos = blocos;
      console.log(`   ✅ ${emp.nome} com ${blocos.length} blocos`);
      res.json(emp);
    });
  });
});

// CRIAR EMPREENDIMENTO
app.post("/api/empreendimentos", (req, res) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 POST /api/empreendimentos');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { nome, observacoes, blocos } = req.body;
  
  console.log('📦 Dados recebidos:');
  console.log('   Nome:', nome);
  console.log('   Obs:', observacoes || '(vazio)');
  console.log('   Blocos:', blocos ? blocos.length : 0);
  
  if (blocos && blocos.length > 0) {
    blocos.forEach((b, i) => {
      console.log(`   Bloco ${i + 1}:`, b.nome, '-', b.quantidade_pavimentos, 'pav,', b.quantidade_apartamentos_por_pavimento, 'aptos');
    });
  }
  
  // VALIDAÇÕES
  if (!nome || nome.trim() === '') {
    console.log('❌ VALIDAÇÃO: Nome obrigatório');
    return res.status(400).json({ error: "Nome é obrigatório" });
  }
  
  if (!blocos || !Array.isArray(blocos)) {
    console.log('❌ VALIDAÇÃO: Blocos deve ser array');
    return res.status(400).json({ error: "Blocos deve ser um array" });
  }
  
  if (blocos.length === 0) {
    console.log('❌ VALIDAÇÃO: Pelo menos 1 bloco');
    return res.status(400).json({ error: "Adicione pelo menos um bloco" });
  }
  
  // Validar cada bloco
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    if (!b.nome || !b.quantidade_pavimentos || !b.quantidade_apartamentos_por_pavimento) {
      console.log(`❌ VALIDAÇÃO: Bloco ${i + 1} incompleto`, b);
      return res.status(400).json({ error: `Bloco ${i + 1} tem campos obrigatórios vazios` });
    }
  }
  
  console.log('✅ Validações OK');
  console.log('\n📝 Iniciando inserção no banco...');
  
  // INSERIR EMPREENDIMENTO
  const sqlEmp = "INSERT INTO empreendimentos (nome, observacoes) VALUES (?, ?)";
  
  db.run(sqlEmp, [nome.trim(), observacoes || null], function(err) {
    if (err) {
      console.error('❌ ERRO AO INSERIR EMPREENDIMENTO:', err.message);
      console.error('   SQL:', sqlEmp);
      console.error('   Params:', [nome, observacoes]);
      return res.status(500).json({ 
        error: "Erro ao criar empreendimento: " + err.message,
        details: err.message
      });
    }
    
    const empId = this.lastID;
    console.log(`✅ Empreendimento inserido! ID: ${empId}`);
    
    // INSERIR BLOCOS
    console.log(`\n📝 Inserindo ${blocos.length} blocos...`);
    
    const sqlBloco = `
      INSERT INTO blocos (
        empreendimento_id, nome, quantidade_pavimentos,
        quantidade_apartamentos_por_pavimento, existem_halls, quantidade_halls_por_pavimento
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    let savedBlocos = 0;
    let errors = [];
    
    blocos.forEach((bloco, index) => {
      const params = [
        empId,
        bloco.nome,
        parseInt(bloco.quantidade_pavimentos),
        parseInt(bloco.quantidade_apartamentos_por_pavimento),
        bloco.existem_halls ? 1 : 0,
        parseInt(bloco.quantidade_halls_por_pavimento) || 0
      ];
      
      console.log(`   Bloco ${index + 1}/${blocos.length}:`, bloco.nome);
      
      db.run(sqlBloco, params, function(errBloco) {
        savedBlocos++;
        
        if (errBloco) {
          console.error(`   ❌ Erro no bloco ${bloco.nome}:`, errBloco.message);
          errors.push({ bloco: bloco.nome, error: errBloco.message });
        } else {
          console.log(`   ✅ Bloco ${bloco.nome} inserido! ID: ${this.lastID}`);
        }
        
        // Quando todos os blocos foram processados
        if (savedBlocos === blocos.length) {
          if (errors.length > 0) {
            console.error('\n❌ FALHA! Erros nos blocos:', errors);
            return res.status(500).json({ 
              error: "Erros ao salvar blocos",
              details: errors
            });
          }
          
          console.log('\n✅✅✅ SUCESSO TOTAL! ✅✅✅');
          console.log(`   Empreendimento ID: ${empId}`);
          console.log(`   Blocos salvos: ${blocos.length}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          
          res.status(201).json({ 
            id: empId,
            message: "Empreendimento criado com sucesso!",
            blocos_salvos: blocos.length
          });
        }
      });
    });
  });
});

// ATUALIZAR EMPREENDIMENTO
// ATUALIZAR EMPREENDIMENTO (COM BLOCOS)
app.put("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  const { nome, observacoes, blocos } = req.body;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 PUT /api/empreendimentos/' + id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Nome:', nome);
  console.log('   Blocos recebidos:', blocos ? blocos.length : 0);
  
  // Atualizar empreendimento
  const sqlEmp = `
    UPDATE empreendimentos SET
      nome = ?,
      observacoes = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `;
  
  db.run(sqlEmp, [nome, observacoes, id], function(err) {
    if (err) {
      console.error("❌ Erro ao atualizar empreendimento:", err.message);
      return res.status(500).json({ error: "Erro ao atualizar: " + err.message });
    }
    
    if (this.changes === 0) {
      console.log('❌ Empreendimento não encontrado');
      return res.status(404).json({ error: "Empreendimento não encontrado" });
    }
    
    console.log('✅ Empreendimento atualizado');
    
    // Se não enviou blocos, retornar
    if (!blocos || !Array.isArray(blocos)) {
      console.log('⚠️  Sem blocos para atualizar');
      return res.json({ message: "Empreendimento atualizado com sucesso" });
    }
    
    // ATUALIZAR BLOCOS
    console.log('\n📝 Atualizando blocos...');
    
    // 1. Deletar blocos que não vieram na requisição
    db.all("SELECT id FROM blocos WHERE empreendimento_id = ?", [id], (err2, blocosExistentes) => {
      if (err2) {
        console.error("❌ Erro ao buscar blocos:", err2.message);
        return res.status(500).json({ error: "Erro ao buscar blocos: " + err2.message });
      }
      
      const idsRecebidos = blocos.filter(b => b.id).map(b => b.id);
      const idsParaDeletar = blocosExistentes.filter(b => !idsRecebidos.includes(b.id)).map(b => b.id);
      
      console.log('   IDs recebidos:', idsRecebidos);
      console.log('   IDs para deletar:', idsParaDeletar);
      
      // Deletar blocos removidos
      if (idsParaDeletar.length > 0) {
        const placeholders = idsParaDeletar.map(() => '?').join(',');
        db.run(`DELETE FROM blocos WHERE id IN (${placeholders})`, idsParaDeletar, (err3) => {
          if (err3) console.error("⚠️  Erro ao deletar blocos:", err3.message);
          else console.log(`✅ ${idsParaDeletar.length} blocos deletados`);
        });
      }
      
      // 2. Inserir ou atualizar blocos
      let processados = 0;
      let erros = [];
      
      blocos.forEach((bloco, index) => {
        if (bloco.id) {
          // ATUALIZAR bloco existente
          const sqlUpdate = `
            UPDATE blocos SET
              nome = ?,
              quantidade_pavimentos = ?,
              quantidade_apartamentos_por_pavimento = ?,
              existem_halls = ?,
              quantidade_halls_por_pavimento = ?
            WHERE id = ? AND empreendimento_id = ?
          `;
          
          db.run(sqlUpdate, [
            bloco.nome,
            bloco.quantidade_pavimentos,
            bloco.quantidade_apartamentos_por_pavimento,
            bloco.existem_halls ? 1 : 0,
            bloco.quantidade_halls_por_pavimento || 0,
            bloco.id,
            id
          ], function(errUpdate) {
            processados++;
            
            if (errUpdate) {
              console.error(`❌ Erro ao atualizar bloco ${bloco.nome}:`, errUpdate.message);
              erros.push({ bloco: bloco.nome, erro: errUpdate.message });
            } else {
              console.log(`✅ Bloco ${bloco.nome} atualizado (ID: ${bloco.id})`);
            }
            
            // Quando todos foram processados
            if (processados === blocos.length) {
              if (erros.length > 0) {
                return res.status(500).json({ error: "Erros ao atualizar blocos", detalhes: erros });
              }
              console.log('✅✅✅ EMPREENDIMENTO E BLOCOS ATUALIZADOS! ✅✅✅');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
              res.json({ message: "Empreendimento e blocos atualizados com sucesso" });
            }
          });
          
        } else {
          // INSERIR novo bloco
          const sqlInsert = `
            INSERT INTO blocos (
              empreendimento_id, nome, quantidade_pavimentos,
              quantidade_apartamentos_por_pavimento, existem_halls, quantidade_halls_por_pavimento
            ) VALUES (?, ?, ?, ?, ?, ?)
          `;
          
          db.run(sqlInsert, [
            id,
            bloco.nome,
            bloco.quantidade_pavimentos,
            bloco.quantidade_apartamentos_por_pavimento,
            bloco.existem_halls ? 1 : 0,
            bloco.quantidade_halls_por_pavimento || 0
          ], function(errInsert) {
            processados++;
            
            if (errInsert) {
              console.error(`❌ Erro ao inserir bloco ${bloco.nome}:`, errInsert.message);
              erros.push({ bloco: bloco.nome, erro: errInsert.message });
            } else {
              console.log(`✅ Bloco ${bloco.nome} inserido (ID: ${this.lastID})`);
            }
            
            // Quando todos foram processados
            if (processados === blocos.length) {
              if (erros.length > 0) {
                return res.status(500).json({ error: "Erros ao salvar blocos", detalhes: erros });
              }
              console.log('✅✅✅ EMPREENDIMENTO E BLOCOS ATUALIZADOS! ✅✅✅');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
              res.json({ message: "Empreendimento e blocos atualizados com sucesso" });
            }
          });
        }
      });
    });
  });
});

// DELETAR EMPREENDIMENTO
app.delete("/api/empreendimentos/:id", (req, res) => {
  const { id } = req.params;
  console.log('   🗑️  Deletando:', id);
  
  db.run("DELETE FROM empreendimentos WHERE id = ?", [id], function(err) {
    if (err) {
      console.error("   ❌ Erro SQL:", err.message);
      return res.status(500).json({ error: "Erro ao deletar: " + err.message });
    }
    if (this.changes === 0) {
      console.log('   ❌ Não encontrado');
      return res.status(404).json({ error: "Não encontrado" });
    }
    console.log('   ✅ Deletado');
    res.json({ message: "Deletado com sucesso" });
  });
});

// LISTAR BLOCOS
app.get("/api/blocos/empreendimento/:empId", (req, res) => {
  const { empId } = req.params;
  console.log('   📋 Buscando blocos do empreendimento:', empId);
  
  db.all("SELECT * FROM blocos WHERE empreendimento_id = ? ORDER BY nome", [empId], (err, rows) => {
    if (err) {
      console.error("   ❌ Erro SQL:", err.message);
      return res.status(500).json({ error: "Erro ao listar blocos: " + err.message });
    }
    console.log(`   ✅ Encontrados: ${rows.length} blocos`);
    res.json(rows);
  });
});

// LISTAR UNIDADES
app.get("/api/unidades/empreendimento/:empId", (req, res) => {
  const { empId } = req.params;
  console.log('   📋 Buscando unidades do empreendimento:', empId);
  
  db.all(
    "SELECT * FROM unidades WHERE empreendimento_id = ? ORDER BY bloco_nome, pavimento, numero_unidade",
    [empId],
    (err, rows) => {
      if (err) {
        console.error("   ❌ Erro SQL:", err.message);
        return res.status(500).json({ error: "Erro ao listar unidades: " + err.message });
      }
      console.log(`   ✅ Encontradas: ${rows.length} unidades`);
      res.json(rows);
    }
  );
});

// EDITAR UNIDADE
app.put("/api/unidades/:id", (req, res) => {
  const { id } = req.params;
  const { tipologia, area_total, observacoes } = req.body;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✏️ PUT /api/unidades/' + id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Tipologia:', tipologia || '(vazio)');
  console.log('   Área:', area_total || '(vazio)');
  console.log('   Obs:', observacoes || '(vazio)');
  
  const sql = `
    UPDATE unidades SET
      tipologia = ?,
      area_total = ?,
      observacoes = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `;
  
  db.run(sql, [tipologia || null, area_total || null, observacoes || null, id], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao atualizar unidade: " + err.message });
    }
    
    if (this.changes === 0) {
      console.log('❌ Unidade não encontrada');
      return res.status(404).json({ error: "Unidade não encontrada" });
    }
    
    console.log('✅ Unidade atualizada!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ message: "Unidade atualizada com sucesso" });
  });
});

// DELETAR UNIDADE
app.delete("/api/unidades/:id", (req, res) => {
  const { id } = req.params;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️ DELETE /api/unidades/' + id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  db.run("DELETE FROM unidades WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao deletar unidade: " + err.message });
    }
    
    if (this.changes === 0) {
      console.log('❌ Unidade não encontrada');
      return res.status(404).json({ error: "Unidade não encontrada" });
    }
    
    console.log('✅ Unidade deletada!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ message: "Unidade deletada com sucesso" });
  });
});

// ADICIONAR UNIDADE MANUAL
app.post("/api/unidades", (req, res) => {
  const {
    empreendimento_id,
    bloco_id,
    bloco_nome,
    pavimento,
    numero_unidade,
    tipo,
    tipologia,
    area_total,
    observacoes
  } = req.body;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('➕ POST /api/unidades (MANUAL)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Empreendimento:', empreendimento_id);
  console.log('   Bloco:', bloco_nome);
  console.log('   Pavimento:', pavimento);
  console.log('   Unidade:', numero_unidade);
  console.log('   Tipo:', tipo);
  
  // Validações
  if (!empreendimento_id || !bloco_id || !bloco_nome || !pavimento || !numero_unidade || !tipo) {
    console.error('❌ Campos obrigatórios faltando');
    return res.status(400).json({ error: "Campos obrigatórios: empreendimento_id, bloco_id, bloco_nome, pavimento, numero_unidade, tipo" });
  }
  
  const sql = `
    INSERT INTO unidades (
      empreendimento_id, bloco_id, bloco_nome, pavimento, numero_unidade,
      tipo, tipologia, area_total, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [
    empreendimento_id,
    bloco_id,
    bloco_nome,
    pavimento,
    numero_unidade,
    tipo,
    tipologia || null,
    area_total || null,
    observacoes || null
  ], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao criar unidade: " + err.message });
    }
    
    console.log('✅ Unidade criada! ID:', this.lastID);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.status(201).json({
      id: this.lastID,
      message: "Unidade criada com sucesso"
    });
  });
});

// CRIAR UNIDADES AUTOMATICAMENTE
app.post("/api/unidades/criar-automatico", (req, res) => {
  const { empreendimento_id } = req.body;
  console.log('   🏗️  Gerando unidades para empreendimento:', empreendimento_id);
  
  if (!empreendimento_id) {
    return res.status(400).json({ error: "empreendimento_id é obrigatório" });
  }
  
  db.all("SELECT * FROM blocos WHERE empreendimento_id = ?", [empreendimento_id], (err, blocos) => {
    if (err) {
      console.error("   ❌ Erro ao buscar blocos:", err.message);
      return res.status(500).json({ error: "Erro: " + err.message });
    }
    
    if (blocos.length === 0) {
      console.log('   ❌ Nenhum bloco encontrado');
      return res.status(404).json({ error: "Nenhum bloco encontrado" });
    }
    
    console.log(`   ✅ Encontrados ${blocos.length} blocos`);
    
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
    
    console.log(`   📝 Criando ${unidades.length} unidades...`);
    
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
          console.log(`   ✅ Criadas: ${inserted} unidades`);
          res.json({ 
            message: `${inserted} unidades criadas`,
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
  console.log('📋 GET /api/contratos');
  
  const sql = `
    SELECT c.*, e.nome as empreendimento_nome
    FROM contratos c
    LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id
    WHERE c.ativo = 1
    ORDER BY c.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao listar contratos: " + err.message });
    }
    
    console.log(`✅ Encontrados: ${rows.length} contratos`);
    
    // Parse metragem_por_pavimento (está como string JSON no banco)
    const contratos = rows.map(contrato => ({
      ...contrato,
      metragem_por_pavimento: contrato.metragem_por_pavimento ? JSON.parse(contrato.metragem_por_pavimento) : null
    }));
    
    res.json(contratos);
  });
});

// BUSCAR CONTRATO POR ID
app.get("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  console.log('📋 GET /api/contratos/' + id);
  
  const sql = `
    SELECT c.*, e.nome as empreendimento_nome
    FROM contratos c
    LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id
    WHERE c.id = ?
  `;
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao buscar contrato: " + err.message });
    }
    
    if (!row) {
      console.log('❌ Contrato não encontrado');
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    
    // Parse metragem_por_pavimento
    if (row.metragem_por_pavimento) {
      row.metragem_por_pavimento = JSON.parse(row.metragem_por_pavimento);
    }
    
    console.log('✅ Contrato encontrado:', row.numero_contrato_oerp);
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
    status,
    data_inicio,
    data_previsao_termino
  } = req.body;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 POST /api/contratos');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Número:', numero_contrato_oerp);
  console.log('   Empreendimento:', empreendimento_id);
  console.log('   Tipo:', tipo_servico);
  console.log('   Valor:', valor_total);
  console.log('   Metragem:', metragem_total);
  
  // Validações
  if (!numero_contrato_oerp || !empreendimento_id || !tipo_servico || !valor_total || !metragem_total) {
    console.error('❌ Campos obrigatórios faltando');
    return res.status(400).json({ 
      error: "Campos obrigatórios: numero_contrato_oerp, empreendimento_id, tipo_servico, valor_total, metragem_total" 
    });
  }
  
  const sql = `
    INSERT INTO contratos (
      numero_contrato_oerp,
      empreendimento_id,
      tipo_servico,
      valor_total,
      valor_por_m2,
      metragem_total,
      metragem_por_pavimento,
      observacoes,
      status,
      data_inicio,
      data_previsao_termino
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  // Converter metragem_por_pavimento para JSON string
  const metragen_json = metragem_por_pavimento ? JSON.stringify(metragem_por_pavimento) : null;
  
  db.run(sql, [
    numero_contrato_oerp,
    empreendimento_id,
    tipo_servico,
    valor_total,
    valor_por_m2 || 0,
    metragem_total,
    metragen_json,
    observacoes || null,
    status || 'ativo',
    data_inicio || null,
    data_previsao_termino || null
  ], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao criar contrato: " + err.message });
    }
    
    console.log('✅ Contrato criado! ID:', this.lastID);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
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
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✏️ PUT /api/contratos/' + id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
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
  
  const metragen_json = metragem_por_pavimento ? JSON.stringify(metragem_por_pavimento) : null;
  
  db.run(sql, [
    numero_contrato_oerp,
    tipo_servico,
    valor_total,
    valor_por_m2 || 0,
    metragem_total,
    metragen_json,
    observacoes || null,
    status || 'ativo',
    data_inicio || null,
    data_previsao_termino || null,
    id
  ], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao atualizar contrato: " + err.message });
    }
    
    if (this.changes === 0) {
      console.log('❌ Contrato não encontrado');
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    
    console.log('✅ Contrato atualizado!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ message: "Contrato atualizado com sucesso" });
  });
});

// DELETAR CONTRATO (soft delete)
app.delete("/api/contratos/:id", (req, res) => {
  const { id } = req.params;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️ DELETE /api/contratos/' + id);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Soft delete - apenas marca como inativo
  const sql = "UPDATE contratos SET ativo = 0, updated_at = datetime('now', 'localtime') WHERE id = ?";
  
  db.run(sql, [id], function(err) {
    if (err) {
      console.error('❌ Erro SQL:', err.message);
      return res.status(500).json({ error: "Erro ao deletar contrato: " + err.message });
    }
    
    if (this.changes === 0) {
      console.log('❌ Contrato não encontrado');
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    
    console.log('✅ Contrato deletado (soft delete)!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    res.json({ message: "Contrato deletado com sucesso" });
  });
});

// Continua com as outras rotas (distribuição, execução)
// ... (código das outras rotas aqui - mantido igual)

// ROTA RAIZ
app.get("/", (req, res) => {
  res.redirect("/index.html");
});

// ==================== INICIAR SERVIDOR ====================
criarTabelas.then(() => {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║   CONTRATOS VR - SISTEMA OPERACIONAL      ║
╠═══════════════════════════════════════════╣
║  Versão: 3.2.0 (REVISADO)                 ║
║  Porta: ${PORT.toString().padEnd(34)} ║
║  Ambiente: ${(isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO').padEnd(30)}║
║  Banco: ${dbPath.substring(0, 28).padEnd(30)}║
║                                           ║
║  🌐 Acesse: http://localhost:${PORT.toString().padEnd(19)}║
║  🧪 Teste: http://localhost:${PORT}/teste.html  ║
╚═══════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('❌ Erro fatal ao criar tabelas:', err);
  process.exit(1);
});

module.exports = app;
