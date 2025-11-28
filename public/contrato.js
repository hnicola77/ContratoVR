/************************************************************
 * CONTRATOS VR - JAVASCRIPT PRINCIPAL
 ************************************************************/

let todosContratos = [];
let contratosFiltrados = [];

// ==================== CARREGAR DADOS ====================
async function carregarContratos() {
  try {
    const response = await fetch('/api/contratosvr/contratos');
    if (!response.ok) throw new Error('Erro ao carregar contratos');
    
    todosContratos = await response.json();
    contratosFiltrados = [...todosContratos];
    
    atualizarCards();
    preencherFiltros();
    renderizarTabela();
  } catch (error) {
    console.error('Erro:', error);
    alert('Erro ao carregar contratos');
  }
}

// ==================== ATUALIZAR CARDS ====================
function atualizarCards() {
  const total = todosContratos.length;
  const ativos = todosContratos.filter(c => c.status === 'ativo').length;
  
  const metragemTotal = todosContratos.reduce((sum, c) => sum + (c.metragem_total || 0), 0);
  const valorTotal = todosContratos.reduce((sum, c) => sum + (c.valor_total || 0), 0);
  
  document.getElementById('cardTotalContratos').textContent = total;
  document.getElementById('cardAtivos').textContent = ativos;
  document.getElementById('cardMetragemTotal').textContent = `${metragemTotal.toFixed(2)} m²`;
  document.getElementById('cardValorTotal').textContent = `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

// ==================== PREENCHER FILTROS ====================
function preencherFiltros() {
  const empreendimentos = [...new Set(todosContratos.map(c => c.empreendimento_nome).filter(e => e))];
  
  const selectEmp = document.getElementById('filtroEmpreendimento');
  selectEmp.innerHTML = '<option value="">Todos</option>';
  
  empreendimentos.sort().forEach(emp => {
    const option = document.createElement('option');
    option.value = emp;
    option.textContent = emp;
    selectEmp.appendChild(option);
  });
}

// ==================== FILTRAR CONTRATOS ====================
function filtrarContratos() {
  const busca = document.getElementById('buscaRapida').value.toLowerCase();
  const empreendimento = document.getElementById('filtroEmpreendimento').value;
  const status = document.getElementById('filtroStatus').value;
  
  contratosFiltrados = todosContratos.filter(contrato => {
    // Busca rápida
    if (busca && !contrato.numero_contrato_oerp.toLowerCase().includes(busca)) {
      return false;
    }
    
    // Filtro de empreendimento
    if (empreendimento && contrato.empreendimento_nome !== empreendimento) {
      return false;
    }
    
    // Filtro de status
    if (status && contrato.status !== status) {
      return false;
    }
    
    return true;
  });
  
  renderizarTabela();
}

// ==================== LIMPAR FILTROS ====================
function limparFiltros() {
  document.getElementById('buscaRapida').value = '';
  document.getElementById('filtroEmpreendimento').value = '';
  document.getElementById('filtroStatus').value = '';
  filtrarContratos();
}

// ==================== RENDERIZAR TABELA ====================
function renderizarTabela() {
  const tbody = document.getElementById('tabelaContratos');
  
  if (contratosFiltrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">Nenhum contrato encontrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  
  contratosFiltrados.forEach(contrato => {
    const tr = document.createElement('tr');
    
    // Badge de status
    let statusBadge = '';
    let statusColor = '';
    if (contrato.status === 'ativo') {
      statusColor = 'background: #10b981; color: white;';
      statusBadge = 'Ativo';
    } else if (contrato.status === 'pausado') {
      statusColor = 'background: #f59e0b; color: white;';
      statusBadge = 'Pausado';
    } else {
      statusColor = 'background: #64748b; color: white;';
      statusBadge = 'Encerrado';
    }
    
    // Badge de tipo
    let tipoBadge = contrato.tipo_servico;
    if (contrato.tipo_servico === 'ambos') tipoBadge = 'Piso + Azulejo';
    
    // % Executado (mock - depois vem do banco)
    const percentualExecutado = contrato.percentual_executado || 0;
    
    tr.innerHTML = `
      <td><strong>${contrato.numero_contrato_oerp}</strong></td>
      <td>${contrato.empreendimento_nome || '-'}</td>
      <td><span style="padding: 4px 8px; border-radius: 4px; background: #e0e7ff; color: #3730a3; font-size: 12px;">${tipoBadge}</span></td>
      <td>${parseFloat(contrato.metragem_total).toFixed(2)} m²</td>
      <td>R$ ${parseFloat(contrato.valor_total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
      <td><span style="padding: 4px 8px; border-radius: 4px; ${statusColor} font-size: 12px;">${statusBadge}</span></td>
      <td>
        <div style="width: 100%; background: #e2e8f0; border-radius: 4px; height: 20px; overflow: hidden;">
          <div style="width: ${percentualExecutado}%; background: linear-gradient(90deg, #10b981, #059669); height: 100%; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">
            ${percentualExecutado}%
          </div>
        </div>
      </td>
      <td>
        <button class="btn-small" onclick="verDetalhes(${contrato.id})" title="Ver detalhes">👁️</button>
        <button class="btn-small" onclick="editarContrato(${contrato.id})" title="Editar">✏️</button>
        <button class="btn-small" onclick="distribuirMetragem(${contrato.id})" title="Distribuir metragem">📏</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}

// ==================== AÇÕES ====================
function verDetalhes(id) {
  window.location.href = `/contratosvr/detalhes.html?id=${id}`;
}

function editarContrato(id) {
  window.location.href = `/contratosvr/editar-contrato.html?id=${id}`;
}

function distribuirMetragem(id) {
  window.location.href = `/contratosvr/distribuicao.html?contrato_id=${id}`;
}

// ==================== INICIALIZAR ====================
document.addEventListener('DOMContentLoaded', () => {
  carregarContratos();
});
