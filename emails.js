(function () {
  const KEY = 'moth_waitlist_v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  }

  function save(rows) {
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  function upsert(entry) {
    const rows = load();
    const email = String(entry.email || '').trim().toLowerCase();
    if (!email || !/[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Need a real email.');
    }
    const next = {
      email,
      name: String(entry.name || '').trim(),
      city: String(entry.city || '').trim(),
      size: String(entry.size || '').trim(),
      source: entry.source || 'waitlist',
      addedAt: new Date().toISOString()
    };
    const idx = rows.findIndex((r) => r.email === email);
    if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
    else rows.unshift(next);
    save(rows);
    return rows;
  }

  function toCsv(rows) {
    const header = ['email', 'name', 'city', 'size', 'source', 'addedAt'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [header.join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n');
  }

  function downloadCsv() {
    const rows = load();
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moth-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  window.MothEmails = { KEY, load, save, upsert, toCsv, downloadCsv };

  const form = document.getElementById('waitlistForm');
  const msg = document.getElementById('waitlistMsg');
  const count = document.getElementById('listCount');

  function refreshCount() {
    if (count) count.textContent = `${load().length} on this device`;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        upsert(data);
        form.reset();
        if (msg) msg.textContent = 'You are on the list.';
        refreshCount();

        if (window.MOTH_FORMSPREE) {
          fetch(window.MOTH_FORMSPREE, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          }).catch(() => {});
        }
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  }

  refreshCount();
})();
