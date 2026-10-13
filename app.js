/* SCHLEMPER STREETWEAR · site-app (PWA) · catálogo + painel da loja */
'use strict';

/* ---------- utilitários ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => { const [i, d] = Number(n).toFixed(2).split('.'); return 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
const pad = (n) => String(n).padStart(2, '0');
const dt = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const stockOf = (p) => p.product_variants.reduce((s, v) => s + v.stock, 0);
const avail = (p) => p.available && stockOf(p) > 0;
const parsePrice = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const SLOGAN = 'Ideias vestem grandes';
const PALETTE = [
  ['Preto', '#000000'], ['Branco', '#FFFFFF'], ['Cinza', '#8A8A8A'], ['Off-white', '#EDE8DC'],
  ['Azul', '#1F3A93'], ['Verde', '#2F5D3A'], ['Vermelho', '#B3261E'], ['Bege', '#C8B79A'],
];
const RANGES = [['Até R$ 100', 0, 100], ['R$ 100 a 150', 100, 150], ['Acima de R$ 150', 150, Infinity]];

/* ---------- dados de demonstração (só usados sem config.js preenchido) ---------- */
const DEF_SETTINGS = {
  store_name: 'Schlemper Streetwear', address: 'Endereço da loja (configure no painel)', city: 'Itajaí, SC',
  hours: 'Segunda a sexta: 10h às 19h\nSábado: 10h às 17h', maps_url: '',
  in_store_info: 'Experimente as peças na loja e leve na hora. As compras são feitas somente presencialmente.',
  collection_name: 'Coleção atual', collection_tagline: SLOGAN, sizes: ['P', 'M', 'G', 'GG'],
};
function demoProducts() {
  const C = { preto: ['Preto', '#000000'], branco: ['Branco', '#FFFFFF'], cinza: ['Cinza', '#8A8A8A'] };
  const SZ = ['P', 'M', 'G', 'GG'];
  const mk = (id, name, price, fabric, flags, stock) => ({
    id, name, price, fabric, description: 'Camiseta oversized de caimento amplo, estampa exclusiva Schlemper.',
    front_image_url: null, back_image_url: null, featured: false, is_new: false, available: true, ...flags,
    product_variants: Object.entries(stock).flatMap(([c, qs]) => qs.map((q, i) => ({
      id: `${id}-${c}-${SZ[i]}`, product_id: id, size: SZ[i], stock: q, color: C[c][0], color_hex: C[c][1] }))),
  });
  return [
    mk('d1', 'Oversized Essential', 129.9, '100% algodão penteado, 220 g/m²', { featured: true, is_new: true }, { preto: [4, 6, 5, 2], branco: [3, 5, 4, 0] }),
    mk('d2', 'Oversized Star', 149.9, '100% algodão, malha pesada 240 g/m²', { featured: true }, { preto: [2, 3, 3, 1], cinza: [0, 4, 2, 2] }),
    mk('d3', 'Oversized Logo S', 139.9, '100% algodão penteado, 220 g/m²', { is_new: true }, { branco: [5, 5, 3, 1] }),
    mk('d4', 'Oversized Grandes Ideias', 159.9, 'Algodão fio 30.1, 230 g/m²', { featured: true, is_new: true }, { preto: [1, 2, 2, 1], cinza: [2, 2, 1, 0] }),
    mk('d5', 'Oversized Mono', 119.9, '100% algodão, 200 g/m²', {}, { cinza: [3, 3, 3, 3] }),
    mk('d6', 'Oversized Edição Limitada', 189.9, 'Algodão egípcio, 260 g/m²', { available: false }, { preto: [0, 0, 0, 0] }),
  ];
}

