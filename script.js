// Endereço do Servidor Backend Django
const DEFAULT_API_URL = "https://suse-apr-curtis-pieces.trycloudflare.com/api";
const API_URL = localStorage.getItem('LUA_CHEIA_API_URL') || DEFAULT_API_URL;

let produtosData = [];
let categoriasData = [];
let carrinho = [];
let categoriaSelecionada = 'todos';

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosDoServidor();
});

// 1. Aceder à API do Django
async function carregarDadosDoServidor() {
    try {
        const [resProd, resCat] = await Promise.all([
            fetch(`${API_URL}/produtos/`),
            fetch(`${API_URL}/categorias/`)
        ]);

        if (!resProd.ok || !resCat.ok) throw new Error("Erro ao carregar dados do servidor");

        produtosData = await resProd.json();
        categoriasData = await resCat.json();

        renderizarCategorias();
        renderizarProdutos();
    } catch (err) {
        console.error("Falha ao ligar com o backend Django:", err);
        document.getElementById('productsGrid').innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                <p>Não foi possível carregar o cardápio. Verifique a ligação com o servidor.</p>
            </div>
        `;
    }
}

// 2. Renderizar Categorias
function renderizarCategorias() {
    const container = document.getElementById('categoriesContainer');

    let html = `
        <button class="cat-btn ${categoriaSelecionada === 'todos' ? 'active' : ''}" data-category="todos" onclick="filtrarCategoria('todos', this)">
            🍽️ Todos
        </button>
    `;

    categoriasData.forEach(c => {
        html += `
            <button class="cat-btn ${categoriaSelecionada == c.id ? 'active' : ''}" data-category="${c.id}" onclick="filtrarCategoria('${c.id}', this)">
                ${c.nome}
            </button>
        `;
    });

    container.innerHTML = html;
}

// 3. Renderizar Produtos na Grelha
function renderizarProdutos(lista = produtosData) {
    const grid = document.getElementById('productsGrid');

    if (lista.length === 0) {
        grid.innerHTML = `
            <div class="loading-state">
                <p>Nenhum prato encontrado nesta categoria.</p>
            </div>
        `;
        return;
    }

    const baseUrlServer = API_URL.replace(/\/api\/?$/, "");

    grid.innerHTML = lista.map(p => {
        const qtdEstoque = p.estoque ?? p.quantidade_estoque ?? 0;
        const semEstoque = qtdEstoque <= 0;
        const poucoEstoque = qtdEstoque > 0 && qtdEstoque <= 3;

        // Trata a imagem (Upload do Django vs URL Externa)
        let imagemSrc = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80';
        if (p.imagem) {
            const caminho = p.imagem.startsWith('/') ? p.imagem : `/${p.imagem}`;
            imagemSrc = p.imagem.startsWith('http') ? p.imagem : `${baseUrlServer}${caminho}`;
        } else if (p.imagem_url) {
            imagemSrc = p.imagem_url;
        }

        return `
            <div class="product-card">
                <div class="card-img-wrapper">
                    <img src="${imagemSrc}" class="card-img" alt="${p.nome}" onerror="this.src='https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'">
                    ${semEstoque ? '<span class="stock-badge out">Esgotado</span>' : ''}
                    ${poucoEstoque ? `<span class="stock-badge warning">Sua última chance (${qtdEstoque})</span>` : ''}
                </div>
                <div class="product-details">
                    <span class="product-cat">${p.categoria_nome || 'Especialidade'}</span>
                    <h3 class="product-title">${p.nome}</h3>
                    <p class="product-desc">${p.descricao || 'Sem descrição disponível.'}</p>
                    <div class="card-bottom">
                        <span class="product-price">R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}</span>
                        <button class="btn-add-cart" ${semEstoque ? 'disabled' : ''} onclick="adicionarAoCarrinho(${p.id})">
                            ${semEstoque ? 'Indisponível' : '<i class="fa-solid fa-plus"></i> Adicionar'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 4. Filtrar por Categoria e Texto
function filtrarCategoria(catId, btn) {
    categoriaSelecionada = catId;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    filtrarProdutos();
}

function filtrarProdutos() {
    const termo = document.getElementById('searchInput').value.toLowerCase();

    const filtrados = produtosData.filter(p => {
        const bateCategoria = categoriaSelecionada === 'todos' || p.categoria == categoriaSelecionada;
        const bateTexto = p.nome.toLowerCase().includes(termo) || (p.descricao && p.descricao.toLowerCase().includes(termo));
        return bateCategoria && bateTexto;
    });

    renderizarProdutos(filtrados);
}

// 5. Gestão do Carrinho
function adicionarAoCarrinho(produtoId) {
    const produto = produtosData.find(p => p.id === produtoId);
    if (!produto) return;

    const itemExistente = carrinho.find(item => item.id === produtoId);
    const qtdEstoque = produto.estoque ?? produto.quantidade_estoque ?? 0;

    if (itemExistente) {
        if (itemExistente.qtd >= qtdEstoque) {
            showToast("Quantidade limite de estoque atingida!", "warning");
            return;
        }
        itemExistente.qtd += 1;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            preco: parseFloat(produto.preco),
            imagem: produto.imagem || produto.imagem_url,
            qtd: 1,
            estoqueMax: qtdEstoque
        });
    }

    atualizarCarrinhoUI();
    showToast(`"${produto.nome}" adicionado ao carrinho!`);
}

