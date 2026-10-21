// URL da API Django via Cloudflare Tunnel
const API_URL = "https://career-annually-refine-respondent.trycloudflare.com";

// Estado Local do Carrinho
let cart = [];

// Elementos do DOM
const cartToggle = document.getElementById('cartToggle');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItemsContainer = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');
const btnCheckout = document.getElementById('btnCheckout');

// 1. Abrir e Fechar o Carrinho
function toggleCart() {
    cartDrawer.classList.toggle('open');
    cartOverlay.style.display = cartDrawer.classList.contains('open') ? 'block' : 'none';
}

if (cartToggle) cartToggle.addEventListener('click', toggleCart);
if (closeCart) closeCart.addEventListener('click', toggleCart);
if (cartOverlay) cartOverlay.addEventListener('click', toggleCart);

// 2. Buscar Produtos do Django e Renderizar o Cardápio
async function carregarCardapioDoDjango() {
    try {
        const response = await fetch(`${API_URL}/produtos/`);
        if (!response.ok) throw new Error('Erro ao carregar o cardápio do servidor');

        const produtos = await response.json();
        const gridContainer = document.querySelector('.products-grid');

        // Limpa os cards estáticos de exemplo
        gridContainer.innerHTML = '';

        produtos.forEach(produto => {
            const card = document.createElement('div');
            card.classList.add('product-card');

            // Atribui a categoria para o filtro funcionar dinamicamente
            const categoriaNome = produto.categoria_nome ? produto.categoria_nome.toLowerCase() : 'geral';
            card.setAttribute('data-category', categoriaNome);

            card.innerHTML = `
                <img src="${produto.imagem_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'}" alt="${produto.nome}" class="product-img">
                <div class="product-info">
                    <h3>${produto.nome}</h3>
                    <p>${produto.descricao}</p>
                    <div class="product-footer">
                        <span class="product-price">R$ ${parseFloat(produto.preco).toFixed(2).replace('.', ',')}</span>
                        <button class="btn-add" data-id="${produto.id}">Adicionar</button>
                    </div>
                </div>
            `;
            gridContainer.appendChild(card);
        });

        // Inicializa os filtros e os botões após carregar os elementos dinamicamente
        inicializarFiltrosECompras();

    } catch (error) {
        console.error("Erro de conexão com o back-end Django:", error);
    }
}

// 3. Configurar Filtros e Botões de Compra
function inicializarFiltrosECompras() {
    const categoryButtons = document.querySelectorAll('.category-btn');
    const productCards = document.querySelectorAll('.product-card');

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const selectedCategory = button.getAttribute('data-category');

            productCards.forEach(card => {
                const cardCategories = card.getAttribute('data-category');

                if (selectedCategory === 'todos' || cardCategories.includes(selectedCategory)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Botões Adicionar ao Carrinho
    document.querySelectorAll('.btn-add').forEach(button => {
        button.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            const id = parseInt(button.getAttribute('data-id')); // Captura o ID do banco
            const name = card.querySelector('h3').textContent;
            const priceText = card.querySelector('.product-price').textContent;
            const price = parseFloat(priceText.replace('R$', '').replace(',', '.').trim());

            addToCart(id, name, price);
        });
    });
}

function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }

    updateCartUI();
    toggleCart();
}

// 4. Atualizar a Interface do Carrinho
function updateCartUI() {
    cartItemsContainer.innerHTML = '';

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">O seu carrinho está vazio.</p>';
        cartTotalEl.textContent = 'R$ 0,00';
        cartCountEl.textContent = '0';
        return;
    }

    let total = 0;
    let totalCount = 0;

    cart.forEach((item, index) => {
        total += item.price * item.quantity;
        totalCount += item.quantity;

        const itemEl = document.createElement('div');
        itemEl.classList.add('cart-item');
        itemEl.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name} (${item.quantity}x)</h4>
                <p>R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
            </div>
            <button class="btn-remove" onclick="removeFromCart(${index})">🗑️ Excluir</button>
        `;
        cartItemsContainer.appendChild(itemEl);
    });

    cartTotalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    cartCountEl.textContent = totalCount;
}

// 5. Remover Item do Carrinho
window.removeFromCart = function (index) {
    cart.splice(index, 1);
    updateCartUI();
};

// 6. Enviar Pedido para o WhatsApp com Validação de Estoque
if (btnCheckout) {
    btnCheckout.addEventListener('click', async () => {
        if (cart.length === 0) {
            alert('Adicione pelo menos um item ao carrinho!');
            return;
        }

        // Prepara os dados para enviar ao Django
        const itensParaValidar = cart.map(item => ({
            id: item.id,
            quantidade: item.quantity
        }));

        try {
            // Valida o estoque no back-end antes de fechar o pedido
            const response = await fetch(`${API_URL}/finalizar-pedido/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ itens: itensParaValidar })
            });

            const resultado = await response.json();

            if (!response.ok) {
                // Se o estoque acabou para algum item, avisa o usuário e impede o envio
                alert(resultado.mensagem || 'Desculpe, alguns itens esgotaram.');
                carregarCardapioDoDjango(); // Atualiza o cardápio na tela
                return;
            }

            // Se deu tudo certo com o estoque, monta a mensagem do WhatsApp
            let message = "Olá! Gostaria de fazer o seguinte pedido no *Lua Cheia Restaurante*:\n\n";
            let total = 0;

            cart.forEach(item => {
                const subtotal = item.price * item.quantity;
                total += subtotal;
                message += `${item.quantity}x ${item.name} - R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
            });

            message += `\n*Total:* R$ ${total.toFixed(2).replace('.', ',')}`;

            const phone = "5511999999999";
            const encodedMessage = encodeURIComponent(message);

            // Limpa o carrinho local após o sucesso
            cart = [];
            updateCartUI();
            toggleCart();

            window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');

        } catch (error) {
            console.error("Erro ao validar o pedido:", error);
            alert("Erro de conexão com o servidor. Tente novamente.");
        }
    });
}

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', carregarCardapioDoDjango);