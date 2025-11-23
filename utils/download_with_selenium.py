#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для скачивания сайта с рендерингом JavaScript через Selenium
Затем парсит локальные файлы
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
from urllib.parse import urljoin, urlparse

BASE_URL = "https://www.stone-technology.info"
DOWNLOAD_DIR = "downloaded_site_selenium"
OUTPUT_FILE = "../catalog.json"

def setup_driver():
    """Настройка Selenium драйвера"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Без GUI
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def download_page_with_selenium(driver, url, filepath, wait_time=5):
    """Скачать страницу с рендерингом JavaScript"""
    try:
        print(f"  Загрузка: {url}")
        driver.get(url)
        
        # Ждем загрузки контента
        time.sleep(wait_time)
        
        # Ждем появления контента (пробуем найти любой контент)
        try:
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
        except:
            pass
        
        # Дополнительное ожидание для JavaScript
        time.sleep(2)
        
        # Получаем HTML после рендеринга JavaScript
        html = driver.page_source
        
        # Сохраняем файл
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"  ✓ Сохранено: {filepath} ({len(html)} символов)")
        return True
    except Exception as e:
        print(f"  ✗ Ошибка: {e}")
        return False

def download_site():
    """Скачать сайт с рендерингом JavaScript"""
    print("=" * 60)
    print("ШАГ 1: Скачивание сайта с рендерингом JavaScript")
    print("=" * 60)
    
    driver = setup_driver()
    
    try:
        os.makedirs(DOWNLOAD_DIR, exist_ok=True)
        
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
        
        # Скачиваем главную страницу
        download_page_with_selenium(driver, BASE_URL, os.path.join(DOWNLOAD_DIR, 'index.html'), wait_time=3)
        
        # Скачиваем страницы категорий
        print(f"\nСкачивание страниц категорий ({len(categories)} шт)...")
        for cat in categories:
            url = BASE_URL + cat['url']
            filepath = os.path.join(DOWNLOAD_DIR, f"category_{cat['id']}.html")
            download_page_with_selenium(driver, url, filepath, wait_time=5)
            time.sleep(1)
        
    print("\n✓ Скачивание завершено!")
    
    # Теперь скачиваем детальные страницы товаров
    print("\n" + "=" * 60)
    print("ШАГ 1.5: Скачивание детальных страниц товаров")
    print("=" * 60)
    
    # Читаем уже спарсенные товары из временного файла или парсим заново
    # Для простоты, скачаем детальные страницы после основного парсинга
    return categories
        
    finally:
        driver.quit()

def parse_local_files(categories):
    """Парсить скачанные локальные файлы"""
    print("\n" + "=" * 60)
    print("ШАГ 2: Парсинг локальных файлов")
    print("=" * 60)
    
    catalog = {
        'categories': []
    }
    
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
        
        # Ищем товары через ссылки (самый надежный способ)
        all_links = soup.find_all('a', href=True)
        seen_urls = set()
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # Пропускаем служебные ссылки
            if any(x in href.lower() for x in ['tel:', 'mailto:', '#', 'javascript:', 'filter/', 'clear/', 'apply/']):
                continue
            
            # Ищем ссылки на товары: /product/category/product-name/ (4 уровня)
            if '/product/' in href and href.count('/') == 4 and href.endswith('/'):
                # Проверяем, что это не категория (3 уровня)
                if href.count('/') == 4:  # Товар имеет 4 уровня
                    # Проверяем, что это товар из текущей категории
                    if cat['url'].strip('/') in href:
                        full_url = urljoin(BASE_URL, href)
                        if full_url not in seen_urls and text and len(text) > 3:
                            seen_urls.add(full_url)
                            
                            # Ищем изображение рядом со ссылкой
                            parent = link.find_parent(['div', 'article', 'li'])
                            product_image = None
                            if parent:
                                img_elem = parent.find('img')
                                if img_elem:
                                    img_src = img_elem.get('src') or img_elem.get('data-src') or img_elem.get('data-lazy-src')
                                    if img_src:
                                        product_image = urljoin(BASE_URL, img_src)
                            
                            # Ищем описание рядом
                            description = ''
                            if parent:
                                desc_elem = parent.find(['p', 'div'], class_=re.compile('description|excerpt|text', re.I))
                                if desc_elem:
                                    description = desc_elem.get_text(strip=True)[:300]
                            
                            products.append({
                                'id': f"{cat['id']}-{len(products)+1}",
                                'name': text,
                                'description': description,
                                'image': product_image,
                                'url': full_url,
                                'specifications': [],
                                'application': '',
                                'consumption': ''
                            })
                            
                            print(f"  ✓ Товар {len(products)}: {text[:50]}")
        
        # Товары уже добавлены в список выше через ссылки
        
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
    print("Скачивание и парсинг сайта с рендерингом JavaScript")
    print("=" * 60)
    
    categories = download_site()
    parse_local_files(categories)
    
    print("\n✓ Готово!")

if __name__ == "__main__":
    main()

