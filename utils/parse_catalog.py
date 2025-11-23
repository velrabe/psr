#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для парсинга каталога товаров с сайта stone-technology.info
Результат сохраняется в формате JSON, совместимом с catalog.json
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import time
from urllib.parse import urljoin, urlparse
import os
import sys

BASE_URL = "https://www.stone-technology.info"
OUTPUT_FILE = "../catalog.json"

# Заголовки для запросов
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
}

def get_page(url, retries=3, delay=2):
    """Получить HTML страницы с повторными попытками"""
    for attempt in range(retries):
        try:
            print(f"  Попытка {attempt + 1}/{retries} загрузки {url}", flush=True)
            sys.stdout.flush()
            response = requests.get(url, headers=HEADERS, timeout=30)  # Увеличен таймаут до 30 сек
            response.raise_for_status()
            response.encoding = 'utf-8'
            print(f"  ✓ Успешно загружено ({len(response.text)} символов)", flush=True)
            sys.stdout.flush()
            return response.text
        except requests.exceptions.Timeout:
            print(f"  ⏱ Таймаут, ждем {delay} сек...", flush=True)
            sys.stdout.flush()
            if attempt < retries - 1:
                time.sleep(delay)
        except requests.exceptions.RequestException as e:
            print(f"  ⚠ Ошибка: {str(e)[:100]}", flush=True)
            sys.stdout.flush()
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                print(f"  ✗ Не удалось загрузить после {retries} попыток", flush=True)
                sys.stdout.flush()
    return None

def parse_category_links(html):
    """Извлечь ссылки на категории из меню каталога"""
    soup = BeautifulSoup(html, 'html.parser')
    categories = []
    
    # Пробуем найти меню каталога
    catalog_links = []
    
    # Ищем ссылки, содержащие названия категорий
    known_category_names = [
        'Инъекционные составы', 'Антисептики и биоциды', 'Блокираторы солей',
        'Гидроизоляционные составы', 'Дополнительная продукция', 'Камнеукрепители',
        'Краска известковая', 'Очистители', 'Ремонтные составы', 'Гидрофобизаторы'
    ]
    
    all_links = soup.find_all('a', href=True)
    for link in all_links:
        link_text = link.get_text(strip=True)
        if any(cat_name.lower() in link_text.lower() for cat_name in known_category_names):
            href = link.get('href', '')
            if href and ('catalog' in href.lower() or 'category' in href.lower() or 'product' in href.lower()):
                full_url = urljoin(BASE_URL, href)
                if full_url not in [c['url'] for c in catalog_links]:
                    catalog_links.append({
                        'name': link_text,
                        'url': full_url
                    })
    
    # Если нашли ссылки на сайте, используем их
    if catalog_links:
        for link in catalog_links:
            categories.append({
                'name': link['name'],
                'url': link['url'],
                'id': generate_id(link['name']),
                'description': ''
            })
        return categories
    
    # Если не нашли, используем известные категории с транслитерацией URL
    known_categories = [
        {'name': 'Инъекционные составы', 'id': 'injection', 'slug': 'inektsionnye-sostavy', 'description': 'Для укрепления, герметизации и защиты различных строительных объектов'},
        {'name': 'Антисептики и биоциды', 'id': 'antiseptics', 'slug': 'antiseptiki-i-biotsidy', 'description': 'Для предотвращения роста микроорганизмов на строительных материалах, увеличивает долговечность и защищает от плесени и вредителей'},
        {'name': 'Блокираторы солей', 'id': 'salt-blockers', 'slug': 'blokiratory-solei', 'description': 'Предотвращают образование солевых отложений и коррозию в строительных материалах, улучшая их долговечность'},
        {'name': 'Гидроизоляционные составы', 'id': 'waterproofing', 'slug': 'gidroizolyatsionnye-sostavy', 'description': 'Для защиты строительных конструкций от проникновения воды и влаги, обеспечивая долговечность и устойчивость к разрушению'},
        {'name': 'Дополнительная продукция', 'id': 'additional', 'slug': 'dopolnitelnaya-produktsiya', 'description': 'Продукция для обработки поверхностей изделий и строительных конструкций'},
        {'name': 'Камнеукрепители', 'id': 'stone-strengtheners', 'slug': 'kamneukrepiteli', 'description': 'Для повышения прочности и устойчивости каменных и бетонных конструкций, предотвращая их разрушение и деградацию'},
        {'name': 'Краска известковая', 'id': 'lime-paint', 'slug': 'kraska-izvestkovaya', 'description': 'Для отделки и защиты поверхностей, обладающая антисептическими свойствами и способствующая регулированию влажности'},
        {'name': 'Очистители', 'id': 'cleaners', 'slug': 'ochistiteli', 'description': 'Для удаления загрязнений, остатков строительных материалов и других нежелательных веществ с поверхностей, обеспечивая их чистоту и подготовленность к дальнейшей обработке'},
        {'name': 'Ремонтные составы', 'id': 'repair', 'slug': 'remontnye-sostavy', 'description': 'Для восстановления и укрепления поврежденных строительных конструкций'},
        {'name': 'Гидрофобизаторы', 'id': 'hydrophobizers', 'slug': 'gidrofobizatory', 'description': 'Уменьшают водопроницаемость строительных материалов, обеспечивая защиту от влаги и продлевая срок их службы'},
    ]
    
    categories = []
    for cat in known_categories:
        # Используем транслитерацию для URL (как на реальном сайте)
        categories.append({
            'name': cat['name'],
            'url': f"{BASE_URL}/product/{cat['slug']}/",
            'id': cat['id'],
            'description': cat['description']
        })
    
    return categories

