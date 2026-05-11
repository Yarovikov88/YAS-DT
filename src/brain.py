import json
import os
from datetime import date

def load_data(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(json_path, data):
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def run_yas():
    # Определяем путь к файлу относительно скрипта
    base_path = os.path.dirname(os.path.dirname(__file__))
    json_path = os.path.join(base_path, 'data', 'yas_core.json')
    
    if not os.path.exists(json_path):
        print(f"Ошибка: Файл не найден по пути {json_path}")
        return

    data = load_data(json_path)

    print(f"\n--- YAS Digital Twin v2.1 (Active) ---")
    print(f"Загружено фактов: {len(data['knowledge_base'])}")
    print("1. Поиск совета (Read)")
    print("2. Добавить инсайт (Commit)")
    print("3. Выход")
    
    cmd = input("\nВыберите действие (1/2/3): ")

    if cmd == "1":
        choice = input("Введите ID факта: ")
        fact = next((f for f in data['knowledge_base'] if str(f['id']) == choice), None)
        if fact:
            print(f"\n--- [ФАКТ #{fact['id']}: {fact['title']}] ---")
            print(f"Категория: {fact.get('category', 'N/A')}")
            print(f"Дата: {fact.get('created_at', 'N/A')}")
            print(f"Суть: {fact['content']}")
            print(f"Теги: {', '.join(fact['tags'])}")
        else:
            print("\n[!] Факт с таким ID не найден.")

    elif cmd == "2":
        try:
            raw_id = input("Введите ID (число): ")
            new_id = int(raw_id)
            
            title = input("Название: ")
            content = input("Суть алгоритма: ")
            tags = input("Теги (через запятую): ").split(',')
            
            print("Категории: Принцип, Кейс, Технология, Философия")
            cat = input("Выберите категорию: ")
            
            new_fact = {
                "id": new_id,
                "title": title,
                "content": content,
                "tags": [t.strip() for t in tags],
                "category": cat.strip() or "Принцип",
                "created_at": str(date.today())
            }
            
            data['knowledge_base'].append(new_fact)
            save_data(json_path, data)
            print(f"\n[DONE] Инсайт #{new_id} успешно интегрирован в ядро.")
        except ValueError:
            print("\n[ERROR] ID должен быть числом!")

    elif cmd == "3":
        print("Система переведена в спящий режим.")
        return

if __name__ == "__main__":
    run_yas()