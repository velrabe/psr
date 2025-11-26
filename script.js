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
    initHeroGrid();
    initContactDropdown();
    initDocuments();
    initContactForm();
    initScrollToTop();
    initHeaderCatalog();
    initImportListModal();
});

// Hero grid animation
function initHeroGrid() {
    const hero = document.getElementById('hero');
    if (!hero) return;
    
    function createGridLine(isHorizontal, isTrain = false) {
        const line = document.createElement('div');
        line.className = `hero-grid-line ${isHorizontal ? 'horizontal' : 'vertical'} ${isTrain ? 'train-line' : ''}`;
        
        if (isHorizontal) {
            // Выравниваем по сетке (50px шаг)
            const gridPosition = Math.floor(Math.random() * Math.floor(window.innerHeight / 50)) * 50;
            line.style.top = `${gridPosition}px`;
            line.style.left = '-128px'; // Начинаем за левым краем
            line.style.animationDelay = `${Math.random() * 2}s`;
            line.style.animationDuration = isTrain ? `${1.5 + Math.random() * 1}s` : `${2 + Math.random() * 2}s`;
        } else {
            // Выравниваем по сетке (50px шаг)
            const gridPosition = Math.floor(Math.random() * Math.floor(window.innerWidth / 50)) * 50;
            line.style.left = `${gridPosition}px`;
            line.style.top = '-128px'; // Начинаем за верхним краем
            line.style.animationDelay = `${Math.random() * 2}s`;
            line.style.animationDuration = isTrain ? `${1.5 + Math.random() * 1}s` : `${2 + Math.random() * 2}s`;
        }
        
        hero.appendChild(line);
        
        // Удаляем линию после анимации
        const duration = isTrain ? 2500 : 5000;
        setTimeout(() => {
            if (line.parentNode) {
                line.parentNode.removeChild(line);
            }
        }, duration);
    }
    
    // Создаем обычные линии периодически
    function spawnLine() {
        const isHorizontal = Math.random() > 0.5;
        createGridLine(isHorizontal, false);
        
        // Следующая линия через случайный интервал
        setTimeout(spawnLine, 1000 + Math.random() * 2000);
    }
    
    // Создаем "поезда" (плотные линии) периодически
    function spawnTrain() {
        const isHorizontal = Math.random() > 0.5;
        createGridLine(isHorizontal, true);
        
        // Следующий "поезд" через случайный интервал
        setTimeout(spawnTrain, 2000 + Math.random() * 3000);
    }
    
    // Начинаем создавать линии сразу
    spawnLine();
    spawnTrain();
}

