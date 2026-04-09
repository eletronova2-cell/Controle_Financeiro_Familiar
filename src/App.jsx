import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// Valor mascarado quando ocultar=true
const fmtV = (v, ocultar) => ocultar ? "R$ ••••" : fmtBRL(v);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const mesAtualReal = () => {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
};

const monthLabel = (y, m) => {
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[m - 1]}/${String(y).slice(2)}`;
};

const mesAnterior = (ano, mes) => mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
const mesPosterior = (ano, mes) => mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
const mesAntes = (a1, m1, a2, m2) => a1 < a2 || (a1 === a2 && m1 < m2);
const mesIgual = (a1, m1, a2, m2) => a1 === a2 && m1 === m2;

const uid = () => Math.random().toString(36).slice(2, 10);

const CATEGORIAS = [
  { id: "moradia",     label: "Moradia",      icon: "🏠" },
  { id: "alimentacao", label: "Alimentação",  icon: "🛒" },
  { id: "transporte",  label: "Transporte",   icon: "🚗" },
  { id: "educacao",    label: "Educação",     icon: "📚" },
  { id: "saude",       label: "Saúde",        icon: "🏥" },
  { id: "lazer",       label: "Lazer",        icon: "🎉" },
  { id: "servicos",    label: "Serviços",     icon: "📱" },
  { id: "investimento",label: "Investimento", icon: "📈" },
  { id: "outros",      label: "Outros",       icon: "📦" },
];

const CAT_MAP = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));

const CAT_CORES = {
  moradia:      "#2563eb",
  alimentacao:  "#16a34a",
  transporte:   "#d97706",
  educacao:     "#7c3aed",
  saude:        "#dc2626",
  lazer:        "#db2777",
  servicos:     "#0891b2",
  investimento: "#059669",
  outros:       "#6b7280",
};

const ESTADO_INICIAL = {
  config: {
    nomeFamilia: "Minha Família",
    ciclo1ini: 1,  ciclo1fim: 5,
    ciclo2ini: 15, ciclo2fim: 20,
    orcamentoVariaveis: 0,
  },
  receitasFixas: [],
  despesasFixas: [],
  receitasAvulsas: [],
  despesasVariaveis: [],
  pagamentos: {},
};

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "controle-financeiro-v1";
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ESTADO_INICIAL;
    return { ...ESTADO_INICIAL, ...JSON.parse(raw) };
  } catch { return ESTADO_INICIAL; }
}
function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

// ─── Helpers de cálculo ───────────────────────────────────────────────────────
function itemAtivoNoMes(item, ano, mes) {
  const ini = new Date(item.dataInicio + "T00:00:00");
  const fimMes = new Date(ano, mes - 1, 28);
  if (ini > fimMes) return false;
  if (item.dataFim) {
    const fim = new Date(item.dataFim + "T00:00:00");
    const inicioMes = new Date(ano, mes - 1, 1);
    if (fim < inicioMes) return false;
  }
  return true;
}

function calcularMes(state, ano, mes) {
  const agora = mesAtualReal();
  const ehFuturo = mesAntes(agora.ano, agora.mes, ano, mes);

  const rfAtivas = state.receitasFixas.filter((r) => itemAtivoNoMes(r, ano, mes));
  const totalRF = rfAtivas.reduce((s, r) => s + r.valor, 0);

  const raDoMes = state.receitasAvulsas.filter((r) => {
    const d = new Date(r.data + "T00:00:00");
    return d.getFullYear() === ano && d.getMonth() + 1 === mes;
  });
  const totalRA = raDoMes.reduce((s, r) => s + r.valor, 0);

  const dfAtivas = state.despesasFixas.filter((d) => itemAtivoNoMes(d, ano, mes));

  // Meses futuros: usa valor padrão das fixas (sem pagamentos reais ainda)
  const totalDF = dfAtivas.reduce((s, d) => {
    if (ehFuturo) return s + d.valor;
    const key = `${d.id}-${ano}-${mes}`;
    const pg = state.pagamentos[key];
    return s + (pg ? pg.valor : d.valor);
  }, 0);

  const dvDoMes = state.despesasVariaveis.filter((d) => {
    const dt = new Date(d.data + "T00:00:00");
    return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
  });
  const totalDV = dvDoMes.reduce((s, d) => s + d.valor, 0);

  const totalReceitas = totalRF + totalRA;
  // Meses futuros: despesas variáveis são zero (ainda não ocorreram)
  const totalDespesas = ehFuturo ? totalDF : totalDF + totalDV;

  return {
    totalReceitas: ehFuturo ? totalRF : totalReceitas,
    totalDespesas,
    saldo: (ehFuturo ? totalRF : totalReceitas) - totalDespesas,
    dfAtivas,
    dvDoMes,
    ehFuturo,
  };
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0f1117;
    --bg2:      #1a1d27;
    --bg3:      #22263a;
    --border:   rgba(255,255,255,0.07);
    --border2:  rgba(255,255,255,0.13);
    --text:     #e8eaf0;
    --text2:    #8b90a7;
    --text3:    #555a72;
    --green:    #34d399;
    --red:      #f87171;
    --yellow:   #fbbf24;
    --blue:     #60a5fa;
    --accent:   #6366f1;
    --accent2:  #818cf8;
    --radius:   14px;
    --radius-sm:8px;
    --font:     'DM Sans', sans-serif;
    --mono:     'DM Mono', monospace;
    --nav-h:    60px;
    --tab-h:    64px;
  }

  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }

  .app {
    max-width: 430px;
    margin: 0 auto;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    position: relative;
    overflow: hidden;
  }

  .topbar {
    height: var(--nav-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    z-index: 10;
  }
  .topbar-title { font-size: 17px; font-weight: 600; letter-spacing: -0.3px; }
  .topbar-sub   { font-size: 12px; color: var(--text2); margin-top: 1px; }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-bottom: 80px;
    scroll-behavior: smooth;
  }
  .content::-webkit-scrollbar { width: 0; }

  .tabbar {
    height: var(--tab-h);
    display: flex;
    border-top: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
    z-index: 10;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tab-btn {
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--text3);
    font-family: var(--font);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.3px;
    transition: color 0.15s;
    padding-bottom: 4px;
  }
  .tab-btn.active { color: var(--accent2); }
  .tab-btn svg { width: 22px; height: 22px; }

  .card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 12px;
  }
  .card-sm {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    margin-bottom: 8px;
  }

  .sec-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.8px;
    color: var(--text3);
    text-transform: uppercase;
    margin: 20px 0 10px;
  }
  .sec-title:first-child { margin-top: 4px; }

  .hero {
    background: linear-gradient(135deg, #1e2140 0%, #16192e 100%);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 120px; height: 120px;
    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
    border-radius: 50%;
  }
  .hero-label { font-size: 11px; color: var(--text2); letter-spacing: 0.5px; margin-bottom: 6px; }
  .hero-value { font-size: 32px; font-weight: 700; letter-spacing: -1px; font-family: var(--mono); }
  .hero-value.pos { color: var(--green); }
  .hero-value.neg { color: var(--red); }
  .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .hero-cell-label { font-size: 11px; color: var(--text2); margin-bottom: 3px; }
  .hero-cell-val { font-size: 16px; font-weight: 600; font-family: var(--mono); }

  .ciclo-card {
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 10px;
    border: 1px solid var(--border);
    background: var(--bg2);
  }
  .ciclo-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; cursor: pointer; }
  .ciclo-title  { font-size: 14px; font-weight: 600; }
  .ciclo-sub    { font-size: 11px; color: var(--text2); margin-top: 2px; }
  .ciclo-saldo  { font-size: 18px; font-weight: 700; font-family: var(--mono); text-align: right; }
  .ciclo-saldo-label { font-size: 10px; color: var(--text2); text-align: right; }

  .progress-wrap { margin-bottom: 12px; }
  .progress-row  { display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); margin-bottom: 4px; }
  .progress-bar  { height: 4px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }

  .saude-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .saude-ok     { background: rgba(52,211,153,0.12);  color: var(--green);  border: 1px solid rgba(52,211,153,0.2); }
  .saude-warn   { background: rgba(251,191,36,0.12);   color: var(--yellow); border: 1px solid rgba(251,191,36,0.2); }
  .saude-critico{ background: rgba(248,113,113,0.12);  color: var(--red);    border: 1px solid rgba(248,113,113,0.2); }

  .tx-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .tx-row:last-child { border-bottom: none; padding-bottom: 0; }
  .tx-icon {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }
  .tx-info { flex: 1; min-width: 0; }
  .tx-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tx-meta { font-size: 11px; color: var(--text2); margin-top: 1px; }
  .tx-val  { font-size: 14px; font-weight: 600; font-family: var(--mono); flex-shrink: 0; }
  .tx-val.pos { color: var(--green); }
  .tx-val.neg { color: var(--red); }

  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
    padding: 2px 8px; border-radius: 20px;
  }
  .pill-pago     { background: rgba(52,211,153,0.12);  color: var(--green); }
  .pill-pendente { background: rgba(251,191,36,0.12);   color: var(--yellow); }
  .pill-futuro   { background: rgba(96,165,250,0.12);   color: var(--blue); }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-family: var(--font); font-size: 14px; font-weight: 500;
    cursor: pointer; border: none; transition: all 0.15s;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: #4f52d8; }
  .btn-ghost { background: var(--bg3); color: var(--text); border: 1px solid var(--border2); }
  .btn-ghost:hover { background: var(--bg2); }
  .btn-danger { background: rgba(248,113,113,0.15); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
  .btn-danger:hover { background: rgba(248,113,113,0.25); }
  .btn-edit { background: rgba(96,165,250,0.1); color: var(--blue); border: 1px solid rgba(96,165,250,0.2); }
  .btn-edit:hover { background: rgba(96,165,250,0.2); }
  .btn-sm   { padding: 6px 12px; font-size: 12px; }
  .btn-full { width: 100%; }
  .btn-icon { padding: 7px; border-radius: 8px; }

  .fab {
    position: fixed;
    bottom: calc(var(--tab-h) + 16px);
    right: calc(50% - 215px + 16px);
    width: 52px; height: 52px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    border: none;
    font-size: 24px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(99,102,241,0.4);
    transition: transform 0.15s, box-shadow 0.15s;
    z-index: 20;
  }
  .fab:hover { transform: scale(1.06); box-shadow: 0 6px 24px rgba(99,102,241,0.5); }

  .modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 50;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal {
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: var(--radius) var(--radius) 0 0;
    padding: 20px;
    width: 100%;
    max-width: 430px;
    max-height: 90dvh;
    overflow-y: auto;
    animation: slideUp 0.2s ease;
  }
  @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-title { font-size: 17px; font-weight: 600; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .modal::-webkit-scrollbar { width: 0; }

  .field { margin-bottom: 14px; }
  .field label { font-size: 12px; color: var(--text2); font-weight: 500; display: block; margin-bottom: 6px; letter-spacing: 0.3px; }
  .field input, .field select, .field textarea {
    width: 100%;
    background: var(--bg3);
    border: 1px solid var(--border2);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
    appearance: none;
    -webkit-appearance: none;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .field select option { background: var(--bg2); }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; }
  .toggle-row label { font-size: 13px; color: var(--text); flex: 1; padding-right: 12px; }
  .toggle {
    width: 40px; height: 22px;
    background: var(--bg3);
    border: 1px solid var(--border2);
    border-radius: 11px;
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle.on { background: var(--accent); border-color: var(--accent); }
  .toggle::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 16px; height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  .toggle.on::after { transform: translateX(18px); }

  .chart-wrap { display: flex; align-items: flex-end; gap: 6px; height: 80px; margin: 8px 0 4px; }
  .chart-bar-group { flex: 1; display: flex; align-items: flex-end; gap: 2px; }
  .chart-bar { flex: 1; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s ease; }
  .chart-labels { display: flex; gap: 6px; }
  .chart-label { flex: 1; font-size: 9px; color: var(--text3); text-align: center; }

  .empty { text-align: center; color: var(--text3); font-size: 13px; padding: 32px 0; }
  .divider { height: 1px; background: var(--border); margin: 12px 0; }

  .month-nav { display: flex; align-items: center; gap: 6px; }
  .month-nav button {
    background: none; border: none; color: var(--text2); cursor: pointer;
    font-size: 18px; padding: 4px 8px; border-radius: 6px;
    font-family: var(--font);
  }
  .month-nav button:hover { background: var(--bg3); color: var(--text); }
  .mes-atual-btn {
    font-size: 11px !important; padding: 4px 10px !important;
    background: var(--bg3) !important; border: 1px solid var(--border2) !important;
    border-radius: 20px !important; color: var(--text2) !important;
  }
  .mes-atual-btn:hover { color: var(--text) !important; }

  .check-btn {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 2px solid var(--border2);
    background: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .check-btn.checked { background: var(--green); border-color: var(--green); }

  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { color: var(--text2); }
  .stat-val   { font-weight: 600; font-family: var(--mono); }

  .banner {
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    font-size: 12px;
    margin-bottom: 14px;
    text-align: center;
  }
  .banner-futuro  { background: rgba(96,165,250,0.08);   border: 1px solid rgba(96,165,250,0.2);  color: var(--blue); }
  .banner-passado { background: rgba(139,144,167,0.08);  border: 1px solid var(--border);          color: var(--text2); }

  .sub-label { font-size: 11px; color: var(--text3); font-weight: 600; letter-spacing: 0.5px; margin-bottom: 6px; }

  @media (min-width: 600px) {
    .fab { right: calc(50% - 215px + 16px); }
  }
`;

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(() => loadState());
  const [aba, setAba] = useState("inicio");
  const [modal, setModal] = useState(null);
  const [mesVis, setMesVis] = useState(() => mesAtualReal());
  const [ocultar, setOcultar] = useState(false);

  useEffect(() => { saveState(state); }, [state]);

  const update = useCallback((fn) => {
    setState((prev) => { const next = { ...prev }; fn(next); return next; });
  }, []);

  const agora = mesAtualReal();
  const ehMesAtual  = mesIgual(mesVis.ano, mesVis.mes, agora.ano, agora.mes);
  const ehMesFuturo = mesAntes(agora.ano, agora.mes, mesVis.ano, mesVis.mes);
  const ehMesPassado = mesAntes(mesVis.ano, mesVis.mes, agora.ano, agora.mes);

  const dadosMes = useMemo(() => calcularMes(state, mesVis.ano, mesVis.mes), [state, mesVis]);

  const cicloData = useMemo(() => {
    const { ano, mes } = mesVis;
    const { config, receitasFixas, receitasAvulsas, pagamentos } = state;
    const { dfAtivas, dvDoMes } = dadosMes;

    // Garante compatibilidade com dados salvos no formato antigo (ciclo1/ciclo2 numérico)
    const c1ini = config.ciclo1ini ?? 1;
    const c1fim = config.ciclo1fim ?? (config.ciclo1 ?? 5);
    const c2ini = config.ciclo2ini ?? 15;
    const c2fim = config.ciclo2fim ?? (config.ciclo2 ?? 20);

    const recAvNaFaixa = (ini, fim) => receitasAvulsas.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      const dia = d.getDate();
      return d.getFullYear() === ano && d.getMonth() + 1 === mes && dia >= ini && dia <= fim;
    }).reduce((s, r) => s + r.valor, 0);

    const recFixNaFaixa = (ini, fim) => receitasFixas
      .filter((r) => itemAtivoNoMes(r, ano, mes) && r.dia >= ini && r.dia <= fim)
      .reduce((s, r) => s + r.valor, 0);

    const mapD = (d) => {
      const key = `${d.id}-${ano}-${mes}`;
      const pg = pagamentos[key];
      return { ...d, pago: pg?.pago || false, valorReal: pg?.valor ?? d.valor };
    };

    const naFaixa = (dia, ini, fim) => dia >= ini && dia <= fim;

    return [
      {
        label: `Ciclo 1 — dia ${c1ini} a ${c1fim}`,
        receita: recFixNaFaixa(c1ini, c1fim) + recAvNaFaixa(c1ini, c1fim),
        despesas: dfAtivas.filter((d) => naFaixa(d.diaVencimento, c1ini, c1fim)).map(mapD),
        despesasVar: dvDoMes.filter((d) => naFaixa(new Date(d.data + "T00:00:00").getDate(), c1ini, c1fim)),
      },
      {
        label: `Ciclo 2 — dia ${c2ini} a ${c2fim}`,
        receita: recFixNaFaixa(c2ini, c2fim) + recAvNaFaixa(c2ini, c2fim),
        despesas: dfAtivas.filter((d) => naFaixa(d.diaVencimento, c2ini, c2fim)).map(mapD),
        despesasVar: dvDoMes.filter((d) => naFaixa(new Date(d.data + "T00:00:00").getDate(), c2ini, c2fim)),
      },
    ];
  }, [state, mesVis, dadosMes]);

  const saudeMes = useMemo(() => {
    const prox = mesPosterior(mesVis.ano, mesVis.mes);

    const recFixProx = state.receitasFixas
      .filter((r) => itemAtivoNoMes(r, prox.ano, prox.mes))
      .reduce((s, r) => s + r.valor, 0);

    const despFixProx = state.despesasFixas
      .filter((d) => itemAtivoNoMes(d, prox.ano, prox.mes))
      .reduce((s, d) => s + d.valor, 0);

    const despVarEstimada = state.config.orcamentoVariaveis || 0;

    const totalDespProx = despFixProx + despVarEstimada;
    const saldoProx = recFixProx - totalDespProx;
    const pct = recFixProx > 0 ? (totalDespProx / recFixProx) * 100 : 100;
    const status = pct >= 95 ? "critico" : pct >= 80 ? "warn" : "ok";

    return {
      recFixProx,
      despFixProx,
      despVarEstimada,
      totalDespProx,
      saldoProx,
      pct: Math.min(Math.round(pct), 100),
      status,
    };
  }, [state, mesVis]);

  const historico = useMemo(() => {
    const result = [];
    for (let i = 11; i >= 0; i--) {
      let hAno = agora.ano, hMes = agora.mes - i;
      while (hMes <= 0) { hMes += 12; hAno--; }
      const d = calcularMes(state, hAno, hMes);
      result.push({ label: monthLabel(hAno, hMes), ...d });
    }
    return result;
  }, [state]);

  const marcarPago = (despId, pago, valorAtual) => {
    const { ano, mes } = mesVis;
    const key = `${despId}-${ano}-${mes}`;
    update((s) => { s.pagamentos = { ...s.pagamentos, [key]: { pago, valor: valorAtual } }; });
  };

  const editarValorPagamento = (despId, novoValor) => {
    const { ano, mes } = mesVis;
    const key = `${despId}-${ano}-${mes}`;
    const current = state.pagamentos[key] || { pago: false };
    update((s) => { s.pagamentos = { ...s.pagamentos, [key]: { ...current, valor: parseFloat(novoValor) || 0 } }; });
  };

  const excluir = (colecao, id) => {
    update((s) => { s[colecao] = s[colecao].filter((i) => i.id !== id); });
  };

  const editar = (colecao, id, dados) => {
    update((s) => { s[colecao] = s[colecao].map((i) => i.id === id ? { ...i, ...dados } : i); });
  };

  const mover = (colecao, id, direcao) => {
    update((s) => {
      const arr = [...s[colecao]];
      const idx = arr.findIndex((i) => i.id === id);
      const novoIdx = idx + direcao;
      if (novoIdx < 0 || novoIdx >= arr.length) return;
      [arr[idx], arr[novoIdx]] = [arr[novoIdx], arr[idx]];
      s[colecao] = arr;
    });
  };

  const exportarCSV = () => {
    const { ano, mes } = mesVis;
    const rows = [["Data","Nome","Categoria","Tipo","Valor","Status"]];
    state.receitasFixas.filter((r) => itemAtivoNoMes(r, ano, mes)).forEach((r) => {
      rows.push([`${ano}-${String(mes).padStart(2,"0")}-${String(r.dia).padStart(2,"0")}`, r.nome, "Receita", "Fixa", r.valor.toFixed(2), "Recebida"]);
    });
    state.receitasAvulsas.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    }).forEach((r) => {
      rows.push([r.data, r.nome, "Receita", "Avulsa", r.valor.toFixed(2), "Recebida"]);
    });
    dadosMes.dfAtivas.forEach((d) => {
      const key = `${d.id}-${ano}-${mes}`;
      const pg = state.pagamentos[key];
      rows.push([`${ano}-${String(mes).padStart(2,"0")}-${String(d.diaVencimento).padStart(2,"0")}`, d.nome, CAT_MAP[d.categoria]?.label || d.categoria, "Fixa", (pg?.valor ?? d.valor).toFixed(2), pg?.pago ? "Pago" : "Pendente"]);
    });
    dadosMes.dvDoMes.forEach((d) => {
      rows.push([d.data, d.nome, CAT_MAP[d.categoria]?.label || d.categoria, "Variável", d.valor.toFixed(2), "Pago"]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro-${ano}-${String(mes).padStart(2,"0")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="topbar">
          <div>
            <div className="topbar-title">{state.config.nomeFamilia}</div>
            <div className="topbar-sub">
              {monthLabel(mesVis.ano, mesVis.mes)}
              {ehMesAtual  && " · mês atual"}
              {ehMesFuturo && " · futuro"}
              {ehMesPassado && " · encerrado"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setOcultar((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: ocultar ? "var(--accent2)" : "var(--text3)", padding: "6px", borderRadius: 8, display: "flex", alignItems: "center" }}
              title={ocultar ? "Mostrar valores" : "Ocultar valores"}
            >
              {ocultar ? <IconOlhoFechado /> : <IconOlho />}
            </button>
            <div className="month-nav">
              <button onClick={() => setMesVis((m) => mesAnterior(m.ano, m.mes))}>‹</button>
              {!ehMesAtual && (
                <button className="mes-atual-btn" onClick={() => setMesVis(mesAtualReal())}>Mês atual</button>
              )}
              <button onClick={() => setMesVis((m) => mesPosterior(m.ano, m.mes))}>›</button>
            </div>
          </div>
        </div>

        <div className="content">
          {aba === "inicio"     && <AbaInicio dadosMes={dadosMes} cicloData={cicloData} saudeMes={saudeMes} ehMesFuturo={ehMesFuturo} ehMesPassado={ehMesPassado} marcarPago={marcarPago} editarValorPagamento={editarValorPagamento} ocultar={ocultar} />}
          {aba === "transacoes" && <AbaTransacoes state={state} mesVis={mesVis} dadosMes={dadosMes} excluir={excluir} setModal={setModal} exportarCSV={exportarCSV} ocultar={ocultar} />}
          {aba === "historico"  && <AbaHistorico historico={historico} ocultar={ocultar} />}
          {aba === "config"     && <AbaConfig state={state} update={update} setModal={setModal} excluir={excluir} editar={editar} mover={mover} />}
        </div>

        {(aba === "inicio" || aba === "transacoes") && (
          <button className="fab" onClick={() => setModal({ tipo: "addLancamento" })}>+</button>
        )}

        <div className="tabbar">
          {[
            { id: "inicio",     label: "Início",    icon: <IconHome /> },
            { id: "transacoes", label: "Transações", icon: <IconList /> },
            { id: "historico",  label: "Histórico",  icon: <IconChart /> },
            { id: "config",     label: "Ajustes",    icon: <IconGear /> },
          ].map((t) => (
            <button key={t.id} className={`tab-btn${aba === t.id ? " active" : ""}`} onClick={() => setAba(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {modal && <Modal modal={modal} setModal={setModal} state={state} update={update} mesVis={mesVis} editar={editar} />}
      </div>
    </>
  );
}

// ─── Aba Início ───────────────────────────────────────────────────────────────
function AbaInicio({ dadosMes, cicloData, saudeMes, ehMesFuturo, ehMesPassado, marcarPago, editarValorPagamento, ocultar }) {
  const { totalReceitas, totalDespesas, saldo } = dadosMes;
  return (
    <>
      {ehMesFuturo  && <div className="banner banner-futuro">📅 Mês futuro — valores baseados nas receitas e despesas fixas cadastradas</div>}
      {ehMesPassado && <div className="banner banner-passado">🗂 Mês encerrado — histórico consolidado</div>}

      <div className="hero">
        <div className="hero-label">{ehMesFuturo ? "PROJEÇÃO DO MÊS" : "SALDO DO MÊS"}</div>
        <div className={`hero-value ${saldo >= 0 ? "pos" : "neg"}`}>{fmtV(saldo, ocultar)}</div>
        <div className="hero-grid">
          <div className="hero-cell">
            <div className="hero-cell-label">↑ Receitas</div>
            <div className="hero-cell-val" style={{ color: "var(--green)" }}>{fmtV(totalReceitas, ocultar)}</div>
          </div>
          <div className="hero-cell">
            <div className="hero-cell-label">↓ Despesas</div>
            <div className="hero-cell-val" style={{ color: "var(--red)" }}>{fmtV(totalDespesas, ocultar)}</div>
          </div>
        </div>
      </div>

      {!ehMesPassado && (
        <>
          <div className="sec-title">Saúde do Próximo Mês</div>
          <SaudeCard saudeMes={saudeMes} ocultar={ocultar} />
        </>
      )}

      <div className="sec-title">Ciclos de Pagamento</div>
      {cicloData.map((ciclo, i) => (
        <CicloCard key={i} ciclo={ciclo} ehMesFuturo={ehMesFuturo} marcarPago={marcarPago} editarValorPagamento={editarValorPagamento} ocultar={ocultar} />
      ))}

      <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)", letterSpacing: "0.3px" }}>
          v1.0.1 · 1703026
        </span>
      </div>
    </>
  );
}

function SaudeCard({ saudeMes, ocultar }) {
  const { recFixProx, despFixProx, despVarEstimada, totalDespProx, saldoProx, pct, status } = saudeMes;
  const label = status === "ok" ? "Folgado" : status === "warn" ? "Apertado" : "Sobrecarregado";
  const emoji = status === "ok" ? "✓" : status === "warn" ? "⚠" : "✕";
  const barColor = status === "ok" ? "var(--green)" : status === "warn" ? "var(--yellow)" : "var(--red)";
  return (
    <div className="card">
      <span className={`saude-badge saude-${status}`}>{emoji} {label}</span>
      <div className="progress-wrap">
        <div className="progress-row"><span>Comprometido</span><span>{ocultar ? "••%" : `${pct}%`}</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: ocultar ? "0%" : `${pct}%`, background: barColor }} /></div>
      </div>
      <div className="stat-row">
        <span className="stat-label">Receitas previstas</span>
        <span className="stat-val" style={{ color: "var(--green)" }}>{fmtV(recFixProx, ocultar)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Despesas fixas previstas</span>
        <span className="stat-val" style={{ color: "var(--red)" }}>{fmtV(despFixProx, ocultar)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Variáveis previstas <span style={{ fontSize: 10, color: "var(--text3)" }}>(orçamento mensal)</span></span>
        <span className="stat-val" style={{ color: "var(--red)" }}>{fmtV(despVarEstimada, ocultar)}</span>
      </div>
      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      <div className="stat-row">
        <span className="stat-label">Total de despesas previstas</span>
        <span className="stat-val" style={{ color: "var(--red)" }}>{fmtV(totalDespProx, ocultar)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label" style={{ fontWeight: 600, color: "var(--text)" }}>Disponível para investir</span>
        <span className="stat-val" style={{ color: saldoProx >= 0 ? "var(--green)" : "var(--red)", fontSize: 16 }}>{fmtV(saldoProx, ocultar)}</span>
      </div>
    </div>
  );
}

function CicloCard({ ciclo, ehMesFuturo, marcarPago, editarValorPagamento, ocultar }) {
  const totalFixas = ciclo.despesas.reduce((s, d) => s + d.valorReal, 0);
  const totalVar   = ciclo.despesasVar.reduce((s, d) => s + d.valor, 0);
  const totalDesp  = totalFixas + totalVar;
  const saldoCiclo = ciclo.receita - totalDesp;
  const pct = ciclo.receita > 0 ? Math.min(Math.round((totalDesp / ciclo.receita) * 100), 100) : 0;
  const barColor = pct < 70 ? "var(--green)" : pct < 90 ? "var(--yellow)" : "var(--red)";
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ciclo-card">
      <div className="ciclo-header" onClick={() => setExpanded((e) => !e)}>
        <div>
          <div className="ciclo-title">{ciclo.label}</div>
          <div className="ciclo-sub">{ciclo.despesas.length} fixas · {ciclo.despesasVar.length} variáveis</div>
        </div>
        <div>
          <div className="ciclo-saldo" style={{ color: saldoCiclo >= 0 ? "var(--green)" : "var(--red)" }}>{fmtV(saldoCiclo, ocultar)}</div>
          <div className="ciclo-saldo-label">saldo do ciclo</div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-row">
          <span>Receita: {fmtV(ciclo.receita, ocultar)}</span>
          <span>{ocultar ? "••%" : `${pct}% usado`}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>

      {expanded && (
        <>
          {ciclo.despesas.length > 0 && (
            <>
              <div className="sub-label">DESPESAS FIXAS</div>
              {ciclo.despesas.map((d) => {
                const cat = CAT_MAP[d.categoria];
                return (
                  <div key={d.id} className="tx-row">
                    {!ehMesFuturo && (
                      <button className={`check-btn${d.pago ? " checked" : ""}`} onClick={() => marcarPago(d.id, !d.pago, d.valorReal)}>
                        {d.pago && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    )}
                    <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria]}18` }}>{cat?.icon || "📦"}</div>
                    <div className="tx-info">
                      <div className="tx-name" style={{ textDecoration: d.pago ? "line-through" : "none", color: d.pago ? "var(--text2)" : "var(--text)" }}>{d.nome}</div>
                      <div className="tx-meta">Vence dia {d.diaVencimento}{d.valorVariavel ? " · valor variável" : ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {d.valorVariavel && !d.pago && !ehMesFuturo ? (
                        <input type="number" value={d.valorReal} onChange={(e) => editarValorPagamento(d.id, e.target.value)}
                          style={{ width: 90, background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 6px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, textAlign: "right" }} />
                      ) : (
                        <span className="tx-val neg">{fmtV(d.valorReal, ocultar)}</span>
                      )}
                      <span className={`pill ${ehMesFuturo ? "pill-futuro" : d.pago ? "pill-pago" : "pill-pendente"}`}>
                        {ehMesFuturo ? "Previsto" : d.pago ? "Pago" : "Pendente"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {ciclo.despesasVar.length > 0 && (
            <>
              <div className="sub-label" style={{ marginTop: 12 }}>DESPESAS VARIÁVEIS</div>
              {ciclo.despesasVar.map((d) => {
                const cat = CAT_MAP[d.categoria];
                return (
                  <div key={d.id} className="tx-row">
                    <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria] || "#6b7280"}18` }}>{cat?.icon || "📦"}</div>
                    <div className="tx-info">
                      <div className="tx-name">{d.nome}</div>
                      <div className="tx-meta">{d.data} · {cat?.label}</div>
                    </div>
                    <span className="tx-val neg">{fmtV(d.valor, ocultar)}</span>
                  </div>
                );
              })}
            </>
          )}

          {ciclo.despesas.length === 0 && ciclo.despesasVar.length === 0 && (
            <div className="empty">Nenhuma despesa neste ciclo</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Aba Transações ───────────────────────────────────────────────────────────
function AbaTransacoes({ state, mesVis, dadosMes, excluir, setModal, exportarCSV, ocultar }) {
  const { ano, mes } = mesVis;
  const [filtro, setFiltro] = useState("todos");

  const recFixMes = state.receitasFixas.filter((r) => itemAtivoNoMes(r, ano, mes));
  const recAvMes  = state.receitasAvulsas.filter((r) => {
    const d = new Date(r.data + "T00:00:00");
    return d.getFullYear() === ano && d.getMonth() + 1 === mes;
  });

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
        {["todos","receitas","despesas"].map((f) => (
          <button key={f} className={`btn btn-sm ${filtro === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFiltro(f)} style={{ whiteSpace: "nowrap" }}>
            {f === "todos" ? "Todos" : f === "receitas" ? "Receitas" : "Despesas"}
          </button>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={exportarCSV} style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>↓ CSV</button>
      </div>

      {(filtro === "todos" || filtro === "receitas") && (
        <>
          <div className="sec-title">Receitas</div>
          <div className="card" style={{ padding: "8px 14px" }}>
            {recFixMes.length === 0 && recAvMes.length === 0 && <div className="empty">Nenhuma receita</div>}
            {recFixMes.map((r) => (
              <div key={r.id} className="tx-row">
                <div className="tx-icon" style={{ background: "rgba(52,211,153,0.12)", fontSize: 18 }}>💼</div>
                <div className="tx-info">
                  <div className="tx-name">{r.nome}</div>
                  <div className="tx-meta">Fixa · Dia {r.dia}</div>
                </div>
                <span className="tx-val pos">{fmtV(r.valor, ocultar)}</span>
                <button className="btn btn-edit btn-sm btn-icon" title="Editar" onClick={() => setModal({ tipo: "editReceita", subtipo: "fixa", item: r })}>✎</button>
              </div>
            ))}
            {recAvMes.map((r) => (
              <div key={r.id} className="tx-row">
                <div className="tx-icon" style={{ background: "rgba(52,211,153,0.12)", fontSize: 18 }}>💰</div>
                <div className="tx-info">
                  <div className="tx-name">{r.nome}</div>
                  <div className="tx-meta">Avulsa · {r.data}</div>
                </div>
                <span className="tx-val pos">{fmtV(r.valor, ocultar)}</span>
                <button className="btn btn-edit btn-sm btn-icon" title="Editar" onClick={() => setModal({ tipo: "editReceita", subtipo: "avulsa", item: r })}>✎</button>
                <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => excluir("receitasAvulsas", r.id)}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {(filtro === "todos" || filtro === "despesas") && (
        <>
          <div className="sec-title">Despesas Fixas</div>
          <div className="card" style={{ padding: "8px 14px" }}>
            {dadosMes.dfAtivas.length === 0 && <div className="empty">Nenhuma despesa fixa</div>}
            {dadosMes.dfAtivas.map((d) => {
              const cat = CAT_MAP[d.categoria];
              const key = `${d.id}-${ano}-${mes}`;
              const pg = state.pagamentos[key];
              return (
                <div key={d.id} className="tx-row">
                  <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria]}18` }}>{cat?.icon || "📦"}</div>
                  <div className="tx-info">
                    <div className="tx-name">{d.nome}</div>
                    <div className="tx-meta">{cat?.label} · Dia {d.diaVencimento}{d.dataFim ? ` · até ${d.dataFim}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span className="tx-val neg">{fmtV(pg?.valor ?? d.valor, ocultar)}</span>
                    <span className={`pill ${pg?.pago ? "pill-pago" : "pill-pendente"}`}>{pg?.pago ? "Pago" : "Pendente"}</span>
                  </div>
                  <button className="btn btn-edit btn-sm btn-icon" title="Editar" onClick={() => setModal({ tipo: "editDespesaFixa", item: d })}>✎</button>
                </div>
              );
            })}
          </div>

          <div className="sec-title">Despesas Variáveis</div>
          <div className="card" style={{ padding: "8px 14px" }}>
            {dadosMes.dvDoMes.length === 0 && <div className="empty">Nenhuma despesa variável</div>}
            {dadosMes.dvDoMes.map((d) => {
              const cat = CAT_MAP[d.categoria];
              return (
                <div key={d.id} className="tx-row">
                  <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria] || "#6b7280"}18` }}>{cat?.icon || "📦"}</div>
                  <div className="tx-info">
                    <div className="tx-name">{d.nome}</div>
                    <div className="tx-meta">{cat?.label} · {d.data}</div>
                  </div>
                  <span className="tx-val neg">{fmtV(d.valor, ocultar)}</span>
                  <button className="btn btn-edit btn-sm btn-icon" title="Editar" onClick={() => setModal({ tipo: "editDespesaVar", item: d })}>✎</button>
                  <button className="btn btn-danger btn-sm btn-icon" title="Excluir" onClick={() => excluir("despesasVariaveis", d.id)}>✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ─── Aba Histórico ────────────────────────────────────────────────────────────
function AbaHistorico({ historico, ocultar }) {
  const comDados = historico.filter((h) => !h.ehFuturo);
  const maxVal = Math.max(...comDados.map((h) => Math.max(h.totalReceitas, h.totalDespesas)), 1);

  return (
    <>
      <div className="sec-title">Últimos 12 Meses</div>
      <div className="card">
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--green)", display: "inline-block" }} /> Receitas
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text2)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--red)", display: "inline-block" }} /> Despesas
          </span>
        </div>
        <div className="chart-wrap">
          {historico.map((h, i) => (
            <div key={i} className="chart-bar-group">
              <div className="chart-bar" style={{
                height: h.ehFuturo ? "3px" : `${Math.round((h.totalReceitas / maxVal) * 100)}%`,
                background: "var(--green)", opacity: h.ehFuturo ? 0.15 : 0.75
              }} />
              <div className="chart-bar" style={{
                height: h.ehFuturo ? "3px" : `${Math.round((h.totalDespesas / maxVal) * 100)}%`,
                background: "var(--red)", opacity: h.ehFuturo ? 0.15 : 0.75
              }} />
            </div>
          ))}
        </div>
        <div className="chart-labels">
          {historico.map((h, i) => <div key={i} className="chart-label">{h.label}</div>)}
        </div>
      </div>

      <div className="sec-title">Detalhamento</div>
      {comDados.length === 0 && <div className="empty">Nenhum dado ainda — cadastre suas receitas e despesas</div>}
      {[...comDados].reverse().map((h, i) => (
        <div key={i} className="card-sm">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{h.label}</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15, color: h.saldo >= 0 ? "var(--green)" : "var(--red)" }}>{fmtV(h.saldo, ocultar)}</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--green)" }}>↑ {fmtV(h.totalReceitas, ocultar)}</span>
            <span style={{ fontSize: 12, color: "var(--red)" }}>↓ {fmtV(h.totalDespesas, ocultar)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Aba Config ───────────────────────────────────────────────────────────────
function AbaConfig({ state, update, setModal, excluir, editar, mover }) {
  return (
    <>
      <div className="sec-title">Configurações Gerais</div>
      <div className="card">
        <div className="field">
          <label>Nome da família</label>
          <input value={state.config.nomeFamilia} onChange={(e) => update((s) => { s.config.nomeFamilia = e.target.value; })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Ciclo 1 — dia início</label>
            <input type="number" min="1" max="28" value={state.config.ciclo1ini ?? 1}
              onChange={(e) => update((s) => { s.config.ciclo1ini = parseInt(e.target.value) || 1; })} />
          </div>
          <div className="field">
            <label>Ciclo 1 — dia fim</label>
            <input type="number" min="1" max="28" value={state.config.ciclo1fim ?? 5}
              onChange={(e) => update((s) => { s.config.ciclo1fim = parseInt(e.target.value) || 5; })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Ciclo 2 — dia início</label>
            <input type="number" min="1" max="31" value={state.config.ciclo2ini ?? 15}
              onChange={(e) => update((s) => { s.config.ciclo2ini = parseInt(e.target.value) || 15; })} />
          </div>
          <div className="field">
            <label>Ciclo 2 — dia fim</label>
            <input type="number" min="1" max="31" value={state.config.ciclo2fim ?? 20}
              onChange={(e) => update((s) => { s.config.ciclo2fim = parseInt(e.target.value) || 20; })} />
          </div>
        </div>
        <div className="field">
          <label>Orçamento mensal para despesas variáveis (R$)</label>
          <input
            type="number"
            placeholder="Ex: 1500"
            value={state.config.orcamentoVariaveis || ""}
            onChange={(e) => update((s) => { s.config.orcamentoVariaveis = parseFloat(e.target.value) || 0; })}
          />
        </div>
      </div>

      <div className="sec-title">Receitas Fixas</div>
      {state.receitasFixas.length === 0 && <div className="empty" style={{ padding: "12px 0" }}>Nenhuma receita fixa cadastrada</div>}
      {state.receitasFixas.map((r, idx) => (
        <div key={r.id} className="card-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: "2px 6px", fontSize: 11, opacity: idx === 0 ? 0.2 : 1 }}
              onClick={() => mover("receitasFixas", r.id, -1)} disabled={idx === 0}>▲</button>
            <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: "2px 6px", fontSize: 11, opacity: idx === state.receitasFixas.length - 1 ? 0.2 : 1 }}
              onClick={() => mover("receitasFixas", r.id, 1)} disabled={idx === state.receitasFixas.length - 1}>▼</button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.nome}</div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>Dia {r.dia} · {fmtBRL(r.valor)}</div>
          </div>
          <button className="btn btn-edit btn-sm btn-icon" onClick={() => setModal({ tipo: "editReceita", subtipo: "fixa", item: r })}>✎</button>
          <button className="btn btn-danger btn-sm btn-icon" onClick={() => excluir("receitasFixas", r.id)}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-full" style={{ marginBottom: 4 }} onClick={() => setModal({ tipo: "addReceita", subtipo: "fixa" })}>+ Receita fixa</button>

      <div className="sec-title">Despesas Fixas Cadastradas</div>
      {state.despesasFixas.length === 0 && <div className="empty" style={{ padding: "12px 0" }}>Nenhuma despesa fixa cadastrada</div>}
      {state.despesasFixas.map((d, idx) => {
        const cat = CAT_MAP[d.categoria];
        return (
          <div key={d.id} className="card-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: "2px 6px", fontSize: 11, opacity: idx === 0 ? 0.2 : 1 }}
                onClick={() => mover("despesasFixas", d.id, -1)} disabled={idx === 0}>▲</button>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ padding: "2px 6px", fontSize: 11, opacity: idx === state.despesasFixas.length - 1 ? 0.2 : 1 }}
                onClick={() => mover("despesasFixas", d.id, 1)} disabled={idx === state.despesasFixas.length - 1}>▼</button>
            </div>
            <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria]}18`, width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{cat?.icon || "📦"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{d.nome}</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>Dia {d.diaVencimento} · {fmtBRL(d.valor)}{d.valorVariavel ? " (variável)" : ""}{d.dataFim ? ` · até ${d.dataFim}` : ""}</div>
            </div>
            <button className="btn btn-edit btn-sm btn-icon" onClick={() => setModal({ tipo: "editDespesaFixa", item: d })}>✎</button>
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => excluir("despesasFixas", d.id)}>✕</button>
          </div>
        );
      })}
      <button className="btn btn-ghost btn-full" onClick={() => setModal({ tipo: "addDespesaFixa" })}>+ Despesa fixa</button>
    </>
  );
}

// ─── Modais ───────────────────────────────────────────────────────────────────
function Modal({ modal, setModal, state, update, mesVis, editar }) {
  const fechar = () => setModal(null);

  if (modal.tipo === "addLancamento") {
    return (
      <div className="modal-overlay" onClick={fechar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-title">Novo Lançamento <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Despesa variável", icon: "💸", acao: () => setModal({ tipo: "addDespesaVar" }) },
              { label: "Receita avulsa",   icon: "💰", acao: () => setModal({ tipo: "addReceita", subtipo: "avulsa" }) },
              { label: "Despesa fixa",     icon: "📋", acao: () => setModal({ tipo: "addDespesaFixa" }) },
              { label: "Receita fixa",     icon: "💼", acao: () => setModal({ tipo: "addReceita", subtipo: "fixa" }) },
            ].map((op) => (
              <button key={op.label} className="btn btn-ghost" style={{ flexDirection: "column", gap: 8, padding: "16px", height: 80 }} onClick={op.acao}>
                <span style={{ fontSize: 24 }}>{op.icon}</span>
                <span style={{ fontSize: 12 }}>{op.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (modal.tipo === "addDespesaVar" || modal.tipo === "editDespesaVar")
    return <ModalDespesaVar fechar={fechar} update={update} editar={editar} item={modal.item} />;
  if (modal.tipo === "addDespesaFixa" || modal.tipo === "editDespesaFixa")
    return <ModalDespesaFixa fechar={fechar} update={update} editar={editar} item={modal.item} />;
  if (modal.tipo === "addReceita" || modal.tipo === "editReceita")
    return <ModalReceita fechar={fechar} update={update} editar={editar} subtipo={modal.subtipo} item={modal.item} />;

  return null;
}

function ModalDespesaVar({ fechar, update, editar, item }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    categoria: item?.categoria || "alimentacao",
    valor: item?.valor?.toString() || "",
    data: item?.data || todayStr(),
  });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor) return;
    const dados = { ...form, valor: parseFloat(form.valor) };
    if (isEdit) editar("despesasVariaveis", item.id, dados);
    else update((s) => { s.despesasVariaveis = [...s.despesasVariaveis, { id: uid(), ...dados }]; });
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? "Editar" : "Nova"} Despesa Variável <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
        <div className="field"><label>Nome</label><input placeholder="Ex: Farmácia" value={form.nome} onChange={f("nome")} /></div>
        <div className="field-row">
          <div className="field"><label>Valor (R$)</label><input type="number" placeholder="0,00" value={form.valor} onChange={f("valor")} /></div>
          <div className="field"><label>Data</label><input type="date" value={form.data} onChange={f("data")} /></div>
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={form.categoria} onChange={f("categoria")}>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-full" onClick={salvar}>{isEdit ? "Salvar alterações" : "Adicionar"}</button>
      </div>
    </div>
  );
}

function ModalDespesaFixa({ fechar, update, editar, item }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    categoria: item?.categoria || "moradia",
    valor: item?.valor?.toString() || "",
    diaVencimento: item?.diaVencimento?.toString() || "",
    dataInicio: item?.dataInicio || todayStr().slice(0, 7) + "-01",
    dataFim: item?.dataFim || "",
    valorVariavel: item?.valorVariavel || false,
    temFim: !!item?.dataFim,
  });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor || !form.diaVencimento) return;
    const dados = {
      nome: form.nome, categoria: form.categoria,
      valor: parseFloat(form.valor), diaVencimento: parseInt(form.diaVencimento),
      dataInicio: form.dataInicio, dataFim: form.temFim ? form.dataFim : null,
      valorVariavel: form.valorVariavel,
    };
    if (isEdit) editar("despesasFixas", item.id, dados);
    else update((s) => { s.despesasFixas = [...s.despesasFixas, { id: uid(), ...dados }]; });
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? "Editar" : "Nova"} Despesa Fixa <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
        <div className="field"><label>Nome</label><input placeholder="Ex: Conta de Luz" value={form.nome} onChange={f("nome")} /></div>
        <div className="field-row">
          <div className="field"><label>Valor padrão (R$)</label><input type="number" placeholder="0,00" value={form.valor} onChange={f("valor")} /></div>
          <div className="field"><label>Dia vencimento</label><input type="number" min="1" max="31" placeholder="Ex: 10" value={form.diaVencimento} onChange={f("diaVencimento")} /></div>
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={form.categoria} onChange={f("categoria")}>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div className="field"><label>Data início</label><input type="date" value={form.dataInicio} onChange={f("dataInicio")} /></div>
        <div className="toggle-row">
          <label>Tem data de término (ex: financiamento)?</label>
          <div className={`toggle${form.temFim ? " on" : ""}`} onClick={() => setForm((p) => ({ ...p, temFim: !p.temFim }))} />
        </div>
        {form.temFim && <div className="field"><label>Data término</label><input type="date" value={form.dataFim} onChange={f("dataFim")} /></div>}
        <div className="toggle-row">
          <label>Valor varia todo mês (ex: luz, água)?</label>
          <div className={`toggle${form.valorVariavel ? " on" : ""}`} onClick={() => setForm((p) => ({ ...p, valorVariavel: !p.valorVariavel }))} />
        </div>
        <button className="btn btn-primary btn-full" onClick={salvar}>{isEdit ? "Salvar alterações" : "Adicionar"}</button>
      </div>
    </div>
  );
}

function ModalReceita({ fechar, update, editar, subtipo, item }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    nome: item?.nome || "",
    valor: item?.valor?.toString() || "",
    dia: item?.dia?.toString() || "",
    data: item?.data || todayStr(),
    dataInicio: item?.dataInicio || todayStr().slice(0, 7) + "-01",
    dataFim: item?.dataFim || "",
    temFim: !!item?.dataFim,
  });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor) return;
    if (subtipo === "fixa") {
      const dados = { nome: form.nome, valor: parseFloat(form.valor), dia: parseInt(form.dia) || 1, dataInicio: form.dataInicio, dataFim: form.temFim ? form.dataFim : null };
      if (isEdit) editar("receitasFixas", item.id, dados);
      else update((s) => { s.receitasFixas = [...s.receitasFixas, { id: uid(), ...dados }]; });
    } else {
      const dados = { nome: form.nome, valor: parseFloat(form.valor), data: form.data };
      if (isEdit) editar("receitasAvulsas", item.id, dados);
      else update((s) => { s.receitasAvulsas = [...s.receitasAvulsas, { id: uid(), ...dados }]; });
    }
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? "Editar" : "Nova"} {subtipo === "fixa" ? "Receita Fixa" : "Receita Avulsa"} <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
        <div className="field"><label>Nome</label><input placeholder={subtipo === "fixa" ? "Ex: Salário" : "Ex: Freela"} value={form.nome} onChange={f("nome")} /></div>
        <div className="field-row">
          <div className="field"><label>Valor (R$)</label><input type="number" placeholder="0,00" value={form.valor} onChange={f("valor")} /></div>
          {subtipo === "fixa"
            ? <div className="field"><label>Dia do mês</label><input type="number" min="1" max="31" placeholder="Ex: 30" value={form.dia} onChange={f("dia")} /></div>
            : <div className="field"><label>Data</label><input type="date" value={form.data} onChange={f("data")} /></div>
          }
        </div>
        {subtipo === "fixa" && (
          <>
            <div className="field"><label>Data início</label><input type="date" value={form.dataInicio} onChange={f("dataInicio")} /></div>
            <div className="toggle-row">
              <label>Tem data de término?</label>
              <div className={`toggle${form.temFim ? " on" : ""}`} onClick={() => setForm((p) => ({ ...p, temFim: !p.temFim }))} />
            </div>
            {form.temFim && <div className="field"><label>Data término</label><input type="date" value={form.dataFim} onChange={f("dataFim")} /></div>}
          </>
        )}
        <button className="btn btn-primary btn-full" onClick={salvar}>{isEdit ? "Salvar alterações" : "Adicionar"}</button>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconHome  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
const IconList  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
const IconGear  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IconOlho = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconOlhoFechado = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
