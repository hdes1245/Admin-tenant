import { jsPDF } from "jspdf";

// Boîte à outils de dessin PDF partagée — extraite de dashboardPdf.ts pour être
// réutilisée par tous les générateurs de rapports (dashboard, portefeuille,
// localisations, agents terrain, rapport global) sans dupliquer le code.

// ─── Palette ─────────────────────────────────────────────────────────────────
export const C = {
  navy:   [15,  59,  92 ] as [number,number,number],
  steel:  [30,  96,  145] as [number,number,number],
  gold:   [60, 128, 71 ] as [number,number,number],
  goldDark: [32, 82, 43] as [number,number,number],
  green:  [5,   150, 105] as [number,number,number],
  red:    [220, 38,  38 ] as [number,number,number],
  orange: [217, 119, 6  ] as [number,number,number],
  violet: [124, 58,  237] as [number,number,number],
  gray:   [100, 116, 139] as [number,number,number],
  light:  [240, 244, 248] as [number,number,number],
  white:  [255, 255, 255] as [number,number,number],
};
export const CHART_COLORS: [number,number,number][] = [C.navy, C.steel, C.gold, C.green, C.red, C.orange, C.violet];

// ─── Helpers texte & formatage ─────────────────────────────────────────────────
export function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch { return iso; }
}
export function fmtNum(n: number) { return Math.round(n).toLocaleString("fr-FR"); }

export function rgb(doc: jsPDF, col: [number,number,number], target: "fill"|"draw"|"text") {
  if (target==="fill") doc.setFillColor(col[0],col[1],col[2]);
  else if (target==="draw") doc.setDrawColor(col[0],col[1],col[2]);
  else doc.setTextColor(col[0],col[1],col[2]);
}
export function fr(doc: jsPDF, x:number,y:number,w:number,h:number,col:[number,number,number]) {
  rgb(doc,col,"fill"); doc.rect(x,y,w,h,"F");
}
export function txt(doc:jsPDF,t:string,x:number,y:number,size:number,col:[number,number,number],align:"left"|"center"|"right"="left",bold=false) {
  doc.setFontSize(size); doc.setFont("helvetica",bold?"bold":"normal");
  rgb(doc,col,"text"); doc.text(t,x,y,{align});
}
export function hline(doc:jsPDF,x1:number,y1:number,x2:number,y2:number,col:[number,number,number],lw=0.3) {
  rgb(doc,col,"draw"); doc.setLineWidth(lw); doc.line(x1,y1,x2,y2);
}

// ─── Pie/Donut ─────────────────────────────────────────────────────────────────
function drawSector(doc:jsPDF,cx:number,cy:number,r:number,startDeg:number,endDeg:number,col:[number,number,number]) {
  rgb(doc,col,"fill");
  rgb(doc,col,"draw");
  doc.setLineWidth(0.01);
  const step=2;
  for(let a=startDeg;a<endDeg;a+=step){
    const a1=(a*Math.PI)/180, a2=(Math.min(a+step,endDeg)*Math.PI)/180;
    const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
    const x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2);
    doc.lines(
      [[x1-cx,y1-cy],[x2-x1,y2-y1],[cx-x2,cy-y2]],
      cx, cy, [1,1], 'F', true
    );
  }
}
export function drawPieDonut(doc:jsPDF,data:{label:string;value:number}[],cx:number,cy:number,r:number,innerR:number,legendX:number,legendY:number,labelFn?:(s:string)=>string) {
  const total=data.reduce((a,d)=>a+d.value,0)||1;
  let currentDeg=-90;
  data.forEach((d,i)=>{
    const sweep=(d.value/total)*360;
    drawSector(doc,cx,cy,r,currentDeg,currentDeg+sweep,CHART_COLORS[i%CHART_COLORS.length]);
    currentDeg+=sweep;
  });
  rgb(doc,C.white,"fill"); doc.circle(cx,cy,innerR,"F");
  txt(doc,`${total}`,cx,cy-2,10,C.navy,"center",true);
  txt(doc,"total",cx,cy+4,7,C.gray,"center");
  data.forEach((d,i)=>{
    const ly=legendY+i*8;
    fr(doc,legendX,ly-3.5,4,4,CHART_COLORS[i%CHART_COLORS.length]);
    const lbl = labelFn ? labelFn(d.label) : d.label;
    txt(doc,`${lbl} (${d.value})`,legendX+5.5,ly,7.5,C.navy);
  });
}

