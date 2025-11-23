// Global variables
let catalogData = null;
let currentProductId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initHeader();
    loadCatalog();
    initModal();
    initYandexMap();
    initContactCopy();
});

// Header scroll effect
function initHeader() {
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Load catalog from JSON
async function loadCatalog() {
    try {
        // Используем относительный путь - будет работать на GitHub Pages
        const response = await fetch('catalog.json');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.categories || !Array.isArray(data.categories)) {
            throw new Error('Неверный формат данных каталога: отсутствует массив categories');
        }
        
        catalogData = data;
        renderCatalog();
        renderFooterCatalog();
        // Check URL params after catalog is loaded
        handleURLParams();
    } catch (error) {
        console.error('Ошибка загрузки каталога:', error);
        const container = document.getElementById('catalog-container');
        if (container) {
            // Показываем более информативное сообщение об ошибке
            container.innerHTML = `
                <div style="text-align: center; color: #666; padding: 40px;">
                    <p style="font-size: 18px; margin-bottom: 10px;">Ошибка загрузки каталога</p>
                    <p style="font-size: 14px; color: #999;">${error.message}</p>
                    <p style="font-size: 12px; color: #999; margin-top: 20px;">
                        Убедитесь, что файл catalog.json находится в корне проекта.
                        <br>На GitHub Pages это должно работать автоматически.
                    </p>
                </div>
            `;
        }
    }
}

// Render catalog
function renderCatalog() {
    const container = document.getElementById('catalog-container');
    container.innerHTML = '';

    catalogData.categories.forEach(category => {
        const categoryBlock = document.createElement('div');
        categoryBlock.className = 'category-block';
        categoryBlock.id = `category-${category.id}`;

        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.name;

        const productsGrid = document.createElement('div');
        productsGrid.className = 'products-grid';

        category.products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.productId = product.id;
            productCard.dataset.categoryId = category.id;
            productCard.addEventListener('click', () => openProductModal(product.id, category.id));

            productCard.innerHTML = `
                <div class="product-image-placeholder"></div>
                <h4 class="product-title">${product.name}</h4>
                <p class="product-description">${product.description ? product.description.substring(0, 150) + (product.description.length > 150 ? '...' : '') : ''}</p>
            `;

            productsGrid.appendChild(productCard);
        });

        categoryBlock.appendChild(categoryTitle);
        categoryBlock.appendChild(productsGrid);
        container.appendChild(categoryBlock);
    });
}

