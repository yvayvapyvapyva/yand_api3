# 🧭 NAVIGATOR — VK Mini Apps

Веб-приложение для навигации по учебным автомобильным маршрутам с голосовыми подсказками.

## 🚀 Запуск в VK Mini Apps

### Минимальные требования

Для работы в VK Mini Apps достаточно **одного изменения** — подключён VK Bridge SDK:

```html
<script src="https://unpkg.com/@vkontakte/vk-bridge@latest/dist/browser.min.js"></script>
```

### 1. Локальное тестирование

```bash
# Используем любой локальный сервер
npx http-server -p 5501
# или
python3 -m http.server 5501
```

### 2. Размещение в VK

1. Загрузите файлы на HTTPS-хостинг (GitHub Pages, Vercel, Netlify)
2. В [VK Developers](https://dev.vk.com/) создайте мини-приложение
3. Укажите URL вашего приложения
4. Включите разрешения на геолокацию

### 3. Требования

- **HTTPS** — обязательно для работы геолокации
- **Yandex Maps API Key** — замените `YANDEX_API_KEY` в `index.html`

## 📁 Структура

```
vknavigator/
├── index.html              # Основной файл
├── instr.txt               # Инструкция пользователя
├── README.md               # Этот файл
├── assets/
│   ├── css/
│   │   └── menu-module.css # Стили меню
│   └── js/
│       └── menu-module.js  # Модуль загрузки маршрутов
└── audio/                  # 43 аудиокоманды
```

## 📝 Примечания

- Геолокация требует HTTPS или localhost
- Wake Lock API может не работать в некоторых вебвью
- Приложение работает как обычное веб-приложение и в VK Mini Apps без дополнительных изменений