def generate_id(text):
    """Генерировать ID из текста"""
    # Транслитерация и преобразование в lowercase с дефисами
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    }
    
    text_lower = text.lower()
    result = ''
    for char in text_lower:
        if char in translit_map:
            result += translit_map[char]
        elif char.isalnum():
            result += char
        elif char in ' -_':
            result += '-'
    
    # Убираем множественные дефисы
    result = re.sub(r'-+', '-', result)
    result = result.strip('-')
    
    return result

def parse_products_from_category(category_url, category_name):
    """Парсить товары из категории"""
    print(f"\n{'='*60}")
    print(f"Парсинг категории: {category_name}")
    print(f"URL: {category_url}")
    html = get_page(category_url, retries=3, delay=2)
    if not html:
        print(f"✗ Не удалось загрузить категорию {category_name}")
        return []
    
    soup = BeautifulSoup(html, 'html.parser')
    products = []
    
    # Ищем карточки товаров (разные возможные селекторы)
    product_cards = []
    
    # Исключаем элементы навигации и служебные элементы
    exclude_texts = ['телефон', 'email', 'адрес', 'режим работы', 'компания', 'каталог', 'проекты', 'статьи', 'контакты', 'размер', 'цвет', 'изображения', 'озвучивание', '8 800', 'бесплатно', 'москва', 'санкт-петербург']
    
    # Ищем по классам с продуктами
    found = soup.find_all('div', class_=re.compile('product.*card|card.*product', re.I))
    for card in found:
        card_text = card.get_text(strip=True).lower()
        if not any(exclude in card_text for exclude in exclude_texts):
            if card not in product_cards:
                product_cards.append(card)
    
    # Ищем article с продуктами
    if not product_cards:
        found = soup.find_all('article', class_=re.compile('product', re.I))
        for card in found:
            card_text = card.get_text(strip=True).lower()
            if not any(exclude in card_text for exclude in exclude_texts):
                if card not in product_cards:
                    product_cards.append(card)
    
    # Ищем div с data-product
    if not product_cards:
        found = soup.find_all('div', {'data-product': True})
        for card in found:
            card_text = card.get_text(strip=True).lower()
            if not any(exclude in card_text for exclude in exclude_texts):
                if card not in product_cards:
                    product_cards.append(card)
    
    # Если не нашли, пробуем найти по структуре списка товаров
    if not product_cards:
        product_list = soup.find('ul', class_=re.compile('products|catalog.*list', re.I))
        if product_list:
            for li in product_list.find_all('li'):
                li_text = li.get_text(strip=True).lower()
                if not any(exclude in li_text for exclude in exclude_texts):
                    product_cards.append(li)
    
    # Если все еще не нашли, ищем любые карточки, но фильтруем по содержимому
    if not product_cards:
        all_cards = soup.find_all(['div', 'article'], class_=re.compile('card|item', re.I))
        for card in all_cards:
            card_text = card.get_text(strip=True).lower()
            # Пропускаем навигацию и служебные элементы
            if any(exclude in card_text for exclude in exclude_texts):
                continue
            # Проверяем наличие названия товара (обычно в h2-h4)
            if card.find(['h2', 'h3', 'h4', 'h5']):
                if card not in product_cards:
                    product_cards.append(card)
    
    for idx, card in enumerate(product_cards[:50]):  # Ограничение на случай большого количества
        try:
            # Название товара
            name_elem = (
                card.find('h2') or card.find('h3') or card.find('h4') or
                card.find(class_=re.compile('title|name|heading', re.I)) or
                card.find('a', class_=re.compile('title|name', re.I))
            )
            if not name_elem:
                continue
            
            product_name = name_elem.get_text(strip=True)
            if not product_name:
                continue
            
            # Ссылка на товар (исключаем tel: и mailto:)
            link_elem = card.find('a', href=True) or name_elem.find('a', href=True)
            product_url = None
            if link_elem:
                href = link_elem.get('href', '')
                # Пропускаем служебные ссылки
                if href and not href.startswith(('tel:', 'mailto:', '#', 'javascript:')):
                    product_url = urljoin(BASE_URL, href)
                    # Проверяем, что это ссылка на товар, а не на раздел
                    if '/product/' in product_url.lower() or '/item/' in product_url.lower() or '/goods/' in product_url.lower():
                        pass  # Это похоже на товар
                    elif any(x in product_url.lower() for x in ['/company/', '/catalog/', '/projects/', '/articles/', '/contacts/']):
                        continue  # Пропускаем разделы сайта
            
            # Изображение
            img_elem = card.find('img')
            product_image = None
            if img_elem:
                img_src = img_elem.get('src') or img_elem.get('data-src') or img_elem.get('data-lazy-src')
                if img_src:
                    product_image = urljoin(BASE_URL, img_src)
            
            # Краткое описание
            desc_elem = (
                card.find('p', class_=re.compile('description|excerpt|text', re.I)) or
                card.find('div', class_=re.compile('description|excerpt|text', re.I))
            )
            product_description = desc_elem.get_text(strip=True) if desc_elem else ""
            
            product_id = f"{generate_id(category_name)}-{generate_id(product_name)}-{idx+1}"
            
            product = {
                'id': product_id,
                'name': product_name,
                'description': product_description,
                'image': product_image or f"https://via.placeholder.com/400x300?text={product_name[:20]}",
                'url': product_url
            }
            
            # Если есть ссылка, парсим детальную страницу
            if product_url:
                detailed_info = parse_product_details(product_url)
                if detailed_info:
                    product.update(detailed_info)
            
            products.append(product)
            print(f"  - Найден товар: {product_name}")
            time.sleep(2)  # Увеличена задержка до 2 сек между товарами
            
        except Exception as e:
            print(f"  Ошибка при парсинге товара: {e}")
            continue
    
    return products

