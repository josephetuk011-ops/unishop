// Negotiation chat shared by the marketplace page (modal) and the workspace (Messages inbox).
(function () {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const safeUrl = (url) => (/^(https:\/\/res\.cloudinary\.com\/|\/uploads\/)/.test(String(url)) ? url : '');
  const token = () => localStorage.getItem('unishop-token') || '';
  const warningHtml = '<strong>Strict warning:</strong> do not share bank account numbers in this chat. Any account that does is <strong>suspended automatically</strong>. Do not make any mobile call to each other until after payment is made. Any account that does is <strong>suspended</strong>.';

  async function refreshSession() {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) return false;
      const result = await response.json();
      localStorage.setItem('unishop-token', result.token);
      if (result.user) localStorage.setItem('unishop-user', JSON.stringify(result.user));
      return true;
    } catch { return false; }
  }
  async function call(url, options = {}, retried = false) {
    const headers = { Authorization: `Bearer ${token()}`, ...(options.headers || {}) };
    if (!(options.body instanceof FormData) && options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401 && !retried && (await refreshSession())) return call(url, options, true);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || 'The request could not be completed.'); error.status = response.status; error.data = result; throw error; }
    return result;
  }
  const toast = (message) => {
    let box = document.querySelector('#uc-toast');
    if (!box) { box = document.createElement('div'); box.id = 'uc-toast'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.textContent = message; box.classList.add('visible');
    clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove('visible'), 4200);
  };

  // Tell the server this person is online while any Unishop page is open.
  const beat = () => { if (token() && !document.hidden) fetch('/api/presence', { method: 'POST', headers: { Authorization: `Bearer ${token()}` } }).catch(() => {}); };
  beat(); setInterval(beat, 30000);

  function messageHtml(message, me) {
    const time = new Date(message.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    if (message.kind === 'system') return `<div class="uc-system">${esc(message.text)}</div>`;
    const mine = message.senderId === me;
    let body;
    if (message.kind === 'image' && safeUrl(message.media?.url)) body = `<a href="${esc(message.media.url)}" target="_blank" rel="noopener"><img class="uc-photo" src="${esc(message.media.url)}" alt="Photo sent in chat" loading="lazy"></a>${message.text ? `<p>${esc(message.text)}</p>` : ''}`;
    else if (message.kind === 'audio' && safeUrl(message.media?.url)) body = `<audio controls preload="none" src="${esc(message.media.url)}"></audio>${message.text ? `<p>${esc(message.text)}</p>` : ''}`;
    else if (message.kind === 'offer') body = `<div class="uc-offer"><small>Price offer</small><strong>${money(message.amountNaira)}</strong></div>`;
    else body = `<p>${esc(message.text)}</p>`;
    return `<div class="uc-row ${mine ? 'uc-me' : 'uc-them'}"><div class="uc-bubble">${body}<time>${esc(time)}</time></div></div>`;
  }

  function createThread(host, id, options = {}) {
    const me = JSON.parse(localStorage.getItem('unishop-user') || '{}').id;
    let seq = 0; let convo; let timer; let recorder; let busy = false;
    host.innerHTML = `<div class="uc-thread">
      <header class="uc-head"><span class="uc-avatar" data-avatar></span><div class="uc-who"><strong data-name>Loading</strong><small data-sub></small></div><span class="uc-status" data-status></span>${options.onClose ? '<button type="button" class="uc-close" data-close aria-label="Close chat">×</button>' : ''}${options.onBack ? '<button type="button" class="uc-back" data-back>Back</button>' : ''}</header>
      <div class="uc-warning" role="alert">${warningHtml}</div>
      <div class="uc-messages" data-messages aria-live="polite"></div>
      <form class="uc-compose" data-compose>
        <button type="button" class="uc-tool" data-photo title="Send a photo">Photo</button>
        <button type="button" class="uc-tool" data-voice title="Record a voice message">Voice</button>
        <input type="file" data-photo-input accept="image/jpeg,image/png,image/webp" hidden>
        <input type="file" data-audio-input accept="audio/*" hidden>
        <input class="uc-input" name="text" maxlength="1000" autocomplete="off" placeholder="Type a message">
        <button type="submit" class="uc-send">Send</button>
      </form>
      <div class="uc-actions" data-actions></div>
      <form class="uc-extra" data-offer-form hidden><label>Your price in NGN<input name="amount" type="number" min="1000" step="100" required></label><button type="submit" class="uc-primary">Send price offer</button></form>
      <form class="uc-extra" data-pay-form hidden><label>Where do you need the service?<input name="neighbourhood" maxlength="200" required placeholder="Street and area in Uyo"></label><label>When?<input name="time" maxlength="100" required placeholder="Tomorrow, 10am"></label><button type="submit" class="uc-primary" data-pay-label>Pay now</button></form>
    </div>`;
    const $ = (selector) => host.querySelector(selector);
    const list = $('[data-messages]');

    function applyConversation(next) {
      convo = next;
      $('[data-name]').textContent = convo.otherName;
      $('[data-avatar]').textContent = (convo.otherName || '?').trim().charAt(0).toUpperCase();
      $('[data-sub]').textContent = convo.listingTitle || '';
      const status = $('[data-status]');
      status.textContent = convo.otherOnline ? 'Online' : 'Offline';
      status.classList.toggle('on', Boolean(convo.otherOnline));
      const ended = convo.status === 'ended';
      host.querySelector('[data-compose]').querySelectorAll('input[name=text],.uc-send,.uc-tool').forEach((node) => { node.disabled = ended; });
      const customer = convo.youAre === 'customer';
      $('[data-actions]').innerHTML = ended
        ? `<span class="uc-note">This negotiation has ended.</span>${options.onClose ? '<button type="button" class="uc-end" data-close-chat>Close</button>' : ''}`
        : `<button type="button" class="uc-end" data-end>End negotiation</button>${customer
          ? `<button type="button" class="uc-primary" data-pay>${convo.offerNaira ? `Proceed to payment (${money(convo.offerNaira)})` : 'Proceed to payment'}</button>`
          : '<button type="button" class="uc-primary" data-offer>Send price offer</button>'}`;
      const label = host.querySelector('[data-pay-label]');
      if (label) label.textContent = `Pay ${money((convo.offerNaira || 0) + 500)} (price plus ₦500 dispatch contribution)`;
      if (typeof options.onUpdate === 'function') options.onUpdate(convo);
    }
    function append(messages) {
      if (!messages.length) return;
      const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80 || seq === 0;
      list.insertAdjacentHTML('beforeend', messages.map((message) => messageHtml(message, me)).join(''));
      seq = Math.max(seq, ...messages.map((message) => message.seq));
      if (nearBottom) list.scrollTop = list.scrollHeight;
    }
    async function poll() {
      if (!host.isConnected) return clearInterval(timer);
      if (document.hidden || busy) return;
      try { const data = await call(`/api/chats/${id}?after=${seq}`); applyConversation(data.conversation); append(data.messages); } catch (error) { if (error.status === 401) clearInterval(timer); }
    }
    async function send(body) {
      busy = true;
      try {
        await call(`/api/chats/${id}/messages`, { method: 'POST', body: JSON.stringify(body) });
        busy = false; await poll();
      } catch (error) {
        busy = false;
        if (error.data?.suspended) { toast(error.message); host.querySelector('.uc-thread').classList.add('uc-blocked'); host.querySelector('[data-actions]').innerHTML = `<span class="uc-note uc-danger">${esc(error.message)}</span>`; clearInterval(timer); return; }
        toast(error.message);
      }
    }
    async function upload(file, kind) {
      if (!file) return;
      const form = new FormData(); form.append('file', file, file.name || `voice.${kind === 'audio' ? 'webm' : 'jpg'}`);
      try { toast(kind === 'audio' ? 'Sending voice message…' : 'Sending photo…'); const media = await call(`/api/uploads/chat?kind=${kind}`, { method: 'POST', body: form }); await send({ media: { kind: media.kind, url: media.url } }); } catch (error) { toast(error.message); }
    }

    host.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.matches('[data-compose]')) {
        const text = form.elements.text.value.trim();
        if (!text) return;
        form.elements.text.value = '';
        await send({ text });
      } else if (form.matches('[data-offer-form]')) {
        try { await call(`/api/chats/${id}/offer`, { method: 'POST', body: JSON.stringify({ amount: Number(form.elements.amount.value) }) }); form.hidden = true; form.reset(); await poll(); } catch (error) { toast(error.message); }
      } else if (form.matches('[data-pay-form]')) {
        const button = form.querySelector('button'); button.disabled = true;
        try {
          const booked = await call(`/api/chats/${id}/book`, { method: 'POST', body: JSON.stringify({ neighbourhood: form.elements.neighbourhood.value, time: form.elements.time.value }) });
          const payment = await call('/api/payments/initialize', { method: 'POST', body: JSON.stringify({ bookingId: booked.booking.id }) });
          window.location.assign(payment.authorizationUrl);
        } catch (error) { toast(error.message); button.disabled = false; }
      }
    });
    host.addEventListener('click', async (event) => {
      const target = event.target;
      if (target.closest('[data-close],[data-close-chat]')) { options.onClose?.(); return; }
      if (target.closest('[data-back]')) { options.onBack?.(); return; }
      if (target.closest('[data-photo]')) { $('[data-photo-input]').click(); return; }
      if (target.closest('[data-offer]')) { const form = $('[data-offer-form]'); form.hidden = !form.hidden; return; }
      if (target.closest('[data-pay]')) {
        if (!convo?.offerNaira) { toast('Wait for the service provider to send a price first.'); return; }
        const form = $('[data-pay-form]'); form.hidden = !form.hidden; return;
      }
      if (target.closest('[data-end]')) {
        if (!confirm('End this negotiation? You can start a new one from the service page.')) return;
        try { await call(`/api/chats/${id}/end`, { method: 'POST', body: '{}' }); await poll(); } catch (error) { toast(error.message); }
        return;
      }
      if (target.closest('[data-voice]')) {
        const button = target.closest('[data-voice]');
        if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { $('[data-audio-input]').click(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => { stream.getTracks().forEach((t) => t.stop()); button.textContent = 'Voice'; button.classList.remove('recording'); const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }); upload(new File([blob], `voice.${(blob.type.split('/')[1] || 'webm').split(';')[0]}`, { type: blob.type }), 'audio'); };
          recorder.start(); button.textContent = 'Stop'; button.classList.add('recording');
          setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 90000);
        } catch { $('[data-audio-input]').click(); }
      }
    });
    host.addEventListener('change', (event) => {
      if (event.target.matches('[data-photo-input]')) { upload(event.target.files[0], 'image'); event.target.value = ''; }
      if (event.target.matches('[data-audio-input]')) { upload(event.target.files[0], 'audio'); event.target.value = ''; }
    });
    poll(); timer = setInterval(poll, 3000);
    return { destroy() { clearInterval(timer); if (recorder && recorder.state === 'recording') recorder.stop(); } };
  }

  function openModal(id) {
    const overlay = document.createElement('div');
    overlay.className = 'uc-overlay';
    overlay.innerHTML = '<div class="uc-modal" role="dialog" aria-modal="true" aria-label="Negotiation chat"></div>';
    document.body.appendChild(overlay); document.body.style.overflow = 'hidden';
    let thread;
    const close = () => { thread?.destroy(); overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    thread = createThread(overlay.firstElementChild, id, { onClose: close });
  }

  function mountInbox(host, openId) {
    host.innerHTML = '<div class="uc-inbox"><aside class="uc-list" data-list><div class="uc-empty">Loading messages…</div></aside><section class="uc-pane" data-pane><div class="uc-empty">Choose a conversation to read it.</div></section></div>';
    const root = host.firstElementChild; let thread; let activeId = openId || ''; let timer;
    const listEl = host.querySelector('[data-list]'); const pane = host.querySelector('[data-pane]');
    function open(id) {
      activeId = id; thread?.destroy(); root.classList.add('uc-reading');
      thread = createThread(pane, id, { onBack: () => { root.classList.remove('uc-reading'); thread?.destroy(); pane.innerHTML = '<div class="uc-empty">Choose a conversation to read it.</div>'; activeId = ''; load(); }, onUpdate: () => {} });
      listEl.querySelectorAll('.uc-item').forEach((item) => item.classList.toggle('active', item.dataset.chat === id));
    }
    async function load() {
      if (!host.isConnected) return clearInterval(timer);
      try {
        const data = await call('/api/chats');
        listEl.innerHTML = data.conversations.length ? data.conversations.map((item) => `<button type="button" class="uc-item${item.id === activeId ? ' active' : ''}" data-chat="${esc(item.id)}"><span class="uc-avatar">${esc((item.otherName || '?').charAt(0).toUpperCase())}<i class="uc-pip${item.otherOnline ? ' on' : ''}"></i></span><span class="uc-meta"><strong>${esc(item.otherName)}</strong><small>${esc(item.listingTitle || '')}</small><em>${esc((item.lastMessage || 'No messages yet').slice(0, 60))}</em></span>${item.unread ? `<b class="uc-badge">${item.unread}</b>` : ''}</button>`).join('') : '<div class="uc-empty">No conversations yet. When a customer starts a negotiation, it appears here.</div>';
      } catch (error) { listEl.innerHTML = `<div class="uc-empty">${esc(error.message)}</div>`; }
    }
    listEl.addEventListener('click', (event) => { const item = event.target.closest('[data-chat]'); if (item) open(item.dataset.chat); });
    load(); timer = setInterval(load, 6000);
    if (openId) open(openId);
  }

  function watchUnread(callback) {
    const run = async () => { if (!token() || document.hidden) return; try { callback((await call('/api/chats')).unread || 0); } catch { /* signed out */ } };
    run(); setInterval(run, 15000);
  }

  window.UnishopChat = { openModal, mountInbox, watchUnread, call };
})();
