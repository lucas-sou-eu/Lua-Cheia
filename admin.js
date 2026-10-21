const DEFAULT_API_URL = "https://hawaii-feeding-expensive-discipline.trycloudflare.com/api";
let API_URL = localStorage.getItem('LUA_CHEIA_API_URL') || DEFAULT_API_URL;

let produtos = [];
let categorias = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('inputApiUrlConfig').value = API_URL;
    carregarDadosDoBanco();
});

// ALTERAR ENTRE ABAS E DESTAQUE NO MENU LATERAL (LARANJA)
function switchTab(tab) {
    const sections = ['dashboard', 'produtos', 'categorias', 'configuracoes'];

    sections.forEach(s => {
        const secEl = document.getElementById(`section-${s}`);
        const navBtn = document.getElementById(`nav-${s}`);

        if (s === tab) {
            secEl.classList.remove('hidden');
            navBtn.classList.add('active'); // Aplica o estilo Laranja
        } else {
            secEl.classList.add('hidden');
            navBtn.classList.remove('active');
        }
    });

    const titulos = {
        dashboard: 'Visão Geral',
        produtos: 'Gestão do Cardápio',
        categorias: 'Categorias do Cardápio',
        configuracoes: 'Configurações de Conexão'
    };

    document.getElementById('pageTitle').textContent = titulos[tab] || 'Painel';

    // Fecha o menu lateral no telemóvel se estiver aberto
    const sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
        toggleMobileSidebar();
    }
}

async function carregarDadosDoBanco(manual = false) {
    const badgeDot = document.getElementById('apiStatusDot');
    const badgeText = document.getElementById('apiStatusText');

    try {
        const [resProd, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos/`),
            fetch(`${API_URL}/categorias/`)
        ]);

        if (!resProd.ok || !resCat.ok) throw new Error("Erro ao aceder ao banco");

        produtos = await resProd.json();
        categorias = await resCat.json();

        badgeDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        badgeText.textContent = "Banco Conectado (Django)";
        badgeText.className = "text-emerald-400 font-semibold";

        if (manual) showToast("Dados atualizados com sucesso direto do banco!", "success");

        renderizarTudo();
    } catch (error) {
        badgeDot.className = "w-2 h-2 rounded-full bg-rose-500";
        badgeText.textContent = "Erro de Conexão com o Banco";
        badgeText.className = "text-rose-400 font-medium";
        if (manual) showToast("Não foi possível conectar ao banco de dados.", "error");
    }
}

function renderizarTudo() {
    renderizarDashboard();
    renderizarProdutos();
    renderizarCategorias();
    preencherSelectCategorias();
}

function renderizarDashboard() {
    document.getElementById('dashTotalProdutos').textContent = produtos.length;
    document.getElementById('dashStockBaixo').textContent = produtos.filter(p => (p.quantidade_estoque || 0) <= 3).length;
    document.getElementById('dashTotalCategorias').textContent = categorias.length;
}

function renderizarProdutos(lista = produtos) {
    const body = document.getElementById('tableProdutosBody');
    body.innerHTML = lista.map(p => `
        <tr class="hover:bg-slate-800/40">
            <td class="p-4 flex items-center gap-3">
                <img src="${p.imagem_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80'}" class="w-10 h-10 rounded-xl object-cover border border-slate-700">
                <div>
                    <h4 class="font-bold text-slate-200">${p.nome}</h4>
                    <p class="text-xs text-slate-400">${p.descricao || ''}</p>
                </div>
            </td>
            <td class="p-4 text-xs text-slate-300">${p.categoria_nome || 'Geral'}</td>
            <td class="p-4 font-semibold text-amber-400">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</td>
            <td class="p-4 font-bold ${p.quantidade_estoque <= 3 ? 'text-amber-400' : 'text-slate-300'}">${p.quantidade_estoque ?? 0} un</td>
            <td class="p-4 text-right space-x-2">
                <button onclick="editarProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-amber-500/10 text-amber-400 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="excluirProduto(${p.id})" class="p-2 bg-slate-800 hover:bg-rose-500/10 text-rose-400 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" class="p-8 text-center text-slate-500">Nenhum produto encontrado no banco.</td></tr>`;
}

function filtrarProdutos() {
    const busca = document.getElementById('inputSearchProduto').value.toLowerCase();
    const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca));
    renderizarProdutos(filtrados);
}

