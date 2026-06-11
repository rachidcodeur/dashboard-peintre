/* Protection mot de passe avec popup HTML + cache 30 jours.
   Inclure via <script src="../auth.js"></script> en HEAD (pas de `defer`). */
(function () {
  var KEY = 'dash_auth_v1';
  var TTL = 30 * 24 * 3600 * 1000; // 30 jours
  var PASSWORD = 'Distrimag33@';

  var stored = localStorage.getItem(KEY);
  if (stored && (Date.now() - parseInt(stored, 10)) < TTL) return;

  // Masquer le body avant le premier paint (évite le flash de contenu)
  var hideStyle = document.createElement('style');
  hideStyle.textContent = 'body{visibility:hidden!important;overflow:hidden!important}';
  document.head.appendChild(hideStyle);

  function showModal() {
    var overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML =
      '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">' +
        '<div class="auth-icon">🔒</div>' +
        '<h2 id="auth-title">Accès protégé</h2>' +
        '<p>Entrez le mot de passe pour accéder au dashboard.</p>' +
        '<form id="auth-form" autocomplete="off">' +
          '<input type="password" id="auth-pwd" placeholder="Mot de passe" autocomplete="off" required>' +
          '<button type="submit">Valider</button>' +
          '<p class="auth-error" id="auth-err" hidden>Mot de passe incorrect.</p>' +
        '</form>' +
      '</div>';

    var css = document.createElement('style');
    css.textContent =
      '#auth-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(15,23,42,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;visibility:visible!important;' +
      'animation:authFadeIn .2s ease-out}' +
      '@keyframes authFadeIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes authPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}' +
      '@keyframes authShake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(3px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}' +
      '.auth-modal{background:#fff;border-radius:18px;padding:40px 34px 32px;max-width:380px;width:90%;' +
      'box-shadow:0 24px 64px rgba(0,0,0,.32),0 2px 8px rgba(0,0,0,.08);text-align:center;' +
      'animation:authPop .25s cubic-bezier(.34,1.2,.64,1)}' +
      '.auth-icon{font-size:52px;line-height:1;margin-bottom:14px;filter:drop-shadow(0 4px 12px rgba(15,23,42,.18))}' +
      '.auth-modal h2{font-size:22px;font-weight:700;color:#0F172A;margin:0 0 8px;letter-spacing:-.01em}' +
      '.auth-modal p{font-size:14px;color:#64748B;margin:0 0 22px;line-height:1.5}' +
      '#auth-form{display:flex;flex-direction:column;gap:12px}' +
      '.auth-modal input{width:100%;padding:13px 16px;font-size:15px;border:1.5px solid #E2E8F0;border-radius:10px;' +
      'outline:none;background:#FAFBFC;color:#1A1A1A;transition:border-color .15s,box-shadow .15s,background-color .15s;' +
      'font-family:inherit;-webkit-appearance:none}' +
      '.auth-modal input:focus{border-color:#0F172A;background:#fff;box-shadow:0 0 0 3px rgba(15,23,42,.12)}' +
      '.auth-modal input.auth-wrong{border-color:#DC2626;background:#FEF2F2;animation:authShake .4s ease-in-out}' +
      '.auth-modal button{width:100%;padding:13px;font-size:15px;font-weight:600;background:#0F172A;color:#fff;' +
      'border:none;border-radius:10px;cursor:pointer;transition:background-color .15s,transform .1s;font-family:inherit}' +
      '.auth-modal button:hover{background:#1E293B}' +
      '.auth-modal button:active{transform:scale(.98)}' +
      '.auth-error{color:#DC2626;font-size:13px;font-weight:500;margin:6px 0 0;text-align:center}';

    document.head.appendChild(css);
    document.body.appendChild(overlay);

    var input = document.getElementById('auth-pwd');
    var err = document.getElementById('auth-err');
    var form = document.getElementById('auth-form');

    setTimeout(function () { input.focus(); }, 50);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === PASSWORD) {
        localStorage.setItem(KEY, String(Date.now()));
        overlay.remove();
        hideStyle.remove();
      } else {
        err.hidden = false;
        input.classList.add('auth-wrong');
        input.select();
        setTimeout(function () { input.classList.remove('auth-wrong'); }, 500);
      }
    });

    // Empêcher tabulation hors du modal
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') e.preventDefault();
    });
  }

  if (document.body) showModal();
  else document.addEventListener('DOMContentLoaded', showModal);
})();