// Header scroll effect
function initHeader() {
    const header = document.getElementById('header');
    const burger = document.getElementById('header-burger');
    const headerNav = document.getElementById('header-nav');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    if (burger && headerNav) {
        burger.addEventListener('click', () => {
            const isOpen = headerNav.classList.toggle('open');
            burger.classList.toggle('active', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Закрываем меню при клике по ссылкам
        headerNav.addEventListener('click', (e) => {
            if (e.target.closest('a')) {
                headerNav.classList.remove('open');
                burger.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
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
        try {
            renderCatalog();
        } catch (error) {
            console.error('Ошибка при рендеринге каталога:', error);
        }
        try {
            renderFooterCatalog();
        } catch (error) {
            console.error('Ошибка при рендеринге каталога в футере:', error);
        }
        // Render header catalog menu after a short delay to ensure DOM is ready
        setTimeout(() => {
            try {
                renderHeaderCatalog();
            } catch (error) {
                console.error('Ошибка при рендеринге меню каталога в хедере:', error);
            }
        }, 100);
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
    if (!container || !catalogData || !catalogData.categories) {
        console.error('Ошибка: контейнер каталога не найден или данные не загружены');
        return;
    }
    
    container.innerHTML = '';

    catalogData.categories.forEach(category => {
        // Сначала фильтруем товары - оставляем только те, у которых артикул < 1000
        const visibleProducts = category.products.filter(product => {
            const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
            const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
            const articleNumber = parseInt(article, 10);
            return articleNumber < 1000;
        });
        
        // Если в категории нет видимых товаров - пропускаем категорию
        if (visibleProducts.length === 0) {
            return;
        }
        
        const categoryBlock = document.createElement('div');
        categoryBlock.className = 'category-block';
        categoryBlock.id = `category-${category.id}`;

        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'category-title';
        categoryTitle.textContent = category.name;

        const productsGrid = document.createElement('div');
        productsGrid.className = 'products-grid';

        visibleProducts.forEach(product => {
            // Извлекаем артикул из названия (последние цифры)
            const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
            const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
            
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.productId = product.id;
            productCard.dataset.categoryId = category.id;
            productCard.addEventListener('click', () => openProductModal(product.id, category.id));
            
            // Формируем теги
            const tagsHtml = product.tags && product.tags.length > 0 
                ? `<div class="product-tags">${product.tags.map(tag => `<span class="product-tag">${tag}</span>`).join('')}</div>`
                : '';
            
            productCard.innerHTML = `
                <div class="product-image-placeholder">
                    <span class="product-article">${article}</span>
                </div>
                <h4 class="product-title">${product.name}</h4>
                <p class="product-description">${product.description ? product.description.substring(0, 150) + (product.description.length > 150 ? '...' : '') : ''}</p>
                ${tagsHtml}
                <span class="product-more-link">Подробнее <span class="arrow">→</span></span>
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
    
    // Проверяем артикул - не показываем товары с артикулом 1000+
    const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
    const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
    const articleNumber = parseInt(article, 10);
    if (articleNumber >= 1000) {
        return;
    }

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
    
    // Формируем теги для модалки
    const tagsHtml = product.tags && product.tags.length > 0 
        ? `<div class="modal-product-tags">${product.tags.map(tag => `<span class="product-tag">${tag}</span>`).join('')}</div>`
        : '';
    
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${article}`;
    
    modalBody.innerHTML = `
        <div class="modal-product-header">
            <div class="modal-header">
                <div class="modal-header-top">
                    <h2 class="modal-product-title">${product.name}</h2>
                    <button type="button" class="modal-close-inline" aria-label="Закрыть">&times;</button>
                </div>
                <div class="modal-header-bottom">
                    ${tagsHtml}
                    <div class="modal-product-actions">
                        <button type="button" class="modal-copy-link" data-url="${productUrl}" title="Скопировать ссылку на товар">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span class="modal-copy-tooltip">Ссылка на товар скопирована</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
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
    
    // Инициализируем копирование ссылки
    const copyBtn = modalBody.querySelector('.modal-copy-link');
    if (copyBtn) {
        const urlToCopy = copyBtn.dataset.url;
        
        const showCopyTooltip = () => {
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.classList.remove('copied');
            }, 2000);
        };
        
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(urlToCopy).then(showCopyTooltip).catch(err => {
                    console.error('Ошибка копирования ссылки на товар:', err);
                });
            } else {
                // Fallback
                const temp = document.createElement('textarea');
                temp.value = urlToCopy;
                temp.style.position = 'fixed';
                temp.style.opacity = '0';
                document.body.appendChild(temp);
                temp.select();
                try {
                    document.execCommand('copy');
                    showCopyTooltip();
                } catch (err) {
                    console.error('Ошибка копирования ссылки на товар:', err);
                }
                document.body.removeChild(temp);
            }
        });
    }

    // Update URL без перезагрузки — используем артикул как идентификатор
    const newUrl = `${window.location.pathname}?product=${article}`;
    window.history.pushState({ product: article }, '', newUrl);
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

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    modalOverlay.addEventListener('click', closeModal);

    // Делегируем клик по встроенной кнопке закрытия в шапке модалки
    modal.addEventListener('click', (e) => {
        if (e.target.closest('.modal-close-inline')) {
            closeModal();
        }
    });

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

// Open product from URL (по артикулу)
function openProductFromURL(articleParam) {
    if (!catalogData || !articleParam) return;
    const target = articleParam.toString().trim();

    for (const category of catalogData.categories) {
        for (const product of category.products) {
            const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
            const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
            const articleNumber = parseInt(article, 10);
            if (articleNumber >= 1000) {
                continue; // не показываем скрытые товары
            }
            if (article === target) {
                // Scroll to category and open modal
                setTimeout(() => {
                    const categoryElement = document.getElementById(`category-${category.id}`);
                    if (categoryElement) {
                        categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    setTimeout(() => {
                        openProductModal(product.id, category.id);
                    }, 500);
                }, 500);
                return;
            }
        }
    }
}

// Render footer catalog navigation
function renderFooterCatalog() {
    const footerCatalog = document.getElementById('footer-catalog');
    footerCatalog.innerHTML = '';

    catalogData.categories.forEach(category => {
        // Фильтруем товары с артикулом 1000+
        const visibleProducts = category.products.filter(product => {
            const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
            const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
            const articleNumber = parseInt(article, 10);
            return articleNumber < 1000;
        });

        // Если в категории нет видимых товаров - пропускаем категорию
        if (visibleProducts.length === 0) {
            return;
        }
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'footer-category';

        const categoryTitle = document.createElement('h4');
        categoryTitle.className = 'footer-category-title';
        categoryTitle.innerHTML = `
            <span class="footer-category-name">${category.name}</span>
            <span class="footer-category-toggle">▼</span>
        `;
        categoryTitle.style.cursor = 'pointer';

        const productsDiv = document.createElement('div');
        productsDiv.className = 'footer-products';
        productsDiv.style.display = 'none'; // По умолчанию свернуто

        visibleProducts.forEach(product => {
            const productLink = document.createElement('a');
            productLink.className = 'footer-product-link';
            productLink.href = `?product=${article}`;
            productLink.textContent = product.name;
            productLink.addEventListener('click', (e) => {
                e.preventDefault();
                openProductFromURL(article);
            });

            productsDiv.appendChild(productLink);
        });

        // Обработчик клика для разворачивания/сворачивания
        categoryTitle.addEventListener('click', (e) => {
            e.preventDefault();
            const isExpanded = productsDiv.style.display !== 'none';
            productsDiv.style.display = isExpanded ? 'none' : 'flex';
            const toggle = categoryTitle.querySelector('.footer-category-toggle');
            toggle.textContent = isExpanded ? '▼' : '▲';
            categoryDiv.classList.toggle('expanded', !isExpanded);
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
                        balloonContent: 'Санкт-Петербург, вторая линия Васильевского Острова, дом 5'
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

// Contact Dropdown
function initContactDropdown() {
    const contactBtn = document.getElementById('about-contact-btn');
    const dropdown = document.getElementById('contact-dropdown');
    const closeBtn = document.getElementById('contact-dropdown-close');
    
    if (!contactBtn || !dropdown) return;
    
    contactBtn.addEventListener('click', function() {
        dropdown.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            dropdown.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Закрытие при клике на overlay
    const overlay = dropdown.querySelector('.contact-dropdown-overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                dropdown.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
    
    // Закрытие при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
    
    // Обработчики кнопок копирования
    const copyButtons = dropdown.querySelectorAll('.contact-copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const textToCopy = this.dataset.copy;
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showCopyFeedback(this);
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

// Показать обратную связь при копировании
function showCopyFeedback(button) {
    button.classList.add('copied');
    const originalTitle = button.getAttribute('title');
    button.setAttribute('title', 'Скопировано!');
    
    setTimeout(() => {
        button.classList.remove('copied');
        button.setAttribute('title', originalTitle);
    }, 2000);
}

// Documents Modal
function initDocuments() {
    const documentItems = document.querySelectorAll('.document-item');
    const documentModal = document.getElementById('document-modal');
    const documentModalImage = document.getElementById('document-modal-image');
    const documentModalClose = document.getElementById('document-modal-close');
    
    if (!documentModal || !documentModalImage) return;
    
    documentItems.forEach(item => {
        item.addEventListener('click', function() {
            const thumbnail = this.querySelector('.document-thumbnail');
            if (thumbnail) {
                documentModalImage.src = thumbnail.src;
                documentModalImage.alt = thumbnail.alt;
                documentModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    });
    
    if (documentModalClose) {
        documentModalClose.addEventListener('click', function() {
            documentModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Закрытие при клике на overlay
    const overlay = documentModal.querySelector('.document-modal-overlay');
    if (overlay) {
        overlay.addEventListener('click', function() {
            documentModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Закрытие при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && documentModal.classList.contains('active')) {
            documentModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// Contact Form
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (!contactForm) return;
    
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(contactForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            message: formData.get('message')
        };
        
        // Здесь можно добавить отправку данных на сервер
        console.log('Форма отправлена:', data);
        
        // Показываем сообщение об успехе
        alert('Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.');
        
        // Очищаем форму
        contactForm.reset();
    });
}

// Scroll to Top Button
function initScrollToTop() {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;
    
    // Показываем/скрываем кнопку при прокрутке
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });
    
    // Прокрутка наверх при клике
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Header Catalog Dropdown
function initHeaderCatalog() {
    const dropdown = document.getElementById('header-catalog-dropdown');
    const btn = document.getElementById('header-catalog-btn');
    const menu = document.getElementById('header-catalog-menu');
    
    if (!dropdown || !btn || !menu) return;
    
    // Открытие/закрытие меню
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });
    
    // Закрытие при клике вне меню
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
    
    // Закрытие при нажатии Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    });
}

// Render header catalog menu
function renderHeaderCatalog() {
    try {
        const menu = document.getElementById('header-catalog-menu');
        if (!menu || !catalogData || !catalogData.categories) {
            return;
        }
        
        menu.innerHTML = '';
        
        catalogData.categories.forEach(category => {
            // Фильтруем товары - оставляем только те, у которых артикул < 1000
            const visibleProducts = category.products.filter(product => {
                const articleMatch = product.name.match(/(\d+)(?:\s|$)/);
                const article = articleMatch ? articleMatch[1] : product.id.split('-').pop();
                const articleNumber = parseInt(article, 10);
                return articleNumber < 1000;
            });
            
            // Если в категории нет видимых товаров - пропускаем категорию
            if (visibleProducts.length === 0) {
                return;
            }
            
            const categoryLink = document.createElement('a');
            categoryLink.className = 'header-catalog-item';
            categoryLink.textContent = category.name;
            categoryLink.href = `#category-${category.id}`;
            
            categoryLink.addEventListener('click', function(e) {
                e.preventDefault();
                const categoryElement = document.getElementById(`category-${category.id}`);
                if (categoryElement) {
                    const headerHeight = document.getElementById('header').offsetHeight;
                    const targetPosition = categoryElement.offsetTop - headerHeight;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    // Закрываем меню после клика
                    const dropdown = document.getElementById('header-catalog-dropdown');
                    if (dropdown) {
                        dropdown.classList.remove('active');
                    }
                }
            });
            
            menu.appendChild(categoryLink);
        });
    } catch (error) {
        console.error('Ошибка при рендеринге меню каталога в хедере:', error);
    }
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



// Import List Modal
function initImportListModal() {
    const link = document.getElementById('import-list-link');
    const modal = document.getElementById('import-modal');
    if (!link || !modal) return;

    const closeBtn = document.getElementById('import-modal-close');
    const overlay = modal.querySelector('.document-modal-overlay');
    const iframe = modal.querySelector('iframe');
    const pdfSrc = iframe ? iframe.getAttribute('src') : null;

    const open = (e) => {
        if (e) e.preventDefault();

        // На мобилках открываем PDF в новой вкладке, без модалки
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && pdfSrc) {
            window.open(pdfSrc, '_blank');
            return;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const close = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    };

    link.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            close();
        }
    });
}
