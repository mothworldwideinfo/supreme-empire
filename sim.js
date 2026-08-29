(function () {
  const KEY = 'moth_paper_sim_v1';
  const START = 10000;
  const COINS = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' }
  ];

  let prices = {};
  let tradeId = null;

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

  function money(n) {
    return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
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
    body.innerHTML = COINS.map((c) => {
      const p = prices[c.id] || {};
      const ch = p.usd_24h_change;
      const chCls = ch >= 0 ? 'text-emerald-400' : 'text-rose-400';
      return `<tr class="border-t border-white/10">
        <td class="px-4 py-3">${c.name} <span class="text-gray-500">${c.symbol}</span></td>
        <td class="px-4 py-3">${p.usd != null ? money(p.usd) : '—'}</td>
        <td class="px-4 py-3 ${chCls}">${ch == null ? '—' : ch.toFixed(2) + '%'}</td>
        <td class="px-4 py-3"><button data-trade="${c.id}" class="text-[11px] uppercase tracking-[0.2em] text-pink-400">Trade</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-trade]').forEach((btn) => {
      btn.onclick = () => openTrade(btn.dataset.trade);
    });
  }

  function openTrade(id) {
    tradeId = id;
    const coin = COINS.find((c) => c.id === id);
    const modal = document.getElementById('tradeModal');
    document.getElementById('tradeTitle').textContent = 'Trade ' + coin.symbol;
    document.getElementById('tradePrice').textContent = 'Price: ' + (prices[id]?.usd != null ? money(prices[id].usd) : '—');
    document.getElementById('tradeAmt').value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeTrade() {
    const modal = document.getElementById('tradeModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    tradeId = null;
  }

  function trade(side) {
    const amt = Number(document.getElementById('tradeAmt').value);
    const px = prices[tradeId]?.usd;
    if (!tradeId || !px || !(amt > 0)) return;
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
    closeTrade();
  }

  async function fetchPrices() {
    const ids = COINS.map((c) => c.id).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('price fail');
    prices = await res.json();
    renderWatch();
    renderBalances();
  }

  const reset = document.getElementById('resetSim');
  if (reset) reset.onclick = () => { saveSim({ cash: START, holdings: {} }); renderBalances(); };

  document.getElementById('buyBtn')?.addEventListener('click', () => trade('buy'));
  document.getElementById('sellBtn')?.addEventListener('click', () => trade('sell'));
  document.getElementById('closeTrade')?.addEventListener('click', closeTrade);

  if (document.getElementById('watchBody')) {
    fetchPrices().catch(() => {
      const body = document.getElementById('watchBody');
      if (body) body.innerHTML = '<tr><td class="px-4 py-6 text-gray-500" colspan="4">Prices unavailable. Sim still works as a toy when CoinGecko is up.</td></tr>';
    });
    setInterval(() => fetchPrices().catch(() => {}), 30000);
    renderBalances();
  }
})();