// ─── Barres verticales ──────────────────────────────────────────────────────────
export function drawBarChart(doc:jsPDF,data:{label:string;value:number}[],x:number,y:number,w:number,h:number,col:[number,number,number]) {
  if(!data.length) return;
  const maxV=Math.max(...data.map(d=>d.value),1);
  const barW=Math.min((w/data.length)*0.65,20);
  const gap=(w/data.length);
  hline(doc,x,y,x,y+h,C.gray,0.4);
  hline(doc,x,y+h,x+w,y+h,C.gray,0.4);
  for(let i=1;i<=4;i++){
    const gy=y+h-(h*(i/4));
    hline(doc,x,gy,x+w,gy,C.light,0.2);
    txt(doc,String(Math.round(maxV*(i/4))),x-1,gy+1,5,C.gray,"right");
  }
  data.forEach((d,i)=>{
    const bx=x+i*gap+(gap-barW)/2;
    const bh=(d.value/maxV)*h;
    const by=y+h-bh;
    fr(doc,bx,by,barW,bh,col);
    txt(doc,String(d.value),bx+barW/2,by-1.5,5.5,C.navy,"center",true);
    const lbl=d.label.length>7?d.label.slice(0,6)+"…":d.label;
    txt(doc,lbl,bx+barW/2,y+h+5,5.5,C.gray,"center");
  });
}

// ─── Barres groupées (2-3 séries) ────────────────────────────────────────────
export function drawGroupedBar(doc:jsPDF,data:{label:string;a:number;b:number;c?:number}[],x:number,y:number,w:number,h:number,labels:[string,string,string?],colors:[[number,number,number],[number,number,number],[number,number,number]?]) {
  if(!data.length) return;
  const series=colors[2]?3:2;
  const maxV=Math.max(...data.flatMap(d=>[d.a,d.b,d.c??0]),1);
  const groupW=w/data.length;
  const bw=Math.min(groupW*0.25,8);
  hline(doc,x,y,x,y+h,C.gray,0.4);
  hline(doc,x,y+h,x+w,y+h,C.gray,0.4);
  for(let i=1;i<=4;i++){
    const gy=y+h-(h*(i/4));
    hline(doc,x,gy,x+w,gy,C.light,0.2);
    txt(doc,String(Math.round(maxV*(i/4))),x-1,gy+1,5,C.gray,"right");
  }
  data.forEach((d,i)=>{
    const gx=x+i*groupW;
    const vals=[d.a,d.b,d.c??0];
    vals.slice(0,series).forEach((v,s)=>{
      const bx=gx+(groupW-series*bw-(series-1)*1)/2+s*(bw+1);
      const bh=(v/maxV)*h;
      const by=y+h-bh;
      fr(doc,bx,by,bw,bh,colors[s]!);
      if(v>0) txt(doc,String(v),bx+bw/2,by-1.5,4.5,C.navy,"center");
    });
    const lbl=d.label.length>7?d.label.slice(0,6)+"…":d.label;
    txt(doc,lbl,gx+groupW/2,y+h+5,5,C.gray,"center");
  });
  let lx=x;
  labels.slice(0,series).forEach((l,i)=>{
    if(!l) return;
    fr(doc,lx,y-6,3.5,3.5,colors[i]!);
    txt(doc,l,lx+4.5,y-3,6.5,C.navy);
    lx+=30;
  });
}

// ─── Barres horizontales ─────────────────────────────────────────────────────
export function drawHorizBar(doc:jsPDF,data:{label:string;value:number}[],x:number,y:number,w:number,col:[number,number,number]) {
  if(!data.length) return;
  const maxV=Math.max(...data.map(d=>d.value),1);
  const rowH=7;
  data.slice(0,12).forEach((d,i)=>{
    const ry=y+i*rowH;
    if(i%2===0) fr(doc,x,ry,w+50,rowH-0.5,C.light);
    const bw=(d.value/maxV)*w;
    fr(doc,x,ry+1.5,bw,rowH-3.5,col);
    txt(doc,d.label.length>18?d.label.slice(0,17)+"…":d.label,x-2,ry+5.5,6,C.navy,"right");
    txt(doc,String(d.value),x+bw+1.5,ry+5.5,6,col);
  });
}