def parse_product_details(product_url):
    """Парсить детальную информацию о товаре"""
    print(f"    Загрузка деталей товара: {product_url}")
    html = get_page(product_url, retries=2, delay=3)
    if not html:
        print(f"    ✗ Не удалось загрузить детали")
        return None
    
    soup = BeautifulSoup(html, 'html.parser')
    details = {}
    
    # Полное описание
    description_elem = (
        soup.find('div', class_=re.compile('description|content|text', re.I)) or
        soup.find('article', class_=re.compile('content|description', re.I)) or
        soup.find('div', {'id': re.compile('content|description', re.I)})
    )
    if description_elem:
        # Убираем скрипты и стили
        for script in description_elem(["script", "style"]):
            script.decompose()
        details['description'] = description_elem.get_text(separator=' ', strip=True)
    
    # Характеристики (спецификации)
    specs = []
    spec_section = (
        soup.find('div', class_=re.compile('spec|characteristic|property', re.I)) or
        soup.find('ul', class_=re.compile('spec|characteristic|property', re.I)) or
        soup.find('table', class_=re.compile('spec|characteristic', re.I))
    )
    
    if spec_section:
        if spec_section.name == 'table':
            rows = spec_section.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    spec_text = f"{cells[0].get_text(strip=True)}: {cells[1].get_text(strip=True)}"
                    specs.append(spec_text)
        else:
            spec_items = spec_section.find_all('li') or spec_section.find_all('div', class_=re.compile('item|row', re.I))
            for item in spec_items:
                spec_text = item.get_text(strip=True)
                if spec_text:
                    specs.append(spec_text)
    
    if specs:
        details['specifications'] = specs
    
    # Область применения
    application_section = soup.find(string=re.compile('применен|использован|назначен', re.I))
    if application_section:
        parent = application_section.find_parent()
        if parent:
            application_text = parent.get_text(strip=True)
            details['application'] = application_text
    
    # Расход
    consumption_section = soup.find(string=re.compile('расход|consumption|норма', re.I))
    if consumption_section:
        parent = consumption_section.find_parent()
        if parent:
            consumption_text = parent.get_text(strip=True)
            details['consumption'] = consumption_text
    
    # Изображение товара
    img_elem = soup.find('img', class_=re.compile('product|main|featured', re.I)) or soup.find('img', {'alt': True})
    if img_elem:
        img_src = img_elem.get('src') or img_elem.get('data-src') or img_elem.get('data-lazy-src')
        if img_src:
            details['image'] = urljoin(BASE_URL, img_src)
    
    return details if details else None

