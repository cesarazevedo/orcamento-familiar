({ answer }) => {
  const a = typeof answer === 'string' ? JSON.parse(answer) : answer;
  if (!a || typeof a.content !== 'string') {
    throw new Error('A planilha não devolveu o conteúdo. Chaves recebidas: ' + Object.keys(a || {}).join(', '));
  }
  const bytes = Uint8Array.from(atob(a.content), (c) => c.charCodeAt(0));
  const csv = new TextDecoder('utf-8').decode(bytes);
  const grid = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); grid.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); grid.push(row); }
  const cl = (r, i) => String((r && r[i]) || '').trim();
  const money = (s) => {
    const n = parseFloat(String(s || '').replace(/[^\d,\-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const out = [];
  grid.forEach((r) => {
    const g = cl(r, 6);
    if (g.startsWith('Mês:')) out.push({ bloco: 'info', item: 'Mês', categoria: g.slice(4).trim(), previsto: null, realizado: null, diferenca: null });
    if (g.startsWith('Status:')) out.push({ bloco: 'info', item: 'Status', categoria: g.slice(7).trim(), previsto: null, realizado: null, diferenca: null });
  });
  const kr = grid.findIndex((r) => cl(r, 1) === 'RECEITAS TOTAIS');
  if (kr >= 0) {
    [1, 3, 5, 7].forEach((c) => {
      const v = cl(grid[kr + 1], c);
      out.push({ bloco: 'resumo', item: cl(grid[kr], c), categoria: '', previsto: null, realizado: v.includes('%') ? money(v) / 100 : money(v), diferenca: null });
    });
  }
  const blocos = { 'Fonte de Receita': 'receita', 'Despesa Fixa': 'fixa', 'Despesa Variável': 'variavel', 'Reserva / Investimento': 'investimento' };
  let cur = null;
  grid.forEach((r) => {
    const b = cl(r, 1);
    if (blocos[b] && cl(r, 2) === 'Categoria') { cur = blocos[b]; return; }
    if (!b) { cur = null; return; }
    if (cur && cl(r, 2)) {
      out.push({ bloco: cur, item: b, categoria: cl(r, 2), previsto: money(r[3]), realizado: money(r[4]), diferenca: money(r[5]) });
    }
  });
  const hi = grid.findIndex((r) => cl(r, 7) === 'Categoria Consolidada');
  if (hi >= 0) {
    for (let j = hi + 1; j < grid.length && cl(grid[j], 7); j++) {
      out.push({ bloco: 'grupo', item: cl(grid[j], 7), categoria: '', previsto: null, realizado: money(grid[j][8]), diferenca: null });
    }
  }
  return out;
}
