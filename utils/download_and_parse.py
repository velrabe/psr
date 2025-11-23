#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для скачивания сайта и последующего парсинга каталога
Сначала скачивает сайт, затем парсит локальные файлы
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os
from urllib.parse import urljoin, urlparse
import sys

BASE_URL = "https://www.stone-technology.info"
DOWNLOAD_DIR = "downloaded_site"
OUTPUT_FILE = "../catalog.json"

# Заголовки для запросов
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
}

def download_page(url, filepath):
    """Скачать страницу и сохранить в файл"""
    try:
        print(f"  Скачивание: {url}")
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        # Создаем директорию если нужно
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        # Сохраняем файл
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        print(f"  ✓ Сохранено: {filepath} ({len(response.text)} символов)")
        return True
    except Exception as e:
        print(f"  ✗ Ошибка: {e}")
        return False

def download_site():
    """Скачать основные страницы сайта"""
    print("=" * 60)
    print("ШАГ 1: Скачивание сайта")
    print("=" * 60)
    
    # Создаем директорию для скачанных файлов
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    
    # Список страниц для скачивания
    pages_to_download = [
        ('', 'index.html'),  # Главная страница
        ('/product/', 'product_index.html'),  # Каталог
    ]
    
    # Категории
    categories = [
        {'id': 'injection', 'name': 'Инъекционные составы', 'url': '/product/inektsionnye-sostavy/'},
        {'id': 'antiseptics', 'name': 'Антисептики и биоциды', 'url': '/product/antiseptiki-i-biotsidy/'},
        {'id': 'salt-blockers', 'name': 'Блокираторы солей', 'url': '/product/blokiratory-soley/'},
        {'id': 'waterproofing', 'name': 'Гидроизоляционные составы', 'url': '/product/gidroizolyatsionnye-sostavy/'},
        {'id': 'additional', 'name': 'Дополнительная продукция', 'url': '/product/dopolnitelnaya-produktsiya/'},
        {'id': 'stone-strengtheners', 'name': 'Камнеукрепители', 'url': '/product/kamneukrepiteli/'},
        {'id': 'lime-paint', 'name': 'Краска известковая', 'url': '/product/kraska-izvestkovaya/'},
        {'id': 'cleaners', 'name': 'Очистители', 'url': '/product/ochistiteli/'},
        {'id': 'repair', 'name': 'Ремонтные составы', 'url': '/product/remontnye-sostavy/'},
        {'id': 'hydrophobizers', 'name': 'Гидрофобизаторы', 'url': '/product/gidrofobizatory/'},
    ]
    
    # Скачиваем главные страницы
    for url_path, filename in pages_to_download:
        url = BASE_URL + url_path
        filepath = os.path.join(DOWNLOAD_DIR, filename)
        download_page(url, filepath)
        time.sleep(1)
    
    # Скачиваем страницы категорий
    print(f"\nСкачивание страниц категорий ({len(categories)} шт)...")
    for cat in categories:
        url = BASE_URL + cat['url']
        filepath = os.path.join(DOWNLOAD_DIR, f"category_{cat['id']}.html")
        if download_page(url, filepath):
            time.sleep(1)
    
    # На главной странице ищем ссылки на товары
    print(f"\nПоиск ссылок на товары...")
    index_path = os.path.join(DOWNLOAD_DIR, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            html = f.read()
        soup = BeautifulSoup(html, 'html.parser')
        
        # Ищем все ссылки на товары
        all_links = soup.find_all('a', href=True)
        product_urls = set()
        
        for link in all_links:
            href = link.get('href', '')
            # Ищем ссылки вида /product/.../.../ (глубокие уровни)
            if '/product/' in href and href.count('/') >= 4:
                full_url = urljoin(BASE_URL, href)
                if full_url.startswith(BASE_URL + '/product/'):
                    # Проверяем, что это не категория
                    if not any(cat['url'] in href for cat in categories):
                        product_urls.add((href, full_url))
        
        print(f"  Найдено потенциальных товаров: {len(product_urls)}")
        
        # Скачиваем первые 50 товаров (чтобы не перегружать)
        downloaded = 0
        for href, full_url in list(product_urls)[:50]:
            # Создаем имя файла из URL
            filename = href.strip('/').replace('/', '_') + '.html'
            if len(filename) > 200:
                filename = filename[:200] + '.html'
            filepath = os.path.join(DOWNLOAD_DIR, 'products', filename)
            
            if download_page(full_url, filepath):
                downloaded += 1
                time.sleep(0.5)  # Небольшая задержка
        
        print(f"  Скачано товаров: {downloaded}")
    
    print("\n✓ Скачивание завершено!")
    return categories

def parse_local_files(categories):
    """Парсить скачанные локальные файлы"""
    print("\n" + "=" * 60)
    print("ШАГ 2: Парсинг локальных файлов")
    print("=" * 60)
    
    catalog = {
        'categories': []
    }
    
    # Парсим каждую категорию
    for cat in categories:
        print(f"\nПарсинг категории: {cat['name']}")
        filepath = os.path.join(DOWNLOAD_DIR, f"category_{cat['id']}.html")
        
        if not os.path.exists(filepath):
            print(f"  ✗ Файл не найден: {filepath}")
            catalog['categories'].append({
                'id': cat['id'],
                'name': cat['name'],
                'description': '',
                'products': []
            })
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            html = f.read()
        
        soup = BeautifulSoup(html, 'html.parser')
        products = []
        
        # Ищем товары на странице категории
        # Ищем все ссылки, которые могут быть товарами
        all_links = soup.find_all('a', href=True)
        product_links = []
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Пропускаем служебные ссылки
            if any(x in href.lower() for x in ['tel:', 'mailto:', '#', 'javascript:']):
                continue
            
            # Пропускаем ссылки на категории
            if any(c['url'] in href for c in categories):
                continue
            
            # Ищем ссылки на товары (глубокие уровни /product/)
            if '/product/' in href and href.count('/') >= 4:
                if text and len(text) > 3 and text not in ['ru', 'en', 'Каталог']:
                    product_links.append({
                        'href': href,
                        'text': text,
                        'url': urljoin(BASE_URL, href)
                    })
        
        # Убираем дубликаты
        seen = set()
        unique_links = []
        for link in product_links:
            if link['href'] not in seen:
                seen.add(link['href'])
                unique_links.append(link)
        
        print(f"  Найдено ссылок на товары: {len(unique_links)}")
        
        # Парсим каждый товар
        for idx, link in enumerate(unique_links[:30]):  # Ограничение
            # Пробуем найти локальный файл товара
            filename = link['href'].strip('/').replace('/', '_') + '.html'
            if len(filename) > 200:
                filename = filename[:200] + '.html'
            product_file = os.path.join(DOWNLOAD_DIR, 'products', filename)
            
            product_data = {
                'id': f"{cat['id']}-{idx+1}",
                'name': link['text'],
                'description': '',
                'image': None,
                'url': link['url']
            }
            
            # Если есть локальный файл, парсим его
            if os.path.exists(product_file):
                with open(product_file, 'r', encoding='utf-8') as f:
                    product_html = f.read()
                product_soup = BeautifulSoup(product_html, 'html.parser')
                
                # Извлекаем описание
                desc_elem = product_soup.find(['div', 'article'], class_=re.compile('content|description|text', re.I))
                if desc_elem:
                    desc_elem.find_all(['script', 'style'], recursive=True)
                    for script in desc_elem.find_all(['script', 'style']):
                        script.decompose()
                    product_data['description'] = desc_elem.get_text(separator=' ', strip=True)[:500]
                
                # Извлекаем изображение
                img_elem = product_soup.find('img', class_=re.compile('product|main|featured', re.I))
                if not img_elem:
                    img_elem = product_soup.find('img', src=True)
                if img_elem:
                    img_src = img_elem.get('src') or img_elem.get('data-src')
                    if img_src:
                        product_data['image'] = urljoin(BASE_URL, img_src)
                
                # Ищем характеристики
                specs = []
                spec_section = product_soup.find(['div', 'ul'], class_=re.compile('spec|characteristic|property', re.I))
                if spec_section:
                    for item in spec_section.find_all(['li', 'div']):
                        spec_text = item.get_text(strip=True)
                        if spec_text and len(spec_text) > 5:
                            specs.append(spec_text)
                if specs:
                    product_data['specifications'] = specs[:10]  # Ограничение
            
            products.append(product_data)
            print(f"  ✓ Товар {idx+1}: {link['text'][:50]}")
        
        catalog['categories'].append({
            'id': cat['id'],
            'name': cat['name'],
            'description': '',
            'products': products
        })
        
        print(f"  Всего товаров в категории: {len(products)}")
    
    # Сохраняем результат
    output_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("Парсинг завершен!")
    print(f"Результат сохранен в: {output_path}")
    total_products = sum(len(cat['products']) for cat in catalog['categories'])
    print(f"Всего категорий: {len(catalog['categories'])}")
    print(f"Всего товаров: {total_products}")

def main():
    """Основная функция"""
    print("Скачивание и парсинг сайта stone-technology.info")
    print("=" * 60)
    
    # Шаг 1: Скачиваем сайт
    categories = download_site()
    
    # Шаг 2: Парсим локальные файлы
    parse_local_files(categories)
    
    print("\n✓ Готово!")

if __name__ == "__main__":
    main()

