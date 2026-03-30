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

// Индикатор авто-ведения
let autoIndicatorMarker=null,autoIndicatorVisible=false;

// Создание и обновление индикатора
function updateAutoIndicator(coords){
    if(!APP.map||!coords)return;
    if(!autoIndicatorMarker){
        const indicatorEl=document.createElement('div');
        indicatorEl.style.cssText='width:16px;height:16px;background:#F33;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(255,0,0,0.8),0 0 20px rgba(255,0,0,0.4);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);';
        indicatorEl.innerHTML='<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;background:rgba(255,255,255,0.8);border-radius:50%"></div>';
        autoIndicatorMarker=new ymaps3.YMapMarker({coordinates:coords,zIndex:10000},indicatorEl);
        APP.map.addChild(autoIndicatorMarker);
        autoIndicatorVisible=true;
        console.log('[Indicator] Создан');
        return;
    }
    if(!autoIndicatorVisible){APP.map.addChild(autoIndicatorMarker);autoIndicatorVisible=true;console.log('[Indicator] Добавлен');}
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
            const ls=createLineString(validPts),routeLength=getLineLength(ls);
            let duration=(routeLength/speed)*1000;
            if(minDuration>0){
                const actualSpeed=routeLength<(speed*minDuration/1000)?(routeLength/(minDuration/1000)):speed;
                duration=(routeLength/actualSpeed)*1000;
            }
            // ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ: кэшируем длины сегментов
            const segmentLengths=[];
            const cumulativeLengths=[0];
            let totalLen=0;
            for(let i=0;i<validPts.length-1;i++){
                const len=_calcDistance(validPts[i],validPts[i+1]);
                segmentLengths.push(len);
                totalLen+=len;
                cumulativeLengths.push(totalLen);
            }
            const startTime=performance.now();let animationId=null;
            let currentSegmentIndex=0;
            const animateStep=(currentTime)=>{
                if(!window.isAutoRouteRunning){cancelAnimationFrame(animationId);return;}
                const elapsed=currentTime-startTime,t=Math.min(elapsed/duration,1),currentDistance=t*routeLength;
                try{
                    // ОПТИМИЗАЦИЯ: ищем сегмент начиная с текущего (не с начала!)
                    while(currentSegmentIndex<cumulativeLengths.length-1&&
                          currentDistance>cumulativeLengths[currentSegmentIndex+1]){
                        currentSegmentIndex++;
                    }
                    // Интерполируем точку внутри сегмента
                    const segStart=cumulativeLengths[currentSegmentIndex];
                    const segEnd=cumulativeLengths[currentSegmentIndex+1];
                    const segLen=segEnd-segStart;
                    const segT=segLen>0?(currentDistance-segStart)/segLen:0;
                    const p1=validPts[currentSegmentIndex];
                    const p2=validPts[currentSegmentIndex+1];
                    const coords=[p1[0]+(p2[0]-p1[0])*segT,p1[1]+(p2[1]-p1[1])*segT];
                    APP.map.update({location:{center:coords}});
                    updateAutoIndicator(coords);
                }catch(e){}
                if(t<1){animationId=requestAnimationFrame(animateStep);}else{if(onComplete)onComplete();}
            };
            animationId=requestAnimationFrame(animateStep);
        }catch(e){if(onComplete)onComplete();}
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
