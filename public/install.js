// "Download the app" banner shown at the top of the public pages, plus the install helper used by /download.html.
(function () {
  var DISMISS_KEY = 'unishop-app-banner-dismissed';
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  window.unishopInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.unishopInstallPrompt = event;
    document.dispatchEvent(new CustomEvent('unishop:installready'));
  });
  window.addEventListener('appinstalled', function () { window.unishopInstallPrompt = null; });

  function dismissedRecently() {
    try { var at = Number(localStorage.getItem(DISMISS_KEY)); return at && Date.now() - at < 7 * 24 * 60 * 60 * 1000; } catch (e) { return false; }
  }
  function showBanner() {
    if (standalone || dismissedRecently() || document.querySelector('.app-banner') || /\/download\.html$/.test(location.pathname)) return;
    var bar = document.createElement('div');
    bar.className = 'app-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Download the Unishop app');
    var logo = document.createElement('img'); logo.src = '/assets/icon-192.png'; logo.alt = '';
    var text = document.createElement('span'); text.textContent = 'Shop faster with the Unishop app';
    var cta = document.createElement('a'); cta.className = 'app-banner-cta'; cta.href = '/download.html'; cta.textContent = 'Download the app';
    var close = document.createElement('button'); close.className = 'app-banner-close'; close.type = 'button'; close.setAttribute('aria-label', 'Dismiss'); close.textContent = '\u00d7';
    close.addEventListener('click', function () { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} bar.remove(); });
    bar.append(logo, text, cta, close);
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner); else showBanner();
})();
