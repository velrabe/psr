#!/usr/bin/env node
/**
 * Скрипт для парсинга каталога товаров с сайта stone-technology.info
 * Результат сохраняется в формате JSON, совместимом с catalog.json
 * 
 * Использование: node parse_catalog.js
 * Требуется: npm install cheerio axios
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BASE_URL = "https://www.stone-technology.info";
const OUTPUT_FILE = path.join(__dirname, "../catalog.json");

// Заголовки для запросов
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
};

/**
 * Получить HTML страницы
 */
async function getPage(url) {
    try {
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`Ошибка при загрузке ${url}:`, error.message);
        return null;
    }
}

/**
 * Генерировать ID из текста
 */
function generateId(text) {
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    let result = '';
    for (const char of text.toLowerCase()) {
        if (translitMap[char]) {
            result += translitMap[char];
        } else if (/[a-z0-9]/.test(char)) {
            result += char;
        } else if (/[\s\-_]/.test(char)) {
            result += '-';
        }
    }
    
    result = result.replace(/-+/g, '-').replace(/^-|-$/g, '');
    return result;
}

/**
 * Извлечь ссылки на категории
 */
function parseCategoryLinks(html) {
    const $ = cheerio.load(html);
    const categories = [];
    
    // Ищем меню каталога
    let catalogMenu = $('nav ul, ul.menu, ul.catalog, ul.nav').first();
    
    if (catalogMenu.length === 0) {
        // Ищем по тексту "Каталог"
        const catalogText = $('*:contains("Каталог")').first();
        if (catalogText.length) {
            catalogMenu = catalogText.next('ul').first();
        }
    }
    
    if (catalogMenu.length) {
        catalogMenu.find('a[href]').each((i, elem) => {
            const $link = $(elem);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            if (text && !['Каталог', 'Все товары'].includes(text)) {
                const fullUrl = new URL(href, BASE_URL).href;
                categories.push({
                    name: text,
                    url: fullUrl,
                    id: generateId(text)
                });
            }
        });
    }
    
    // Если не нашли, используем известные категории
    if (categories.length === 0) {
        const knownCategories = [
            { name: 'Инъекционные составы', id: 'injection' },
            { name: 'Антисептики и биоциды', id: 'antiseptics' },
            { name: 'Блокираторы солей', id: 'salt-blockers' },
            { name: 'Гидроизоляционные составы', id: 'waterproofing' },
            { name: 'Дополнительная продукция', id: 'additional' },
            { name: 'Камнеукрепители', id: 'stone-strengtheners' },
            { name: 'Краска известковая', id: 'lime-paint' },
            { name: 'Очистители', id: 'cleaners' },
            { name: 'Ремонтные составы', id: 'repair' },
            { name: 'Гидрофобизаторы', id: 'hydrophobizers' },
        ];
        
        knownCategories.forEach(cat => {
            categories.push({
                name: cat.name,
                url: `${BASE_URL}/catalog/${cat.id}/`,
                id: cat.id
            });
        });
    }
    
    return categories;
}

/**
 * Парсить товары из категории
 */
async function parseProductsFromCategory(categoryUrl, categoryName) {
    console.log(`Парсинг категории: ${categoryName}`);
    const html = await getPage(categoryUrl);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const products = [];
    
    // Ищем карточки товаров
    let productCards = $('.product, .card, .item, [data-product], article.product, article.card');
    
    if (productCards.length === 0) {
        productCards = $('ul.products li, ul.items li, ul.list li');
    }
    
    const cards = productCards.slice(0, 50); // Ограничение
    
    for (let idx = 0; idx < cards.length; idx++) {
        const card = $(cards[idx]);
        
        try {
            // Название товара
            const nameElem = card.find('h2, h3, h4, .title, .name, .heading').first();
            if (nameElem.length === 0) continue;
            
            const productName = nameElem.text().trim();
            if (!productName) continue;
            
            // Ссылка на товар
            const linkElem = card.find('a[href]').first() || nameElem.find('a[href]').first();
            const productUrl = linkElem.length ? new URL(linkElem.attr('href'), BASE_URL).href : null;
            
            // Изображение
            const imgElem = card.find('img').first();
            let productImage = null;
            if (imgElem.length) {
                const imgSrc = imgElem.attr('src') || imgElem.attr('data-src') || imgElem.attr('data-lazy-src');
                if (imgSrc) {
                    productImage = new URL(imgSrc, BASE_URL).href;
                }
            }
            
            // Краткое описание
            const descElem = card.find('.description, .excerpt, .text, p').first();
            const productDescription = descElem.length ? descElem.text().trim() : "";
            
            const productId = `${generateId(categoryName)}-${generateId(productName)}-${idx + 1}`;
            
            const product = {
                id: productId,
                name: productName,
                description: productDescription,
                image: productImage || `https://via.placeholder.com/400x300?text=${encodeURIComponent(productName.substring(0, 20))}`,
                url: productUrl
            };
            
            // Парсим детальную страницу
            if (productUrl) {
                const detailedInfo = await parseProductDetails(productUrl);
                if (detailedInfo) {
                    Object.assign(product, detailedInfo);
                }
            }
            
            products.push(product);
            console.log(`  - Найден товар: ${productName}`);
            
            // Задержка между запросами
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`  Ошибка при парсинге товара:`, error.message);
            continue;
        }
    }
    
    return products;
}