// Open product modal
function openProductModal(productId, categoryId) {
    const category = catalogData.categories.find(cat => cat.id === categoryId);
    const product = category.products.find(prod => prod.id === productId);

    if (!product) return;

    currentProductId = productId;
    const modal = document.getElementById('product-modal');
    const modalBody = document.getElementById('modal-body');

    // Форматируем описание с заголовками
    const formatDescription = (text) => {
        if (!text) return '';
        // Разбиваем на абзацы по заголовкам
        const lines = text.split('\n').filter(l => l.trim());
        let html = '';
        let inList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Определяем заголовки
            if (line.match(/^(О товаре|Применение|Форма поставки|Срок годности|Техника безопасности|Подготовка основания|Способ приготовления|Способ применения|Расход|Рекомендации|ТУ|Технические характеристики|Состав|Внешний вид):?$/i)) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<h3>${line.replace(':', '')}</h3>`;
            } else if (line.match(/^[-•]\s/) || line.match(/^\d+[\.\)]\s/)) {
                // Список
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                html += `<li>${line.replace(/^[-•]\s/, '').replace(/^\d+[\.\)]\s/, '')}</li>`;
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<p>${line}</p>`;
            }
        }
        if (inList) html += '</ul>';
        return html;
    };
    
    modalBody.innerHTML = `
        <div class="modal-product-image-placeholder"></div>
        <h2 class="modal-product-title">${product.name}</h2>
        <div class="modal-product-content">
            ${product.description ? `<div class="modal-section">${formatDescription(product.description)}</div>` : ''}
            ${product.delivery_form ? `
            <div class="modal-section">
                <h3>Форма поставки</h3>
                <p>${product.delivery_form}</p>
            </div>
            ` : ''}
            ${product.shelf_life ? `
            <div class="modal-section">
                <h3>Срок годности и условия хранения</h3>
                <p>${product.shelf_life}</p>
            </div>
            ` : ''}
            ${product.safety ? `
            <div class="modal-section">
                <h3>Техника безопасности</h3>
                <p>${product.safety}</p>
            </div>
            ` : ''}
            ${product.preparation ? `
            <div class="modal-section">
                <h3>Подготовка основания</h3>
                ${formatDescription(product.preparation)}
            </div>
            ` : ''}
            ${product.preparation_method ? `
            <div class="modal-section">
                <h3>Способ приготовления</h3>
                ${formatDescription(product.preparation_method)}
            </div>
            ` : ''}
            ${product.application_method ? `
            <div class="modal-section">
                <h3>Способ применения</h3>
                ${formatDescription(product.application_method)}
            </div>
            ` : ''}
            ${product.recommendations ? `
            <div class="modal-section">
                <h3>Рекомендации</h3>
                ${formatDescription(product.recommendations)}
            </div>
            ` : ''}
            ${product.tu ? `
            <div class="modal-section">
                <h3>ТУ</h3>
                <p>${product.tu}</p>
            </div>
            ` : ''}
            ${product.technical_characteristics && Object.keys(product.technical_characteristics).length > 0 ? `
            <div class="modal-section">
                <h3>Технические характеристики</h3>
                <table class="technical-table">
                    ${Object.entries(product.technical_characteristics).map(([key, value]) => 
                        `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`
                    ).join('')}
                </table>
            </div>
            ` : ''}
            ${product.specifications && product.specifications.length > 0 ? `
            <div class="modal-section">
                <h3>Характеристики</h3>
                <ul>
                    ${product.specifications.map(spec => `<li>${spec}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Update URL without reload
    const newUrl = `${window.location.pathname}?product=${productId}`;
    window.history.pushState({ product: productId }, '', newUrl);
}

// Close modal
function closeModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    currentProductId = null;

    // Remove product from URL
    window.history.pushState({}, '', window.location.pathname);
}

// Initialize modal
function initModal() {
    const modal = document.getElementById('product-modal');
    const modalClose = document.getElementById('modal-close');
    const modalOverlay = modal.querySelector('.modal-overlay');

    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

// Handle URL parameters
function handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');

    if (productId) {
        // Wait for catalog to load
        if (catalogData) {
            openProductFromURL(productId);
        } else {
            // If catalog not loaded yet, wait for it
            const checkCatalog = setInterval(() => {
                if (catalogData) {
                    clearInterval(checkCatalog);
                    openProductFromURL(productId);
                }
            }, 100);
        }
    }
}

// Open product from URL
function openProductFromURL(productId) {
    for (const category of catalogData.categories) {
        const product = category.products.find(p => p.id === productId);
        if (product) {
            // Scroll to category and open modal
            setTimeout(() => {
                const categoryElement = document.getElementById(`category-${category.id}`);
                if (categoryElement) {
                    categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setTimeout(() => {
                    openProductModal(productId, category.id);
                }, 500);
            }, 500);
            break;
        }
    }
}

// Render footer catalog navigation
function renderFooterCatalog() {
    const footerCatalog = document.getElementById('footer-catalog');
    footerCatalog.innerHTML = '';

    catalogData.categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'footer-category';

        const categoryTitle = document.createElement('h4');
        categoryTitle.className = 'footer-category-title';
        categoryTitle.textContent = category.name;
        categoryTitle.style.cursor = 'pointer';
        categoryTitle.addEventListener('click', () => {
            const categoryElement = document.getElementById(`category-${category.id}`);
            if (categoryElement) {
                categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        const productsDiv = document.createElement('div');
        productsDiv.className = 'footer-products';

        category.products.forEach(product => {
            const productLink = document.createElement('a');
            productLink.className = 'footer-product-link';
            productLink.href = `?product=${product.id}`;
            productLink.textContent = product.name;
            productLink.addEventListener('click', (e) => {
                e.preventDefault();
                const categoryElement = document.getElementById(`category-${category.id}`);
                if (categoryElement) {
                    categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => {
                        openProductModal(product.id, category.id);
                    }, 500);
                }
            });

            productsDiv.appendChild(productLink);
        });

        categoryDiv.appendChild(categoryTitle);
        categoryDiv.appendChild(productsDiv);
        footerCatalog.appendChild(categoryDiv);
    });
}

// Contact copy functionality
function initContactCopy() {
    const contactLinks = document.querySelectorAll('.contact-link[data-copy]');

    contactLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const textToCopy = this.dataset.copy;
            
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showTooltip(this);
                }).catch(err => {
                    console.error('Ошибка копирования:', err);
                    fallbackCopy(textToCopy, this);
                });
            } else {
                fallbackCopy(textToCopy, this);
            }
        });
    });
}

// Fallback copy method
function fallbackCopy(text, element) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        document.execCommand('copy');
        showTooltip(element);
    } catch (err) {
        console.error('Ошибка копирования:', err);
    }
    
    document.body.removeChild(textArea);
}

// Show tooltip
function showTooltip(element) {
    element.classList.add('copied');
    setTimeout(() => {
        element.classList.remove('copied');
    }, 2000);
}

// Initialize Yandex Map
function initYandexMap() {
    // Проверяем наличие элемента карты
    const mapElement = document.getElementById('yandex-map');
    if (!mapElement) return;

    // Проверяем загрузку API с задержкой
    setTimeout(() => {
        if (typeof ymaps !== 'undefined') {
            ymaps.ready(function() {
                try {
                    const map = new ymaps.Map('yandex-map', {
                        center: [59.9414, 30.2808], // Координаты Санкт-Петербурга, Васильевский остров
                        zoom: 15,
                        controls: ['zoomControl', 'fullscreenControl']
                    });

                    // Добавляем метку
                    const placemark = new ymaps.Placemark([59.9414, 30.2808], {
                        balloonContent: 'Санкт-Петербург, вторая линия Васильевского Острова, дом 5 корпус Б'
                    }, {
                        preset: 'islands#blueDotIcon'
                    });

                    map.geoObjects.add(placemark);
                } catch (error) {
                    console.error('Ошибка инициализации карты:', error);
                    mapElement.innerHTML = 
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; padding: 20px; text-align: center;">Ошибка загрузки карты. Проверьте API ключ Яндекс.Карт.</div>';
                }
            });
        } else {
            // Если API не загружен, показываем заглушку
            mapElement.innerHTML = 
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; padding: 20px; text-align: center;">Для отображения карты необходим API ключ Яндекс.Карт. Замените YOUR_API_KEY в index.html на ваш ключ.</div>';
        }
    }, 500);
}

// Smooth scroll for anchor links
document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
        e.preventDefault();
        const targetId = anchor.getAttribute('href').substring(1);
        const target = document.getElementById(targetId);
        if (target) {
            const headerHeight = document.getElementById('header').offsetHeight;
            const targetPosition = target.offsetTop - headerHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }
});

