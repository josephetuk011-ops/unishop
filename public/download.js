(function () {
  var $ = function (id) { return document.getElementById(id); };
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) { $('install-text').textContent = 'Unishop is already installed on this device.'; return; }
  fetch('/api/app-downloads').then(function (r) { return r.json(); }).then(function (data) {
    if (!data.android) return;
    $('android-link').href = data.android.url;
    if (data.android.sizeMb) $('android-size').textContent = 'Version package · ' + data.android.sizeMb + ' MB';
    $('android-card').hidden = false;
  }).catch(function () {});
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  function ready() {
    if (!window.unishopInstallPrompt) return;
    $('install-button').hidden = false; $('manual-note').hidden = true;
  }
  if (isIos) $('ios-note').hidden = false; else $('manual-note').hidden = false;
  document.addEventListener('unishop:installready', ready); ready();
  $('install-button').addEventListener('click', function () {
    var prompt = window.unishopInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.finally(function () { window.unishopInstallPrompt = null; $('install-button').hidden = true; });
  });
})();