/**
 * Парсить детальную информацию о товаре
 */
async function parseProductDetails(productUrl) {
    const html = await getPage(productUrl);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    const details = {};
    
    // Полное описание
    const descriptionElem = $('.description, .content, .text, #content, #description, article').first();
    if (descriptionElem.length) {
        descriptionElem.find('script, style').remove();
        details.description = descriptionElem.text().replace(/\s+/g, ' ').trim();
    }
    
    // Характеристики
    const specs = [];
    let specSection = $('.spec, .characteristic, .property').first();
    
    if (specSection.length === 0) {
        specSection = $('table.spec, table.characteristic').first();
    }
    
    if (specSection.length) {
        if (specSection.is('table')) {
            specSection.find('tr').each((i, row) => {
                const cells = $(row).find('td, th');
                if (cells.length >= 2) {
                    const specText = `${cells.eq(0).text().trim()}: ${cells.eq(1).text().trim()}`;
                    specs.push(specText);
                }
            });
        } else {
            specSection.find('li, .item, .row').each((i, item) => {
                const specText = $(item).text().trim();
                if (specText) specs.push(specText);
            });
        }
    }
    
    if (specs.length) {
        details.specifications = specs;
    }
    
    // Область применения
    const applicationText = $('*:contains("применен"), *:contains("использован"), *:contains("назначен")').first();
    if (applicationText.length) {
        details.application = applicationText.text().trim();
    }
    
    // Расход
    const consumptionText = $('*:contains("расход"), *:contains("consumption"), *:contains("норма")').first();
    if (consumptionText.length) {
        details.consumption = consumptionText.text().trim();
    }
    
    // Изображение товара
    const imgElem = $('img.product, img.main, img.featured, img[alt]').first();
    if (imgElem.length) {
        const imgSrc = imgElem.attr('src') || imgElem.attr('data-src') || imgElem.attr('data-lazy-src');
        if (imgSrc) {
            details.image = new URL(imgSrc, BASE_URL).href;
        }
    }
    
    return Object.keys(details).length > 0 ? details : null;
}

/**
 * Основная функция
 */
async function main() {
    console.log("Начало парсинга каталога stone-technology.info");
    console.log("=".repeat(60));
    
    // Получаем главную страницу
    const mainHtml = await getPage(BASE_URL);
    if (!mainHtml) {
        console.error("Не удалось загрузить главную страницу");
        return;
    }
    
    // Парсим категории
    let categoriesData = parseCategoryLinks(mainHtml);
    
    if (categoriesData.length === 0) {
        console.log("Категории не найдены, используем известные категории");
        categoriesData = [
            { name: 'Инъекционные составы', url: `${BASE_URL}/catalog/injection/`, id: 'injection' },
            { name: 'Антисептики и биоциды', url: `${BASE_URL}/catalog/antiseptics/`, id: 'antiseptics' },
            { name: 'Блокираторы солей', url: `${BASE_URL}/catalog/salt-blockers/`, id: 'salt-blockers' },
            { name: 'Гидроизоляционные составы', url: `${BASE_URL}/catalog/waterproofing/`, id: 'waterproofing' },
            { name: 'Дополнительная продукция', url: `${BASE_URL}/catalog/additional/`, id: 'additional' },
            { name: 'Камнеукрепители', url: `${BASE_URL}/catalog/stone-strengtheners/`, id: 'stone-strengtheners' },
            { name: 'Краска известковая', url: `${BASE_URL}/catalog/lime-paint/`, id: 'lime-paint' },
            { name: 'Очистители', url: `${BASE_URL}/catalog/cleaners/`, id: 'cleaners' },
            { name: 'Ремонтные составы', url: `${BASE_URL}/catalog/repair/`, id: 'repair' },
            { name: 'Гидрофобизаторы', url: `${BASE_URL}/catalog/hydrophobizers/`, id: 'hydrophobizers' },
        ];
    }
    
    console.log(`\nНайдено категорий: ${categoriesData.length}\n`);
    
    // Формируем структуру каталога
    const catalog = {
        categories: []
    };
    
    // Парсим товары для каждой категории
    for (const cat of categoriesData) {
        console.log(`\nОбработка категории: ${cat.name}`);
        const products = await parseProductsFromCategory(cat.url, cat.name);
        
        catalog.categories.push({
            id: cat.id,
            name: cat.name,
            description: '',
            products: products
        });
        
        console.log(`Найдено товаров: ${products.length}`);
        
        // Задержка между категориями
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Сохраняем результат
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2), 'utf8');
    
    console.log("\n" + "=".repeat(60));
    console.log("Парсинг завершен!");
    console.log(`Результат сохранен в: ${OUTPUT_FILE}`);
    console.log(`Всего категорий: ${catalog.categories.length}`);
    const totalProducts = catalog.categories.reduce((sum, cat) => sum + cat.products.length, 0);
    console.log(`Всего товаров: ${totalProducts}`);
}

// Запуск
if (require.main === module) {
    main().catch(error => {
        console.error("Критическая ошибка:", error);
        process.exit(1);
    });
}

module.exports = { main, parseCategoryLinks, parseProductsFromCategory, parseProductDetails };

