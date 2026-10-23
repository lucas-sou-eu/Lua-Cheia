const DEFAULT_API_URL = "https://roots-tackle-jamie-venues.trycloudflare.com/api";

let savedUrl = localStorage.getItem('LUA_CHEIA_API_URL');
if (!savedUrl || savedUrl.includes('trycloudflare.com')) {
    savedUrl = DEFAULT_API_URL;
    localStorage.setItem('LUA_CHEIA_API_URL', DEFAULT_API_URL);
}

const API_URL = savedUrl;

let produtosData = [];
let categoriasData = [];
let carrinho = JSON.parse(localStorage.getItem('LUA_CHEIA_CARRINHO_CLIENTE')) || [];
let categoriaSelecionada = 'todos';

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosDoServidor();

    // Sincroniza o estoque em background a cada 10 segundos
    setInterval(sincronizarEstoqueSilencioso, 2000);
});

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
        atualizarCarrinhoUI();
    } catch (err) {
        console.error("Falha ao ligar com o backend Django:", err);
        document.getElementById('productsGrid').innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>
                <p>Não foi possível carregar o cardápio.</p>
            </div>
        `;
    }
}

// Sincronização silenciosa segura
async function sincronizarEstoqueSilencioso() {
    try {
        const resProd = await fetch(`${API_URL}/produtos/`);
        if (!resProd.ok) return;

        const novosProdutos = await resProd.json();
        let mensagemAlerta = "";

        novosProdutos.forEach(novoProd => {
            const novoEstoque = novoProd.estoque ?? novoProd.quantidade_estoque ?? 0;
            const itemNoCarrinho = carrinho.find(i => i.id === novoProd.id);

            if (itemNoCarrinho) {
                const estoqueAntigoMax = itemNoCarrinho.estoqueMax;
                itemNoCarrinho.estoqueMax = novoEstoque;

                if (novoEstoque <= 0 && estoqueAntigoMax > 0) {
                    mensagemAlerta = `O item <strong>"${novoProd.nome}"</strong> que está no seu carrinho acabou de <strong>esgotar</strong> no restaurante. Ele continuará listado no carrinho, mas precisará ser removido ou aguardar reabastecimento para finalizar o pedido.`;
                }
                else if (itemNoCarrinho.qtd > novoEstoque && novoEstoque > 0) {
                    itemNoCarrinho.qtd = novoEstoque;
                    mensagemAlerta = `A quantidade do item <strong>"${novoProd.nome}"</strong> foi ajustada para <strong>${novoEstoque} unidade(s)</strong> devido a uma atualização no estoque do restaurante.`;
                }
            }
        });

        produtosData = novosProdutos;
        salvarCarrinhoLocal();
        atualizarBadgesEstoqueNaTela();
        atualizarCarrinhoUI();

        if (mensagemAlerta) {
            abrirModalEstoque(mensagemAlerta);
        }
    } catch (e) {
        console.error("Erro na sincronização de estoque:", e);
    }
}

function abrirModalEstoque(mensagem) {
    const elMensagem = document.getElementById('estoqueModalMensagem');
    const elOverlay = document.getElementById('estoqueModalOverlay');
    const modal = document.getElementById('estoqueModal');

    if (elMensagem) elMensagem.innerHTML = mensagem;
    if (elOverlay) elOverlay.style.display = 'block';
    if (modal) modal.classList.add('open');
}

function fecharModalEstoque() {
    const elMensagem = document.getElementById('estoqueModalMensagem');
    const elOverlay = document.getElementById('estoqueModalOverlay');
    const modal = document.getElementById('estoqueModal');

    if (elOverlay) elOverlay.style.display = 'none';
    if (elMensagem) elMensagem.innerHTML = '';
    if (modal) modal.classList.remove('open');
}

function atualizarBadgesEstoqueNaTela() {
    produtosData.forEach(p => {
        const card = document.querySelector(`[data-produto-id="${p.id}"]`);
        if (card) {
            const qtdEstoque = p.estoque ?? p.quantidade_estoque ?? 0;
            const btnAdd = card.querySelector('.btn-add-cart');

            if (btnAdd) {
                if (qtdEstoque <= 0) {
                    btnAdd.disabled = true;
                    btnAdd.innerHTML = 'Indisponível';
                } else {
                    btnAdd.disabled = false;
                    btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Adicionar';
                }
            }
        }
    });
}

function renderizarCategorias() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

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

function renderizarProdutos(lista = produtosData) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

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

        let imagemSrc = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80';
        if (p.imagem) {
            const caminho = p.imagem.startsWith('/') ? p.imagem : `/${p.imagem}`;
            imagemSrc = p.imagem.startsWith('http') ? p.imagem : `${baseUrlServer}${caminho}`;
        } else if (p.imagem_url) {
            imagemSrc = p.imagem_url;
        }

        return `
            <div class="product-card" data-produto-id="${p.id}" onclick="abrirModalProduto(${p.id})" style="cursor: pointer;">
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
                        <button class="btn-add-cart" ${semEstoque ? 'disabled' : ''} onclick="event.stopPropagation(); adicionarAoCarrinho(${p.id})">
                            ${semEstoque ? 'Indisponível' : '<i class="fa-solid fa-plus"></i> Adicionar'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filtrarCategoria(catId, btn) {
    categoriaSelecionada = catId;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    filtrarProdutos();
}

function filtrarProdutos() {
    const inputSearch = document.getElementById('searchInput');
    const termo = inputSearch ? inputSearch.value.toLowerCase() : '';

    const filtrados = produtosData.filter(p => {
        const bateCategoria = categoriaSelecionada === 'todos' || p.categoria == categoriaSelecionada;
        const bateTexto = p.nome.toLowerCase().includes(termo) || (p.descricao && p.descricao.toLowerCase().includes(termo));
        return bateCategoria && bateTexto;
    });

    renderizarProdutos(filtrados);
}

function salvarCarrinhoLocal() {
    localStorage.setItem('LUA_CHEIA_CARRINHO_CLIENTE', JSON.stringify(carrinho));
}

function adicionarAoCarrinho(produtoId) {
    const produto = produtosData.find(p => p.id === produtoId);
    if (!produto) return;

    const qtdEstoque = produto.estoque ?? produto.quantidade_estoque ?? 0;
    if (qtdEstoque <= 0) {
        showToast("Este produto está esgotado!", "error");
        return;
    }

    const itemExistente = carrinho.find(item => item.id === produtoId);

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

    salvarCarrinhoLocal();
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

    salvarCarrinhoLocal();
    atualizarCarrinhoUI();
}

function removerItemCarrinho(produtoId) {
    carrinho = carrinho.filter(i => i.id !== produtoId);
    salvarCarrinhoLocal();
    atualizarCarrinhoUI();
    showToast("Item removido do carrinho.", "info");
}

function atualizarCarrinhoUI() {
    const cartCountEl = document.getElementById('cartCount');
    const cartItemsEl = document.getElementById('cartItems');
    const cartSubtotalEl = document.getElementById('cartSubtotal');
    const cartTotalEl = document.getElementById('cartTotal');

    if (!cartCountEl || !cartItemsEl) return;

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
        if (cartSubtotalEl) cartSubtotalEl.textContent = 'R$ 0,00';
        if (cartTotalEl) cartTotalEl.textContent = 'R$ 0,00';
        return;
    }

    let totalGeral = 0;
    const baseUrlServer = API_URL.replace(/\/api\/?$/, "");

    cartItemsEl.innerHTML = carrinho.map(item => {
        const subtotal = item.preco * item.qtd;

        const produtoAtual = produtosData.find(p => p.id === item.id);
        const estoqueServidor = produtoAtual ? (produtoAtual.estoque ?? produtoAtual.quantidade_estoque ?? 0) : item.estoqueMax;

        const estaEsgotado = estoqueServidor <= 0;

        if (item.qtd > 0 && !estaEsgotado) {
            totalGeral += subtotal;
        }

        let img = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=100&q=80';
        if (item.imagem) {
            img = item.imagem.startsWith('http') ? item.imagem : `${baseUrlServer}${item.imagem}`;
        }

        return `
            <div class="cart-item" style="${estaEsgotado ? 'border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.05);' : ''}">
                <img src="${img}" class="cart-item-img" alt="${item.nome}">
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.nome}</h4>
                    <span class="cart-item-price">R$ ${subtotal.toFixed(2).replace('.', ',')}</span>
                    ${estaEsgotado ? '<span style="display: block; font-size: 0.65rem; color: #ef4444; font-weight: 700; margin-top: 2px;"><i class="fa-solid fa-triangle-exclamation"></i> ESGOTADO</span>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="alterarQtd(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                        <span class="qty-val">${item.qtd}</span>
                        <button class="qty-btn" ${estaEsgotado ? 'disabled' : ''} onclick="alterarQtd(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <button onclick="removerItemCarrinho(${item.id})" title="Excluir item" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s;">
                        <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (cartSubtotalEl) cartSubtotalEl.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
    if (cartTotalEl) cartTotalEl.textContent = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;
}

function toggleCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    if (!drawer || !overlay) return;

    drawer.classList.toggle('open');
    overlay.style.display = drawer.classList.contains('open') ? 'block' : 'none';
}

const cartToggleBtn = document.getElementById('cartToggle');
if (cartToggleBtn) {
    cartToggleBtn.addEventListener('click', toggleCart);
}

function finalizarPedidoWhatsApp() {
    if (carrinho.length === 0) {
        showToast("Adicione pelo menos um item ao carrinho!", "warning");
        return;
    }

    const itensValidos = carrinho.filter(i => i.qtd > 0 && i.estoqueMax > 0);

    if (itensValidos.length === 0) {
        showToast("Seu carrinho contém apenas itens esgotados. Remova-os ou aguarde o reabastecimento.", "error");
        return;
    }

    let total = 0;
    let mensagem = "🌕 *NOVO PEDIDO - LUA CHEIA RESTAURANTE*\n\n";
    const numeroPedido = Math.floor(1000 + Math.random() * 9000);

    const itensPedido = itensValidos.map((item, index) => {
        const sub = item.preco * item.qtd;
        total += sub;
        mensagem += `${index + 1}. *${item.nome}* (${item.qtd}x) - R$ ${sub.toFixed(2).replace('.', ',')}\n`;

        return {
            produtoId: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.qtd
        };
    });

    mensagem += `\n💰 *Total do Pedido:* R$ ${total.toFixed(2).replace('.', ',')}`;
    mensagem += "\n\nObrigado! Aguardo a confirmação.";

    const novoPedidoPendente = {
        id: String(numeroPedido),
        dataHora: new Date().toLocaleString('pt-BR'),
        total: total,
        itens: itensPedido
    };

    let pedidosPendentes = JSON.parse(localStorage.getItem('LUA_CHEIA_PEDIDOS_PENDENTES')) || [];
    pedidosPendentes.unshift(novoPedidoPendente);
    localStorage.setItem('LUA_CHEIA_PEDIDOS_PENDENTES', JSON.stringify(pedidosPendentes));

    const telefoneRestaurante = "5511999999999";
    const url = `https://wa.me/${telefoneRestaurante}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');

    carrinho = carrinho.filter(i => i.estoqueMax <= 0);
    salvarCarrinhoLocal();
    atualizarCarrinhoUI();
    toggleCart();
    showToast("Pedido enviado para o WhatsApp e registado no painel!", "success");
}

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Modal de Detalhes do Produto
let produtoModalAtual = null;
let qtdModalAtual = 1;

function abrirModalProduto(produtoId) {
    const produto = produtosData.find(p => p.id === produtoId);
    if (!produto) return;

    produtoModalAtual = produto;
    qtdModalAtual = 1;

    const baseUrlServer = API_URL.replace(/\/api\/?$/, "");
    let imagemSrc = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80';

    if (produto.imagem) {
        const caminho = produto.imagem.startsWith('/') ? produto.imagem : `/${produto.imagem}`;
        imagemSrc = produto.imagem.startsWith('http') ? produto.imagem : `${baseUrlServer}${caminho}`;
    } else if (produto.imagem_url) {
        imagemSrc = produto.imagem_url;
    }

    const elImg = document.getElementById('modalProductImg');
    const elCat = document.getElementById('modalProductCat');
    const elTitle = document.getElementById('modalProductTitle');
    const elDesc = document.getElementById('modalProductDesc');
    const elPrice = document.getElementById('modalProductPrice');
    const elQty = document.getElementById('modalQtyVal');
    const overlay = document.getElementById('productModalOverlay');
    const modal = document.getElementById('productModal');

    if (elImg) elImg.src = imagemSrc;
    if (elCat) elCat.textContent = produto.categoria_nome || 'Especialidade';
    if (elTitle) elTitle.textContent = produto.nome;
    if (elDesc) elDesc.textContent = produto.descricao || 'Sem descrição detalhada.';

    const precoUnitario = parseFloat(produto.preco);
    if (elPrice) elPrice.textContent = `R$ ${precoUnitario.toFixed(2).replace('.', ',')}`;
    if (elQty) elQty.textContent = qtdModalAtual;

    atualizarBotaoAddModal();

    if (overlay) overlay.style.display = 'block';
    if (modal) modal.classList.add('open');
}

function fecharModalProduto() {
    const overlay = document.getElementById('productModalOverlay');
    const modal = document.getElementById('productModal');

    if (overlay) overlay.style.display = 'none';
    if (modal) modal.classList.remove('open');
    produtoModalAtual = null;
}

function atualizarBotaoAddModal() {
    if (!produtoModalAtual) return;

    const qtdEstoque = produtoModalAtual.estoque ?? produtoModalAtual.quantidade_estoque ?? 0;
    const semEstoque = qtdEstoque <= 0;
    const btnAdd = document.getElementById('modalBtnAdd');
    if (!btnAdd) return;

    if (semEstoque) {
        btnAdd.disabled = true;
        btnAdd.innerHTML = 'Produto Esgotado';
        return;
    }

    const precoUnitario = parseFloat(produtoModalAtual.preco);
    const precoTotal = precoUnitario * qtdModalAtual;
    const totalFormatado = `R$ ${precoTotal.toFixed(2).replace('.', ',')}`;

    btnAdd.disabled = false;
    btnAdd.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Adicionar • ${totalFormatado}`;
}

function alterarQtdModal(delta) {
    if (!produtoModalAtual) return;
    const qtdEstoque = produtoModalAtual.estoque ?? produtoModalAtual.quantidade_estoque ?? 0;

    const novaQtd = qtdModalAtual + delta;

    if (novaQtd < 1) return;
    if (novaQtd > qtdEstoque) {
        showToast("Limite de estoque atingido!", "warning");
        return;
    }

    qtdModalAtual = novaQtd;
    const elQty = document.getElementById('modalQtyVal');
    if (elQty) elQty.textContent = qtdModalAtual;
    atualizarBotaoAddModal();
}

function adicionarDoModalAoCarrinho() {
    if (!produtoModalAtual) return;

    const produtoId = produtoModalAtual.id;
    const qtdEstoque = produtoModalAtual.estoque ?? produtoModalAtual.quantidade_estoque ?? 0;

    if (qtdEstoque <= 0) {
        showToast("Produto esgotado!", "error");
        return;
    }

    const itemExistente = carrinho.find(item => item.id === produtoId);

    if (itemExistente) {
        if (itemExistente.qtd + qtdModalAtual > qtdEstoque) {
            showToast("Quantidade limite de estoque atingida!", "warning");
            return;
        }
        itemExistente.qtd += qtdModalAtual;
    } else {
        carrinho.push({
            id: produtoModalAtual.id,
            nome: produtoModalAtual.nome,
            preco: parseFloat(produtoModalAtual.preco),
            imagem: produtoModalAtual.imagem || produtoModalAtual.imagem_url,
            qtd: qtdModalAtual,
            estoqueMax: qtdEstoque
        });
    }

    salvarCarrinhoLocal();
    atualizarCarrinhoUI();
    fecharModalProduto();
    showToast(`${qtdModalAtual}x "${produtoModalAtual.nome}" adicionado ao carrinho!`);
}
