// Forgot password: ask for a reset link by email, and set a new password from the link (/?reset=TOKEN).
(function () {
  const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  if (!document.querySelector('#fg-style')) {
    const style = document.createElement('style');
    style.id = 'fg-style';
    style.textContent = '.fg-back{position:fixed;inset:0;background:rgba(10,10,10,.55);z-index:3500;display:flex;align-items:center;justify-content:center;padding:16px}.fg-box{background:#fff;color:#111;border-radius:16px;max-width:400px;width:100%;padding:22px;font-family:inherit}.fg-box h3{margin:0 0 6px}.fg-box p{margin:0 0 12px;color:#555;font-size:.92rem}.fg-box label{display:block;font-size:.85rem;margin-bottom:10px}.fg-box input{display:block;width:100%;margin-top:4px;padding:11px;border:1px solid #ccd;border-radius:10px;font:inherit}.fg-go{width:100%;padding:12px;border:0;border-radius:10px;background:#1d3fbb;color:#fff;font:inherit;font-weight:700;cursor:pointer}.fg-go:disabled{opacity:.6}.fg-x{background:none;border:0;color:#555;width:100%;padding:8px;cursor:pointer;font:inherit}.fg-msg{min-height:1.2em;margin:10px 0 0;font-size:.9rem}.fg-msg.err{color:#b3261e}.fg-msg.ok{color:#17692e}.fg-link{background:none;border:0;color:#1d3fbb;cursor:pointer;font:inherit;padding:6px 0;text-decoration:underline}';
    document.head.appendChild(style);
  }
  async function post(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
    return result;
  }
  function shell(html) {
    document.querySelector('.fg-back')?.remove();
    const back = document.createElement('div');
    back.className = 'fg-back';
    back.innerHTML = `<div class="fg-box" role="dialog" aria-modal="true">${html}</div>`;
    back.addEventListener('click', (event) => { if (event.target === back || event.target.closest('.fg-x')) back.remove(); });
    document.body.appendChild(back);
    return back;
  }
  function openRequest() {
    const back = shell('<h3>Forgot your password?</h3><p>Enter your username or the email address on your account. We will email you a link to choose a new password.</p><form><label>Username or email<input name="who" required autocomplete="username" maxlength="254"></label><button class="fg-go" type="submit">Send reset link</button><p class="fg-msg" role="status"></p></form><button type="button" class="fg-x">Close</button>');
    const form = back.querySelector('form'); const msg = back.querySelector('.fg-msg'); const go = back.querySelector('.fg-go');
    form.who.focus();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      go.disabled = true; msg.className = 'fg-msg'; msg.textContent = '';
      try { const result = await post('/api/auth/forgot-password', { identifier: form.who.value }); msg.className = 'fg-msg ok'; msg.textContent = result.message; }
      catch (error) { msg.className = 'fg-msg err'; msg.textContent = error.message; go.disabled = false; }
    });
  }
  function openReset(token) {
    const back = shell('<h3>Choose a new password</h3><p>At least 10 characters.</p><form><label>New password<input name="pw" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><label>Repeat it<input name="pw2" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label><button class="fg-go" type="submit">Save new password</button><p class="fg-msg" role="alert"></p></form><button type="button" class="fg-x">Close</button>');
    const form = back.querySelector('form'); const msg = back.querySelector('.fg-msg'); const go = back.querySelector('.fg-go');
    form.pw.focus();
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.pw.value !== form.pw2.value) { msg.className = 'fg-msg err'; msg.textContent = 'The two passwords do not match.'; return; }
      go.disabled = true; msg.className = 'fg-msg'; msg.textContent = '';
      try {
        const result = await post('/api/auth/reset-password', { token, password: form.pw.value });
        try { localStorage.setItem('unishop-last-username', result.username); } catch {}
        history.replaceState(null, '', location.pathname + location.hash);
        shell(`<h3>Password changed</h3><p>${esc(result.message)}</p><button type="button" class="fg-go" id="fg-signin">Sign in</button>`).querySelector('#fg-signin').addEventListener('click', () => { document.querySelector('.fg-back')?.remove(); if (typeof window.openAuth === 'function') window.openAuth('customer', 'login'); else location.assign('/?signin=1'); });
      } catch (error) { msg.className = 'fg-msg err'; msg.textContent = error.message; go.disabled = false; }
    });
  }
  window.UnishopForgot = { open: openRequest };
  document.addEventListener('click', (event) => { if (event.target.closest('[data-forgot]')) { event.preventDefault(); openRequest(); } });
  const token = new URLSearchParams(location.search).get('reset');
  if (token) openReset(token);
})();
