import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthLabel = (y, m) => {
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[m - 1]}/${String(y).slice(2)}`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const CATEGORIAS = [
  { id: "moradia",    label: "Moradia",       icon: "🏠" },
  { id: "alimentacao",label: "Alimentação",   icon: "🛒" },
  { id: "transporte", label: "Transporte",    icon: "🚗" },
  { id: "educacao",   label: "Educação",      icon: "📚" },
  { id: "saude",      label: "Saúde",         icon: "🏥" },
  { id: "lazer",      label: "Lazer",         icon: "🎉" },
  { id: "servicos",   label: "Serviços",      icon: "📱" },
  { id: "investimento",label:"Investimento",  icon: "📈" },
  { id: "outros",     label: "Outros",        icon: "📦" },
];

const CAT_MAP = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));

const ESTADO_INICIAL = {
  config: { ciclo1: 15, ciclo2: 30, nomeFamilia: "Minha Família" },
  receitasFixas: [],
  despesasFixas: [],
  receitasAvulsas: [],
  despesasVariaveis: [],
  pagamentos: {}, // key: `${despFixaId}-${ano}-${mes}` → { pago: bool, valor: number }
};

// ─── Storage ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "controle-financeiro-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ESTADO_INICIAL;
    const s = JSON.parse(raw);
    return { ...ESTADO_INICIAL, ...s };
  } catch {
    return ESTADO_INICIAL;
  }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Cores por categoria ──────────────────────────────────────────────────────
const CAT_CORES = {
  moradia:     "#2563eb",
  alimentacao: "#16a34a",
  transporte:  "#d97706",
  educacao:    "#7c3aed",
  saude:       "#dc2626",
  lazer:       "#db2777",
  servicos:    "#0891b2",
  investimento:"#059669",
  outros:      "#6b7280",
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
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

  /* ── Nav ── */
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
  .topbar-badge {
    background: var(--accent);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    letter-spacing: 0.3px;
  }

  /* ── Scrollable content ── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    padding-bottom: 24px;
    scroll-behavior: smooth;
  }
  .content::-webkit-scrollbar { width: 0; }

  /* ── Tab bar ── */
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

  /* ── Cards ── */
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

  /* ── Seção título ── */
  .sec-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.8px;
    color: var(--text3);
    text-transform: uppercase;
    margin: 20px 0 10px;
  }
  .sec-title:first-child { margin-top: 4px; }

  /* ── Summary hero ── */
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
  .hero-cell { }
  .hero-cell-label { font-size: 11px; color: var(--text2); margin-bottom: 3px; }
  .hero-cell-val { font-size: 16px; font-weight: 600; font-family: var(--mono); }

  /* ── Ciclo cards ── */
  .ciclo-card {
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 10px;
    border: 1px solid var(--border);
  }
  .ciclo-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .ciclo-title  { font-size: 14px; font-weight: 600; }
  .ciclo-sub    { font-size: 11px; color: var(--text2); margin-top: 2px; }
  .ciclo-saldo  { font-size: 18px; font-weight: 700; font-family: var(--mono); text-align: right; }
  .ciclo-saldo-label { font-size: 10px; color: var(--text2); text-align: right; }

  .progress-wrap { margin-bottom: 12px; }
  .progress-row  { display: flex; justify-content: space-between; font-size: 11px; color: var(--text2); margin-bottom: 4px; }
  .progress-bar  { height: 4px; background: var(--bg3); border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }

  /* ── Saúde financeira ── */
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
  .saude-ok    { background: rgba(52,211,153,0.12); color: var(--green); border: 1px solid rgba(52,211,153,0.2); }
  .saude-warn  { background: rgba(251,191,36,0.12);  color: var(--yellow);border: 1px solid rgba(251,191,36,0.2); }
  .saude-critico{ background: rgba(248,113,113,0.12); color: var(--red);  border: 1px solid rgba(248,113,113,0.2); }

  /* ── Transaction rows ── */
  .tx-row {
    display: flex;
    align-items: center;
    gap: 12px;
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

  /* ── Status pill ── */
  .pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
    padding: 2px 8px; border-radius: 20px;
  }
  .pill-pago    { background: rgba(52,211,153,0.12); color: var(--green); }
  .pill-pendente{ background: rgba(251,191,36,0.12);  color: var(--yellow); }
  .pill-vencido { background: rgba(248,113,113,0.12); color: var(--red); }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-family: var(--font); font-size: 14px; font-weight: 500;
    cursor: pointer; border: none; transition: all 0.15s;
  }
  .btn-primary  { background: var(--accent); color: #fff; }
  .btn-primary:hover  { background: #4f52d8; }
  .btn-ghost    { background: var(--bg3); color: var(--text); border: 1px solid var(--border2); }
  .btn-ghost:hover    { background: var(--bg2); }
  .btn-danger   { background: rgba(248,113,113,0.15); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
  .btn-danger:hover   { background: rgba(248,113,113,0.25); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-full { width: 100%; }
  .btn-icon { padding: 8px; border-radius: 8px; }

  /* ── FAB ── */
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

  /* ── Modal ── */
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

  /* ── Form ── */
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
  .toggle-row label { font-size: 13px; color: var(--text); }
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

  /* ── Histórico chart ── */
  .chart-wrap { display: flex; align-items: flex-end; gap: 6px; height: 80px; margin: 8px 0 4px; }
  .chart-bar-group { flex: 1; display: flex; align-items: flex-end; gap: 2px; }
  .chart-bar { flex: 1; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.4s ease; }
  .chart-labels { display: flex; gap: 6px; }
  .chart-label { flex: 1; font-size: 9px; color: var(--text3); text-align: center; }

  /* ── Misc ── */
  .divider { height: 1px; background: var(--border); margin: 12px 0; }
  .empty { text-align: center; color: var(--text3); font-size: 13px; padding: 32px 0; }
  .badge-cat {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; padding: 3px 8px;
    border-radius: 6px; background: var(--bg3);
    color: var(--text2);
  }
  .row-actions { display: flex; gap: 6px; margin-top: 8px; justify-content: flex-end; }
  .month-nav { display: flex; align-items: center; gap: 12px; }
  .month-nav button { background: none; border: none; color: var(--text2); cursor: pointer; font-size: 18px; padding: 4px 8px; border-radius: 6px; }
  .month-nav button:hover { background: var(--bg3); color: var(--text); }
  .month-nav span { font-size: 15px; font-weight: 600; min-width: 80px; text-align: center; }

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

  @media (min-width: 600px) {
    .fab { right: calc(50% - 215px + 16px); }
  }
`;

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(() => loadState());
  const [aba, setAba] = useState("inicio");
  const [modal, setModal] = useState(null); // null | { tipo, dados? }
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = { ...prev };
      fn(next);
      return next;
    });
  }, []);

  // ─ Computed ─
  const { totalReceitas, totalDespesas, saldo, cicloData, saudeMes, historico } = useMemo(() => {
    const { ano, mes } = mesAtual;
    const { config, receitasFixas, receitasAvulsas, despesasFixas, despesasVariaveis, pagamentos } = state;

    // Receitas do mês
    const rfMes = receitasFixas.reduce((s, r) => {
      const ini = new Date(r.dataInicio + "T00:00:00");
      const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
      const mesRef = new Date(ano, mes - 1, 1);
      if (ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef)) return s + r.valor;
      return s;
    }, 0);

    const raMes = receitasAvulsas.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    }).reduce((s, r) => s + r.valor, 0);

    const totalReceitas = rfMes + raMes;

    // Despesas fixas do mês
    const dfMes = despesasFixas.filter((d) => {
      const ini = new Date(d.dataInicio + "T00:00:00");
      const fim = d.dataFim ? new Date(d.dataFim + "T00:00:00") : null;
      const mesRef = new Date(ano, mes - 1, 1);
      return ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef);
    });

    // Despesas variáveis do mês
    const dvMes = despesasVariaveis.filter((d) => {
      const dt = new Date(d.data + "T00:00:00");
      return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
    });

    const totalDespesasFixas = dfMes.reduce((s, d) => {
      const key = `${d.id}-${ano}-${mes}`;
      const pg = pagamentos[key];
      return s + (pg ? pg.valor : d.valor);
    }, 0);

    const totalDespesasVar = dvMes.reduce((s, d) => s + d.valor, 0);
    const totalDespesas = totalDespesasFixas + totalDespesasVar;
    const saldo = totalReceitas - totalDespesas;

    // Ciclos
    const c1 = config.ciclo1;
    const c2 = config.ciclo2;
    const cicloData = [
      {
        label: `Até dia ${c1}`,
        receita: receitasFixas.filter((r) => r.dia === c2 || r.dia <= c1).reduce((s, r) => {
          const ini = new Date(r.dataInicio + "T00:00:00");
          const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
          const mesRef = new Date(ano, mes - 1, 1);
          if (ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef)) return s + r.valor;
          return s;
        }, 0) + receitasAvulsas.filter((r) => {
          const d = new Date(r.data + "T00:00:00");
          return d.getFullYear() === ano && d.getMonth() + 1 === mes && d.getDate() <= c1;
        }).reduce((s, r) => s + r.valor, 0),
        despesas: dfMes.filter((d) => d.diaVencimento <= c1).map((d) => {
          const key = `${d.id}-${ano}-${mes}`;
          const pg = pagamentos[key];
          return { ...d, pago: pg?.pago || false, valorReal: pg?.valor ?? d.valor };
        }),
        despesasVar: dvMes.filter((d) => {
          const dt = new Date(d.data + "T00:00:00");
          return dt.getDate() <= c1;
        }),
      },
      {
        label: `Até dia ${c2}`,
        receita: receitasFixas.filter((r) => r.dia > c1 && r.dia <= c2).reduce((s, r) => {
          const ini = new Date(r.dataInicio + "T00:00:00");
          const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
          const mesRef = new Date(ano, mes - 1, 1);
          if (ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef)) return s + r.valor;
          return s;
        }, 0) + receitasAvulsas.filter((r) => {
          const d = new Date(r.data + "T00:00:00");
          return d.getFullYear() === ano && d.getMonth() + 1 === mes && d.getDate() > c1 && d.getDate() <= c2;
        }).reduce((s, r) => s + r.valor, 0),
        despesas: dfMes.filter((d) => d.diaVencimento > c1 && d.diaVencimento <= c2).map((d) => {
          const key = `${d.id}-${ano}-${mes}`;
          const pg = pagamentos[key];
          return { ...d, pago: pg?.pago || false, valorReal: pg?.valor ?? d.valor };
        }),
        despesasVar: dvMes.filter((d) => {
          const dt = new Date(d.data + "T00:00:00");
          return dt.getDate() > c1 && dt.getDate() <= c2;
        }),
      },
    ];

    // Saúde financeira (próximo mês)
    const proximoAno = mes === 12 ? ano + 1 : ano;
    const proximoMes = mes === 12 ? 1 : mes + 1;
    const recFixProx = receitasFixas.reduce((s, r) => {
      const ini = new Date(r.dataInicio + "T00:00:00");
      const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
      const mesRef = new Date(proximoAno, proximoMes - 1, 1);
      if (ini <= new Date(proximoAno, proximoMes - 1, 28) && (!fim || fim >= mesRef)) return s + r.valor;
      return s;
    }, 0);
    const despFixProx = despesasFixas.reduce((s, d) => {
      const ini = new Date(d.dataInicio + "T00:00:00");
      const fim = d.dataFim ? new Date(d.dataFim + "T00:00:00") : null;
      const mesRef = new Date(proximoAno, proximoMes - 1, 1);
      if (ini <= new Date(proximoAno, proximoMes - 1, 28) && (!fim || fim >= mesRef)) return s + d.valor;
      return s;
    }, 0);
    const saldoProx = recFixProx - despFixProx;
    const pctComprometido = recFixProx > 0 ? (despFixProx / recFixProx) * 100 : 100;
    let saudeStatus = "ok";
    if (pctComprometido >= 95) saudeStatus = "critico";
    else if (pctComprometido >= 80) saudeStatus = "warn";
    const saudeMes = { recFixProx, despFixProx, saldoProx, pctComprometido, status: saudeStatus };

    // Histórico 12 meses
    const historico = [];
    for (let i = 11; i >= 0; i--) {
      let hAno = ano, hMes = mes - i;
      while (hMes <= 0) { hMes += 12; hAno--; }
      const hRf = receitasFixas.reduce((s, r) => {
        const ini = new Date(r.dataInicio + "T00:00:00");
        const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
        const mesRef = new Date(hAno, hMes - 1, 1);
        if (ini <= new Date(hAno, hMes - 1, 28) && (!fim || fim >= mesRef)) return s + r.valor;
        return s;
      }, 0);
      const hRa = receitasAvulsas.filter((r) => {
        const d = new Date(r.data + "T00:00:00");
        return d.getFullYear() === hAno && d.getMonth() + 1 === hMes;
      }).reduce((s, r) => s + r.valor, 0);
      const hDf = despesasFixas.filter((d) => {
        const ini = new Date(d.dataInicio + "T00:00:00");
        const fim = d.dataFim ? new Date(d.dataFim + "T00:00:00") : null;
        const mesRef = new Date(hAno, hMes - 1, 1);
        return ini <= new Date(hAno, hMes - 1, 28) && (!fim || fim >= mesRef);
      }).reduce((s, d) => {
        const key = `${d.id}-${hAno}-${hMes}`;
        const pg = pagamentos[key];
        return s + (pg ? pg.valor : d.valor);
      }, 0);
      const hDv = despesasVariaveis.filter((d) => {
        const dt = new Date(d.data + "T00:00:00");
        return dt.getFullYear() === hAno && dt.getMonth() + 1 === hMes;
      }).reduce((s, d) => s + d.valor, 0);
      historico.push({
        label: monthLabel(hAno, hMes),
        receitas: hRf + hRa,
        despesas: hDf + hDv,
        saldo: (hRf + hRa) - (hDf + hDv),
      });
    }

    return { totalReceitas, totalDespesas, saldo, cicloData, saudeMes, historico };
  }, [state, mesAtual]);

  // ─ Handlers ─
  const marcarPago = (despId, pago, valorAtual) => {
    const { ano, mes } = mesAtual;
    const key = `${despId}-${ano}-${mes}`;
    update((s) => {
      s.pagamentos = { ...s.pagamentos, [key]: { pago, valor: valorAtual } };
    });
  };

  const editarValorPagamento = (despId, novoValor) => {
    const { ano, mes } = mesAtual;
    const key = `${despId}-${ano}-${mes}`;
    const current = state.pagamentos[key] || { pago: false };
    update((s) => {
      s.pagamentos = { ...s.pagamentos, [key]: { ...current, valor: parseFloat(novoValor) || 0 } };
    });
  };

  const excluir = (colecao, id) => {
    update((s) => { s[colecao] = s[colecao].filter((i) => i.id !== id); });
  };

  const exportarCSV = () => {
    const { ano, mes } = mesAtual;
    const rows = [["Data","Nome","Categoria","Tipo","Valor","Status"]];
    state.receitasFixas.forEach((r) => {
      rows.push([`${ano}-${String(mes).padStart(2,"0")}-${String(r.dia).padStart(2,"0")}`, r.nome, "Receita", "Fixa", r.valor.toFixed(2), "Recebida"]);
    });
    state.receitasAvulsas.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      return d.getFullYear() === ano && d.getMonth() + 1 === mes;
    }).forEach((r) => {
      rows.push([r.data, r.nome, "Receita", "Avulsa", r.valor.toFixed(2), "Recebida"]);
    });
    state.despesasFixas.forEach((d) => {
      const key = `${d.id}-${ano}-${mes}`;
      const pg = state.pagamentos[key];
      const valor = pg ? pg.valor : d.valor;
      const status = pg?.pago ? "Pago" : "Pendente";
      rows.push([`${ano}-${String(mes).padStart(2,"0")}-${String(d.diaVencimento).padStart(2,"0")}`, d.nome, CAT_MAP[d.categoria]?.label || d.categoria, "Fixa", valor.toFixed(2), status]);
    });
    state.despesasVariaveis.filter((d) => {
      const dt = new Date(d.data + "T00:00:00");
      return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
    }).forEach((d) => {
      rows.push([d.data, d.nome, CAT_MAP[d.categoria]?.label || d.categoria, "Variável", d.valor.toFixed(2), "Pago"]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financeiro-${ano}-${String(mes).padStart(2,"0")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─ Render ─
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Topbar */}
        <div className="topbar">
          <div>
            <div className="topbar-title">{state.config.nomeFamilia}</div>
            <div className="topbar-sub">{monthLabel(mesAtual.ano, mesAtual.mes)}</div>
          </div>
          <div className="month-nav">
            <button onClick={() => setMesAtual((m) => {
              let mes = m.mes - 1, ano = m.ano;
              if (mes <= 0) { mes = 12; ano--; }
              return { ano, mes };
            })}>‹</button>
            <button onClick={() => {
              const d = new Date();
              setMesAtual({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
            }} style={{ fontSize: 12, padding: "4px 8px" }}>Hoje</button>
            <button onClick={() => setMesAtual((m) => {
              let mes = m.mes + 1, ano = m.ano;
              if (mes > 12) { mes = 1; ano++; }
              return { ano, mes };
            })}>›</button>
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {aba === "inicio" && <AbaInicio state={state} totalReceitas={totalReceitas} totalDespesas={totalDespesas} saldo={saldo} cicloData={cicloData} saudeMes={saudeMes} mesAtual={mesAtual} marcarPago={marcarPago} editarValorPagamento={editarValorPagamento} />}
          {aba === "transacoes" && <AbaTransacoes state={state} mesAtual={mesAtual} excluir={excluir} exportarCSV={exportarCSV} setModal={setModal} />}
          {aba === "historico" && <AbaHistorico historico={historico} />}
          {aba === "config" && <AbaConfig state={state} update={update} setModal={setModal} excluir={excluir} />}
        </div>

        {/* FAB */}
        {(aba === "inicio" || aba === "transacoes") && (
          <button className="fab" onClick={() => setModal({ tipo: "addLancamento" })}>+</button>
        )}

        {/* Tab bar */}
        <div className="tabbar">
          {[
            { id: "inicio",      label: "Início",     icon: <IconHome /> },
            { id: "transacoes",  label: "Transações",  icon: <IconList /> },
            { id: "historico",   label: "Histórico",   icon: <IconChart /> },
            { id: "config",      label: "Ajustes",     icon: <IconGear /> },
          ].map((t) => (
            <button key={t.id} className={`tab-btn${aba === t.id ? " active" : ""}`} onClick={() => setAba(t.id)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Modals */}
        {modal && (
          <Modal modal={modal} setModal={setModal} state={state} update={update} mesAtual={mesAtual} />
        )}
      </div>
    </>
  );
}

// ─── Aba Início ──────────────────────────────────────────────────────────────
function AbaInicio({ state, totalReceitas, totalDespesas, saldo, cicloData, saudeMes, mesAtual, marcarPago, editarValorPagamento }) {
  const hoje = new Date();
  const diaHoje = hoje.getDate();

  return (
    <>
      {/* Hero saldo */}
      <div className="hero">
        <div className="hero-label">SALDO DO MÊS</div>
        <div className={`hero-value ${saldo >= 0 ? "pos" : "neg"}`}>{fmtBRL(saldo)}</div>
        <div className="hero-grid">
          <div className="hero-cell">
            <div className="hero-cell-label">↑ Receitas</div>
            <div className="hero-cell-val" style={{ color: "var(--green)" }}>{fmtBRL(totalReceitas)}</div>
          </div>
          <div className="hero-cell">
            <div className="hero-cell-label">↓ Despesas</div>
            <div className="hero-cell-val" style={{ color: "var(--red)" }}>{fmtBRL(totalDespesas)}</div>
          </div>
        </div>
      </div>

      {/* Saúde próximo mês */}
      <div className="sec-title">Saúde do Próximo Mês</div>
      <SaudeCard saudeMes={saudeMes} />

      {/* Ciclos */}
      <div className="sec-title">Ciclos de Pagamento</div>
      {cicloData.map((ciclo, i) => (
        <CicloCard key={i} ciclo={ciclo} diaHoje={diaHoje} mesAtual={mesAtual} marcarPago={marcarPago} editarValorPagamento={editarValorPagamento} state={state} />
      ))}
    </>
  );
}

function SaudeCard({ saudeMes }) {
  const { recFixProx, despFixProx, saldoProx, pctComprometido, status } = saudeMes;
  const label = status === "ok" ? "Folgado" : status === "warn" ? "Apertado" : "Sobrecarregado";
  const badgeClass = status === "ok" ? "saude-ok" : status === "warn" ? "saude-warn" : "saude-critico";
  const emoji = status === "ok" ? "✓" : status === "warn" ? "⚠" : "✕";
  const pct = Math.min(Math.round(pctComprometido), 100);
  const barColor = status === "ok" ? "var(--green)" : status === "warn" ? "var(--yellow)" : "var(--red)";

  return (
    <div className="card">
      <span className={`saude-badge ${badgeClass}`}>{emoji} {label}</span>
      <div className="progress-wrap">
        <div className="progress-row">
          <span>Comprometido</span>
          <span>{pct}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>
      <div className="stat-row">
        <span className="stat-label">Receitas previstas</span>
        <span className="stat-val" style={{ color: "var(--green)" }}>{fmtBRL(recFixProx)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Despesas fixas previstas</span>
        <span className="stat-val" style={{ color: "var(--red)" }}>{fmtBRL(despFixProx)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label" style={{ fontWeight: 600, color: "var(--text)" }}>Disponível para investir</span>
        <span className="stat-val" style={{ color: saldoProx >= 0 ? "var(--green)" : "var(--red)", fontSize: 16 }}>{fmtBRL(saldoProx)}</span>
      </div>
    </div>
  );
}

function CicloCard({ ciclo, diaHoje, mesAtual, marcarPago, editarValorPagamento, state }) {
  const totalFixas = ciclo.despesas.reduce((s, d) => s + d.valorReal, 0);
  const totalVar   = ciclo.despesasVar.reduce((s, d) => s + d.valor, 0);
  const totalDesp  = totalFixas + totalVar;
  const pagas      = ciclo.despesas.filter((d) => d.pago).reduce((s, d) => s + d.valorReal, 0);
  const pendentes  = totalFixas - pagas;
  const saldoCiclo = ciclo.receita - totalDesp;
  const pct        = ciclo.receita > 0 ? Math.min(Math.round((totalDesp / ciclo.receita) * 100), 100) : 0;
  const barColor   = pct < 70 ? "var(--green)" : pct < 90 ? "var(--yellow)" : "var(--red)";
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="ciclo-card" style={{ background: "var(--bg2)" }}>
      <div className="ciclo-header" onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer" }}>
        <div>
          <div className="ciclo-title">{ciclo.label}</div>
          <div className="ciclo-sub">{ciclo.despesas.length} fixas · {ciclo.despesasVar.length} variáveis</div>
        </div>
        <div>
          <div className={`ciclo-saldo`} style={{ color: saldoCiclo >= 0 ? "var(--green)" : "var(--red)" }}>{fmtBRL(saldoCiclo)}</div>
          <div className="ciclo-saldo-label">saldo do ciclo</div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-row">
          <span>Receita: {fmtBRL(ciclo.receita)}</span>
          <span>{pct}% usado</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      </div>

      {expanded && (
        <>
          {ciclo.despesas.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 6 }}>DESPESAS FIXAS</div>
              {ciclo.despesas.map((d) => {
                const cat = CAT_MAP[d.categoria];
                return (
                  <div key={d.id} className="tx-row">
                    <button
                      className={`check-btn${d.pago ? " checked" : ""}`}
                      onClick={() => marcarPago(d.id, !d.pago, d.valorReal)}
                    >
                      {d.pago && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria]}18` }}>
                      {cat?.icon || "📦"}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name" style={{ textDecoration: d.pago ? "line-through" : "none", color: d.pago ? "var(--text2)" : "var(--text)" }}>{d.nome}</div>
                      <div className="tx-meta">Vence dia {d.diaVencimento} · {d.valorVariavel ? "valor variável" : "fixo"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {d.valorVariavel && !d.pago ? (
                        <input
                          type="number"
                          value={d.valorReal}
                          onChange={(e) => editarValorPagamento(d.id, e.target.value)}
                          style={{ width: 90, background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 6px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, textAlign: "right" }}
                        />
                      ) : (
                        <span className="tx-val neg">{fmtBRL(d.valorReal)}</span>
                      )}
                      <span className={`pill ${d.pago ? "pill-pago" : "pill-pendente"}`}>{d.pago ? "Pago" : "Pendente"}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {ciclo.despesasVar.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, letterSpacing: "0.5px", margin: "12px 0 6px" }}>DESPESAS VARIÁVEIS</div>
              {ciclo.despesasVar.map((d) => {
                const cat = CAT_MAP[d.categoria];
                return (
                  <div key={d.id} className="tx-row">
                    <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria] || "#6b7280"}18` }}>
                      {cat?.icon || "📦"}
                    </div>
                    <div className="tx-info">
                      <div className="tx-name">{d.nome}</div>
                      <div className="tx-meta">{d.data} · {cat?.label}</div>
                    </div>
                    <span className="tx-val neg">{fmtBRL(d.valor)}</span>
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
function AbaTransacoes({ state, mesAtual, excluir, exportarCSV, setModal }) {
  const { ano, mes } = mesAtual;
  const [filtro, setFiltro] = useState("todos");

  const recFixMes = state.receitasFixas.filter((r) => {
    const ini = new Date(r.dataInicio + "T00:00:00");
    const fim = r.dataFim ? new Date(r.dataFim + "T00:00:00") : null;
    const mesRef = new Date(ano, mes - 1, 1);
    return ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef);
  });
  const recAvMes = state.receitasAvulsas.filter((r) => {
    const d = new Date(r.data + "T00:00:00");
    return d.getFullYear() === ano && d.getMonth() + 1 === mes;
  });
  const despFixMes = state.despesasFixas.filter((d) => {
    const ini = new Date(d.dataInicio + "T00:00:00");
    const fim = d.dataFim ? new Date(d.dataFim + "T00:00:00") : null;
    const mesRef = new Date(ano, mes - 1, 1);
    return ini <= new Date(ano, mes - 1, 28) && (!fim || fim >= mesRef);
  });
  const despVarMes = state.despesasVariaveis.filter((d) => {
    const dt = new Date(d.data + "T00:00:00");
    return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
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
        <button className="btn btn-sm btn-ghost" onClick={exportarCSV} style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
          ↓ CSV
        </button>
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
                <span className="tx-val pos">{fmtBRL(r.valor)}</span>
              </div>
            ))}
            {recAvMes.map((r) => (
              <div key={r.id} className="tx-row">
                <div className="tx-icon" style={{ background: "rgba(52,211,153,0.12)", fontSize: 18 }}>💰</div>
                <div className="tx-info">
                  <div className="tx-name">{r.nome}</div>
                  <div className="tx-meta">Avulsa · {r.data}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span className="tx-val pos">{fmtBRL(r.valor)}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => excluir("receitasAvulsas", r.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {(filtro === "todos" || filtro === "despesas") && (
        <>
          <div className="sec-title">Despesas Fixas</div>
          <div className="card" style={{ padding: "8px 14px" }}>
            {despFixMes.length === 0 && <div className="empty">Nenhuma despesa fixa</div>}
            {despFixMes.map((d) => {
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
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className="tx-val neg">{fmtBRL(pg?.valor ?? d.valor)}</span>
                    <span className={`pill ${pg?.pago ? "pill-pago" : "pill-pendente"}`}>{pg?.pago ? "Pago" : "Pendente"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sec-title">Despesas Variáveis</div>
          <div className="card" style={{ padding: "8px 14px" }}>
            {despVarMes.length === 0 && <div className="empty">Nenhuma despesa variável</div>}
            {despVarMes.map((d) => {
              const cat = CAT_MAP[d.categoria];
              return (
                <div key={d.id} className="tx-row">
                  <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria] || "#6b7280"}18` }}>{cat?.icon || "📦"}</div>
                  <div className="tx-info">
                    <div className="tx-name">{d.nome}</div>
                    <div className="tx-meta">{cat?.label} · {d.data}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className="tx-val neg">{fmtBRL(d.valor)}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => excluir("despesasVariaveis", d.id)}>✕</button>
                  </div>
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
function AbaHistorico({ historico }) {
  const maxVal = Math.max(...historico.map((h) => Math.max(h.receitas, h.despesas)), 1);

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
              <div className="chart-bar" style={{ height: `${Math.round((h.receitas / maxVal) * 100)}%`, background: "var(--green)", opacity: 0.7 }} />
              <div className="chart-bar" style={{ height: `${Math.round((h.despesas / maxVal) * 100)}%`, background: "var(--red)", opacity: 0.7 }} />
            </div>
          ))}
        </div>
        <div className="chart-labels">
          {historico.map((h, i) => (
            <div key={i} className="chart-label">{h.label}</div>
          ))}
        </div>
      </div>

      <div className="sec-title">Detalhamento</div>
      {[...historico].reverse().map((h, i) => (
        <div key={i} className="card-sm">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{h.label}</span>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15, color: h.saldo >= 0 ? "var(--green)" : "var(--red)" }}>{fmtBRL(h.saldo)}</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <span style={{ fontSize: 12, color: "var(--green)" }}>↑ {fmtBRL(h.receitas)}</span>
            <span style={{ fontSize: 12, color: "var(--red)" }}>↓ {fmtBRL(h.despesas)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Aba Config ───────────────────────────────────────────────────────────────
function AbaConfig({ state, update, setModal, excluir }) {
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
            <label>Ciclo 1 — dia</label>
            <input type="number" min="1" max="28" value={state.config.ciclo1} onChange={(e) => update((s) => { s.config.ciclo1 = parseInt(e.target.value) || 15; })} />
          </div>
          <div className="field">
            <label>Ciclo 2 — dia</label>
            <input type="number" min="1" max="31" value={state.config.ciclo2} onChange={(e) => update((s) => { s.config.ciclo2 = parseInt(e.target.value) || 30; })} />
          </div>
        </div>
      </div>

      <div className="sec-title">Receitas Fixas</div>
      {state.receitasFixas.map((r) => (
        <div key={r.id} className="card-sm" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.nome}</div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>Dia {r.dia} · {fmtBRL(r.valor)}</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => excluir("receitasFixas", r.id)}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-full" style={{ marginBottom: 4 }} onClick={() => setModal({ tipo: "addReceita", subtipo: "fixa" })}>+ Receita fixa</button>

      <div className="sec-title">Despesas Fixas Cadastradas</div>
      {state.despesasFixas.map((d) => {
        const cat = CAT_MAP[d.categoria];
        return (
          <div key={d.id} className="card-sm" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="tx-icon" style={{ background: `${CAT_CORES[d.categoria]}18`, width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{cat?.icon || "📦"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{d.nome}</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>Dia {d.diaVencimento} · {fmtBRL(d.valor)}{d.valorVariavel ? " (variável)" : ""}{d.dataFim ? ` · até ${d.dataFim}` : ""}</div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => excluir("despesasFixas", d.id)}>✕</button>
          </div>
        );
      })}
      <button className="btn btn-ghost btn-full" onClick={() => setModal({ tipo: "addDespesaFixa" })}>+ Despesa fixa</button>
    </>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ modal, setModal, state, update, mesAtual }) {
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

  if (modal.tipo === "addDespesaVar") {
    return <ModalDespesaVar fechar={fechar} update={update} mesAtual={mesAtual} />;
  }

  if (modal.tipo === "addDespesaFixa") {
    return <ModalDespesaFixa fechar={fechar} update={update} />;
  }

  if (modal.tipo === "addReceita") {
    return <ModalReceita fechar={fechar} update={update} subtipo={modal.subtipo} mesAtual={mesAtual} />;
  }

  return null;
}

function ModalDespesaVar({ fechar, update, mesAtual }) {
  const [form, setForm] = useState({ nome: "", categoria: "alimentacao", valor: "", data: today() });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor) return;
    update((s) => {
      s.despesasVariaveis = [...s.despesasVariaveis, { id: uid(), ...form, valor: parseFloat(form.valor) }];
    });
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Despesa Variável <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
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
        <button className="btn btn-primary btn-full" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}

function ModalDespesaFixa({ fechar, update }) {
  const [form, setForm] = useState({ nome: "", categoria: "moradia", valor: "", diaVencimento: "", dataInicio: today().slice(0, 7) + "-01", dataFim: "", valorVariavel: false, temFim: false });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor || !form.diaVencimento) return;
    update((s) => {
      s.despesasFixas = [...s.despesasFixas, {
        id: uid(),
        nome: form.nome,
        categoria: form.categoria,
        valor: parseFloat(form.valor),
        diaVencimento: parseInt(form.diaVencimento),
        dataInicio: form.dataInicio,
        dataFim: form.temFim ? form.dataFim : null,
        valorVariavel: form.valorVariavel,
      }];
    });
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Despesa Fixa <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
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
        <button className="btn btn-primary btn-full" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}

function ModalReceita({ fechar, update, subtipo, mesAtual }) {
  const [form, setForm] = useState({ nome: "", valor: "", dia: "", data: today(), dataInicio: today().slice(0, 7) + "-01", dataFim: "", temFim: false });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const salvar = () => {
    if (!form.nome || !form.valor) return;
    if (subtipo === "fixa") {
      update((s) => {
        s.receitasFixas = [...s.receitasFixas, { id: uid(), nome: form.nome, valor: parseFloat(form.valor), dia: parseInt(form.dia) || 1, dataInicio: form.dataInicio, dataFim: form.temFim ? form.dataFim : null }];
      });
    } else {
      update((s) => {
        s.receitasAvulsas = [...s.receitasAvulsas, { id: uid(), nome: form.nome, valor: parseFloat(form.valor), data: form.data }];
      });
    }
    fechar();
  };
  return (
    <div className="modal-overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{subtipo === "fixa" ? "Receita Fixa" : "Receita Avulsa"} <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar}>✕</button></div>
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
        <button className="btn btn-primary btn-full" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconHome  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
const IconList  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>;
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>;
const IconGear  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
