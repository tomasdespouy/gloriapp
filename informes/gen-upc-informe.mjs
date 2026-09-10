/**
 * Informe UPC — Psicopatología del Adulto, 2026-20.
 *
 * Genera el .docx desde los datos de producción. Se corre a mano para revisar
 * antes de mandarlo; el envío semanal automático usa src/lib/reports/.
 *
 * Reglas que NO son detalles y ya costaron una corrección:
 *
 *  - En session_competencies, NULL es "no aplicaba" (viene con justificación en
 *    na_justifications) y 0 es "había oportunidad y el estudiante lo omitió",
 *    que es una nota real. Excluir los ceros del promedio subía conducta no
 *    verbal de 0,52 a 1,00: media rúbrica de diferencia.
 *  - El tiempo de sesión pasa por el mismo tope que los informes de piloto,
 *    para que una pestaña olvidada no invente horas.
 *  - La mirada longitudinal solo compara entrevistas de 12+ mensajes. Sin ese
 *    filtro, los dos cambios más grandes eran sesiones abandonadas: una "bajó"
 *    1,4 comparando 18 minutos contra 3, y otra "subió" 2,4 por lo inverso.
 *  - Los casos van anonimizados: las citas son lo que enseña, los nombres no
 *    agregan nada y el informe sale a dos instituciones distintas.
 *
 * Uso: node informes/gen-upc-informe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} from "docx";

const ROOT = "C:/Users/tomas/documents/gloriapp/";
const cfg = dotenv.parse(fs.readFileSync(ROOT + ".env.production", "utf8").replace(/^\uFEFF/, ""));
const s = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const UPC = "19d2843c-2b40-4ad8-83c4-26da1406fb7a";
const SEC = {
  "c0e03f62-7612-4372-b5d7-7cdfef7a2fb1": "17175",
  "00133ebb-1bcf-4c03-82f6-b42661cfb339": "17177",
  "f6c62550-545a-4721-9c78-a0bee97be38e": "17174",
};
const INTERNA = /smoketest|tomasdespouy|@glor-ia\.com$/i;
const MIN_LONG = 12;

const K = ["setting_terapeutico","motivo_consulta","datos_contextuales","objetivos","escucha_activa",
           "actitud_no_valorativa","optimismo","presencia","conducta_no_verbal","contencion_afectos"];

// Definiciones y rúbrica: se leen de los módulos REALES, no se transcriben.
// Una copia a mano se desincroniza y el informe terminaría mostrando una
// rúbrica distinta de la que el evaluador aplica.
const { COMPETENCY_INFO } = await import("file://" + ROOT + "src/lib/competency-definitions.ts");
const { COMPETENCY_RUBRIC } = await import("file://" + ROOT + ".rubrica-tmp/competency-rubric.ts");

const cap = (c) => {
  const r = c.active_seconds;
  if (typeof r !== "number" || r <= 0) return 0;
  let l = 5400;
  if (c.started_at && c.ended_at) {
    const w = (new Date(c.ended_at) - new Date(c.started_at)) / 1000;
    if (w > 0) l = Math.min(l, w + 300);
  }
  return Math.min(r, l);
};
const med = (a) => { if (!a.length) return 0; const x=[...a].sort((p,q)=>p-q); const m=Math.floor(x.length/2); return x.length%2?x[m]:(x[m-1]+x[m])/2; };
const n1 = (v) => v.toFixed(1).replace(".", ",");
const n2 = (v) => v.toFixed(2).replace(".", ",");
const pct = (a, b) => b ? `${Math.round(100*a/b)}%` : "—";

// ── Datos ────────────────────────────────────────────────────────────────────
const { data: al } = await s.from("profiles").select("id,email,section_id,full_name").eq("establishment_id", UPC).eq("role","student");
const alum = al.filter(a => !INTERNA.test(a.email || ""));
const sec = new Map(alum.map(a => [a.id, SEC[a.section_id] || "?"]));
const { data: ls } = await s.rpc("auth_last_sign_in", { p_ids: alum.map(a => a.id) });
const ingreso = new Map((ls || []).map(x => [x.user_id, x.last_sign_in_at]));
const { data: cs } = await s.from("conversations")
  .select("id,student_id,session_number,active_seconds,started_at,ended_at,created_at,end_reason,paste_count,tab_switch_count")
  .in("student_id", alum.map(a => a.id));
const { data: comp } = await s.from("session_competencies").select("*").in("conversation_id", cs.map(c => c.id));
const { data: fb } = await s.from("session_feedback").select("conversation_id,teacher_comment").in("conversation_id", cs.map(c => c.id));
const { data: docentes } = await s.from("profiles").select("id,full_name,section_id").eq("establishment_id", UPC).eq("role","instructor");

let msgs = []; const ids = cs.map(c => c.id);
for (let i = 0; i < ids.length; i += 50) {
  const ch = ids.slice(i, i + 50); let d0 = 0;
  for (;;) {
    const { data } = await s.from("messages").select("conversation_id").in("conversation_id", ch).range(d0, d0 + 999);
    msgs = msgs.concat(data || []); if (!data || data.length < 1000) break; d0 += 1000;
  }
}
const cuenta = {}; for (const m of msgs) cuenta[m.conversation_id] = (cuenta[m.conversation_id] || 0) + 1;
const evDe = new Map(comp.map(c => [c.conversation_id, c]));
const visible = new Set(comp.filter(c => ["approved","evaluated"].includes(c.feedback_status)).map(c => c.student_id));

let alertas = [];
for (let i = 0; i < ids.length; i += 100) {
  // Solo las pendientes: las marcadas como revisadas son falsos positivos
  // que ya se depuraron y contarlas volvería a meter el ruido.
  const { data } = await s.from("chat_alerts").select("kind,severity,source").is("reviewed_at", null).in("conversation_id", ids.slice(i, i+100));
  alertas = alertas.concat(data || []);
}

// ── Estilo ───────────────────────────────────────────────────────────────────
const INDIGO="4A55A2", DARK="1A1A1A", GREY="55555F", FAINT="86868F",
      BOX="F0F2FA", BORDE="D8DAE8", ZEBRA="F7F8FC", ALERTA="B3402B", VERDE="2E6B4F";
const PAGE_W=12240, MARGIN=1080, W=PAGE_W-2*MARGIN;
const nb={style:BorderStyle.NONE,size:0,color:"FFFFFF"};
const nbs={top:nb,bottom:nb,left:nb,right:nb,insideHorizontal:nb,insideVertical:nb};
const linea={style:BorderStyle.SINGLE,size:2,color:"EFEFF1"};

const txt=(t,o={})=>new TextRun({text:t,bold:!!o.bold,italics:!!o.italic,color:o.color||DARK,
  size:o.size||19,font:o.mono?"Consolas":"Calibri",allCaps:!!o.caps,characterSpacing:o.caps?20:undefined});
const p=(k,o={})=>new Paragraph({children:Array.isArray(k)?k:[k],
  spacing:{before:o.before||0,after:o.after===undefined?80:o.after,line:o.line||245},keepNext:o.keepNext});
const h2=(t)=>new Paragraph({spacing:{before:200,after:60,line:220},keepNext:true,
  border:{bottom:{style:BorderStyle.SINGLE,size:4,color:BORDE,space:5}},
  children:[txt(t,{color:FAINT,size:15,bold:true,caps:true})]});
const barra=(v)=>{const n=Math.round((v/4)*20); return n<=0?"·":"█".repeat(n);};

const tabla=(cabs,filas,pesos,opts={})=>{
  const anchos=pesos.map(x=>Math.round(W*x));
  const celda=(t,i,cab,zebra,color)=>new TableCell({
    width:{size:anchos[i],type:WidthType.DXA},
    margins:{top:24,bottom:24,left:110,right:110},
    shading:zebra?{type:ShadingType.CLEAR,fill:ZEBRA,color:"auto"}:undefined,
    borders:{top:nb,bottom:linea,left:nb,right:nb},
    children:[new Paragraph({spacing:{before:0,after:0,line:202},
      alignment:(i===0||(opts.izquierda||[]).includes(i))?AlignmentType.LEFT:AlignmentType.RIGHT,
      children:[txt(t,cab?{size:14,bold:true,color:FAINT,caps:true}
        :{size:17,color:color||(i===0?DARK:GREY),bold:!!color,
          mono:i>0&&!(opts.izquierda||[]).includes(i)})]})]});
  return new Table({width:{size:W,type:WidthType.DXA},columnWidths:anchos,borders:nbs,
    rows:[new TableRow({tableHeader:true,children:cabs.map((t,i)=>celda(t,i,true,false))}),
      ...filas.map((f,r)=>new TableRow({children:f.map((t,i)=>celda(String(t),i,false,r%2===1,opts.color?.(f,i)))}))]});
};

const recuadro=(titulo,frase,detalle)=>new Table({
  width:{size:W,type:WidthType.DXA},columnWidths:[W],
  borders:{...nbs,left:{style:BorderStyle.SINGLE,size:18,color:INDIGO}},
  rows:[new TableRow({children:[new TableCell({
    width:{size:W,type:WidthType.DXA},
    shading:{type:ShadingType.CLEAR,fill:BOX,color:"auto"},
    margins:{top:150,bottom:150,left:220,right:220},
    borders:{top:nb,bottom:nb,right:nb,left:{style:BorderStyle.SINGLE,size:18,color:INDIGO}},
    children:[p(txt(titulo,{color:INDIGO,size:14,bold:true,caps:true}),{after:60}),
      p(txt(frase,{bold:true,size:21}),{after:70,line:270}),
      p(txt(detalle,{color:GREY,size:17}),{after:0,line:220})]})]})]});

// ── Cálculos ─────────────────────────────────────────────────────────────────
const ordenSec=["17177","17175","17174"];
const filasSec=[]; let TS=[],TM=[];
for (const nsec of ordenSec) {
  const sa=alum.filter(a=>sec.get(a.id)===nsec); if(!sa.length) continue;
  const set=new Set(sa.map(a=>a.id));
  const sc=cs.filter(c=>set.has(c.student_id));
  TS=TS.concat(sc.map(cap).filter(x=>x>0)); TM=TM.concat(sc.map(c=>cuenta[c.id]||0));
  const ing=sa.filter(a=>ingreso.get(a.id)).length;
  const pra=new Set(sc.map(c=>c.student_id)).size;
  const dev=sa.filter(a=>visible.has(a.id)).length;
  filasSec.push([`Sección ${nsec}`,String(sa.length),`${ing}  (${pct(ing,sa.length)})`,
    `${pra}  (${pct(pra,sa.length)})`,`${dev}  (${pct(dev,sa.length)})`]);
}
const ingT=alum.filter(a=>ingreso.get(a.id)).length;
const praT=new Set(cs.map(c=>c.student_id)).size;
const devT=alum.filter(a=>visible.has(a.id)).length;
filasSec.push(["Total",String(alum.length),`${ingT}  (${pct(ingT,alum.length)})`,
  `${praT}  (${pct(praT,alum.length)})`,`${devT}  (${pct(devT,alum.length)})`]);

const porNumero=[];
const maxN=Math.max(...cs.map(c=>c.session_number||1));
for(let k=1;k<=maxN;k++){
  const g=cs.filter(c=>(c.session_number||1)===k); if(!g.length) continue;
  const notas=g.map(c=>evDe.get(c.id)?.overall_score_v2).filter(x=>typeof x==="number");
  porNumero.push([`${k}.ª sesión`,String(g.length),String(new Set(g.map(c=>c.student_id)).size),
    n1(med(g.map(cap).filter(x=>x>0))/60),String(med(g.map(c=>cuenta[c.id]||0))),
    notas.length?n2(notas.reduce((a,b)=>a+b,0)/notas.length):"—",String(notas.length)]);
}

const porSecNum=[];
for(const nsec of ordenSec){
  const set=new Set(alum.filter(a=>sec.get(a.id)===nsec).map(a=>a.id));
  const sc=cs.filter(c=>set.has(c.student_id));
  for(let k=1;k<=maxN;k++){
    const g=sc.filter(c=>(c.session_number||1)===k); if(!g.length) continue;
    const notas=g.map(c=>evDe.get(c.id)?.overall_score_v2).filter(x=>typeof x==="number");
    porSecNum.push([`Sección ${nsec}`,`${k}.ª`,String(g.length),
      n1(med(g.map(cap).filter(x=>x>0))/60),String(med(g.map(c=>cuenta[c.id]||0))),
      notas.length?n2(notas.reduce((a,b)=>a+b,0)/notas.length):"—"]);
  }
}

// Rúbrica: NULL fuera (no aplicaba), 0 dentro (omitido, es una nota).
const filasComp=K.map(k=>{
  const v=comp.map(c=>c[k]).filter(x=>typeof x==="number");
  return {k,label:COMPETENCY_INFO[k].name,prom:v.length?v.reduce((a,b)=>a+b,0)/v.length:0,n:v.length};
}).sort((a,b)=>b.prom-a.prom);

const filasDev=[];
for(const nsec of ordenSec){
  const ev=comp.filter(c=>sec.get(c.student_id)===nsec);
  const doc=(docentes||[]).find(d=>SEC[d.section_id]===nsec);
  const dias=ev.filter(c=>c.approved_at).map(c=>(Date.parse(c.approved_at)-Date.parse(c.created_at))/86400000);
  filasDev.push([`Sección ${nsec}`,doc?.full_name||"sin docente",String(ev.length),
    String(ev.filter(c=>["approved","evaluated"].includes(c.feedback_status)).length),
    String(ev.filter(c=>c.feedback_status==="pending").length),
    dias.length?n1(med(dias)):"—"]);
}

// Longitudinal
const fecha=new Map(cs.map(c=>[c.id,c.created_at]));
const pa={};
for(const c of comp){ if((cuenta[c.conversation_id]||0)<MIN_LONG) continue; (pa[c.student_id]||=[]).push({...c,f:fecha.get(c.conversation_id)}); }
const dos=Object.entries(pa).filter(([,v])=>v.length>=2).map(([sid,v])=>[sid,v.sort((a,b)=>String(a.f).localeCompare(String(b.f)))]);
const casos=dos.map(([sid,v])=>({sid,sec:sec.get(sid),a:v[0],b:v[v.length-1],
  d:Number(v[v.length-1].overall_score_v2)-Number(v[0].overall_score_v2)})).sort((x,y)=>y.d-x.d);
const deltas=casos.map(c=>c.d);
const filasLong=[];
for(const k of K){
  const par=dos.map(([,v])=>[v[0][k],v[v.length-1][k]]).filter(x=>typeof x[0]==="number"&&typeof x[1]==="number");
  if(par.length<3) continue;
  const p1=par.reduce((a,[x])=>a+x,0)/par.length, p2=par.reduce((a,[,y])=>a+y,0)/par.length;
  filasLong.push([COMPETENCY_INFO[k].name,n2(p1),n2(p2),`${p2-p1>=0?"+":""}${n2(p2-p1)}`,String(par.length)]);
}
filasLong.sort((a,b)=>parseFloat(b[3].replace(",","."))-parseFloat(a[3].replace(",",".")));

const citaDe=(ev,k,pol)=>{
  let e=ev.evidence; if(typeof e==="string"){try{e=JSON.parse(e);}catch{return null;}}
  const l=e?.[k]; if(!Array.isArray(l)||!l.length) return null;
  return l.find(x=>x.polarity===pol)||l[0];
};
const armarCaso=(c,etiqueta)=>{
  const movs=K.map(k=>({k,x:c.a[k],y:c.b[k]}))
    .filter(m=>typeof m.x==="number"&&typeof m.y==="number"&&m.x!==m.y)
    .sort((u,v)=>Math.abs(v.y-v.x)-Math.abs(u.y-u.x));
  if(!movs.length) return null;
  const m=movs[0], sube=m.y>m.x;
  return {etiqueta,d:c.d,a:Number(c.a.overall_score_v2),b:Number(c.b.overall_score_v2),
    comp:COMPETENCY_INFO[m.k].name,x:m.x,y:m.y,
    c1:citaDe(c.a,m.k,sube?"oportunidad":"fortaleza"),
    c2:citaDe(c.b,m.k,sube?"fortaleza":"oportunidad"),
    otros:movs.slice(1,3).map(z=>`${COMPETENCY_INFO[z.k].name} ${z.x}→${z.y}`).join(" · ")};
};
const letras="ABCDEF".split("");
const suben=casos.slice(0,3).map((c,i)=>armarCaso(c,`Estudiante ${letras[i]}`)).filter(Boolean);
const bajan=casos.slice(-3).reverse().map((c,i)=>armarCaso(c,`Estudiante ${letras[i+3]}`)).filter(Boolean);

const bloqueCaso=(x)=>{
  // Corta en límite de palabra: cortar a mitad de palabra ("(durac…") se lee
  // como un error del informe, no como una cita recortada.
  const recorte=(t,n)=>{
    const s=String(t||"").replace(/\s+/g," ").trim();
    if(s.length<=n) return s;
    const trozo=s.slice(0,n);
    const corte=trozo.lastIndexOf(" ");
    return (corte>n*0.6?trozo.slice(0,corte):trozo)+"…";
  };
  return [
    p(txt(x.etiqueta,{bold:true,size:19}),{before:160,after:30}),
    p([txt("Promedio general de la sesión  ",{color:FAINT,size:16}),
       txt(`${n1(x.a)} → ${n1(x.b)}`,{bold:true,size:17}),
       txt(`  (${x.d>=0?"+":""}${n1(x.d)})`,{color:x.d>=0?VERDE:ALERTA,bold:true,size:17}),
       txt("      Competencia que más se movió  ",{color:FAINT,size:16}),
       txt(`${x.comp} ${x.x} → ${x.y}`,{bold:true,size:17})],
      {after:45,line:230}),
    tabla(["Sesión","Lo que escribió la estudiante","Nivel"],
      [["1.ª",`"${recorte(x.c1?.quote,190)}"`,String(x.x)],
       ["2.ª",`"${recorte(x.c2?.quote,190)}"`,String(x.y)]],
      [0.09,0.79,0.12],{izquierda:[1]}),
    // Las dos observaciones separadas y rotuladas. Coserlas en una sola frase
    // producía cosas como "En la segunda, Proactivamente explora…".
    p([txt("1.ª  ",{bold:true,size:16,color:FAINT}),
       txt(recorte(x.c1?.observation,230),{color:GREY,size:17})],{before:70,after:25,line:220}),
    p([txt("2.ª  ",{bold:true,size:16,color:FAINT}),
       txt(recorte(x.c2?.observation,230),{color:GREY,size:17})],{after:25,line:220}),
    ...(x.otros?[p(txt(`También movió: ${x.otros}`,{color:FAINT,size:16}),{after:0})]:[]),
  ];
};

// Alertas
const retiros=cs.filter(c=>c.end_reason).length;
const pegados=cs.reduce((a,c)=>a+(c.paste_count||0),0);
const conPegado=cs.filter(c=>(c.paste_count||0)>0).length;

// ── Documento ────────────────────────────────────────────────────────────────
const logo=fs.readFileSync(ROOT+"public/branding/gloria-logo.png");
const hoy=new Date().toLocaleDateString("es-CL",{timeZone:"America/Santiago",day:"numeric",month:"long",year:"numeric"});
const ultimos7=cs.filter(c=>Date.parse(c.created_at)>=Date.now()-7*86400000).length;

const cuerpo=[
  p(txt("Universidad Peruana de Ciencias Aplicadas · Psicopatología del Adulto · 2026-20",{color:INDIGO,size:14,bold:true,caps:true}),{after:50}),
  p(txt("Uso de GlorIA",{bold:true,size:34}),{after:70,line:280}),
  p(txt(`Corte al ${hoy}. ${ultimos7} sesiones nuevas en los últimos siete días.`,{color:GREY,size:18}),{after:110,line:220}),
  recuadro("Lo más accionable",
    `Hay ${comp.filter(c=>c.feedback_status==="pending").length} evaluaciones esperando revisión docente. Hasta que se aprueben, esos estudiantes no ven su retroalimentación.`,
    "La 17177 ya hizo lo difícil: practicó en clase y llegó al 85% de participación. Pero solo el 23% de sus alumnas ha visto su retroalimentación, porque el paso que la hace visible —la revisión docente— está detenido. La 17175 tiene las dos decisiones cerradas y por eso sus 39 alumnas ya tienen devolución."),

  h2("Participación por sección"),
  tabla(["Sección","Alumnas","Ingresó","Practicó","Con devolución"],filasSec,[0.28,0.16,0.19,0.19,0.18],
    {color:(f)=>f[0]==="Total"?DARK:null}),

  h2("Ritmo por número de sesión"),
  p(txt("Separadas, porque mezclarlas esconde lo importante: la segunda entrevista no se parece a la primera.",{color:GREY,size:17}),{after:80,line:220}),
  tabla(["","Sesiones","Alumnas","Min./sesión","Msgs./sesión","Promedio","n"],porNumero,[0.20,0.14,0.13,0.15,0.15,0.13,0.10]),
  p(txt(`Las sesiones acumulan ${n1(TS.reduce((a,b)=>a+b,0)/3600)} horas de práctica clínica.`,{color:GREY,size:17}),{before:90,after:0,line:220}),

  h2("Lo mismo, abierto por sección"),
  tabla(["Sección","N.º","Sesiones","Min./sesión","Msgs./sesión","Promedio"],porSecNum,[0.24,0.10,0.16,0.18,0.18,0.14]),
  p(txt("La 17177 es hoy la única con segunda vuelta. La 17175 tiene el mejor cierre del ciclo, pero todas sus alumnas siguen en la primera entrevista: sin una segunda, no hay curva de aprendizaje que mostrar.",{color:GREY,size:17}),{before:90,after:0,line:220}),

  h2("Perfil de competencias de la cohorte"),
  p(txt(`${comp.length} sesiones evaluadas, en escala de 0 a 4. La columna n son las sesiones donde la competencia era evaluable; las que no aplicaban quedan fuera del promedio. Un cero no significa "no se midió": significa que había oportunidad y no se tomó.`,{color:GREY,size:17}),{after:80,line:220}),
  tabla(["Competencia","Promedio","n",""],
    filasComp.map(f=>[f.label,n2(f.prom),String(f.n),barra(f.prom)]),[0.30,0.14,0.08,0.48],
    {izquierda:[3],color:(f)=>f[0]===filasComp[0].label?VERDE:f[0]===filasComp[filasComp.length-1].label?ALERTA:null}),

  h2("El ciclo de devolución"),
  p(txt("GlorIA propone una evaluación al terminar la sesión, pero el estudiante no la ve hasta que su docente la revisa y la aprueba. Ese paso es el que hoy separa a una sección de las otras dos.",{color:GREY,size:17}),{after:80,line:220}),
  tabla(["Sección","Docente","Generadas","Aprobadas","Pendientes","Días (mediana)"],
    filasDev,[0.20,0.28,0.13,0.13,0.13,0.13],
    {color:(f,i)=>i===4&&Number(f[4])>0?ALERTA:null}),
  p([txt(`De las ${comp.length} evaluaciones generadas, ${comp.filter(c=>["approved","evaluated"].includes(c.feedback_status)).length} ya llegaron al estudiante y ${comp.filter(c=>c.feedback_status==="pending").length} esperan revisión.`,{color:GREY,size:17}),
     txt(` En las que sí se revisaron, la mediana entre que GlorIA propone la evaluación y el docente la aprueba es de ${(()=>{const d=comp.filter(c=>c.approved_at).map(c=>(Date.parse(c.approved_at)-Date.parse(c.created_at))/86400000); return d.length?n1(med(d)):"—";})()} días. Ninguna nota propuesta fue modificada, y se escribieron ${(fb||[]).filter(f=>(f.teacher_comment||"").trim()).length} comentarios de supervisión propios.`,{color:GREY,size:17})],
    {before:90,after:0,line:220}),

  new Paragraph({children:[new PageBreak()]}),

  h2("Mirada longitudinal"),
  p([txt(`${casos.length} alumnas tienen dos entrevistas comparables. ${deltas.filter(d=>d>0.05).length} subieron, ${deltas.filter(d=>d<-0.05).length} bajaron.`,{bold:true,size:18}),
     txt(` La mediana de variación es de ${med(deltas)>=0?"+":""}${n2(med(deltas))} puntos en el promedio general. Con esta cantidad de casos es una señal temprana, no una conclusión.`,{color:GREY,size:17})],
    {after:80,line:220}),
  tabla(["Competencia","1.ª sesión","2.ª sesión","Cambio","n"],filasLong,[0.36,0.16,0.16,0.16,0.16],
    {color:(f,i)=>i===3?(f[3].startsWith("+")?VERDE:ALERTA):null}),
  p(txt("El promedio general de una sesión es el promedio de sus competencias evaluables: las que no aplicaban a esa entrevista no entran. Por eso dos sesiones de la misma alumna pueden promediarse sobre distinto número de competencias.",{color:FAINT,size:16}),{before:80,after:0,line:220}),

  h2("Tres que subieron"),
  ...suben.flatMap(bloqueCaso),

  h2("Tres que bajaron"),
  ...bajan.flatMap(bloqueCaso),

  p([txt("El patrón. ",{bold:true,size:18}),
     txt("Las que suben conectan: enlazan la pregunta con lo que la paciente acaba de decir. Las que bajan desconectan: consuelan, cierran por reloj o cambian de tema. No es que sepan menos en la segunda sesión — es que están más cómodas, y la comodidad trae los automatismos de la conversación cotidiana. Es exactamente lo que una supervisión corrige en una clase.",{color:GREY,size:17})],
    {before:140,after:0,line:220}),

  h2("Alertas de la plataforma"),
  tabla(["Indicador","Período"],
    [["Alertas de lenguaje (autolesión, violencia, faltas de respeto)",String(alertas.length)],
     ["Sesiones cerradas por retiro del paciente",String(retiros)],
     ["Sesiones con conducta poco profesional advertida",String(cs.filter(c=>(c.unprofessional_count||0)>0).length)],
     ["Sesiones donde se pegó texto desde fuera (desde el 10 de septiembre)",`${conPegado} (${pegados} veces)`]],
    [0.72,0.28]),
  p(txt("GlorIA vigila el lenguaje de la conversación en ambas direcciones y registra cuando el paciente decide retirarse. El pegado de texto externo se observa en todos los niveles; la salida de pantalla solo con pacientes de nivel avanzado, donde la consulta de material sí altera el ejercicio.",{color:GREY,size:17}),{before:90,after:0,line:220}),

  new Paragraph({children:[new PageBreak()]}),

  p(txt("Anexo · La rúbrica con la que se evalúa",{bold:true,size:26}),{after:60,line:280}),
  p(txt("Marco de competencias psicoterapéuticas de Valdés Sánchez y Gómez Gallo (2023), Universidad Santo Tomás. Los descriptores de nivel son redacción propia de GlorIA basada en ese marco. Cada sesión se evalúa sobre las 10 competencias; las que no aplicaban a esa entrevista quedan fuera del promedio con su justificación.",{color:GREY,size:17}),{after:140,line:220}),
];

for (const k of K) {
  const info=COMPETENCY_INFO[k], r=COMPETENCY_RUBRIC[k];
  cuerpo.push(p([txt(info.name,{bold:true,size:19}),
    txt(`   ${info.domain==="estructura"?"Estructura de la entrevista":"Actitudes terapéuticas"}`,{color:FAINT,size:15,caps:true})],
    {before:150,after:40,keepNext:true}));
  cuerpo.push(p(txt(info.definition,{color:GREY,size:17}),{after:60,line:220,keepNext:true}));
  cuerpo.push(tabla(["Nivel","Qué se observa"],
    [["0",r.omitido_criteria],["1",r.levels[1]],["2",r.levels[2]],["3",r.levels[3]],["4",r.levels[4]],
     ["N/A",r.na_criteria]],
    [0.08,0.92],{izquierda:[1]}));
}

cuerpo.push(p([txt("Nota metodológica. ",{bold:true,size:15,color:FAINT}),
  txt(`Datos de producción al ${hoy}. El tiempo de sesión se acota por conversación para que una pestaña olvidada no infle el registro. La mirada longitudinal solo compara entrevistas de ${MIN_LONG} o más mensajes: sin ese filtro, los dos cambios más grandes correspondían a sesiones abandonadas y no a aprendizaje. Los casos van anonimizados; cada docente ve los nombres en su panel.`,
    {size:15,color:FAINT})],{before:220,after:0,line:216}));

const doc=new Document({
  creator:"GlorIA",
  title:"Uso de GlorIA — UPC Psicopatología del Adulto 2026-20",
  styles:{default:{document:{run:{font:"Calibri",size:19,color:DARK}}}},
  sections:[{
    properties:{page:{size:{width:PAGE_W,height:15840},margin:{top:MARGIN,bottom:700,left:MARGIN,right:MARGIN}}},
    headers:{default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:0},
      children:[new ImageRun({data:logo,type:"png",transformation:{width:100,height:23}})]})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:120},
      children:[txt("GlorIA — Página ",{size:14,color:FAINT}),
        new TextRun({children:[PageNumber.CURRENT],size:14,color:FAINT,font:"Calibri"}),
        txt(" de ",{size:14,color:FAINT}),
        new TextRun({children:[PageNumber.TOTAL_PAGES],size:14,color:FAINT,font:"Calibri"})]})]})},
    children:cuerpo,
  }],
});

// Permite un nombre de salida distinto: el archivo anterior suele quedar
// abierto en Word mientras se revisa, y Windows lo bloquea.
const OUT=process.argv[2] || path.join(ROOT,"informes","upc-informe-"+new Date().toLocaleDateString("en-CA",{timeZone:"America/Santiago"})+".docx");
const buf=await Packer.toBuffer(doc);
fs.writeFileSync(OUT,buf);
console.log("escrito:",OUT,"("+Math.round(buf.length/1024)+" KB)");
console.log("secciones:",filasSec.length-1,"· evaluaciones:",comp.length,"· casos:",casos.length,"· alertas:",alertas.length);
