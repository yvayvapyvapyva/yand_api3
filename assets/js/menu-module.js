/**
 * Menu Button Module
 * Модуль кнопки меню для загрузки маршрутов
 * Возвращает JSON данные маршрута, а не название
 */

const MenuModule = {
    callback: null,
    isLoaded: false,

    /**
     * Универсальное получение параметров URL
     * Поддерживает только формат: #m=id-название
     */
    getUrlParam(name) {
        if (name !== 'm') return null;

        // Проверка hash: #m=id-название
        const hash = window.location.hash.slice(1);
        if (hash) {
            // Формат: #m=id-название
            const hashParams = new URLSearchParams(hash);
            let value = hashParams.get(name);
            if (value) return value;

            // Формат: #/path?m=id-название
            const hashQueryIndex = hash.indexOf('?');
            if (hashQueryIndex > -1) {
                const hashQuery = hash.substring(hashQueryIndex + 1);
                const hashQueryParams = new URLSearchParams(hashQuery);
                value = hashQueryParams.get(name);
                if (value) return value;
            }
        }

        return null;
    },

    /**
     * Парсинг ввода в формате "id-название" или просто "название"
     * @returns {{id: string|null, name: string}}
     */
    parseRouteInput(input) {
        const trimmed = input.trim();
        const dashIndex = trimmed.indexOf('-');
        
        if (dashIndex > 0) {
            const id = trimmed.substring(0, dashIndex).trim();
            const name = trimmed.substring(dashIndex + 1).trim();
            if (id && name) {
                return { id, name };
            }
        }
        return { id: null, name: trimmed };
    },

    // Инициализация
    init(onRouteLoaded) {
        this.callback = onRouteLoaded;
        this.createModal();
        this.createButton();
        this.hide();

        // Проверяем параметры сразу и при получении данных от VK Bridge
        this.checkUrlParam();

        // Подписка на события VK Bridge для параметров запуска
        if (typeof vkBridge !== 'undefined') {
            vkBridge.subscribe((event) => {
                // Проверяем, что маршрут ещё не загружен
                if (!this.isLoaded && (event && event.type === 'VKWebAppUpdateConfig' || event.detail)) {
                    this.checkUrlParam();
                }
            });

            // Пробуем получить параметры из launchParams
            try {
                vkBridge.send('VKWebAppGetLaunchParams')
                    .then(params => {
                        // Проверяем, что маршрут ещё не загружен
                        if (!this.isLoaded && params && params.m) {
                            const { id, name } = this.parseRouteInput(params.m);
                            if (name) {
                                this.isLoaded = true;
                                this.hide();
                                this.loadRouteByName(name, id);
                            }
                        }
                    })
                    .catch(e => {});
            } catch (e) {
            }
        }
    },
    
    // Создание модального окна
    createModal() {
        // Генерируем HTML для списка маршрутов
        let routesHtml = '';
        if (typeof ROUTES_LIST !== 'undefined') {
            routesHtml = '<div class="routes-list">';
            for (const [routeId, routeName] of Object.entries(ROUTES_LIST)) {
                routesHtml += `<button class="route-item" data-route="${routeId}">
                    <span class="route-name">${routeName}</span>
                    <span class="route-id">${routeId}</span>
                </button>`;
            }
            routesHtml += '</div>';
        }

        const html = `
            <div id="jsonModal">
                <div class="modal-sheet">
                    <div class="modal-title">Загрузка маршрута</div>
                    <input type="text" id="routeInput" class="modal-input" placeholder="ID-название">
                    <div class="modal-buttons">
                        <button id="cancelBtn" class="modal-btn modal-btn-muted">Отмена</button>
                        <button id="loadRouteBtn" class="modal-btn modal-btn-green">Загрузить</button>
                    </div>
                    ${routesHtml}
                </div>
            </div>
        `;

        const loading = document.getElementById('loading');
        if (loading) {
            loading.insertAdjacentHTML('afterend', html);
        } else {
            document.body.insertAdjacentHTML('afterbegin', html);
        }

        // Обработчик загрузки
        document.getElementById('loadRouteBtn').addEventListener('click', () => {
            const inputValue = document.getElementById('routeInput').value.trim();
            if (!inputValue) {
                if (typeof showToast === 'function') {
                    showToast('Введите ID и название маршрута', 'error');
                }
                return;
            }
            const { id, name } = this.parseRouteInput(inputValue);
            if (!name) {
                if (typeof showToast === 'function') {
                    showToast('Введите название маршрута', 'error');
                }
                return;
            }
            this.loadRouteByName(name, id);
        });

        // Обработчик отмены
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hide();
        });

        // Обработчик Enter
        document.getElementById('routeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('loadRouteBtn').click();
            }
        });

        // Обработчики кликов по списку маршрутов
        document.querySelectorAll('.route-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const routeId = btn.getAttribute('data-route');
                document.getElementById('routeInput').value = routeId;
                const { id, name } = this.parseRouteInput(routeId);
                if (name) {
                    this.loadRouteByName(name, id);
                }
            });
        });
    },
    
    // Создание кнопки меню
    createButton() {
        const html = `
            <button id="menuBtn" class="circle-btn">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>
                </svg>
                <span>Меню</span>
            </button>
        `;
        
        const loading = document.getElementById('loading');
        if (loading) {
            loading.insertAdjacentHTML('afterend', html);
        } else {
            document.body.insertAdjacentHTML('afterbegin', html);
        }
        
        // Обработчик клика
        document.getElementById('menuBtn').addEventListener('click', () => {
            this.show();
            document.getElementById('routeInput').value = '';
            // Не устанавливаем фокус автоматически — пользователь сам нажмёт на поле
        });
    },
    
    // Проверка URL параметра
    checkUrlParam() {
        // Поддерживаем только формат: #m=id-название
        const routeParam = this.getUrlParam('m');

        if (routeParam) {
            // Парсим формат "id-название"
            const { id, name } = this.parseRouteInput(routeParam);

            this.isLoaded = true;
            this.hide();
            this.loadRouteByName(name, id);
        }
    },
    
    // Загрузка маршрута по названию (внутренний метод)
    async loadRouteByName(routeName, routeId = null) {
        try {
            // Сначала закрываем окно меню
            this.hide();
            
            // Формируем базовый URL с параметрами: id, m
            let url = 'https://functions.yandexcloud.net/d4ejhg45t650h3amrik1';
            const params = [];
            if (routeId) {
                params.push(`id=${encodeURIComponent(routeId)}`);
            }
            if (routeName) {
                params.push(`m=${encodeURIComponent(routeName)}`);
            }

            // Пытаемся получить userInfo от VK (с таймаутом 1 секунда)
            if (typeof vkBridge !== 'undefined') {
                try {
                    const userInfo = await Promise.race([
                        vkBridge.send('VKWebAppGetUserInfo'),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('timeout')), 1000)
                        )
                    ]);
                    
                    if (userInfo) {
                        const userInfoJson = JSON.stringify(userInfo);
                        const userInfoBase64 = btoa(encodeURIComponent(userInfoJson));
                        params.push(`i=${userInfoBase64}`);
                    }
                } catch (e) {
                }
            } else {
            }

            // Формируем итоговый URL и отправляем ОДИН запрос
            if (params.length > 0) {
                url += '?' + params.join('&');
            }

            const res = await fetch(url);

            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            this.loadRoute(data);
        } catch (e) {
            console.error('[MenuModule] Ошибка загрузки маршрута:', e);
            if (typeof showToast === 'function') {
                showToast('Ошибка загрузки: ' + e.message, 'error', 5000);
            }
        }
    },

    // Внутренняя функция для fetch и загрузки
    async _fetchAndLoad(url) {
        try {
            const res = await fetch(url);

            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();

            this.loadRoute(data);
        } catch (e) {
            console.error('[MenuModule] Ошибка загрузки маршрута:', e);
            if (typeof showToast === 'function') {
                showToast('Ошибка загрузки: ' + e.message, 'error', 5000);
            }
        }
    },
    
    // Загрузка маршрута (публичный метод, передаёт JSON в навигатор)
    loadRoute(jsonData) {
        // Очищаем предыдущий маршрут
        if (typeof clearRoute === 'function') {
            clearRoute();
        }
        
        // Передаём JSON данные в навигатор
        if (typeof this.callback === 'function') {
            this.callback(jsonData);
        }
        this.isLoaded = true;
        this.hide();
    },
    
    // Публичный метод для загрузки JSON напрямую (для будущих источников)
    loadFromJSON(jsonData) {
        this.loadRoute(jsonData);
    },
    
    // Скрыть модальное окно
    hide() {
        const modal = document.getElementById('jsonModal');
        if (modal) modal.classList.add('hidden');
    },
    
    // Показать модальное окно
    show() {
        const modal = document.getElementById('jsonModal');
        if (modal) modal.classList.remove('hidden');
    }
};