/* ---------- estado ---------- */
const CFG = window.SCHLEMPER_CONFIG || {};
const demo = !(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
const libOk = !!(window.supabase && window.supabase.createClient);
const db = !demo && libOk ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

const S = { products: [], settings: DEF_SETTINGS, loading: true, error: null, auth: 'loading', sales: null, salesErr: null };
let FLT = { q: '', size: null, color: null, range: null };
let P = null, F = null, SF = null, SALE = null, busy = false;

async function load() {
  try {
    S.error = null;
    if (demo) { S.products = demoProducts(); S.settings = DEF_SETTINGS; }
    else {
      if (!db) throw new Error('Não foi possível carregar a biblioteca do Supabase. Verifique a internet.');
      const [p, s] = await Promise.all([
        db.from('products').select('*, product_variants(*)').order('created_at', { ascending: false }),
        db.from('store_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (p.error) throw new Error(p.error.message);
      if (s.error) throw new Error(s.error.message);
      S.products = (p.data || []).map((x) => ({ ...x, price: Number(x.price), product_variants: x.product_variants || [] }));
      S.settings = { ...DEF_SETTINGS, ...(s.data || {}) };
    }
  } catch (e) { S.error = e.message || 'Erro ao carregar.'; }
  S.loading = false;
  const h = location.hash;
  if (!h.startsWith('#/admin/produto/') && h !== '#/admin/loja') render();
}

/* ---------- componentes ---------- */
const empty = (title, hint = '', action = '') =>
  `<div class="empty"><img src="logo-symbol.png" alt=""><b>${esc(title)}</b>${hint ? `<p class="mut">${esc(hint)}</p>` : ''}${action}</div>`;
const chip = (label, on, a, data = '', opts = {}) =>
  `<button class="chip ${on ? 'on' : ''}" data-a="${a}" ${data} ${opts.dis ? 'disabled' : ''}>${opts.sw ? `<i class="sw" style="background:${esc(opts.sw)}"></i>` : ''}${esc(label)}</button>`;
const field = (label, key, val, extra = '') =>
  `<label class="f">${label}<input class="in" data-f="${key}" value="${esc(val)}" ${extra}></label>`;
const area = (label, key, val) => `<label class="f">${label}<textarea class="in" data-f="${key}">${esc(val)}</textarea></label>`;

function card(p) {
  const ok = avail(p);
  return `<a class="card" href="#/p/${esc(p.id)}"><div class="ph">${p.front_image_url
    ? `<img src="${esc(p.front_image_url)}" loading="lazy" alt="">` : '<img class="ghost" src="logo-symbol.png" alt="">'}
    ${p.is_new && ok ? '<span class="badge w">Novo</span>' : ''}${!ok ? '<span class="badge">Indisponível</span>' : ''}</div>
    <div class="cn">${esc(p.name)}</div><div class="cp mut">${brl(p.price)}</div></a>`;
}

const mapsUrl = () => S.settings.maps_url?.trim() ||
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${S.settings.address}, ${S.settings.city}`);

/* ---------- telas públicas ---------- */
function viewHome() {
  const f = S.products.filter((p) => p.featured), n = S.products.filter((p) => p.is_new);
  return `<div class="wrap">
    <div class="top"><img src="logo-wordmark.png" alt="Schlemper"></div>
    ${demo ? '<p class="mut" style="font-size:12px;margin:10px 0 0">Modo demonstração: conecte o Supabase para ver os produtos reais.</p>' : ''}
    <section class="hero"><img class="wm" src="logo-symbol.png" alt=""><div class="hero-in">
      <div class="mut" style="font-weight:600">${esc(S.settings.collection_name)}</div>
      <h1 class="disp h-xl">${esc(S.settings.collection_tagline || SLOGAN)}</h1>
      <a class="btn" href="#/catalogo">Explorar catálogo</a></div></section>
    ${!S.products.length ? empty('Catálogo em breve', 'Ainda não há peças cadastradas. Volte em breve.') : ''}
    ${f.length ? `<h2 class="disp h-m" style="margin:40px 0 16px">Destaques</h2><div class="hscroll">${f.map(card).join('')}</div>` : ''}
    ${n.length ? `<h2 class="disp h-m" style="margin:32px 0 16px">Novidades</h2><div class="grid">${n.map(card).join('')}</div>` : ''}
  </div>`;
}

function filtered() {
  const q = FLT.q.trim().toLowerCase();
  return S.products.filter((p) => {
    if (q && !`${p.name} ${p.description}`.toLowerCase().includes(q)) return false;
    const inS = p.product_variants.filter((v) => v.stock > 0);
    if (FLT.size && !inS.some((v) => v.size === FLT.size && (!FLT.color || v.color === FLT.color))) return false;
    if (FLT.color && !inS.some((v) => v.color === FLT.color && (!FLT.size || v.size === FLT.size))) return false;
    if (FLT.range !== null && (p.price < RANGES[FLT.range][1] || p.price >= RANGES[FLT.range][2])) return false;
    return true;
  });
}
function gridHtml() {
  const l = filtered(), has = FLT.q || FLT.size || FLT.color || FLT.range !== null;
  return `<div class="row" style="justify-content:space-between;margin:14px 0"><span class="mut">${l.length} ${l.length === 1 ? 'peça' : 'peças'}</span>
    ${has ? '<button class="lnk" data-a="fclear">Limpar filtros</button>' : ''}</div>
    ${l.length ? `<div class="grid">${l.map(card).join('')}</div>`
      : empty(S.products.length ? 'Nenhuma peça encontrada' : 'Catálogo em breve', S.products.length ? 'Tente outros filtros ou outra busca.' : 'Ainda não há peças cadastradas.')}`;
}
function viewCatalog() {
  const colors = new Map();
  S.products.forEach((p) => p.product_variants.forEach((v) => colors.set(v.color, v.color_hex)));
  return `<div class="wrap">
    <h1 class="disp h-l" style="margin:6px 0 14px">Catálogo</h1>
    <input class="in" style="margin:0" id="q" type="search" placeholder="Buscar camiseta" value="${esc(FLT.q)}">
    <div class="lbl">Tamanho</div><div class="scroll">${S.settings.sizes.map((s) => chip(s, FLT.size === s, 'fsize', `data-v="${esc(s)}"`)).join('')}</div>
    <div class="lbl">Cor</div><div class="scroll">${[...colors].map(([c, h]) => chip(c, FLT.color === c, 'fcolor', `data-v="${esc(c)}"`, { sw: h })).join('')}</div>
    <div class="lbl">Preço</div><div class="scroll">${RANGES.map((r, i) => chip(r[0], FLT.range === i, 'frange', `data-v="${i}"`)).join('')}</div>
    <div id="grid">${gridHtml()}</div></div>`;
}

function viewProduct(id) {
  const p = S.products.find((x) => x.id === id);
  if (!p) return `<div class="wrap">${empty('Produto não encontrado', '', '<p><a class="btn out sm" href="#/catalogo">Voltar ao catálogo</a></p>')}</div>`;
  P = P || { side: 'front', size: null, color: null };
  const vs = p.product_variants;
  const sizes = [...new Set(vs.map((v) => v.size))].sort((a, b) => S.settings.sizes.indexOf(a) - S.settings.sizes.indexOf(b));
  const colors = new Map(vs.map((v) => [v.color, v.color_hex]));
  const stock = (s, c) => vs.filter((v) => (!s || v.size === s) && (!c || v.color === c)).reduce((a, v) => a + v.stock, 0);
  const sel = P.size && P.color ? vs.find((v) => v.size === P.size && v.color === P.color) : null;
  const img = P.side === 'front' ? p.front_image_url : p.back_image_url;
  let status = 'Escolha tamanho e cor para ver a disponibilidade.', cls = 'mut';
  if (!p.available) { status = 'Indisponível no momento.'; cls = 'red'; }
  else if (P.size && P.color) {
    const n = sel ? sel.stock : 0;
    if (n <= 0) { status = 'Indisponível nesta combinação.'; cls = 'red'; }
    else if (n <= 3) { status = `Últimas ${n} ${n === 1 ? 'unidade' : 'unidades'} na loja.`; cls = ''; }
    else { status = `${n} unidades em estoque.`; cls = ''; }
  }
  return `<div class="wrap">
    <div class="pimg">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : '<img class="ghost" src="logo-symbol.png" alt="">'}
      <a class="back" href="#/catalogo">Voltar</a>
      <div class="sides">${chip('Frente', P.side === 'front', 'pside', 'data-v="front"')}${chip('Costas', P.side === 'back', 'pside', 'data-v="back"')}</div></div>
    <h1 class="disp h-l" style="margin:24px 0 0">${esc(p.name)}</h1>
    <div style="font-size:22px;font-weight:800;margin-top:8px">${brl(p.price)}</div>
    ${p.description ? `<p class="mut" style="line-height:1.6">${esc(p.description)}</p>` : ''}
    ${p.fabric ? `<p><b>Tecido: </b>${esc(p.fabric)}</p>` : ''}
    <div class="lbl" style="color:var(--fg);font-weight:800">Tamanho</div>
    <div class="chips">${sizes.map((s) => chip(s, P.size === s, 'psize', `data-v="${esc(s)}"`, { dis: stock(s, P.color) <= 0 })).join('')}</div>
    <div class="lbl" style="color:var(--fg);font-weight:800">Cor</div>
    <div class="chips">${[...colors].map(([c, h]) => chip(c, P.color === c, 'pcolor', `data-v="${esc(c)}"`, { sw: h, dis: stock(P.size, c) <= 0 })).join('')}</div>
    <p class="${cls}" style="font-weight:700;margin-top:20px">${status}</p>
    <div class="note"><b>Compre na loja</b><p class="mut" style="margin:4px 0 14px">Esta peça é vendida somente presencialmente. Pagamento em Pix ou dinheiro.</p>
      <a class="btn" href="${esc(mapsUrl())}" target="_blank" rel="noopener">Como chegar</a></div></div>`;
}

function viewStore() {
  const s = S.settings;
  const blk = (t, body) => `<div class="block"><h3>${t}</h3>${body}</div>`;
  return `<div class="wrap"><img src="logo-symbol.png" style="width:64px;margin:6px 0 20px" alt="">
    <h1 class="disp h-xl" style="margin-bottom:28px">Nossa loja</h1>
    ${blk('Endereço', `<p>${esc(s.address)}</p><p class="mut">${esc(s.city)}</p><div style="margin-top:16px"><a class="btn" href="${esc(mapsUrl())}" target="_blank" rel="noopener">Como chegar</a></div>`)}
    ${blk('Horário de funcionamento', `<p>${esc(s.hours)}</p>`)}
    ${blk('Compras presenciais', `<p>${esc(s.in_store_info)}</p>`)}
    ${blk('Pagamentos aceitos', '<p>Pix e dinheiro</p>')}
    <p style="text-align:center;margin-top:32px"><a class="mut" style="font-size:12px" href="#/admin">Área da loja</a></p></div>`;
}

/* ---------- admin: acesso ---------- */
async function checkAdmin(session) {
  if (!session) { S.auth = 'out'; return render(); }
  const { data, error } = await db.rpc('is_admin');
  S.auth = !error && data === true ? 'ok' : 'denied';
  render();
}
function initAuth() {
  if (demo || !db) { S.auth = 'out'; return; }
  db.auth.getSession().then(({ data }) => checkAdmin(data.session));
  db.auth.onAuthStateChange((_e, session) => setTimeout(() => checkAdmin(session), 0));
}

const bar = (title, back = '#/admin') => `<div class="bar"><a href="${back}">‹ Voltar</a><b>${title}</b><span style="width:56px"></span></div>`;

function viewLogin() {
  return `<div class="wrap"><p><a class="mut" style="font-weight:700" href="#/loja">‹ Voltar</a></p>
    <img src="logo-symbol.png" style="width:64px;margin:28px 0 20px" alt="">
    <h1 style="font-size:28px;font-weight:900;margin:0 0 6px">Área da loja</h1><p class="mut" style="margin:0 0 28px">Acesso restrito ao administrador.</p>
    ${demo ? '<p class="red">Supabase não configurado. Preencha o arquivo config.js para habilitar o painel.</p>' : `
    <label class="f">E-mail<input class="in" id="em" type="email" autocomplete="email" autocapitalize="none"></label>
    <label class="f">Senha<input class="in" id="pw" type="password" autocomplete="current-password"></label>
    <button class="btn" data-a="login">Entrar</button>`}</div>`;
}
function viewDenied() {
  return `<div class="wrap"><h1 style="font-size:24px;font-weight:900">Sem permissão</h1>
    <p class="mut">Esta conta não está autorizada como administradora da loja.</p><button class="btn" data-a="logout">Sair</button></div>`;
}

/* ---------- admin: painel ---------- */
async function loadSales() {
  if (S.salesLoading) return;
  if (!db) { S.sales = []; setTimeout(render, 0); return; }
  S.salesLoading = true;
  const { data, error } = await db.from('sales').select('*, sale_items(*)').order('created_at', { ascending: false }).limit(500);
  S.salesLoading = false;
  if (error) { S.salesErr = error.message; S.sales = []; }
  else { S.salesErr = null; S.sales = data.map((s) => ({ ...s, total: Number(s.total), sale_items: (s.sale_items || []).map((i) => ({ ...i, unit_price: Number(i.unit_price) })) })); }
  render();
}
const spinner = '<div class="spin"></div>';

function viewDash() {
  if (S.sales === null) { loadSales(); return spinner; }
  const now = new Date(), sum = (l) => l.reduce((a, s) => a + s.total, 0);
  const pcs = (l) => l.reduce((a, s) => a + s.sale_items.reduce((b, i) => b + i.quantity, 0), 0);
  const today = S.sales.filter((s) => new Date(s.created_at).toDateString() === now.toDateString());
  const month = S.sales.filter((s) => { const d = new Date(s.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const stats = (a, b) => `<div class="row" style="margin-bottom:12px;align-items:stretch">${a}${b}</div>`;
  const st = (l, v, sub = '') => `<div class="stat"><small>${l}</small><b>${v}</b>${sub ? `<small style="margin:2px 0 0">${sub}</small>` : ''}</div>`;
  return `<div class="wrap">${bar('Painel', '#/loja')}
    ${S.salesErr ? `<p class="red">${esc(S.salesErr)}</p>` : ''}
    ${stats(st('Vendas hoje', brl(sum(today)), `${pcs(today)} peças`), st('Vendas no mês', brl(sum(month)), `${pcs(month)} peças`))}
    ${stats(st('Pix no mês', brl(sum(month.filter((s) => s.payment_method === 'pix')))), st('Dinheiro no mês', brl(sum(month.filter((s) => s.payment_method === 'cash')))))}
    ${stats(st('Peças em estoque', S.products.reduce((a, p) => a + stockOf(p), 0)), st('Produtos esgotados', S.products.filter((p) => !avail(p)).length))}
    <div class="stack" style="margin-top:28px"><a class="btn" href="#/admin/venda">Registrar venda</a>
      <a class="btn out" href="#/admin/produtos">Produtos e estoque</a><a class="btn out" href="#/admin/vendas">Histórico de vendas</a>
      <a class="btn out" href="#/admin/loja">Dados da loja</a><button class="btn out" data-a="logout">Sair da conta</button></div></div>`;
}

function viewAdminProducts() {
  return `<div class="wrap">${bar('Produtos')}<a class="btn" href="#/admin/produto/novo">Novo produto</a><div style="margin-top:20px">
    ${S.products.length ? S.products.map((p) => `<div class="item"><div class="thumb">${p.front_image_url ? `<img src="${esc(p.front_image_url)}" alt="">` : '<img class="ghost" src="logo-symbol.png" alt="">'}</div>
      <div style="flex:1;min-width:0"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
      <div class="mut">${brl(p.price)} · ${stockOf(p)} em estoque</div>
      <label class="sw-t" style="justify-content:flex-start;gap:10px"><input type="checkbox" data-a="avail" data-id="${esc(p.id)}" ${p.available ? 'checked' : ''}><span style="font-size:13px" class="${p.available ? '' : 'red'}">${p.available ? 'Disponível' : 'Indisponível'}</span></label>
      <div class="row" style="gap:20px"><a style="font-weight:800" href="#/admin/produto/${esc(p.id)}">Editar</a><button class="lnk red" data-a="delprod" data-id="${esc(p.id)}">Excluir</button></div></div></div>`).join('')
      : empty('Nenhum produto cadastrado', 'Toque em Novo produto para começar.')}</div></div>`;
}

function initForm(key) {
  const p = key === 'novo' ? null : S.products.find((x) => x.id === key);
  F = { key, id: p?.id, name: p?.name || '', price: p ? p.price.toFixed(2).replace('.', ',') : '', description: p?.description || '', fabric: p?.fabric || '',
    featured: !!p?.featured, is_new: !!p?.is_new, available: p ? p.available : true,
    front: p?.front_image_url ? { url: p.front_image_url } : null, back: p?.back_image_url ? { url: p.back_image_url } : null,
    rows: (p?.product_variants || []).map((v) => ({ id: v.id, size: v.size, color: v.color, color_hex: v.color_hex, stock: v.stock })), removed: [] };
}
function viewForm(key) {
  if (!F || F.key !== key) initForm(key);
  const photo = (side, label) => `<label class="photo"><div>${F[side] ? `<img src="${esc(F[side].preview || F[side].url)}" alt="">` : 'Adicionar foto'}</div>${label}
    <input type="file" accept="image/*" hidden data-photo="${side}"></label>`;
  const sw = (label, k) => `<label class="sw-t"><span>${label}</span><input type="checkbox" data-fc="${k}" ${F[k] ? 'checked' : ''}></label>`;
  return `<div class="wrap">${bar(F.id ? 'Editar produto' : 'Novo produto', '#/admin/produtos')}
    <div class="row" style="align-items:flex-start;margin-bottom:20px">${photo('front', 'Frente')}${photo('back', 'Costas')}</div>
    ${field('Nome', 'name', F.name)}${field('Preço (R$)', 'price', F.price, 'inputmode="decimal" placeholder="129,90"')}
    ${area('Descrição', 'description', F.description)}${field('Tecido', 'fabric', F.fabric, 'placeholder="100% algodão, 220 g/m²"')}
    ${sw('Em destaque na página inicial', 'featured')}${sw('Novidade', 'is_new')}${sw('Disponível', 'available')}
    <h2 style="font-size:20px;font-weight:900;margin:28px 0 12px">Tamanhos, cores e estoque</h2>
    ${F.rows.map((r, i) => `<div class="var"><div class="chips">${S.settings.sizes.map((s) => chip(s, r.size === s, 'rsize', `data-i="${i}" data-v="${esc(s)}"`)).join('')}</div>
      <div class="chips" style="margin-top:10px">${PALETTE.map(([n, h], k) => chip(n, r.color === n, 'rcolor', `data-i="${i}" data-v="${k}"`, { sw: h })).join('')}</div>
      <div class="row" style="align-items:flex-end;margin-top:12px"><label class="f" style="flex:1;margin:0">Quantidade em estoque
        <input class="in" inputmode="numeric" data-i="${i}" data-rs value="${r.stock}"></label>
        <button class="lnk red" style="height:48px" data-a="rdel" data-i="${i}">Remover</button></div></div>`).join('')}
    <button class="btn out" data-a="radd">Adicionar variação</button>
    <div style="height:24px"></div><button class="btn" data-a="saveprod">${F.id ? 'Salvar alterações' : 'Criar produto'}</button></div>`;
}

/* ---------- admin: venda ---------- */
function saleRows() {
  const q = SALE.q.trim().toLowerCase();
  return S.products.flatMap((p) => p.product_variants.filter((v) => v.stock > 0).map((v) => ({ p, v })))
    .filter(({ p, v }) => `${p.name} ${v.size} ${v.color}`.toLowerCase().includes(q));
}
function saleList() {
  const rows = saleRows();
  if (!rows.length) return empty('Nada com estoque', 'Ajuste a busca ou cadastre estoque em Produtos.');
  return rows.map(({ p, v }) => { const n = SALE.qty[v.id] || 0;
    return `<div class="item" style="align-items:center"><i class="sw" style="background:${esc(v.color_hex)}"></i>
      <div style="flex:1"><div style="font-weight:800">${esc(p.name)}</div><div class="mut" style="font-size:13px">${esc(v.size)} · ${esc(v.color)} · ${v.stock} em estoque · ${brl(p.price)}</div></div>
      <div class="qty">${n > 0 ? `<button data-a="sdec" data-id="${esc(v.id)}">−</button><span>${n}</span>` : ''}<button class="p" data-a="sinc" data-id="${esc(v.id)}">+</button></div></div>`; }).join('');
}
function saleTotals() {
  let total = 0, pcs = 0;
  S.products.forEach((p) => p.product_variants.forEach((v) => { const n = SALE.qty[v.id] || 0; if (n) { total += p.price * n; pcs += n; } }));
  return { total, pcs };
}
function saleBar() {
  const { total, pcs } = saleTotals();
  return `<div style="max-width:560px;margin:0 auto"><div class="chips" style="margin-bottom:14px">${chip('Pix', SALE.pay === 'pix', 'spay', 'data-v="pix"')}${chip('Dinheiro', SALE.pay === 'cash', 'spay', 'data-v="cash"')}</div>
    <div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="mut">${pcs} ${pcs === 1 ? 'peça' : 'peças'}</span><b style="font-size:22px;font-weight:900">${brl(total)}</b></div>
    <button class="btn" data-a="sconfirm" ${pcs ? '' : 'disabled'}>Registrar venda</button></div>`;
}
function viewSale() {
  SALE = SALE || { qty: {}, pay: 'pix', q: '' };
  return `<div class="wrap">${bar('Registrar venda')}<input class="in" style="margin:0 0 8px" id="sq" type="search" placeholder="Buscar produto, tamanho ou cor" value="${esc(SALE.q)}">
    <div id="sale-list">${saleList()}</div></div><div class="salebar" id="sale-bar">${saleBar()}</div>`;
}

function viewSales() {
  if (S.sales === null) { loadSales(); return spinner; }
  return `<div class="wrap">${bar('Histórico de vendas')}${S.salesErr ? `<p class="red">${esc(S.salesErr)}</p>` : ''}
    ${S.sales.length ? S.sales.map((s) => `<div class="item" style="display:block;cursor:pointer" data-a="sopen" data-id="${esc(s.id)}">
      <div class="row" style="justify-content:space-between"><b style="font-size:17px">${brl(s.total)}</b><span class="mut">${s.payment_method === 'pix' ? 'Pix' : 'Dinheiro'}</span></div>
      <div style="color:var(--g5);font-size:13px">${dt(s.created_at)} · ${s.sale_items.reduce((a, i) => a + i.quantity, 0)} peças</div>
      <div class="det" id="d-${esc(s.id)}" hidden style="margin-top:10px">${s.sale_items.map((i) => `<div class="mut" style="margin-top:4px">${i.quantity}x ${esc(i.product_name)} · ${esc(i.size)} · ${esc(i.color)} · ${brl(i.unit_price)}</div>`).join('')}</div></div>`).join('')
      : empty('Nenhuma venda registrada', 'As vendas feitas na loja aparecem aqui.')}</div>`;
}

function viewSettings() {
  if (!SF) SF = { ...S.settings, sizesText: S.settings.sizes.join(', ') };
  const f = (l, k, extra = '') => field(l, 'sf_' + k, SF[k], extra);
  return `<div class="wrap">${bar('Dados da loja')}${f('Endereço', 'address')}${f('Cidade', 'city')}${f('Link do mapa (Google Maps, opcional)', 'maps_url', 'autocapitalize="none"')}
    ${area('Horário de funcionamento', 'sf_hours', SF.hours)}${area('Informações sobre compras presenciais', 'sf_in_store_info', SF.in_store_info)}
    ${f('Nome da coleção atual', 'collection_name')}${f('Frase do banner da página inicial', 'collection_tagline')}${f('Tamanhos (separados por vírgula)', 'sizesText')}
    <button class="btn" data-a="savesettings">Salvar</button></div>`;
}

function viewAdmin(parts) {
  if (S.auth === 'loading' && !demo) return spinner;
  if (S.auth === 'out') return viewLogin();
  if (S.auth === 'denied') return viewDenied();
  const [, sub, arg] = parts;
  if (!sub) return viewDash();
  if (sub === 'produtos') return viewAdminProducts();
  if (sub === 'produto') return viewForm(arg || 'novo');
  if (sub === 'venda') return viewSale();
  if (sub === 'vendas') return viewSales();
  if (sub === 'loja') return viewSettings();
  return viewDash();
}

/* ---------- roteamento ---------- */
function render() {
  const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const r = parts[0];
  let html, theme = 'dark', tab = r;
  if (S.loading) { html = spinner; }
  else if (S.error && !S.products.length) {
    html = `<div class="wrap">${empty('Não deu para carregar', S.error, '<p><button class="btn out" data-a="retry">Tentar de novo</button></p>')}</div>`;
  } else if (r === 'admin') { html = viewAdmin(parts); tab = 'admin'; }
  else if (r === 'catalogo') { html = viewCatalog(); theme = 'light'; }
  else if (r === 'p') { html = viewProduct(parts[1]); theme = 'light'; tab = 'catalogo'; }
  else if (r === 'loja') html = viewStore();
  else { html = viewHome(); tab = 'home'; }
  document.body.className = theme;
  $('#app').innerHTML = html;
  $('#tabbar').classList.toggle('hide', r === 'admin' || r === 'p');
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.t === tab));
}
function route() { P = null; F = null; SF = null; SALE = null; if (/^#\/admin\/?$|#\/admin\/vendas/.test(location.hash)) S.sales = null; render(); window.scrollTo(0, 0); }
window.addEventListener('hashchange', route);

/* ---------- ações ---------- */
let tt; function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); clearTimeout(tt); tt = setTimeout(() => t.remove(), 2200); }
const needDb = () => { if (!db) { alert('Supabase não configurado.'); return false; } return true; };

async function shrink(file, max = 1400) {
  const bmp = await createImageBitmap(file); const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}
async function upload(file) {
  const blob = await shrink(file); const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await db.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
const must = ({ error }) => { if (error) throw new Error(error.message); };

async function saveProduct() {
  if (busy) return;
  const price = parsePrice(F.price);
  if (!F.name.trim()) return alert('Informe o nome do produto.');
  if (!Number.isFinite(price) || price <= 0) return alert('Preço inválido. Use o formato 129,90.');
  const seen = new Set();
  for (const r of F.rows) {
    const k = `${r.size}|${r.color.trim().toLowerCase()}`;
    if (!r.color.trim()) return alert('Toda variação precisa de uma cor.');
    if (seen.has(k)) return alert(`Já existe ${r.size} ${r.color}. Junte as quantidades em uma linha.`);
    seen.add(k);
  }
  if (!needDb()) return;
  busy = true; const btn = document.querySelector('[data-a=saveprod]'); if (btn) btn.disabled = true;
  try {
    const front = F.front?.file ? await upload(F.front.file) : F.front?.url || null;
    const back = F.back?.file ? await upload(F.back.file) : F.back?.url || null;
    const fields = { name: F.name.trim(), description: F.description.trim(), fabric: F.fabric.trim(), price, featured: F.featured, is_new: F.is_new, available: F.available, front_image_url: front, back_image_url: back };
    let pid = F.id;
    if (pid) must(await db.from('products').update(fields).eq('id', pid));
    else { const r = await db.from('products').insert(fields).select('id').single(); must(r); pid = r.data.id; }
    if (F.removed.length) must(await db.from('product_variants').delete().in('id', F.removed));
    const row = (v) => ({ product_id: pid, size: v.size, color: v.color.trim(), color_hex: v.color_hex, stock: Math.max(0, Math.floor(Number(v.stock) || 0)) });
    const old = F.rows.filter((v) => v.id).map((v) => ({ id: v.id, ...row(v) })), neu = F.rows.filter((v) => !v.id).map(row);
    if (old.length) must(await db.from('product_variants').upsert(old));
    if (neu.length) must(await db.from('product_variants').insert(neu));
    await load(); toast('Produto salvo'); location.hash = '#/admin/produtos';
  } catch (e) { alert('Não foi possível salvar: ' + e.message); }
  busy = false; if (btn) btn.disabled = false;
}

async function confirmSale() {
  if (busy || !needDb()) return;
  const { total, pcs } = saleTotals(); if (!pcs) return;
  if (!confirm(`Confirmar venda?\n${pcs} ${pcs === 1 ? 'peça' : 'peças'} · ${brl(total)}\nPagamento: ${SALE.pay === 'pix' ? 'Pix' : 'Dinheiro'}`)) return;
  busy = true;
  const items = Object.entries(SALE.qty).map(([variant_id, quantity]) => ({ variant_id, quantity }));
  const { error } = await db.rpc('register_sale', { p_payment: SALE.pay, p_items: items });
  busy = false;
  await load();
  if (error) {
    SALE.qty = {};
    return alert(error.message.includes('insufficient_stock')
      ? 'Estoque insuficiente para uma das peças. O estoque foi atualizado, confira e tente de novo.' : 'Não foi possível registrar: ' + error.message);
  }
  S.sales = null; toast('Venda registrada'); location.hash = '#/admin';
}

const actions = {
  retry: () => { S.loading = true; render(); load(); },
  fsize: (el) => { FLT.size = FLT.size === el.dataset.v ? null : el.dataset.v; render(); },
  fcolor: (el) => { FLT.color = FLT.color === el.dataset.v ? null : el.dataset.v; render(); },
  frange: (el) => { const i = Number(el.dataset.v); FLT.range = FLT.range === i ? null : i; render(); },
  fclear: () => { FLT = { q: '', size: null, color: null, range: null }; render(); },
  pside: (el) => { P.side = el.dataset.v; render(); },
  psize: (el) => { P.size = P.size === el.dataset.v ? null : el.dataset.v; render(); },
  pcolor: (el) => { P.color = P.color === el.dataset.v ? null : el.dataset.v; render(); },
  login: async () => {
    if (!needDb()) return;
    const { error } = await db.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) alert('E-mail ou senha incorretos.');
  },
  logout: async () => { await db.auth.signOut(); location.hash = '#/loja'; },
  avail: async (el) => {
    if (!needDb()) return; const on = el.checked;
    const { error } = await db.from('products').update({ available: on }).eq('id', el.dataset.id);
    if (error) alert(error.message); await load();
  },
  delprod: async (el) => {
    const p = S.products.find((x) => x.id === el.dataset.id);
    if (!confirm(`Excluir "${p.name}" e todo o estoque dele? Vendas já registradas continuam no histórico.`) || !needDb()) return;
    const { error } = await db.from('products').delete().eq('id', p.id);
    if (error) alert(error.message); await load();
  },
  rsize: (el) => { F.rows[el.dataset.i].size = el.dataset.v; render(); },
  rcolor: (el) => { const [n, h] = PALETTE[el.dataset.v]; Object.assign(F.rows[el.dataset.i], { color: n, color_hex: h }); render(); },
  radd: () => { F.rows.push({ size: S.settings.sizes[0] || 'M', color: 'Preto', color_hex: '#000000', stock: 0 }); render(); },
  rdel: (el) => { const r = F.rows[el.dataset.i]; if (r.id) F.removed.push(r.id); F.rows.splice(el.dataset.i, 1); render(); },
  saveprod: saveProduct,
  sinc: (el) => { const v = S.products.flatMap((p) => p.product_variants).find((x) => x.id === el.dataset.id); SALE.qty[v.id] = Math.min(v.stock, (SALE.qty[v.id] || 0) + 1); refreshSale(); },
  sdec: (el) => { const id = el.dataset.id; SALE.qty[id] = (SALE.qty[id] || 1) - 1; if (SALE.qty[id] <= 0) delete SALE.qty[id]; refreshSale(); },
  spay: (el) => { SALE.pay = el.dataset.v; refreshSale(); },
  sconfirm: confirmSale,
  sopen: (el) => { const d = document.getElementById('d-' + el.dataset.id); if (d) d.hidden = !d.hidden; },
  savesettings: async () => {
    const sizes = SF.sizesText.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (!sizes.length) return alert('Informe ao menos um tamanho, por exemplo: P, M, G, GG.');
    if (!needDb()) return;
    const { sizesText, ...rest } = SF;
    const { error } = await db.from('store_settings').upsert({ ...rest, id: 1, sizes });
    if (error) return alert('Não foi possível salvar: ' + error.message);
    await load(); toast('Dados salvos'); location.hash = '#/admin';
  },
};
function refreshSale() { $('#sale-list').innerHTML = saleList(); $('#sale-bar').innerHTML = saleBar(); }

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.a]; if (fn) fn(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.a === 'avail') return actions.avail(el);
  if (el.dataset.fc) F[el.dataset.fc] = el.checked;
  if (el.dataset.photo) { const file = el.files[0]; if (file) { F[el.dataset.photo] = { file, preview: URL.createObjectURL(file) }; render(); } }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'q') { FLT.q = el.value; $('#grid').innerHTML = gridHtml(); }
  else if (el.id === 'sq') { SALE.q = el.value; $('#sale-list').innerHTML = saleList(); }
  else if (el.dataset.f?.startsWith('sf_')) SF[el.dataset.f.slice(3)] = el.value;
  else if (el.dataset.f) F[el.dataset.f] = el.value;
  else if (el.dataset.rs !== undefined) F.rows[el.dataset.i].stock = Number(el.value.replace(/\D/g, '')) || 0;
});

/* ---------- início ---------- */
initAuth();
render();
load();
if (db) {
  let t;
  const again = () => { clearTimeout(t); t = setTimeout(load, 400); };
  db.channel('catalog-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_variants' }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, again)
    .subscribe();
}
