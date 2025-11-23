#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для обогащения товаров детальной информацией
Скачивает детальные страницы товаров и извлекает полную информацию
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import json
import re
import time
import os
from urllib.parse import urljoin

BASE_URL = "https://www.stone-technology.info"
OUTPUT_FILE = "../catalog.json"

def setup_driver():
    """Настройка Selenium драйвера"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def parse_technical_characteristics(text):
    """Парсить технические характеристики из текста"""
    characteristics = {}
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or ':' not in line:
            continue
        
        # Ищем пары ключ: значение
        parts = line.split(':', 1)
        key = parts[0].strip()
        value = parts[1].strip() if len(parts) > 1 else ''
        if key and value:
            characteristics[key] = value
    
    return characteristics

def parse_product_page(driver, product_url):
    """Парсить детальную страницу товара"""
    try:
        print(f"  Загрузка: {product_url}")
        driver.get(product_url)
        time.sleep(5)  # Увеличено время ожидания для полной загрузки
        
        html = driver.page_source
        soup = BeautifulSoup(html, 'html.parser')
        
        product_data = {
            'description': '',
            'specifications': [],
            'application': '',
            'consumption': '',
            'delivery_form': '',
            'shelf_life': '',
            'safety': '',
            'preparation': '',
            'preparation_method': '',
            'application_method': '',
            'recommendations': '',
            'tu': '',
            'technical_characteristics': {}
        }
        
        # Ищем основной контент товара
        # Обычно это вкладка "Описание" или основной контент страницы
        content_selectors = [
            ('div', {'class': re.compile('tab.*content|description.*content|product.*content', re.I)}),
            ('div', {'id': re.compile('description|content|tab', re.I)}),
            ('div', {'class': re.compile('bx-tab-content', re.I)}),
            ('article', {'class': re.compile('content', re.I)}),
        ]
        
        content_elem = None
        for tag, attrs in content_selectors:
            content_elem = soup.find(tag, attrs)
            if content_elem:
                break
        
        if not content_elem:
            # Пробуем найти любой контент с текстом о товаре
            content_elem = soup.find('body')
        
        if content_elem:
            # Убираем скрипты и стили
            for script in content_elem.find_all(['script', 'style', 'nav', 'header', 'footer']):
                script.decompose()
            
            # Получаем весь текст
            full_text = content_elem.get_text(separator='\n', strip=True)
            
            # Парсим структурированную информацию
            # Ищем разделы по заголовкам
            sections = {}
            current_section = None
            current_text = []
            
            lines = full_text.split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Определяем заголовки разделов
                section_keywords = {
                    'О товаре': 'description',
                    'Применение': 'application',
                    'Форма поставки': 'delivery_form',
                    'Срок годности': 'shelf_life',
                    'Техника безопасности': 'safety',
                    'Подготовка основания': 'preparation',
                    'Способ приготовления': 'preparation_method',
                    'Способ применения': 'application_method',
                    'Расход': 'consumption',
                    'Рекомендации': 'recommendations',
                    'ТУ': 'tu',
                    'Технические характеристики': 'technical_characteristics',
                    'Состав': 'composition',
                    'Внешний вид': 'appearance',
                }
                
                # Проверяем, является ли строка заголовком
                is_header = False
                for keyword, key in section_keywords.items():
                    if line.startswith(keyword) and len(line) < 100:
                        if current_section:
                            sections[current_section] = '\n'.join(current_text).strip()
                        current_section = key
                        current_text = []
                        is_header = True
                        break
                
                if not is_header and current_section:
                    current_text.append(line)
            
            # Сохраняем последний раздел
            if current_section:
                sections[current_section] = '\n'.join(current_text).strip()
            
            # Заполняем product_data
            for key, value in sections.items():
                if value:
                    if key == 'technical_characteristics':
                        # Парсим технические характеристики как структуру
                        product_data['technical_characteristics'] = parse_technical_characteristics(value)
                    else:
                        product_data[key] = value
            
            # Если не нашли структурированные разделы, берем весь текст как описание
            if not product_data.get('description') and full_text:
                product_data['description'] = full_text[:2000]
        
        # Изображение товара
        img_selectors = [
            ('img', {'class': re.compile('product|main|featured', re.I)}),
            ('img', {'id': re.compile('product|main', re.I)}),
        ]
        
        for tag, attrs in img_selectors:
            img_elem = soup.find(tag, attrs)
            if img_elem:
                img_src = img_elem.get('src') or img_elem.get('data-src') or img_elem.get('data-lazy-src')
                if img_src:
                    product_data['image'] = urljoin(BASE_URL, img_src)
                    break
        
        # Если не нашли по селекторам, берем первое большое изображение
        if 'image' not in product_data:
            all_imgs = soup.find_all('img', src=True)
            for img in all_imgs:
                src = img.get('src', '')
                if src and not any(x in src.lower() for x in ['icon', 'logo', 'banner', 'header', 'footer']):
                    if 'product' in src.lower() or len(src) > 50:  # Большие изображения обычно длиннее
                        product_data['image'] = urljoin(BASE_URL, src)
                        break
        
        # Ищем таблицы с техническими характеристиками
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True)
                    value = cells[1].get_text(strip=True)
                    if key and value:
                        if not product_data.get('technical_characteristics'):
                            product_data['technical_characteristics'] = {}
                        product_data['technical_characteristics'][key] = value
        
        # Ищем таблицы с техническими характеристиками
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True)
                    value = cells[1].get_text(strip=True)
                    if key and value:
                        if not product_data.get('technical_characteristics'):
                            product_data['technical_characteristics'] = {}
                        product_data['technical_characteristics'][key] = value
        
        print(f"  ✓ Извлечено: описание={bool(product_data.get('description'))}, изображение={bool(product_data.get('image'))}, характеристики={len(product_data.get('specifications', []))}")
        return product_data
        
    except Exception as e:
        print(f"  ✗ Ошибка: {e}")
        return {}

def enrich_catalog():
    """Обогатить каталог детальной информацией"""
    print("Обогащение каталога детальной информацией о товарах")
    print("=" * 60)
    
    # Загружаем текущий каталог
    catalog_path = os.path.join(os.path.dirname(__file__), OUTPUT_FILE)
    with open(catalog_path, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    
    driver = setup_driver()
    
    try:
        total_products = sum(len(cat['products']) for cat in catalog['categories'])
        processed = 0
        
        for category in catalog['categories']:
            print(f"\nКатегория: {category['name']}")
            for product in category['products']:
                processed += 1
                print(f"  [{processed}/{total_products}] {product['name'][:50]}")
                
                if not product.get('url'):
                    print(f"    ⚠ Нет URL, пропускаем")
                    continue
                
                # Парсим детальную страницу
                product_data = parse_product_page(driver, product['url'])
                
                # Обновляем данные товара
                for key, value in product_data.items():
                    if value:
                        product[key] = value
                
                time.sleep(1)  # Задержка между запросами
        
        # Сохраняем обновленный каталог
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        
        print("\n" + "=" * 60)
        print("✓ Обогащение завершено!")
        print(f"Результат сохранен в: {catalog_path}")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    enrich_catalog()