// ─── Courbe ───────────────────────────────────────────────────────────────────
export function drawLineChart(doc:jsPDF,series:{label:string;col:[number,number,number];data:number[]}[],labels:string[],x:number,y:number,w:number,h:number) {
  if(!labels.length) return;
  const allVals=series.flatMap(s=>s.data);
  const maxV=Math.max(...allVals,1);
  hline(doc,x,y,x,y+h,C.gray,0.4);
  hline(doc,x,y+h,x+w,y+h,C.gray,0.4);
  for(let i=1;i<=4;i++){
    const gy=y+h-(h*(i/4));
    hline(doc,x,gy,x+w,gy,C.light,0.2);
    txt(doc,String(Math.round(maxV*(i/4))),x-1,gy+1,5,C.gray,"right");
  }
  const step=w/(labels.length-1||1);
  const skip=Math.ceil(labels.length/8);
  labels.forEach((l,i)=>{
    if(i%skip===0||i===labels.length-1)
      txt(doc,l,x+i*step,y+h+5,5,C.gray,"center");
  });
  series.forEach(s=>{
    rgb(doc,s.col,"draw"); doc.setLineWidth(1.2);
    for(let i=1;i<s.data.length;i++){
      const px0=x+(i-1)*step, py0_=y+h-(s.data[i-1]/maxV)*h;
      const px1=x+i*step,     py1=y+h-(s.data[i]/maxV)*h;
      doc.line(px0,py0_,px1,py1);
    }
    rgb(doc,s.col,"fill");
    const pyFirst=y+h-(s.data[0]/maxV)*h;
    const pyLast=y+h-(s.data[s.data.length-1]/maxV)*h;
    doc.circle(x,pyFirst,1,"F");
    doc.circle(x+(labels.length-1)*step,pyLast,1,"F");
  });
  let lx=x;
  series.forEach(s=>{ fr(doc,lx,y-6,3.5,3.5,s.col); txt(doc,s.label,lx+5,y-3,6.5,C.navy); lx+=45; });
}

// ─── Barres de progression ────────────────────────────────────────────────────
export function drawProgressBars(doc:jsPDF,data:{label:string;pct:number;count:number;col:[number,number,number]}[],x:number,y:number,w:number) {
  const rowH=10;
  data.forEach((d,i)=>{
    const ry=y+i*rowH;
    txt(doc,d.label,x,ry+5.5,7,C.navy,"left",true);
    txt(doc,`${d.count} (${d.pct}%)`,x+w,ry+5.5,7,d.col,"right");
    fr(doc,x+38,ry+2,w-38,5,C.light);
    fr(doc,x+38,ry+2,(w-38)*d.pct/100,5,d.col);
  });
}