function alterarQtd(produtoId, delta) {
    const item = carrinho.find(i => i.id === produtoId);
    if (!item) return;

    item.qtd += delta;

    if (item.qtd > item.estoqueMax) {
        item.qtd = item.estoqueMax;
        showToast("Limite de estoque atingido!", "warning");
    }

    if (item.qtd <= 0) {
        carrinho = carrinho.filter(i => i.id !== produtoId);
    }

    atualizarCarrinhoUI();
}

function atualizarCarrinhoUI() {
    const cartCountEl = document.getElementById('cartCount');
    const cartItemsEl = document.getElementById('cartItems');
    const cartSubtotalEl = document.getElementById('cartSubtotal');
    const cartTotalEl = document.getElementById('cartTotal');

    const totalItens = carrinho.reduce((acc, i) => acc + i.qtd, 0);
    cartCountEl.textContent = totalItens;

    if (carrinho.length === 0) {
        cartItemsEl.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-cart-flatbed-suitcases"></i>
                <p>Seu carrinho está vazio.</p>
                <span>Escolha alguns pratos saborosos do nosso cardápio!</span>
            </div>
        `;
        cartSubtotalEl.textContent = 'R$ 0,00';
        cartTotalEl.textContent = 'R$ 0,00';
        return;
    }

    let totalGeral = 0;
    const baseUrlServer = API_URL.replace(/\/api\/?$/, "");

    cartItemsEl.innerHTML = carrinho.map(item => {
        const subtotal = item.preco * item.qtd;
        totalGeral += subtotal;

        let img = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';
        if (item.imagem) {
            img = item.imagem.startsWith('http') ? item.imagem : `${baseUrlServer}${item.imagem}`;
        }

        return `
            <div class="cart-item">
                <img src="${img}" class="cart-item-img" alt="${item.nome}">
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.nome}</h4>
                    <span class="cart-item-price">R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="alterarQtd(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-val">${item.qtd}</span>
                    <button class="qty-btn" onclick="alterarQtd(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
    }).join('');

    cartSubtotalEl.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
    cartTotalEl.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

// 6. Controles do Drawer
function toggleCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    drawer.classList.toggle('open');
    overlay.style.display = drawer.classList.contains('open') ? 'block' : 'none';
}

document.getElementById('cartToggle').addEventListener('click', toggleCart);

// 7. Envio do Pedido via WhatsApp
document.getElementById('btnCheckout').addEventListener('click', () => {
    if (carrinho.length === 0) {
        showToast("Adicione pelo menos um item ao carrinho!", "warning");
        return;
    }

    let mensagem = "🌕 *NOVO PEDIDO - LUA CHEIA RESTAURANTE*\n\n";
    let total = 0;

    carrinho.forEach((item, index) => {
        const sub = item.preco * item.qtd;
        total += sub;
        mensagem += `${index + 1}. *${item.nome}* (${item.qtd}x) - R$ ${sub.toFixed(2).replace('.', ',')}\n`;
    });

    mensagem += `\n💰 *Total do Pedido:* R$ ${total.toFixed(2).replace('.', ',')}`;
    mensagem += "\n\nObrigado! Aguardo a confirmação.";

    const telefoneRestaurante = "5511999999999"; // Coloque aqui o WhatsApp do restaurante
    const url = `https://wa.me/${telefoneRestaurante}?text=${encodeURIComponent(mensagem)}`;

    window.open(url, '_blank');
});

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
