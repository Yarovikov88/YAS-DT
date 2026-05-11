import json
import os

def get_yas_advice():
    # Путь к твоей базе данных
    base_path = os.path.dirname(os.path.dirname(__file__))
    json_path = os.path.join(base_path, 'data', 'yas_core.json')

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        print("\n--- YAS Digital Twin: Система активна ---")
        print(f"Архитектор: {data['system_info']['architect']}")
        print(f"Загружено фактов: {len(data['knowledge_base'])}\n")

        # Просим ввести ID факта
        choice = input("Введите ID факта для консультации (например, 1 или 200): ")
        
        # Ищем факт
        fact = next((f for f in data['knowledge_base'] if str(f['id']) == choice), None)
        
        if fact:
            print(f"\n[ФАКТ #{fact['id']}]: {fact['title']}")
            print(f"СУТЬ: {fact['content']}")
            print(f"ТЕГИ: {', '.join(fact['tags'])}")
        else:
            print("\nОшибка: Данный ID не найден в базе.")
            
    except FileNotFoundError:
        print(f"Ошибка: Не найден файл по адресу {json_path}")

if __name__ == "__main__":
    get_yas_advice()