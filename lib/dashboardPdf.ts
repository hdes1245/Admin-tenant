import { jsPDF } from "jspdf";
import {
  C, CHART_COLORS, fmtDate, rgb, fr, txt, hline,
  drawPieDonut, drawBarChart, drawGroupedBar, drawHorizBar, drawLineChart,
  drawProgressBars, secHdr, pageHdr as pageHdrKit, simpleTable, pageFtr, kpiBlock,
  finalizePageNumbers,
} from "./pdfKit";

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface KpiData    { agences: number; cafs: number; clients: number; locations: number }
interface AgenceStat { agenceId: number; name: string; code: string; zoneName: string | null; nbClients: number; nbCafs: number; nbUsers: number }
interface TicketStat { status: string; count: number }
interface AgencyDist { agence: string; total_clients: string | number }
interface LogItem    { action: string; description: string | null; created_at: string; userName?: string }
interface DerivedKpis { tauxResolution: number; moyenneClients: number; agencesSansCaf: number; totalUsers: number; tendance: number }

export interface PdfReportData {
  tenantName: string;
  period: string;
  kpis: KpiData;
  agenceStats: AgenceStat[];
  ticketsByStatus: TicketStat[];
  clientsByAgency: AgencyDist[];
  recentLogs: LogItem[];
  activityByDay: { date: string; count: number }[];
  derivedKpis?: DerivedKpis;
  agencesByZone?: { zone: string; count: number }[];
  cafsByAgence?: { agence: string; CAFs: number; Utilisateurs: number; Clients: number }[];
  ticketBreakdown?: { status: string; count: number; pct: number }[];
  activityByAction?: { action: string; count: number }[];
}