// ─── En-têtes / pieds de page / tableaux ──────────────────────────────────────
export function secHdr(doc:jsPDF,title:string,y:number,pageW:number) {
  fr(doc,14,y-5,pageW-28,9,C.navy);
  txt(doc,title.toUpperCase(),18,y+1,8,C.white,"left",true);
  return y+11;
}
export function pageHdr(doc:jsPDF,reportTitle:string,sectionTitle:string,page:string,tenant:string,pageW:number) {
  fr(doc,0,0,pageW,14,C.navy);
  fr(doc,0,0,pageW,3,C.gold);
  txt(doc,`${reportTitle}  ·  ${sectionTitle}`,14,10,8.5,C.gray,"left",true);
  txt(doc,`${page}  ·  ${tenant}`,pageW-14,10,8.5,[148,163,184],"right");
}
export function pageFtr(doc:jsPDF,tenant:string,period:string,pageW:number,pageH:number) {
  hline(doc,14,pageH-10,pageW-14,pageH-10,[226,232,240]);
  txt(doc,`GeoTrust Admin — ${tenant} — ${period}`,14,pageH-5,7,C.gray);
  txt(doc,`CONFIDENTIEL`,pageW/2,pageH-5,7,C.gray,"center");
}
export function simpleTable(doc:jsPDF,headers:string[],rows:string[][],sy:number,colW:number[],pageW:number,pageH:number):number {
  const M=14,rh=7,hh=8; let y=sy;
  const np=()=>{doc.addPage();y=20;};
  if(y+hh>pageH-20) np();
  fr(doc,M,y,pageW-2*M,hh,C.steel);
  let cx=M+2; headers.forEach((h,i)=>{txt(doc,h,cx,y+5.5,7.5,C.white,"left",true);cx+=colW[i];});
  y+=hh;
  rows.forEach((row,ri)=>{
    if(y+rh>pageH-20) np();
    if(ri%2===0) fr(doc,M,y,pageW-2*M,rh,C.light);
    let cx2=M+2; row.forEach((cell,i)=>{
      const c=String(cell??"—"); txt(doc,c.length>28?c.slice(0,26)+"…":c,cx2,y+5,7,C.navy); cx2+=colW[i];
    });
    hline(doc,M,y+rh,pageW-M,y+rh,[226,232,240]);
    y+=rh;
  });
  return y+6;
}

// ─── Bloc KPI (dégradé simulé) ─────────────────────────────────────────────────
export function kpiBlock(
  doc:jsPDF, x:number, y:number, w:number, h:number,
  label:string, value:string, sub:string,
  col1:[number,number,number], col2?:[number,number,number]
) {
  const c2 = col2 ?? col1;
  const steps = 6;
  for(let s=0; s<steps; s++) {
    const t  = s/(steps-1);
    const r  = Math.round(col1[0]+(c2[0]-col1[0])*t);
    const g  = Math.round(col1[1]+(c2[1]-col1[1])*t);
    const b  = Math.round(col1[2]+(c2[2]-col1[2])*t);
    const sh = h/steps;
    fr(doc, x, y+s*sh, w, sh+0.5, [r,g,b]);
  }
  txt(doc, value,      x+w/2, y+h*0.46, 17, C.white, "center", true);
  txt(doc, label,      x+w/2, y+h*0.70, 7.5, [255,255,255], "center", true);
  txt(doc, sub,        x+w/2, y+h*0.87, 6,   [210,225,240], "center", false);
}

// ─── Page de couverture générique ─────────────────────────────────────────────
export function coverPage(
  doc: jsPDF, W: number, H: number,
  title: string, subtitle: string,
  tenantName: string, period: string,
) {
  fr(doc,0,0,W,H,C.navy);
  fr(doc,0,0,W,3,C.gold);
  fr(doc,0,H-3,W,3,C.gold);
  rgb(doc,[27,50,80],"fill");
  doc.rect(W-30,0,30,H,"F");
  rgb(doc,C.navy,"fill");
  doc.rect(W-28,0,28,H,"F");

  fr(doc,14,22,22,22,C.gold);
  txt(doc,"G",14+11,36,18,C.navy,"center",true);
  txt(doc,"GeoTrust Admin",14+26,29,12,C.gold,"left",true);
  txt(doc,"Rapport de tenant",14+26,36,9,C.gray,"left");
  hline(doc,14,48,W-14,48,C.gold,0.8);

  txt(doc,title.toUpperCase(),W/2,82,26,C.white,"center",true);
  txt(doc,subtitle,W/2,92,12,C.gold,"center");

  fr(doc,W/2-52,102,104,17,C.steel);
  txt(doc,tenantName.toUpperCase(),W/2,112,11,C.white,"center",true);
  txt(doc,`Période : ${period}`,W/2,130,10,C.gray,"center");
  txt(doc,`Généré le ${fmtDate(new Date().toISOString())}`,W/2,138,9,[100,116,139],"center");

  txt(doc,"CONFIDENTIEL — Usage interne uniquement",W/2,H-12,8,[80,100,120],"center");
}

export function finalizePageNumbers(doc: jsPDF, W: number, H: number, M = 14) {
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    txt(doc, `${i} / ${total}`, W - M, H - 5, 7, C.gray, "right");
  }
}