function renderizarCategorias() {
    const grid = document.getElementById('gridCategorias');
    grid.innerHTML = categorias.map(c => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-3">
            <div class="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><i class="fa-solid fa-tag"></i></div>
            <div>
                <h4 class="font-bold text-slate-200">${c.nome}</h4>
                <p class="text-xs text-slate-400">${produtos.filter(p => p.categoria === c.id || p.categoria_nome === c.nome).length} produtos</p>
            </div>
        </div>
    `).join('');
}

function preencherSelectCategorias() {
    const select = document.getElementById('prodCategoria');
    select.innerHTML = categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('') || `<option value="">Selecione uma categoria</option>`;
}

async function salvarProduto(e) {
    e.preventDefault();
    const id = document.getElementById('prodId').value;

    const payload = {
        nome: document.getElementById('prodNome').value,
        preco: parseFloat(document.getElementById('prodPreco').value),
        quantidade_estoque: parseInt(document.getElementById('prodEstoque').value),
        categoria: parseInt(document.getElementById('prodCategoria').value), // Envia o ID correto exigido pela foreign key do Django
        descricao: document.getElementById('prodDescricao').value,
        imagem_url: document.getElementById('prodImagemUrl').value,
        ativo: true
    };

    const url = id ? `${API_URL}/produtos/${id}/` : `${API_URL}/produtos/`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Produto guardado com sucesso no banco de dados!", "success");
            fecharModalProduto();
            carregarDadosDoBanco();
        } else {
            const erroData = await res.json();
            console.error("Detalhes do erro 400 (Produto):", erroData);
            showToast("Erro ao guardar o produto no banco.", "error");
        }
    } catch (err) {
        showToast("Falha de comunicação com o servidor.", "error");
    }
}

async function excluirProduto(id) {
    if (!confirm("Tem certeza que deseja apagar este produto do banco?")) return;

    try {
        const res = await fetch(`${API_URL}/produtos/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Produto removido do banco!", "success");
            carregarDadosDoBanco();
        }
    } catch (err) {
        showToast("Erro ao excluir do banco.", "error");
    }
}

async function salvarCategoria(e) {
    e.preventDefault();
    const nome = document.getElementById('catNome').value;

    const slug = nome.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '-');

    const payload = {
        nome: nome,
        slug: slug
    };

    try {
        const res = await fetch(`${API_URL}/categorias/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Categoria criada no banco com sucesso!", "success");
            fecharModalCategoria();
            carregarDadosDoBanco();
        } else {
            const erroData = await res.json();
            console.error("Detalhes do erro 400:", erroData);
            showToast("Erro ao criar categoria no banco.", "error");
        }
    } catch (err) {
        showToast("Erro de comunicação com o servidor.", "error");
    }
}

function salvarNovaApiUrl() {
    const val = document.getElementById('inputApiUrlConfig').value.trim();
    if (val) {
        API_URL = val.replace(/\/$/, "");
        localStorage.setItem('LUA_CHEIA_API_URL', API_URL);
        showToast("URL da API atualizada!", "success");
        carregarDadosDoBanco(true);
    }
}

function abrirModalProduto() {
    document.getElementById('formProduto').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('modalProdutoTitulo').textContent = 'Novo Produto';
    document.getElementById('modalProduto').classList.remove('hidden');
}

function editarProduto(id) {
    const p = produtos.find(item => item.id == id);
    if (!p) return;
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodNome').value = p.nome;
    document.getElementById('prodPreco').value = p.preco;
    document.getElementById('prodEstoque').value = p.quantidade_estoque ?? 0;
    document.getElementById('prodCategoria').value = p.categoria || ''; // Atribui corretamente o ID da categoria
    document.getElementById('prodDescricao').value = p.descricao || '';
    document.getElementById('prodImagemUrl').value = p.imagem_url || '';
    document.getElementById('modalProdutoTitulo').textContent = 'Editar Produto';
    document.getElementById('modalProduto').classList.remove('hidden');
}

function fecharModalProduto() { document.getElementById('modalProduto').classList.add('hidden'); }
function abrirModalCategoria() { document.getElementById('modalCategoria').classList.remove('hidden'); }
function fecharModalCategoria() { document.getElementById('modalCategoria').classList.add('hidden'); }

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function showToast(msg, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const cores = { success: 'bg-emerald-950 text-emerald-300', error: 'bg-rose-950 text-rose-300', info: 'bg-slate-900 text-slate-200' };
    toast.className = `px-4 py-3 rounded-xl border border-slate-700 text-xs font-medium shadow-xl ${cores[tipo]}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}