// ─── Helpers text & primitives ────────────────────────────────────────────────
function statusLabel(s: string) {
  return ({ open:"Ouvert", in_progress:"En cours", resolved:"Résolu", closed:"Fermé" } as any)[s] ?? s;
}
// ─── Main export ──────────────────────────────────────────────────────────────
export function generateDashboardPdf(data: PdfReportData) {
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14; // margin
  const IW = W - 2*M; // inner width

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COUVERTURE
  // ══════════════════════════════════════════════════════════════════════════════
  fr(doc,0,0,W,H,C.navy);
  fr(doc,0,0,W,3,C.gold);
  fr(doc,0,H-3,W,3,C.gold);

  // Decorative accent lines instead of circles (GState not available in all versions)
  rgb(doc,[27,50,80],"fill");
  doc.rect(W-30,0,30,H,"F");
  rgb(doc,C.navy,"fill");
  doc.rect(W-28,0,28,H,"F");

  // Logo square
  fr(doc,M,22,22,22,C.gold);
  txt(doc,"G",M+11,36,18,C.navy,"center",true);
  txt(doc,"GeoTrust Admin",M+26,29,12,C.gold,"left",true);
  txt(doc,"Rapport de tenant",M+26,36,9,C.gray,"left");
  hline(doc,M,48,W-M,48,C.gold,0.8);

  txt(doc,"TABLEAU DE BORD",W/2,82,28,C.white,"center",true);
  txt(doc,"Rapport complet — Synthèse tenant",W/2,92,12,C.gold,"center");

  fr(doc,W/2-52,102,104,17,C.steel);
  txt(doc,data.tenantName.toUpperCase(),W/2,112,11,C.white,"center",true);
  txt(doc,`Période : ${data.period}`,W/2,130,10,C.gray,"center");
  txt(doc,`Généré le ${fmtDate(new Date().toISOString())}`,W/2,138,9,[100,116,139],"center");

  // 4 KPI blocks couverture (mêmes dégradés que page 2)
  const bw=(IW-9)/4;
  [
    {l:"Agences",      v:String(data.kpis.agences),   s:"actives",       c1:C.navy,                              c2:C.steel},
    {l:"CAFs",         v:String(data.kpis.cafs),      s:"agents terrain",c1:C.steel,                             c2:[22,76,115] as [number,number,number]},
    {l:"Clients",      v:String(data.kpis.clients),   s:"portefeuille",  c1:C.gold,                              c2:C.goldDark},
    {l:"Localisations",v:String(data.kpis.locations), s:"GPS capturées", c1:[5,101,70] as [number,number,number], c2:C.green},
  ].forEach((k,i)=>{
    kpiBlock(doc,M+i*(bw+3),157,bw,30,k.l,k.v,k.s,k.c1,k.c2);
  });

  // Tickets band
  const totalTix = data.ticketsByStatus.reduce((a,t)=>a+t.count,0);
  fr(doc,M,197,IW,22,[28,52,78]);
  txt(doc,"Tickets support",M+3,206,8,C.gray);
  txt(doc,`${totalTix} au total`,M+3,212,9.5,C.white,"left",true);
  let tx=W/2;
  data.ticketsByStatus.slice(0,4).forEach(t=>{
    txt(doc,`${statusLabel(t.status)}: ${t.count}`,tx,206,7.5,C.gray);
    tx+=36;
  });

  txt(doc,"CONFIDENTIEL — Usage interne uniquement",W/2,H-12,8,[80,100,120],"center");

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — KPIs DÉTAIL + MÉTRIQUES DÉRIVÉES
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","KPIs","Page 2",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  let y=22;

  y = secHdr(doc,"Indicateurs clés du tenant",y,W);

  const mbw=(IW-9)/4;
  const mbh=34; // hauteur des blocs (comme la page web)

  // ── Rangée 1 : KPIs principaux (même dégradés que le web) ──────────────────
  const row1=[
    {l:"Agences",      v:String(data.kpis.agences),   s:"agences enregistrées", c1:C.navy,              c2:C.steel},
    {l:"CAFs",         v:String(data.kpis.cafs),      s:"agents de terrain",    c1:C.steel,             c2:[22,76,115] as [number,number,number]},
    {l:"Clients",      v:String(data.kpis.clients),   s:"portefeuille clients", c1:C.gold,              c2:C.goldDark},
    {l:"Localisations",v:String(data.kpis.locations), s:"positions GPS",        c1:[5,101,70] as [number,number,number], c2:C.green},
  ];
  row1.forEach((k,i)=>{ kpiBlock(doc,M+i*(mbw+3),y,mbw,mbh,k.l,k.v,k.s,k.c1,k.c2); });
  y+=mbh+6;

  // ── Rangée 2 : Métriques dérivées ──────────────────────────────────────────
  if(data.derivedKpis){
    const dk=data.derivedKpis;
    const txR = dk.tauxResolution;
    const row2=[
      { l:"Taux résolution",   v:`${txR}%`,             s:"tickets résolus+fermés",
        c1: txR>=70?[4,78,56]  as [number,number,number]:txR>=40?[120,53,15] as [number,number,number]:[127,29,29] as [number,number,number],
        c2: txR>=70?C.green:txR>=40?C.orange:C.red },
      { l:"Moy. clients/ag.",  v:String(dk.moyenneClients), s:"clients par agence",   c1:C.navy,               c2:C.steel },
      { l:"Ag. sans CAF",      v:String(dk.agencesSansCaf), s:"non couvertes",
        c1: dk.agencesSansCaf>0?[120,53,15] as [number,number,number]:[4,78,56] as [number,number,number],
        c2: dk.agencesSansCaf>0?C.orange:C.green },
      { l:"Utilisateurs",      v:String(dk.totalUsers),     s:"rattachés agences",    c1:[59,7,100] as [number,number,number], c2:C.violet },
    ];
    row2.forEach((k,i)=>{ kpiBlock(doc,M+i*(mbw+3),y,mbw,mbh,k.l,k.v,k.s,k.c1,k.c2); });
    y+=mbh+6;

    // Bandeau tendance (couleur pleine + texte blanc)
    const tPos=dk.tendance>=0;
    const tCol:([number,number,number])=tPos?[4,78,56]:[127,29,29];
    const tCol2:([number,number,number])=tPos?C.green:C.red;
    fr(doc,M,y,IW,11,tCol);
    hline(doc,M,y,W-M,y,tCol2,0.8);
    hline(doc,M,y+11,W-M,y+11,tCol2,0.8);
    const sign=dk.tendance>0?"+":"";
    txt(doc,`Tendance activité : ${sign}${dk.tendance}% sur la 2ème moitié de la période`,
        M+4,y+7.5,8,C.white,"left",true);
    y+=17;
  }

  // Tickets table
  y=secHdr(doc,"Résumé tickets par statut",y,W);
  const tRows=data.ticketsByStatus.map(t=>[statusLabel(t.status),String(t.count),
    totalTix>0?`${Math.round(t.count/totalTix*100)}%`:"0%"]);
  y=simpleTable(doc,["Statut","Nombre","Part (%)"],tRows.length?tRows:[["—","—","—"]],y,[80,40,68],W,H);

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — GRAPHIQUE : ACTIVITÉ JOURNALIÈRE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","ACTIVITÉ / JOUR","Page 3",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  y=secHdr(doc,`Activité journalière — ${data.period}`,y,W);
  txt(doc,"Nombre d'événements enregistrés par jour sur la période sélectionnée.",M,y,8,C.gray);
  y+=6;

  if(data.activityByDay.length>0){
    const barData=data.activityByDay.map(d=>({label:d.date.slice(5),value:d.count}));
    // full-width bar chart
    drawBarChart(doc,barData,M+12,y+8,IW-14,80,C.steel);
    y+=105;

    // Stat summary band
    const total=data.activityByDay.reduce((a,d)=>a+d.count,0);
    const avg=Math.round(total/data.activityByDay.length);
    const mx=Math.max(...data.activityByDay.map(d=>d.count));
    const mn=Math.min(...data.activityByDay.map(d=>d.count));
    const cols=[C.navy,C.steel,C.gold,C.green];
    [{l:"Total événements",v:String(total)},{l:"Moyenne/jour",v:String(avg)},
     {l:"Pic maximum",v:String(mx)},{l:"Minimum",v:String(mn)}].forEach((s,i)=>{
      const bx=M+i*(IW/4);
      fr(doc,bx,y,IW/4-2,16,cols[i]);
      txt(doc,s.v,bx+(IW/4-2)/2,y+8,11,C.white,"center",true);
      txt(doc,s.l,bx+(IW/4-2)/2,y+13.5,6,[200,220,240],"center");
    });
    y+=22;
  } else {
    txt(doc,"Aucune donnée disponible pour cette période.",M,y+10,9,C.gray);
    y+=20;
  }

  // Line chart: tendance + moyenne mobile
  y=secHdr(doc,"Tendance vs moyenne mobile",y,W);
  txt(doc,"Comparaison événements journaliers (trait plein) et moyenne mobile cumulée (pointillés).",M,y,8,C.gray);
  y+=6;
  if(data.activityByDay.length>1){
    const vals=data.activityByDay.map(d=>d.count);
    const moy=vals.map((_,i)=>Math.round(vals.slice(0,i+1).reduce((a,v)=>a+v,0)/(i+1)));
    const lbls=data.activityByDay.map(d=>d.date.slice(5));
    drawLineChart(doc,[
      {label:"Événements/jour",col:C.navy,data:vals},
      {label:"Moyenne mobile",  col:C.gold, data:moy},
    ],lbls,M+12,y+8,IW-14,65);
    y+=85;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 4 — GRAPHIQUE : TICKETS PAR STATUT (PIE) + LOGS PAR ACTION (BAR)
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","TICKETS & ACTIONS","Page 4",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  // Left: Pie donut tickets
  y=secHdr(doc,"Tickets par statut — diagramme",y,W);
  const halfW=IW/2-4;
  if(data.ticketsByStatus.length>0){
    const pieData=data.ticketsByStatus.map(t=>({label:t.status,value:t.count}));
    const cx=M+halfW/2, cy=y+42;
    drawPieDonut(doc,pieData,cx,cy,36,16,M+halfW+8,y+6,statusLabel);
    y+=90;
  } else {
    txt(doc,"Aucun ticket.",M,y+10,9,C.gray); y+=20;
  }

  // Progress bars résolution
  if(data.ticketBreakdown&&data.ticketBreakdown.length>0){
    y=secHdr(doc,"Taux de résolution détaillé",y,W);
    const statusColors:Record<string,[number,number,number]>={
      "Ouvert":C.red,"En cours":C.orange,"Résolu":C.green,"Fermé":C.navy,
    };
    const pbData=data.ticketBreakdown.map(t=>({
      label:t.status, pct:t.pct, count:t.count,
      col:statusColors[t.status]??C.steel,
    }));
    drawProgressBars(doc,pbData,M,y,IW);
    y+=pbData.length*10+8;
  }

  // Bar chart: logs par action
  if(data.activityByAction&&data.activityByAction.length>0){
    y=secHdr(doc,"Événements par type d'action",y,W);
    txt(doc,"Distribution des actions enregistrées dans les logs d'activité.",M,y,8,C.gray); y+=6;
    const actData=data.activityByAction.map((a,i)=>({label:a.action,value:a.count}));
    drawBarChart(doc,actData,M+12,y+8,IW-14,65,C.navy);
    // color each bar differently
    y+=90;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 5 — GRAPHIQUE : CLIENTS PAR AGENCE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","CLIENTS","Page 5",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  y=secHdr(doc,"Distribution clients par agence",y,W);
  txt(doc,"Classement des agences par nombre de clients — top 12.",M,y,8,C.gray); y+=6;
  if(data.clientsByAgency.length>0){
    const horizData=data.clientsByAgency.slice(0,12).map(c=>({
      label:String(c.agence??"—"),value:Number(c.total_clients),
    }));
    drawHorizBar(doc,horizData,M+52,y+4,IW-56,C.steel);
    y+=horizData.length*7+12;
  } else {
    txt(doc,"Aucune donnée.",M,y+8,9,C.gray); y+=16;
  }

  // Table clients par agence
  y=secHdr(doc,"Tableau clients par agence",y,W);
  const totalCli=data.clientsByAgency.reduce((a,c)=>a+Number(c.total_clients),0)||1;
  const cRows=data.clientsByAgency.slice(0,20).map((c,i)=>[
    String(i+1),String(c.agence??"—"),String(Number(c.total_clients)),
    `${Math.round(Number(c.total_clients)/totalCli*100)}%`,
  ]);
  y=simpleTable(doc,["#","Agence","Clients","Part (%)"],cRows.length?cRows:[["—","—","—","—"]],y,[10,90,40,46],W,H);

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 6 — GRAPHIQUE : RESSOURCES HUMAINES PAR AGENCE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","RESSOURCES","Page 6",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  if(data.cafsByAgence&&data.cafsByAgence.length>0){
    y=secHdr(doc,"CAFs, Utilisateurs & Clients par agence",y,W);
    txt(doc,"Histogramme groupé : répartition des ressources humaines et clients par agence.",M,y,8,C.gray); y+=10;
    const grData=data.cafsByAgence.slice(0,10).map(a=>({
      label:a.agence, a:a.CAFs, b:a.Utilisateurs, c:a.Clients,
    }));
    drawGroupedBar(doc,grData,M+12,y+10,IW-14,75,
      ["CAFs","Utilisateurs","Clients"],
      [C.violet,C.gold,C.steel]);
    y+=100;

    // Table
    y=secHdr(doc,"Tableau ressources par agence",y,W);
    const rRows=data.cafsByAgence.map(a=>[a.agence,String(a.CAFs),String(a.Utilisateurs),String(a.Clients)]);
    y=simpleTable(doc,["Agence","CAFs","Utilisateurs","Clients"],rRows,y,[70,32,40,44],W,H);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 7 — GRAPHIQUE : ZONES + AGENCES STATS TABLE
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","ZONES","Page 7",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  if(data.agencesByZone&&data.agencesByZone.length>0){
    y=secHdr(doc,"Répartition des agences par zone géographique",y,W);
    txt(doc,"Diagramme en anneau — chaque secteur représente une zone.",M,y,8,C.gray); y+=4;

    const zoneTotal=data.agencesByZone.reduce((a,z)=>a+z.count,0);
    const zPieData=data.agencesByZone.map(z=>({label:z.zone,value:z.count}));
    const zcx=M+45, zcy=y+50;
    drawPieDonut(doc,zPieData,zcx,zcy,40,17,M+100,y+6);
    y+=105;

    // Zone table
    y=secHdr(doc,"Tableau zones",y,W);
    const zRows=data.agencesByZone.map(z=>[z.zone,String(z.count),
      `${Math.round(z.count/zoneTotal*100)}%`]);
    y=simpleTable(doc,["Zone","Agences","Part (%)"],zRows,y,[110,34,42],W,H);
  }

  // Agences détail
  if(data.agenceStats.length>0){
    y=secHdr(doc,"Fiche détaillée par agence",y,W);
    const agRows=data.agenceStats.map(a=>[a.code,a.name,a.zoneName??"—",
      String(a.nbClients),String(a.nbCafs),String(a.nbUsers)]);
    y=simpleTable(doc,["Code","Nom agence","Zone","Clients","CAFs","Users"],agRows,y,[20,52,38,18,14,26],W,H);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 8 — LOGS D'ACTIVITÉ RÉCENTS
  // ══════════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHdrKit(doc,"TABLEAU DE BORD","LOGS RÉCENTS","Page 8",data.tenantName,W);
  pageFtr(doc,data.tenantName,data.period,W,H);
  y=22;

  y=secHdr(doc,"Derniers événements d'activité",y,W);
  const lRows=data.recentLogs.slice(0,40).map(l=>[
    fmtDate(l.created_at), l.action,
    (l.description??"").slice(0,32),
    l.userName??"—",
  ]);
  y=simpleTable(doc,["Date","Action","Description","Utilisateur"],
    lRows.length?lRows:[["—","—","—","—"]],y,[38,28,70,50],W,H);

  // ══════════════════════════════════════════════════════════════════════════════
  // NUMÉROTATION + FOOTER sur toutes les pages
  // ══════════════════════════════════════════════════════════════════════════════
  finalizePageNumbers(doc, W, H, M);

  const slug=data.tenantName.toLowerCase().replace(/\s+/g,"-");
  doc.save(`rapport-${slug}-${new Date().toISOString().slice(0,10)}.pdf`);
}

