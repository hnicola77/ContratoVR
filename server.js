// ==================== ADICIONAR NO SERVER.JS (APÓS AS ROTAS DO CHAVEVR) ====================

// ==================== ROTAS DO CONTRATOS VR ====================

// 1. LISTAR TODOS OS CONTRATOS
app.get("/api/contratosvr/contratos", requireAuth, (req, res) => {
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
app.get("/api/contratosvr/contratos/:id", requireAuth, (req, res) => {
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
app.post("/api/contratosvr/contratos", requireAuth, (req, res) => {
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
  
  // Validações
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

// 4. ATUALIZAR CONTRATO
app.put("/api/contratosvr/contratos/:id", requireAuth, (req, res) => {
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

// 5. DELETAR CONTRATO
app.delete("/api/contratosvr/contratos/:id", requireAdmin, (req, res) => {
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

// ==================== EMPREENDIMENTOS ====================

// 6. LISTAR EMPREENDIMENTOS
app.get("/api/contratosvr/empreendimentos", requireAuth, (req, res) => {
  db.all("SELECT * FROM empreendimentos WHERE ativo = 1 ORDER BY nome", [], (err, rows) => {
    if (err) {
      console.error("Erro ao listar empreendimentos:", err);
      return res.status(500).json({ error: "Erro ao listar empreendimentos" });
    }
    res.json(rows);
  });
});

// 7. CRIAR EMPREENDIMENTO
app.post("/api/contratosvr/empreendimentos", requireAuth, (req, res) => {
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

// ==================== DISTRIBUIÇÃO DE METRAGEM ====================

// 8. LISTAR UNIDADES DE UM EMPREENDIMENTO
app.get("/api/contratosvr/unidades/empreendimento/:empId", requireAuth, (req, res) => {
  const { empId } = req.params;
  
  db.all(
    "SELECT * FROM unidades WHERE empreendimento_id = ? ORDER BY bloco, pavimento, numero_unidade",
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

// 9. CRIAR UNIDADES AUTOMATICAMENTE
app.post("/api/contratosvr/unidades/criar-automatico", requireAuth, (req, res) => {
  const { empreendimento_id } = req.body;
  
  // Buscar configuração do empreendimento
  db.get("SELECT * FROM empreendimentos WHERE id = ?", [empreendimento_id], (err, emp) => {
    if (err || !emp) {
      return res.status(404).json({ error: "Empreendimento não encontrado" });
    }
    
    const unidades = [];
    
    // Gerar unidades para cada bloco/pavimento
    for (let b = 1; b <= emp.quantidade_blocos; b++) {
      const blocoNome = `Bloco ${String(b).padStart(2, '0')}`;
      
      for (let p = 1; p <= emp.quantidade_pavimentos_por_bloco; p++) {
        // Apartamentos
        for (let a = 1; a <= emp.quantidade_apartamentos_por_pavimento; a++) {
          const numeroUnidade = `${p}${String(a).padStart(2, '0')}`;
          unidades.push([empreendimento_id, blocoNome, p, numeroUnidade, 'apartamento']);
        }
        
        // Hall (se existir)
        if (emp.existem_halls) {
          unidades.push([empreendimento_id, blocoNome, p, 'Hall', 'hall']);
        }
      }
    }
    
    // Inserir todas as unidades
    const sql = "INSERT OR IGNORE INTO unidades (empreendimento_id, bloco, pavimento, numero_unidade, tipo) VALUES (?, ?, ?, ?, ?)";
    
    let inserted = 0;
    unidades.forEach(unidade => {
      db.run(sql, unidade, function(err) {
        if (!err && this.changes > 0) inserted++;
      });
    });
    
    setTimeout(() => {
      res.json({ 
        message: `${inserted} unidades criadas com sucesso`,
        total: unidades.length
      });
    }, 500);
  });
});

// 10. DISTRIBUIR METRAGEM AUTOMATICAMENTE
app.post("/api/contratosvr/distribuicao/automatica", requireAuth, (req, res) => {
  const { contrato_id, pavimento, incluir_hall, metragem_hall } = req.body;
  
  // Buscar contrato e empreendimento
  const sqlContrato = `
    SELECT c.*, e.* FROM contratos c
    JOIN empreendimentos e ON c.empreendimento_id = e.id
    WHERE c.id = ?
  `;
  
  db.get(sqlContrato, [contrato_id], (err, contrato) => {
    if (err || !contrato) {
      return res.status(404).json({ error: "Contrato não encontrado" });
    }
    
    // Pegar metragem do pavimento
    const metragemPorPavimento = JSON.parse(contrato.metragem_por_pavimento);
    const metragemTotal = metragemPorPavimento[pavimento];
    
    if (!metragemTotal) {
      return res.status(400).json({ error: "Pavimento não encontrado no contrato" });
    }
    
    // Buscar unidades do pavimento
    const sqlUnidades = "SELECT * FROM unidades WHERE empreendimento_id = ? AND pavimento = ? AND tipo = 'apartamento'";
    
    db.all(sqlUnidades, [contrato.empreendimento_id, pavimento], (err, unidades) => {
      if (err || unidades.length === 0) {
        return res.status(404).json({ error: "Nenhuma unidade encontrada para este pavimento" });
      }
      
      // Calcular distribuição
      let metragemDisponivel = metragemTotal;
      if (incluir_hall && metragem_hall) {
        metragemDisponivel -= metragem_hall;
      }
      
      const metragen_por_apto = metragemDisponivel / unidades.length;
      
      // Criar distribuições
      const distribuicoes = unidades.map(u => ({
        unidade_id: u.id,
        numero_unidade: u.numero_unidade,
        metragem_contratada: metragen_por_apto
      }));
      
      // Se incluir hall, adicionar
      if (incluir_hall && metragem_hall) {
        distribuicoes.push({
          unidade_id: null, // Hall será criado/buscado
          numero_unidade: 'Hall',
          metragem_contratada: metragem_hall
        });
      }
      
      res.json({
        distribuicao: distribuicoes,
        soma_total: metragemTotal,
        valido: true
      });
    });
  });
});

// 11. SALVAR DISTRIBUIÇÃO
app.post("/api/contratosvr/distribuicao/salvar", requireAuth, (req, res) => {
  const { contrato_id, distribuicoes } = req.body;
  
  if (!contrato_id || !Array.isArray(distribuicoes) || distribuicoes.length === 0) {
    return res.status(400).json({ error: "Dados inválidos" });
  }
  
  // Validar soma
  const soma = distribuicoes.reduce((acc, d) => acc + d.metragem_contratada, 0);
  // Buscar metragem esperada...
  
  // Inserir distribuições
  const sql = `
    INSERT OR REPLACE INTO distribuicao (
      contrato_id, unidade_id, bloco, pavimento, metragem_contratada
    ) VALUES (?, ?, ?, ?, ?)
  `;
  
  let saved = 0;
  distribuicoes.forEach(dist => {
    db.run(sql, [
      contrato_id,
      dist.unidade_id,
      dist.bloco,
      dist.pavimento,
      dist.metragem_contratada
    ], function(err) {
      if (!err) saved++;
    });
  });
  
  setTimeout(() => {
    res.json({ message: `${saved} distribuições salvas com sucesso` });
  }, 300);
});

// ==================== FIM DAS ROTAS DO CONTRATOS VR ====================
