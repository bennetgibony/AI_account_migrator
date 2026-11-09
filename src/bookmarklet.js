(async () => {
  /* Runs ON the chat site (claude.ai / chatgpt.com) using the visitor's own login.
     SITE is replaced automatically by index.html with the page's own URL. */
  const SITE = '__SITE__';
  const MODE = '__MODE__';
  const SITE_ORIGIN = new URL(SITE).origin;
  const host = location.hostname.replace(/^www\./, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;bottom:20px;right:20px;background:#111;color:#fff;font:14px/1.4 system-ui,sans-serif;padding:14px 18px;border-radius:12px;max-width:340px;box-shadow:0 6px 24px rgba(0,0,0,.4)';
  document.body.appendChild(box);
  const ui = t => { box.textContent = t; };

  async function get(url, opts) {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, Object.assign({ credentials: 'include' }, opts || {}));
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * 2 ** i); continue; }
      if (!r.ok) throw new Error(r.status + ' on ' + url);
      return r.json();
    }
    throw new Error('Rate-limited by the site. Wait a few minutes and try again.');
  }
  const iso = t => (typeof t === 'number' ? new Date(t * 1000).toISOString() : t || null);

  const ADAPTERS = {
    'claude.ai': {
      name: 'Claude',
      async list() {
        const orgs = await get('/api/organizations');
        const out = [];
        for (const o of orgs.filter(o => !o.capabilities || o.capabilities.includes('chat'))) {
          const seen = new Set();
          for (let off = 0; ; off += 50) {
            const page = await get('/api/organizations/' + o.uuid + '/chat_conversations?limit=50&offset=' + off);
            const arr = Array.isArray(page) ? page : (page.data || []);
            const fresh = arr.filter(c => !seen.has(c.uuid));
            fresh.forEach(c => { seen.add(c.uuid); out.push({ org: o.uuid, id: c.uuid }); });
            if (arr.length < 50 || !fresh.length) break;
          }
        }
        return out;
      },
      async get(ref) {
        const c = await get('/api/organizations/' + ref.org + '/chat_conversations/' + ref.id + '?tree=True&rendering_mode=messages&render_all_tools=true');
        let msgs = c.chat_messages || [];
        if (c.current_leaf_message_uuid) {
          const byId = {}; msgs.forEach(m => { byId[m.uuid] = m; });
          const path = []; let cur = byId[c.current_leaf_message_uuid];
          while (cur) { path.unshift(cur); cur = byId[cur.parent_message_uuid]; }
          if (path.length) msgs = path;
        }
        return {
          title: c.name, created: c.created_at, url: 'https://claude.ai/chat/' + ref.id,
          messages: msgs.map(m => {
            const parts = (m.content || []).map(b =>
              b.type === 'text' ? b.text : b.type === 'tool_use' ? '[used tool: ' + (b.name || '?') + ']' : '').filter(Boolean);
            let text = parts.join('\n\n') || m.text || '';
            (m.attachments || []).concat(m.files || [], m.files_v2 || []).forEach(f => {
              const n = f.file_name || f.name; if (n) text += '\n[attachment: ' + n + ']';
            });
            return { role: m.sender === 'human' ? 'user' : 'assistant', time: m.created_at, text: text };
          })
        };
      }
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      async auth() {
        if (!this.h) { const s = await get('/api/auth/session'); this.h = { headers: { Authorization: 'Bearer ' + s.accessToken } }; }
        return this.h;
      },
      async list() {
        const h = await this.auth(); const out = [];
        for (const archived of [false, true]) {
          for (let off = 0; ; off += 100) {
            const p = await get('/backend-api/conversations?offset=' + off + '&limit=100&order=updated' + (archived ? '&is_archived=true' : ''), h);
            (p.items || []).forEach(c => out.push({ id: c.id }));
            if (!p.items || p.items.length < 100) break;
          }
        }
        return out;
      },
      async get(ref) {
        const c = await get('/backend-api/conversation/' + ref.id, await this.auth());
        const msgs = []; let node = c.current_node;
        while (node && c.mapping[node]) {
          const m = c.mapping[node].message;
          if (m && m.author && (m.author.role === 'user' || m.author.role === 'assistant') &&
              !(m.metadata && m.metadata.is_visually_hidden_from_conversation)) {
            const parts = (m.content && m.content.parts || []).filter(p => typeof p === 'string');
            const text = parts.join('\n') || (m.content && m.content.text) || '';
            if (text.trim()) msgs.unshift({ role: m.author.role, time: iso(m.create_time), text: text });
          }
          node = c.mapping[node].parent;
        }
        return { title: c.title, created: iso(c.create_time), url: 'https://chatgpt.com/c/' + ref.id, messages: msgs };
      }
    }
  };
  ADAPTERS['chat.openai.com'] = ADAPTERS['chatgpt.com'];

  const A = ADAPTERS[host];
  if (!A) { ui('This works on: ' + Object.keys(ADAPTERS).join(', ') + '. Open one of them (logged in) and click the bookmark again.'); setTimeout(() => box.remove(), 8000); return; }

  /* Open the receiving page right away (must happen in the click, or popup blockers stop it). */
  const win = MODE === 'gdoc' ? window.open(SITE + '#receive', '_blank') : null;
  let receiver = null, delivered = false, payload = null;
  addEventListener('message', e => {
    if (e.origin !== SITE_ORIGIN) return;
    if (e.data === 'chats:ready') { receiver = e.source; if (payload) receiver.postMessage({ type: 'chats', data: payload }, SITE_ORIGIN); }
    if (e.data === 'chats:received') { delivered = true; }
  });

  try {
    ui('Finding your ' + A.name + ' chats…');
    const refs = await A.list();
    const chats = [];
    for (let i = 0; i < refs.length; i++) {
      ui('Reading ' + A.name + ' chats: ' + (i + 1) + ' / ' + refs.length + '\nKeep this tab open.');
      try { chats.push(await A.get(refs[i])); } catch (err) { console.warn('Skipped chat', refs[i], err); }
      await sleep(250);
    }
    chats.sort((a, b) => String(a.created).localeCompare(String(b.created)));
    const stamp = new Date().toISOString().slice(0, 10);
    const save = (content, type, ext) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: type }));
      a.download = A.name.toLowerCase() + '-chats-' + stamp + ext;
      document.body.appendChild(a); a.click(); a.remove();
    };

    if (MODE === 'txt') {
      const fmt = t => { const d = new Date(t); return t && !isNaN(d) ? d.toLocaleString() : ''; };
      const line = '='.repeat(70);
      const out = [A.name + ' chats, exported ' + new Date().toLocaleString() + ' (' + chats.length + ' chats)', ''];
      chats.forEach((c, i) => {
        out.push('', line, '### ' + (i + 1) + '. ' + (c.title || 'Untitled chat'),
                 [fmt(c.created), c.url].filter(Boolean).join('  |  '), line, '');
        c.messages.forEach(m => {
          const t = String(m.text || '').trim(); if (!t) return;
          out.push((m.role === 'user' ? 'You' : A.name) + (m.time ? ' (' + fmt(m.time) + ')' : '') + ':', t, '');
        });
      });
      save(out.join('\n'), 'text/plain;charset=utf-8', '.txt');
      ui('Done. ' + chats.length + ' chats were saved as a .txt file in your Downloads.');
      setTimeout(() => box.remove(), 30000);
      return;
    }

    payload = { source: A.name, exported: new Date().toISOString(), chats: chats };

    if (receiver) receiver.postMessage({ type: 'chats', data: payload }, SITE_ORIGIN);
    ui('Read ' + chats.length + ' chats. Sending them to the other tab…');
    for (let i = 0; i < 20 && !delivered; i++) await sleep(250);

    if (delivered) {
      ui('Done. ' + chats.length + ' chats were sent to the other tab. Continue there.');
    } else {
      save(JSON.stringify(payload), 'application/json', '.json');
      ui('Read ' + chats.length + ' chats. They were saved as a file. Drop that file onto the page that just opened.');
      if (!win || win.closed) window.open(SITE, '_blank');
    }
  } catch (err) {
    ui('Error: ' + err.message);
    console.error(err);
  }
  setTimeout(() => box.remove(), 30000);
})();
