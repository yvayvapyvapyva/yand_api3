/**
 * Auto Route Module - Оптимизированная версия
 * Модуль автоматического ведения по маршруту (90 км/ч)
 * С плавными переходами между сегментами и красным индикатором
 */
const EARTH_RADIUS=6371000;
function _calcDistance(p1,p2){const[lon1,lat1]=p1.map(d=>d*Math.PI/180),[lon2,lat2]=p2.map(d=>d*Math.PI/180),dLat=lat2-lat1,dLon=lon2-lon1,a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return EARTH_RADIUS*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function createLineString(coords){return{geometry:{coordinates:coords}};}
function getLineLength(ls){const c=ls.geometry.coordinates;let t=0;for(let i=0;i<c.length-1;i++)t+=_calcDistance(c[i],c[i+1]);return t;}
function getPointAlongLine(ls,dist){const c=ls.geometry.coordinates;let traveled=0;for(let i=0;i<c.length-1;i++){const p1=c[i],p2=c[i+1],segDist=_calcDistance(p1,p2);if(traveled+segDist>=dist){const r=(dist-traveled)/segDist;return{geometry:{coordinates:[p1[0]+(p2[0]-p1[0])*r,p1[1]+(p2[1]-p1[1])*r]}};}traveled+=segDist;}return{geometry:{coordinates:c[c.length-1]}};}

// Индикатор авто-ведения (стрелка)
let autoIndicatorMarker=null,autoIndicatorVisible=false,prevCoords=null,autoIndicatorEl=null,mapAzimuth=0;

// Вычисление угла между двумя точками (как в примере Yandex Progress)
function angleFromCoordinate(p1,p2){
    const toRad=d=>d*Math.PI/180;
    const toDeg=r=>r*180/Math.PI;
    const dLon=toRad(p2[0]-p1[0]);
    const y=Math.sin(dLon)*Math.cos(toRad(p2[1]));
    const x=Math.cos(toRad(p1[1]))*Math.sin(toRad(p2[1]))-Math.sin(toRad(p1[1]))*Math.cos(toRad(p2[1]))*Math.cos(dLon);
    let deg=Math.atan2(y,x);
    deg=toDeg(deg);
    return(deg+360)%360;
}

// Плавный поворот угла (кратчайший путь)
function smoothRotate(currentAngle,targetAngle){
    let diff=targetAngle-(currentAngle%360);
    if(diff>180)diff-=360;
    if(diff<-180)diff+=360;
    return currentAngle+diff;
}

// Создание и обновление индикатора-стрелки
function updateAutoIndicator(coords){
    if(!APP.map||!coords)return;
    if(!autoIndicatorMarker){
        // Создаём контейнер
        const markerElement=document.createElement('div');
        markerElement.style.cssText='position:absolute;transform:translate(-50%,-50%);';

        // Создаём стрелку (PNG изображение) с начальным поворотом
        // Поворачиваем стрелку так, чтобы она смотрела вверх экрана
        const markerElementImg=document.createElement('img');
        markerElementImg.id='marker';
        markerElementImg.src='assets/images/marker-red.png';
        // Начальный поворот: стрелка должна смотреть вверх (инвертируем текущий азимут карты)
        const initialRotation=-(APP.map.azimuth||0)*(180/Math.PI);
        markerElementImg.style.cssText=`width:40px;height:40px;display:block;transform:rotate(${initialRotation}deg);`;
        markerElement.appendChild(markerElementImg);

        // Сохраняем ссылку на элемент
        autoIndicatorEl=markerElementImg;

        // Создаём маркер
        autoIndicatorMarker=new ymaps3.YMapMarker({coordinates:coords,zIndex:10000},markerElement);
        APP.map.addChild(autoIndicatorMarker);
        autoIndicatorVisible=true;
        prevCoords=coords;
        console.log('[Indicator] Создан');
        return;
    }
    if(!autoIndicatorVisible){APP.map.addChild(autoIndicatorMarker);autoIndicatorVisible=true;console.log('[Indicator] Добавлен');}

    // Просто обновляем координаты - вращение остаётся неизменным!
    autoIndicatorMarker.update({coordinates:coords});
}

function hideAutoIndicator(){
    if(autoIndicatorVisible&&APP.map){
        APP.map.removeChild(autoIndicatorMarker);
        autoIndicatorVisible=false;
        console.log('[Indicator] Скрыт');
    }
}

const AutoRouteModule={currentIndex:0,speed:25,timeout:null,isRunning:false,btn:null,isTransition:false,isFirstStart:false,
    init(btn){this.btn=btn;this.btn.addEventListener('click',()=>this.toggle());},
    toggle(){this.isRunning?this.stop():this.start(25);},
    start(speed=25){
        console.log('[AutoRoute] start');const appRef=APP||window.APP;
        if(!appRef?.navPoints||appRef.navPoints.length===0){if(typeof showToast==='function')showToast('Маршрут не загружен','error');return;}
        this.isRunning=true;window.isAutoRouteRunning=true;this.speed=speed;
        // Начинаем с текущей активной точки или точки просмотра
        this.currentIndex=appRef.navPreviewIndex>=0?appRef.navPreviewIndex:appRef.navCurrentIndex;
        this.isTransition=false;
        // Флаг первого запуска - не создавать переход от предыдущей точки
        this.isFirstStart=true;
        if(this.btn){this.btn.classList.add('active');this.btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';}
        // Показываем индикатор на ПЕРВОЙ ТОЧКЕ ПУТИ выбранной метки
        const currentPoint=appRef.navPoints[this.currentIndex];
        if(currentPoint?.pts?.length>0){
            updateAutoIndicator(currentPoint.pts[0]);
            // Перемещаем камеру к первой точке пути
            APP.map.update({location:{center:currentPoint.pts[0]}});
        }
        this.playSegment();
    },
    stop(){
        this.isRunning=false;window.isAutoRouteRunning=false;
        if(this.timeout){clearTimeout(this.timeout);this.timeout=null;}
        if(this.btn){this.btn.classList.remove('active');this.btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';}
        this.currentIndex=0;this.isTransition=false;this.isFirstStart=false;
        hideAutoIndicator();
    },
    animateAlongPath(pts,speed=25,onComplete=null,minDuration=3500){
        if(!window.isAutoRouteRunning&&!onComplete)return;
        if(!pts||pts.length<2){if(onComplete)onComplete();return;}
        const validPts=pts.filter(p=>p&&p.length===2&&typeof p[0]==='number'&&typeof p[1]==='number'&&isFinite(p[0])&&isFinite(p[1]));
        if(validPts.length<2){if(onComplete)onComplete();return;}
        try{
            // ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ: длины отрезков и общая длина
            const segLengths=[];
            let totalLength=0;
            for(let i=0;i<validPts.length-1;i++){
                const len=_calcDistance(validPts[i],validPts[i+1]);
                segLengths.push(len);
                totalLength+=len;
            }
            
            // Проверка: есть ли путь для анимации
            if(totalLength===0||segLengths.length===0){
                console.log('[AutoRoute] Нет пути для анимации');
                if(onComplete)onComplete();
                return;
            }
            
            // Расчёт общей длительности
            let totalDuration=(totalLength/speed)*1000;
            if(minDuration>0&&totalDuration<minDuration){
                totalDuration=minDuration;
            }
            
            // Инициализируем mapAzimuth текущим азимутом карты (в градусах)
            mapAzimuth=(APP.map.azimuth||0)*(180/Math.PI);
            
            // Анимация: 1 вызов update() на отрезок + индикатор на 60 FPS
            const startTime=performance.now();
            let animationId=null;

            const animateStep=(currentTime)=>{
                if(!window.isAutoRouteRunning){cancelAnimationFrame(animationId);return;}
                const elapsed=currentTime-startTime;
                const progress=Math.min(elapsed/totalDuration,1);
                const currentDistance=progress*totalLength;

                // Интерполяция позиции для индикатора
                const currentPoint=getPointAlongLine(createLineString(validPts),currentDistance);
                if(currentPoint?.geometry?.coordinates?.length===2){
                    updateAutoIndicator(currentPoint.geometry.coordinates);
                }

                if(progress<1){
                    animationId=requestAnimationFrame(animateStep);
                }
            };

            // Запускаем анимацию индикатора
            animationId=requestAnimationFrame(animateStep);
            
            // Перемещаем карту по отрезкам (1 вызов на отрезок) + поворот при смене направления
            let currentSegIndex=0;

            const animateSegment=()=>{
                console.log('[AutoRoute] animateSegment:', currentSegIndex, 'из', validPts.length-1);
                
                if(!window.isAutoRouteRunning||currentSegIndex>=validPts.length-1){
                    console.log('[AutoRoute] Завершение маршрута');
                    cancelAnimationFrame(animationId);
                    if(onComplete)onComplete();
                    return;
                }

                const p1=validPts[currentSegIndex];
                const p2=validPts[currentSegIndex+1];
                const segDuration=(segLengths[currentSegIndex]/totalLength)*totalDuration;

                // Вычисляем угол направления этого сегмента
                const segAngle=angleFromCoordinate(p1,p2);

                // ИНВЕРТИРУЕМ угол для камеры: чтобы машинка ехала вверх экрана
                let targetAzimuth=-segAngle;
                
                // Поворачиваем карту через кратчайший путь
                mapAzimuth=smoothRotate(mapAzimuth,targetAzimuth);
                
                // Нормализуем mapAzimuth (-360° до +360°) для предотвращения переполнения
                while(mapAzimuth>360)mapAzimuth-=360;
                while(mapAzimuth<-360)mapAzimuth+=360;

                // Перемещаем карту с анимацией + поворот
                APP.map.update({
                    location:{
                        center:p2,
                        duration:segDuration,
                        easing:'linear'
                    },
                    camera:{
                        azimuth:mapAzimuth*(Math.PI/180),  // Поворот карты по направлению
                        duration:segDuration  // Синхронно с перемещением
                    }
                });

                currentSegIndex++;
                setTimeout(animateSegment,segDuration);
            };

            animateSegment();
        }catch(e){
            if(onComplete)onComplete();
        }
    },
    createTransitionSegment(fromIdx,toIdx){
        const appRef=APP||window.APP;
        const fromPoint=appRef.navPoints[fromIdx].pts[appRef.navPoints[fromIdx].pts.length-1];
        const toPoint=appRef.navPoints[toIdx].pts[0];
        const segments=10;const transitionPts=[];
        for(let i=0;i<=segments;i++){const t=i/segments;transitionPts.push([fromPoint[0]+(toPoint[0]-fromPoint[0])*t,fromPoint[1]+(toPoint[1]-fromPoint[1])*t]);}
        return transitionPts;
    },
    playSegment(){
        const appRef=APP||window.APP;if(!this.isRunning)return;
        if(this.currentIndex>=appRef.navPoints.length){this.stop();if(typeof showToast==='function')showToast('Маршрут завершён!','success');return;}
        const p=appRef.navPoints[this.currentIndex];
        if(!p||!p.pts||p.pts.length<2){this.currentIndex++;this.playSegment();return;}
        const firstPoint=p.pts[0];
        // Если это не первый сегмент и есть предыдущий - создаём плавный переход (но не при первом запуске!)
        if(this.currentIndex>0&&!this.isTransition&&!this.isFirstStart){
            const prevPoint=appRef.navPoints[this.currentIndex-1].pts[appRef.navPoints[this.currentIndex-1].pts.length-1];
            const currentStart=p.pts[0];
            const gap=_calcDistance(prevPoint,currentStart);
            if(gap>5){
                this.isTransition=true;
                const transitionPts=[];
                const segments=Math.ceil(gap/10);
                for(let i=0;i<=segments;i++){
                    const t=i/segments;
                    transitionPts.push([prevPoint[0]+(currentStart[0]-prevPoint[0])*t,prevPoint[1]+(currentStart[1]-prevPoint[1])*t]);
                }
                this.animateAlongPath(transitionPts,this.speed,()=>{
                    if(!this.isRunning)return;
                    this.isTransition=false;
                    appRef.navCurrentIndex=this.currentIndex;appRef.navPreviewIndex=-1;
                    if(typeof updateHud==='function')updateHud();if(typeof renderRoutePoints==='function')renderRoutePoints();
                    // Индикатор достиг НАЧАЛА пути (первой точки) - воспроизводим команду
                    if(p.cmd&&typeof playCommand==='function')playCommand(p.cmd);
                    this.animateAlongPath(p.pts,this.speed,()=>{if(!this.isRunning)return;this.currentIndex++;this.playSegment();},3500);
                },0);
                return;
            }
        }
        // Сбрасываем флаг после первого запуска
        this.isFirstStart=false;
        appRef.navCurrentIndex=this.currentIndex;appRef.navPreviewIndex=-1;
        if(typeof updateHud==='function')updateHud();if(typeof renderRoutePoints==='function')renderRoutePoints();
        // Индикатор достиг НАЧАЛА пути (первой точки) - воспроизводим команду
        if(p.cmd&&typeof playCommand==='function')playCommand(p.cmd);
        this.animateAlongPath(p.pts,this.speed,()=>{
            if(!this.isRunning)return;
            this.currentIndex++;
            this.playSegment();
        },3500);
    }
};
