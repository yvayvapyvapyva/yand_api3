/**
 * Auto Route Module - Оптимизированная версия
 * Модуль автоматического ведения по маршруту (90 км/ч)
 */
const EARTH_RADIUS=6371000;
function _calcDistance(p1,p2){const[lon1,lat1]=p1.map(d=>d*Math.PI/180),[lon2,lat2]=p2.map(d=>d*Math.PI/180),dLat=lat2-lat1,dLon=lon2-lon1,a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;return EARTH_RADIUS*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function createLineString(coords){return{geometry:{coordinates:coords}};}
function getLineLength(ls){const c=ls.geometry.coordinates;let t=0;for(let i=0;i<c.length-1;i++)t+=_calcDistance(c[i],c[i+1]);return t;}
function getPointAlongLine(ls,dist){const c=ls.geometry.coordinates;let traveled=0;for(let i=0;i<c.length-1;i++){const p1=c[i],p2=c[i+1],segDist=_calcDistance(p1,p2);if(traveled+segDist>=dist){const r=(dist-traveled)/segDist;return{geometry:{coordinates:[p1[0]+(p2[0]-p1[0])*r,p1[1]+(p2[1]-p1[1])*r]}};}traveled+=segDist;}return{geometry:{coordinates:c[c.length-1]}};}

const AutoRouteModule={currentIndex:0,speed:25,timeout:null,isRunning:false,btn:null,
    init(btn){this.btn=btn;this.btn.addEventListener('click',()=>this.toggle());},
    toggle(){this.isRunning?this.stop():this.start(25);},
    start(speed=25){
        console.log('[AutoRoute] start');const appRef=APP||window.APP;
        if(!appRef?.navPoints||appRef.navPoints.length===0){if(typeof showToast==='function')showToast('Маршрут не загружен','error');return;}
        this.isRunning=true;window.isAutoRouteRunning=true;this.speed=speed;this.currentIndex=0;
        if(this.btn){this.btn.classList.add('active');this.btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';}
        this.playSegment();
    },
    stop(){
        this.isRunning=false;window.isAutoRouteRunning=false;
        if(this.timeout){clearTimeout(this.timeout);this.timeout=null;}
        if(this.btn){this.btn.classList.remove('active');this.btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';}
        this.currentIndex=0;
    },
    animateAlongPath(pts,speed=25,onComplete=null){
        if(!window.isAutoRouteRunning&&!onComplete)return;
        if(!pts||pts.length<2){if(onComplete)onComplete();return;}
        const validPts=pts.filter(p=>p&&p.length===2&&typeof p[0]==='number'&&typeof p[1]==='number'&&isFinite(p[0])&&isFinite(p[1]));
        if(validPts.length<2){if(onComplete)onComplete();return;}
        try{
            const ls=createLineString(validPts),routeLength=getLineLength(ls),duration=(routeLength/speed)*1000,startTime=performance.now();let animationId=null;
            const animateStep=(currentTime)=>{
                if(!window.isAutoRouteRunning){cancelAnimationFrame(animationId);return;}
                const elapsed=currentTime-startTime,t=Math.min(elapsed/duration,1),currentDistance=t*routeLength;
                try{const cp=getPointAlongLine(ls,currentDistance);if(cp?.geometry?.coordinates?.length===2)APP.map.update({location:{center:cp.geometry.coordinates}});}catch(e){}
                if(t<1){animationId=requestAnimationFrame(animateStep);}else{if(onComplete)onComplete();}
            };
            animationId=requestAnimationFrame(animateStep);
        }catch(e){if(onComplete)onComplete();}
    },
    playSegment(){
        const appRef=APP||window.APP;if(!this.isRunning)return;
        if(this.currentIndex>=appRef.navPoints.length){this.stop();if(typeof showToast==='function')showToast('Маршрут завершён!','success');return;}
        const p=appRef.navPoints[this.currentIndex];
        if(!p||!p.pts||p.pts.length<2){this.currentIndex++;this.playSegment();return;}
        appRef.navCurrentIndex=this.currentIndex;appRef.navPreviewIndex=-1;
        if(typeof updateHud==='function')updateHud();if(typeof renderRoutePoints==='function')renderRoutePoints();
        this.animateAlongPath(p.pts,this.speed,()=>{if(!this.isRunning)return;this.currentIndex++;this.playSegment();});
        const ls=createLineString(p.pts),routeLength=getLineLength(ls),segmentDuration=(routeLength/this.speed)*1000;
        this.timeout=setTimeout(()=>{if(!this.isRunning)return;this.currentIndex++;this.playSegment();},segmentDuration);
    }
};
