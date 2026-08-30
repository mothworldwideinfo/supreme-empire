(function () {
  const KEY = 'moth_paper_sim_v1';
  const CACHE_KEY = 'moth_paper_px_v1';
  const START = 10000;
  const COINS = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', cb: 'BTC-USD', kr: ['XBTUSD', 'XXBTZUSD'] },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', cb: 'ETH-USD', kr: ['ETHUSD', 'XETHZUSD'] },
    { id: 'solana', symbol: 'SOL', name: 'Solana', cb: 'SOL-USD', kr: ['SOLUSD'] },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', cb: 'XRP-USD', kr: ['XRPUSD', 'XXRPZUSD'] },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', cb: 'DOGE-USD', kr: ['XDGUSD', 'XXDGZUSD'] }
  ];

  let prices = {};
  let tradeId = null;
  let sourceLabel = '';

  function loadSim() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || { cash: START, holdings: {} };
    } catch {
      return { cash: START, holdings: {} };
    }
  }

  function saveSim(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveCache(px, src) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ prices: px, src: src, at: Date.now() }));
  }

  function money(n) {
    return Number(n).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  function setStatus(text) {
    const el = document.getElementById('simStatus');
    if (el) el.textContent = text;
  }

  function holdingsValue(s) {
    return Object.entries(s.holdings).reduce((sum, [id, amt]) => sum + amt * (prices[id]?.usd || 0), 0);
  }

  function renderBalances() {
    const s = loadSim();
    const hv = holdingsValue(s);
    const cash = document.getElementById('cashBal');
    const hold = document.getElementById('holdBal');
    const tot = document.getElementById('totBal');
    if (cash) cash.textContent = money(s.cash);
    if (hold) hold.textContent = money(hv);
    if (tot) tot.textContent = money(s.cash + hv);
  }

  function renderWatch() {
    const body = document.getElementById('watchBody');
    if (!body) return;
    const s = loadSim();
    body.innerHTML = COINS.map((c) => {
      const p = prices[c.id] || {};
      const ch = p.usd_24h_change;
      const own = s.holdings[c.id] || 0;
      const chCls = ch == null ? 'text-gray-500' : ch >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `<tr class="border-t border-white/10">
        <td class="px-4 py-3">${c.name} <span class="text-gray-500">${c.symbol}</span><div class="text-[10px] text-gray-600">${own ? own + ' paper' : ''}</div></td>
        <td class="px-4 py-3">${p.usd != null ? money(p.usd) : '—'}</td>
        <td class="px-4 py-3 ${chCls}">${ch == null ? '—' : (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%'}</td>
        <td class="px-4 py-3"><button data-trade="${c.id}" class="text-[11px] uppercase tracking-[0.2em] text-pink-400">Trade</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-trade]').forEach((btn) => {
      btn.onclick = () => openTrade(btn.dataset.trade);
    });
  }

  function openTrade(id) {
    const px = prices[id]?.usd;
    if (!px) {
      setStatus('No live price yet. Wait one second and tap Trade again.');
      return;
    }
    tradeId = id;
    const coin = COINS.find((c) => c.id === id);
    const modal = document.getElementById('tradeModal');
    if (!modal) return;
    document.getElementById('tradeTitle').textContent = 'Trade ' + coin.symbol;
    document.getElementById('tradePrice').textContent = 'Live: ' + money(px) + ' · paper only · ' + (sourceLabel || 'feed');
    document.getElementById('tradeAmt').value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeTrade() {
    const modal = document.getElementById('tradeModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    tradeId = null;
  }

  function trade(side) {
    const amt = Number(document.getElementById('tradeAmt').value);
    const px = prices[tradeId]?.usd;
    if (!tradeId || !px || !(amt > 0)) {
      setStatus('Enter an amount greater than 0.');
      return;
    }
    const s = loadSim();
    const cost = amt * px;
    if (side === 'buy') {
      if (cost > s.cash) return alert('Not enough paper cash.');
      s.cash -= cost;
      s.holdings[tradeId] = (s.holdings[tradeId] || 0) + amt;
    } else {
      if ((s.holdings[tradeId] || 0) < amt) return alert('Not enough paper coins.');
      s.holdings[tradeId] -= amt;
      s.cash += cost;
    }
    saveSim(s);
    renderBalances();
    renderWatch();
    closeTrade();
  }

  async function fromCoinbase() {
    const out = {};
    await Promise.all(COINS.map(async (c) => {
      const res = await fetch('https://api.exchange.coinbase.com/products/' + c.cb + '/stats');
      if (!res.ok) throw new Error('cb');
      const j = await res.json();
      const last = Number(j.last);
      const open = Number(j.open);
      if (!last) throw new Error('cb empty');
      out[c.id] = {
        usd: last,
        usd_24h_change: open ? ((last - open) / open) * 100 : null
      };
    }));
    return out;
  }

  async function fromKraken() {
    const pairs = COINS.flatMap((c) => c.kr).join(',');
    const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=' + pairs);
    if (!res.ok) throw new Error('kr');
    const j = await res.json();
    if (j.error && j.error.length) throw new Error(j.error.join(','));
    const out = {};
    for (const c of COINS) {
      let row = null;
      for (const key of c.kr) {
        if (j.result[key]) { row = j.result[key]; break; }
      }
      if (!row) {
        const hit = Object.keys(j.result || {}).find((k) => c.kr.some((p) => k.includes(p.replace('USD', ''))));
        row = hit ? j.result[hit] : null;
      }
      if (!row) continue;
      const last = Number(row.c[0]);
      const open = Number(row.o);
      out[c.id] = {
        usd: last,
        usd_24h_change: open ? ((last - open) / open) * 100 : null
      };
    }
    if (!out.bitcoin) throw new Error('kr empty');
    return out;
  }

  async function fromGecko() {
    const ids = COINS.map((c) => c.id).join(',');
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true');
    if (!res.ok) throw new Error('gecko ' + res.status);
    return await res.json();
  }

  async function fetchPrices() {
    const attempts = [
      { name: 'Coinbase', fn: fromCoinbase },
      { name: 'Kraken', fn: fromKraken },
      { name: 'CoinGecko', fn: fromGecko }
    ];
    let lastErr = null;
    for (const a of attempts) {
      try {
        const next = await a.fn();
        if (!next.bitcoin || next.bitcoin.usd == null) throw new Error('incomplete');
        prices = next;
        sourceLabel = a.name;
        saveCache(next, a.name);
        setStatus('Paper toy · live prices from ' + a.name + ' · not a broker');
        renderWatch();
        renderBalances();
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    const cached = loadCache();
    if (cached.prices && cached.prices.bitcoin) {
      prices = cached.prices;
      sourceLabel = (cached.src || 'cache') + ' cache';
      setStatus('Live feed paused. Showing last prices. Trade still works as paper.');
      renderWatch();
      renderBalances();
      return;
    }
    setStatus('Price feeds are busy. Refresh in a minute. Cash still sits on this phone.');
    throw lastErr || new Error('price fail');
  }

  const reset = document.getElementById('resetSim');
  if (reset) reset.onclick = () => {
    saveSim({ cash: START, holdings: {} });
    renderBalances();
    renderWatch();
  };

  document.getElementById('buyBtn')?.addEventListener('click', () => trade('buy'));
  document.getElementById('sellBtn')?.addEventListener('click', () => trade('sell'));
  document.getElementById('closeTrade')?.addEventListener('click', closeTrade);

  if (document.getElementById('watchBody')) {
    const cached = loadCache();
    if (cached.prices) {
      prices = cached.prices;
      sourceLabel = (cached.src || 'cache') + ' cache';
      renderWatch();
    }
    fetchPrices().catch(() => {
      const body = document.getElementById('watchBody');
      if (body && !body.querySelector('[data-trade]')) {
        body.innerHTML = '<tr><td class="px-4 py-6 text-gray-500" colspan="4">Price feed paused. Your paper cash is still here.</td></tr>';
      }
    });
    setInterval(() => fetchPrices().catch(() => {}), 45000);
    renderBalances();
  }
})();
