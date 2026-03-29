/**
 * Auto Route Module
 * Модуль автоматического ведения по маршруту с использованием Turf.js
 */

const AutoRouteModule = {
    currentIndex: 0,
    speed: 5, // м/сек
    timeout: null,
    isRunning: false,
    btn: null,

    /**
     * Инициализация модуля
     * @param {HTMLElement} btn - кнопка запуска/остановки
     */
    init(btn) {
        this.btn = btn;
        this.btn.addEventListener('click', () => this.toggle());
    },

    /**
     * Переключение состояния (старт/стоп)
     */
    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start(5); // 5 м/сек = 18 км/ч
        }
    },

    /**
     * Запуск автоматического ведения
     * @param {number} speed - скорость в м/сек
     */
    start(speed = 5) {
        console.log('[AutoRoute] start called');
        
        const appRef = APP || window.APP;
        
        if (!appRef?.navPoints || appRef.navPoints.length === 0) {
            if (typeof showToast === 'function') {
                showToast('Маршрут не загружен', 'error');
            }
            return;
        }

        this.isRunning = true;
        window.isAutoRouteRunning = true;
        this.speed = speed;
        this.currentIndex = 0;

        // Обновляем кнопку
        if (this.btn) {
            this.btn.classList.add('active');
            this.btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        }

        this.playSegment();
    },

    /**
     * Остановка автоматического ведения
     */
    stop() {
        this.isRunning = false;
        window.isAutoRouteRunning = false;

        // Очищаем таймер
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }

        // Сбрасываем кнопку
        if (this.btn) {
            this.btn.classList.remove('active');
            this.btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        }

        this.currentIndex = 0;
    },

    /**
     * Воспроизведение текущего сегмента маршрута
     */
    playSegment() {
        const appRef = APP || window.APP;
        
        if (!this.isRunning) return;

        if (this.currentIndex >= appRef.navPoints.length) {
            this.stop();
            if (typeof showToast === 'function') {
                showToast('Маршрут завершён!', 'success');
            }
            return;
        }

        const p = appRef.navPoints[this.currentIndex];
        
        if (!p || !p.pts || p.pts.length < 2) {
            this.currentIndex++;
            this.playSegment();
            return;
        }

        // Обновляем текущий индекс и preview для отображения пути
        appRef.navCurrentIndex = this.currentIndex;
        appRef.navPreviewIndex = -1; // Сбрасываем preview чтобы показывался текущий сегмент и путь
        
        // Обновляем HUD и перерисовываем маршрут с путём
        if (typeof updateHud === 'function') updateHud();
        if (typeof renderRoutePoints === 'function') renderRoutePoints();

        // Анимация вдоль пути сегмента
        if (typeof window.animateAlongPath === 'function') {
            window.animateAlongPath(p.pts, this.speed, () => {
                if (!this.isRunning) return;
                this.currentIndex++;
                this.playSegment();
            });
        }

        // Расчёт длительности сегмента для перехода к следующему
        if (typeof turf !== 'undefined') {
            const routeLength = turf.length(
                turf.lineString(p.pts.map(pt => [pt[0], pt[1]])),
                { units: 'meters' }
            );
            const segmentDuration = (routeLength / this.speed) * 1000;

            this.timeout = setTimeout(() => {
                if (!this.isRunning) return;
                this.currentIndex++;
                this.playSegment();
            }, segmentDuration);
        }
    }
};
