// Vendor and service provider terms. Shown before a seller or provider account is created, and once to existing
// sellers and providers who have not agreed yet. Resolves true on "I agree", false on cancel.
(function () {
  const style = document.createElement('style');
  style.textContent = `
.vt-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(10,10,10,.78);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
.vt-modal{background:#fff;color:#111;max-width:560px;width:100%;border-radius:18px;padding:24px 22px;box-shadow:0 20px 60px rgba(0,0,0,.4);font-family:inherit}
.vt-modal h2{margin:0 0 6px;font-size:1.5rem;line-height:1.15}
.vt-lead{margin:0 0 14px;font-size:1rem}
.vt-rules{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:10px}
.vt-rules li{border:2px solid #111;border-radius:12px;padding:12px 14px;font-size:1.08rem;line-height:1.35}
.vt-rules strong{display:block;font-size:1.25rem;font-weight:900;text-transform:uppercase;letter-spacing:.01em;margin-bottom:2px}
.vt-warn{margin:0 0 14px;font-size:.95rem}
.vt-check{display:flex;gap:10px;align-items:flex-start;font-weight:800;font-size:1rem;margin:0 0 14px;cursor:pointer}
.vt-check input{width:22px;height:22px;flex:none;margin-top:1px}
.vt-actions{display:flex;gap:10px;flex-wrap:wrap}
.vt-agree{flex:1;min-width:200px;border:0;border-radius:999px;background:#111;color:#fff;font-weight:900;font-size:1rem;padding:14px 18px;cursor:pointer}
.vt-agree:disabled{opacity:.35;cursor:not-allowed}
.vt-cancel{border:2px solid #ccc;border-radius:999px;background:#fff;color:#111;font-weight:700;padding:12px 16px;cursor:pointer}
@media (prefers-color-scheme:dark){html[data-theme="dark"] .vt-modal{background:#1b1b1b;color:#fff}html[data-theme="dark"] .vt-rules li{border-color:#fff}html[data-theme="dark"] .vt-agree{background:#fff;color:#111}html[data-theme="dark"] .vt-cancel{background:#1b1b1b;color:#fff;border-color:#555}}
html[data-theme="dark"] .vt-modal{background:#1b1b1b;color:#fff}html[data-theme="dark"] .vt-rules li{border-color:#fff}html[data-theme="dark"] .vt-agree{background:#fff;color:#111}html[data-theme="dark"] .vt-cancel{background:#1b1b1b;color:#fff;border-color:#555}`;
  document.head.appendChild(style);
  window.showVendorTerms = function showVendorTerms(role, cancelLabel) {
    return new Promise((resolve) => {
      const who = role === 'provider' ? 'service provider' : 'vendor';
      const backdrop = document.createElement('div');
      backdrop.className = 'vt-backdrop';
      backdrop.innerHTML = `<section class="vt-modal" role="dialog" aria-modal="true" aria-labelledby="vt-title">
<h2 id="vt-title">Unishop terms for ${who}s</h2>
<p class="vt-lead"><strong>Read this before you continue.</strong> To sell or offer services on Unishop you must agree to all three rules:</p>
<ol class="vt-rules">
<li><strong>1. Keep your prices fair</strong>Do <b>NOT</b> raise your prices too high. Charge customers in Uyo a fair price.</li>
<li><strong>2. No fake products</strong>Do <b>NOT</b> sell fake, counterfeit or wrongly described products. Sell only genuine items and services.</li>
<li><strong>3. Accept returns</strong>If a customer is not satisfied, you <b>MUST</b> accept the return and fix it, replace it or refund the customer.</li>
</ol>
<p class="vt-warn"><b>Breaking these rules can lead to your listing being removed or your account being suspended.</b></p>
<label class="vt-check"><input type="checkbox" id="vt-box"> I have read the rules above and I agree to follow all three.</label>
<div class="vt-actions"><button type="button" class="vt-agree" id="vt-agree" disabled>I agree and continue</button><button type="button" class="vt-cancel" id="vt-cancel">${cancelLabel || 'Cancel'}</button></div></section>`;
      document.body.appendChild(backdrop);
      const box = backdrop.querySelector('#vt-box');
      const agree = backdrop.querySelector('#vt-agree');
      box.addEventListener('change', () => { agree.disabled = !box.checked; });
      const close = (value) => { backdrop.remove(); resolve(value); };
      agree.addEventListener('click', () => { if (box.checked) close(true); });
      backdrop.querySelector('#vt-cancel').addEventListener('click', () => close(false));
    });
  };
})();
