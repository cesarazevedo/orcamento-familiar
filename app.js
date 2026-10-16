// Orçamento Familiar — lê a planilha do Google direto no navegador (sem servidor).
const SHEET_ID = '1pZYB9Y8d1mV_6TZStmLbH632bIZd6WwEaNLd3rvkvlI';
const ABA = 'Orçamento Mensal';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(ABA)}`;
const CACHE_KEY = `orcamento_cache_v1_${SHEET_ID}`;

// ── Leitura da planilha ───────────────────────────────────────
function parseCSV(text) {
  const grid = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); grid.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); grid.push(row); }
  return grid;
}

function money(s) {
  const n = parseFloat(String(s || '').replace(/[^\d,\-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Transforma a grade da planilha em linhas: { bloco, item, categoria, previsto, realizado }
function parseOrcamento(grid) {
  const cl = (r, i) => String((r && r[i]) || '').trim();
  const out = [];
  grid.forEach((r) => r.forEach((c) => {
    const g = String(c || '').trim();
    if (g.startsWith('Mês:')) out.push({ bloco: 'info', item: 'Mês', categoria: g.slice(4).trim() });
    if (g.startsWith('Status:')) out.push({ bloco: 'info', item: 'Status', categoria: g.slice(7).trim() });
  }));
  const kr = grid.findIndex((r) => r.some((c) => String(c).trim() === 'RECEITAS TOTAIS'));
  if (kr >= 0) {
    grid[kr].forEach((c, i) => {
      const lab = String(c).trim();
      if (!lab) return;
      const v = cl(grid[kr + 1], i);
      out.push({ bloco: 'resumo', item: lab, realizado: v.includes('%') ? money(v) / 100 : money(v) });
    });
  }
  const blocos = { 'Fonte de Receita': 'receita', 'Despesa Fixa': 'fixa', 'Despesa Variável': 'variavel', 'Reserva / Investimento': 'investimento' };
  let cur = null, col = 0;
  grid.forEach((r) => {
    const ci = r.findIndex((c) => String(c).trim() === 'Categoria');
    if (ci > 0 && blocos[cl(r, ci - 1)]) { cur = blocos[cl(r, ci - 1)]; col = ci; return; }
    if (!cur) return;
    const item = cl(r, col - 1);
    if (!item) { cur = null; return; }
    if (cl(r, col)) {
      out.push({ bloco: cur, item, categoria: cl(r, col), previsto: money(r[col + 1]), realizado: money(r[col + 2]) });
    }
  });
  let hi = -1, hc = -1;
  grid.forEach((r, i) => { const c = r.findIndex((x) => String(x).trim() === 'Categoria Consolidada'); if (c >= 0 && hi < 0) { hi = i; hc = c; } });
  if (hi >= 0) {
    for (let j = hi + 1; j < grid.length && cl(grid[j], hc); j++) {
      out.push({ bloco: 'grupo', item: cl(grid[j], hc), realizado: money(grid[j][hc + 1]) });
    }
  }
  return out;
}

// ── Cálculos ──────────────────────────────────────────────────
const soma = (rows, b, campo = 'realizado') => rows.filter((r) => r.bloco === b).reduce((s, r) => s + (r[campo] || 0), 0);
const TIPO = { receita: 'Receita', fixa: 'Despesa fixa', variavel: 'Despesa variável', investimento: 'Investimento' };

function calcular(rows) {
  const renda = soma(rows, 'receita');
  const itens = rows.filter((r) => TIPO[r.bloco]).map((r) => ({
    item: r.item, tipo: TIPO[r.bloco], categoria: r.categoria, previsto: r.previsto, realizado: r.realizado,
    desvio: r.realizado - r.previsto, pct_renda: r.bloco === 'receita' || !renda ? null : r.realizado / renda,
  }));
  const nomes = { fixa: 'Despesas fixas', variavel: 'Despesas variáveis', investimento: 'Investimentos' };
  const blocos = ['fixa', 'variavel', 'investimento'].map((b) => {
    const previsto = soma(rows, b, 'previsto'), realizado = soma(rows, b);
    const desvio = realizado - previsto;
    const status = b === 'investimento' ? (desvio < 0 ? 'abaixo' : 'ok') : (desvio > 0 ? 'acima' : 'ok');
    return { bloco: b, nome: nomes[b], previsto, realizado, desvio, status };
  });
  const partes = [['Despesas fixas', soma(rows, 'fixa')], ['Despesas variáveis', soma(rows, 'variavel')], ['Investimentos', soma(rows, 'investimento')]];
  partes.push(['Sobra', Math.max(renda - partes.reduce((s, p) => s + p[1], 0), 0)]);
  const uso = partes.map(([parte, valor]) => ({ parte, valor, pct: renda ? valor / renda : 0 }));
  const grupos = rows.filter((r) => r.bloco === 'grupo').map((r) => ({ grupo: r.item, valor: r.realizado, pct_renda: renda ? r.realizado / renda : 0 }))
    .sort((a, b) => b.valor - a.valor);
  const gastos = rows.filter((r) => r.bloco === 'fixa' || r.bloco === 'variavel');
  const totalGastos = gastos.reduce((s, r) => s + r.realizado, 0);
  const top = gastos.filter((r) => r.realizado > 0).sort((a, b) => b.realizado - a.realizado).slice(0, 8)
    .map((r) => ({ item: r.item, valor: r.realizado, pct: totalGastos ? r.realizado / totalGastos : 0 }));
  return { itens, blocos, uso, grupos, top };
}

// ── Tela ──────────────────────────────────────────────────────
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const $ = (id) => document.getElementById(id);
const root = $('og'), tip = $('og-tip');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const MUTED = 'var(--muted)';
const COR = ['var(--c1)', 'var(--c2)', 'var(--c3)'];
let dados = null; // { rows, calc }

function falha(box) {
  const f = el('div', 'og-fail'); f.append(el('i'), el('span', null, 'Não foi possível carregar'));
  box.replaceChildren(f);
}

function desenharResumo(rows) {
  const pega = (item) => (rows.find((r) => r.bloco === 'resumo' && r.item === item) || {}).realizado;
  const info = (item) => (rows.find((r) => r.bloco === 'info' && r.item === item) || {}).categoria;
  $('og-mes').textContent = info('Mês') || '—';
  $('og-status').textContent = info('Status') || '—';
  const rec = pega('RECEITAS TOTAIS'), des = pega('DESPESAS TOTAIS'), sal = pega('SALDO LÍQUIDO'), taxa = pega('TAXA DE ECONOMIA');
  $('k-receitas').textContent = rec != null ? BRL.format(rec) : '—';
  $('k-despesas').textContent = des != null ? BRL.format(des) : '—';
  $('k-saldo').textContent = sal != null ? BRL.format(sal) : '—';
  $('k-taxa').textContent = taxa != null ? PCT.format(taxa) : '—';
  const inv = dados.calc.blocos.find((b) => b.bloco === 'investimento');
  const lead = $('og-lead'); lead.replaceChildren('Sobram ');
  lead.append(el('b', null, sal != null ? BRL.format(sal) : '—'), ' no mês, ', el('b', null, taxa != null ? PCT.format(taxa) : '—'),
    ' da renda. Investido até agora: ', el('b', null, BRL.format(inv ? inv.realizado : 0)), '.');
}

function desenharUso(uso) {
  const stack = $('og-stack'), legend = $('og-legend');
  const cor = (i) => (i === 3 ? MUTED : COR[i]);
  stack.replaceChildren(...uso.filter((r) => r.valor > 0).map((r) => {
    const s = el('div', 'og-seg'); s.style.flex = r.valor + ' 1 0'; s.style.background = cor(uso.indexOf(r));
    s.dataset.tip = r.parte + ': ' + BRL.format(r.valor) + ' (' + PCT.format(r.pct) + ' da renda)';
    return s;
  }));
  legend.replaceChildren(...uso.map((r, i) => {
    const li = el('div', 'og-li'); const sw = el('span', 'og-sw'); sw.style.background = cor(i);
    li.append(sw, el('span', null, r.parte), el('span', null, BRL.format(r.valor) + ' · ' + PCT.format(r.pct)));
    return li;
  }));
}

function desenharBarras(boxId, rows, label, value, pct, cor) {
  const max = Math.max(...rows.map((r) => r[value]), 1);
  $(boxId).replaceChildren(...rows.map((r) => {
    const line = el('div', 'og-r'); line.append(el('span', 'l', r[label]));
    const track = el('div', 'og-track'); const bar = el('div', 'og-bar');
    bar.style.width = (r[value] / max * 100) + '%'; bar.style.background = r[value] > 0 ? cor : MUTED;
    track.append(bar); line.append(track, el('span', 'v', BRL.format(r[value])));
    line.dataset.tip = r[label] + ': ' + BRL.format(r[value]) + ' (' + PCT.format(r[pct]) + ')';
    return line;
  }));
}

function desenharPrevisto(blocos) {
  const max = Math.max(...blocos.map((r) => Math.max(r.previsto, r.realizado)), 1);
  const texto = { ok: ['ok', '✓ Dentro do previsto'], acima: ['bad', '▲ Acima do previsto'], abaixo: ['warn', '▼ Abaixo da meta'] };
  $('og-previsto').replaceChildren(...blocos.map((r, i) => {
    const w = el('div', 'og-pair'); const head = el('div', 'og-pairhead');
    const st = texto[r.status];
    head.append(el('span', null, r.nome), el('span', 'og-chip ' + st[0], st[1])); w.append(head);
    [['Previsto', r.previsto, '6px'], ['Realizado', r.realizado, '12px']].forEach(([n, v, h]) => {
      const l = el('div', 'og-line'); l.append(el('span', null, n));
      const t = el('div', 'og-track'); t.style.height = h; const b = el('div', 'og-bar');
      b.style.width = (v / max * 100) + '%'; b.style.background = n === 'Previsto' ? MUTED : COR[i];
      t.append(b); l.append(t, el('span', 'v', BRL.format(v))); w.append(l);
    });
    w.dataset.tip = r.nome + ' · previsto ' + BRL.format(r.previsto) + ', realizado ' + BRL.format(r.realizado);
    return w;
  }));
}

const estado = { q: '', tipo: 'Todos', zero: true, key: null, dir: 1 };
const PLURAL = { Todos: 'Todos', Receita: 'Receitas', 'Despesa fixa': 'Despesas fixas', 'Despesa variável': 'Despesas variáveis', Investimento: 'Investimentos' };
const TIPOS = ['Todos', 'Receita', 'Despesa fixa', 'Despesa variável', 'Investimento'];
const tiposBox = $('og-tipos');
TIPOS.forEach((t) => {
  const b = el('button', null, PLURAL[t]); b.type = 'button'; b.dataset.tipo = t;
  b.addEventListener('click', () => { estado.tipo = t; desenharTabela(); });
  tiposBox.append(b, document.createTextNode(' '));
});
$('og-q').addEventListener('input', (e) => { estado.q = e.target.value.toLowerCase(); desenharTabela(); });
$('og-zero').addEventListener('change', (e) => { estado.zero = e.target.checked; desenharTabela(); });
document.querySelectorAll('#og-tabela th').forEach((th) => th.addEventListener('click', () => {
  const k = th.dataset.field; estado.dir = estado.key === k ? -estado.dir : 1; estado.key = k; desenharTabela();
}));

function desenharTabela() {
  const tb = document.querySelector('#og-tabela tbody');
  tiposBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === estado.tipo)));
  document.querySelectorAll('#og-tabela th').forEach((th) => th.setAttribute('aria-sort', th.dataset.field === estado.key ? (estado.dir > 0 ? 'ascending' : 'descending') : 'none'));
  if (!dados) { tb.replaceChildren(); return; }
  const rows = dados.calc.itens;
  let list = rows.filter((r) => (estado.tipo === 'Todos' || r.tipo === estado.tipo)
    && (!estado.zero || r.previsto !== 0 || r.realizado !== 0)
    && (!estado.q || (r.item + ' ' + r.categoria).toLowerCase().includes(estado.q)));
  if (estado.key) list = list.slice().sort((a, b) => (typeof a[estado.key] === 'number' || a[estado.key] == null
    ? ((a[estado.key] ?? -Infinity) - (b[estado.key] ?? -Infinity)) : String(a[estado.key]).localeCompare(String(b[estado.key]), 'pt-BR')) * estado.dir);
  const maxPct = Math.max(...rows.map((r) => r.pct_renda || 0), 0.0001);
  tb.replaceChildren(...list.map((r) => {
    const tr = el('tr');
    tr.append(el('td', null, r.item), el('td', null, r.tipo), el('td', null, r.categoria));
    tr.append(el('td', 'n', BRL.format(r.previsto)), el('td', 'n', BRL.format(r.realizado)));
    const despesa = r.tipo === 'Despesa fixa' || r.tipo === 'Despesa variável';
    const bom = despesa ? r.desvio <= 0 : r.desvio >= 0;
    const d = el('td', 'n' + (r.desvio === 0 ? ' z' : ''), (r.desvio > 0 ? '+' : '') + BRL.format(r.desvio));
    if (r.desvio !== 0) d.style.color = bom ? 'var(--ok)' : 'var(--bad)';
    tr.append(d);
    const p = el('td', 'n' + (!r.pct_renda ? ' z' : ''), r.pct_renda == null ? '—' : PCT.format(r.pct_renda));
    if (r.pct_renda) p.style.background = 'linear-gradient(to left, color-mix(in srgb, var(--c1) 30%, transparent) ' + (r.pct_renda / maxPct * 100) + '%, transparent 0)';
    tr.append(p);
    return tr;
  }));
}

root.addEventListener('mousemove', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.style.display = 'none'; return; }
  tip.textContent = t.dataset.tip; tip.style.display = 'block';
  const b = root.getBoundingClientRect();
  tip.style.left = Math.max(0, Math.min(e.clientX - b.left + 12, b.width - tip.offsetWidth - 4)) + 'px';
  tip.style.top = (e.clientY - b.top + 14) + 'px';
});
root.addEventListener('mouseleave', () => { tip.style.display = 'none'; });

function desenharTudo(rows) {
  dados = { rows, calc: calcular(rows) };
  desenharResumo(rows);
  desenharUso(dados.calc.uso);
  desenharBarras('og-grupos', dados.calc.grupos, 'grupo', 'valor', 'pct_renda', COR[0]);
  desenharBarras('og-top', dados.calc.top, 'item', 'valor', 'pct', COR[1]);
  desenharPrevisto(dados.calc.blocos);
  desenharTabela();
}

// ── Carregar (com cópia guardada no navegador, para abrir mesmo sem internet) ──
function quando(ts) {
  return 'Atualizado em ' + new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function carregar() {
  const btn = $('og-atualizar'), erro = $('og-erro');
  btn.disabled = true; erro.hidden = true;
  try {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseOrcamento(parseCSV(await res.text()));
    if (!rows.some((r) => TIPO[r.bloco])) throw new Error('A planilha veio sem os lançamentos esperados');
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows })); } catch (e) { /* sem cache */ }
    desenharTudo(rows);
    $('og-quando').textContent = quando(Date.now());
  } catch (e) {
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (x) { /* sem cache */ }
    if (guardado && guardado.rows) {
      desenharTudo(guardado.rows);
      $('og-quando').textContent = quando(guardado.ts) + ' (cópia guardada)';
      erro.textContent = 'Não consegui buscar a planilha agora. Mostrando a última cópia guardada.';
    } else {
      ['og-stack', 'og-grupos', 'og-top', 'og-previsto'].forEach((id) => falha($(id)));
      $('og-legend').replaceChildren();
      $('og-lead').textContent = 'Não consegui ler a planilha.';
      erro.textContent = 'Confira se a planilha está compartilhada como "qualquer pessoa com o link pode ver".';
    }
    erro.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

$('og-atualizar').addEventListener('click', carregar);
carregar();