def main():
    """Основная функция"""
    print("Начало парсинга каталога stone-technology.info")
    print("=" * 60)
    
    # Получаем главную страницу
    print("Загрузка главной страницы...")
    main_html = get_page(BASE_URL, retries=3, delay=3)
    if not main_html:
        print("✗ Не удалось загрузить главную страницу")
        print("Продолжаем с известными категориями...")
        main_html = ""  # Продолжаем работу с известными категориями
    
    # Парсим категории
    categories_data = parse_category_links(main_html)
    
    # categories_data уже содержит известные категории из parse_category_links
    
    print(f"\nНайдено категорий: {len(categories_data)}\n")
    
    # Формируем структуру каталога
    catalog = {
        'categories': []
    }
    
    # Парсим товары для каждой категории
    for cat in categories_data:
        print(f"\nОбработка категории: {cat['name']}")
        products = parse_products_from_category(cat['url'], cat['name'])
        
        category_obj = {
            'id': cat['id'],
            'name': cat['name'],
            'description': cat.get('description', ''),
            'products': products
        }
        
        catalog['categories'].append(category_obj)
        print(f"Найдено товаров: {len(products)}")
        time.sleep(3)  # Увеличена задержка до 3 сек между категориями
    
    # Сохраняем результат
    output_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"Парсинг завершен!")
    print(f"Результат сохранен в: {output_path}")
    print(f"Всего категорий: {len(catalog['categories'])}")
    total_products = sum(len(cat['products']) for cat in catalog['categories'])
    print(f"Всего товаров: {total_products}")

if __name__ == "__main__":
    main()

