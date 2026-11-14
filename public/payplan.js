// Shared "how do you want to pay" step shown before the buyer is sent to Paystack.
(function () {
  const FEE = 200;
  const money = (n) => `₦${Number(n).toLocaleString('en-NG')}`;
  if (!document.querySelector('#upay-style')) {
    const style = document.createElement('style');
    style.id = 'upay-style';
    style.textContent = '.upay-phone{display:block;margin:10px 0;font-size:13px;font-weight:600}.upay-phone input{display:block;width:100%;margin-top:6px;padding:10px;border:1px solid #ccd3e0;border-radius:10px;font:inherit}.upay-back{position:fixed;inset:0;background:rgba(10,10,10,.55);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px}.upay-box{background:#fff;color:#111;border-radius:16px;max-width:420px;width:100%;padding:20px;font-family:inherit}.upay-box h3{margin:0 0 4px;font-size:1.15rem}.upay-box p{margin:0 0 14px;color:#555;font-size:.9rem}.upay-opt{display:block;width:100%;text-align:left;border:2px solid #ddd;background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;font:inherit;color:inherit}.upay-opt:hover,.upay-opt:focus{border-color:#111;outline:none}.upay-opt strong{display:block;font-size:1rem}.upay-opt span{display:block;color:#555;font-size:.85rem;margin-top:3px}.upay-cancel{background:none;border:0;color:#555;width:100%;padding:8px;cursor:pointer;font:inherit}';
    document.head.appendChild(style);
  }
  // total = the amount payable in full (price plus delivery or service charge). Resolves 'full', 'part', or null when cancelled.
  // Pass { phone } to also ask for a contact number (required for service bookings); the answer is kept in UnishopPayPlan.phone.
  function choose(total, options) {
    const askPhone = Boolean(options && options.askPhone);
    return new Promise((resolve) => {
      const withFee = total + FEE;
      const first = Math.ceil(withFee / 2);
      const back = document.createElement('div');
      back.className = 'upay-back';
      back.innerHTML = `<div class="upay-box" role="dialog" aria-modal="true" aria-label="Choose how to pay"><h3>How would you like to pay?</h3><p>Pick one before you continue to Paystack.</p>${askPhone ? `<label class="upay-phone">Your phone number (so the provider and Unishop can reach you)<input type="tel" name="phone" required minlength="7" maxlength="20" autocomplete="tel" value="${String((options && options.phone) || '').replace(/[^0-9+()\s-]/g, '')}" placeholder="080 0000 0000"></label>` : ''}
        <button type="button" class="upay-opt" data-plan="full"><strong>Pay in full: ${money(total)}</strong><span>The price as listed or as agreed with the provider.</span></button>
        <button type="button" class="upay-opt" data-plan="part"><strong>Pay in two parts: ${money(first)} now</strong><span>Then ${money(withFee - first)} later. Total ${money(withFee)} including a ${money(FEE)} part payment fee. Your order is confirmed once the second part is paid.</span></button>
        <button type="button" class="upay-cancel">Cancel</button></div>`;
      const done = (value) => { back.remove(); resolve(value); };
      back.addEventListener('click', (event) => {
        const opt = event.target.closest('[data-plan]');
        if (opt) {
          if (askPhone) {
            const input = back.querySelector('[name="phone"]');
            if (!/^[0-9+()\s-]{7,20}$/.test(input.value.trim())) { input.focus(); input.setCustomValidity('Enter a valid phone number.'); input.reportValidity(); input.setCustomValidity(''); return; }
            window.UnishopPayPlan.phone = input.value.trim();
          }
          return done(opt.dataset.plan);
        }
        if (event.target === back || event.target.closest('.upay-cancel')) done(null);
      });
      document.body.appendChild(back);
      back.querySelector('[data-plan="full"]').focus();
    });
  }
  window.UnishopPayPlan = { choose, FEE };
})();
