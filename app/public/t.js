/* Clickify Tracking v1.0 — script first-party de atribuição.
 *
 * Instalação básica:
 *   <script src="https://SEU-DOMINIO/t.js" data-site="ck_SUA_CHAVE" async></script>
 *
 * Via CNAME (recomendado — vira cookie first-party de verdade, imune a bloqueador):
 *   1. Crie o registro CNAME: t.seudominio.com -> SEU-DOMINIO
 *   2. <script src="https://t.seudominio.com/t.js" data-site="ck_SUA_CHAVE" async></script>
 *   O endpoint de coleta é derivado da origem do script, então o CNAME funciona sem config extra.
 *
 * LGPD / consentimento: adicione data-consent="1" no script e só chame
 * window.Clickify.consent(true) depois do aceite no seu banner. Sem o aceite, nada é rastreado.
 *
 * O que ele faz:
 *  - captura UTMs + click IDs (fbclid, gclid, gbraid, wbraid, ttclid, msclkid) da URL
 *  - persiste por 30 dias em cookie first-party (+ backup em localStorage)
 *  - visita direta NÃO apaga atribuição paga anterior
 *  - injeta ck_vid + UTMs como campos ocultos em todo <form> (chegam ao checkout/pedido)
 *  - propaga UTMs nos links internos do site
 *  - expõe window.Clickify.attribution() e window.Clickify.visitorId()
 */
(function () {
  'use strict';
  var doc = document;
  var script = doc.currentScript;
  if (!script) return;
  var SITE = script.getAttribute('data-site');
  if (!SITE || SITE.indexOf('ck_') !== 0) return;
  var NEED_CONSENT = script.getAttribute('data-consent') === '1';

  var ORIGIN;
  try { ORIGIN = new URL(script.src, location.href).origin; } catch (e) { return; }
  var ENDPOINT = ORIGIN + '/api/t/e';

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var CLICK_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid', 'msclkid'];
  var ALL_KEYS = UTM_KEYS.concat(CLICK_KEYS);
  var ATTR_KEY = 'ck_attr';
  var VID_KEY = 'ck_vid';
  var TTL_DAYS = 30;
  var started = false;

  function uuid() {
    if (window.crypto && crypto.randomUUID) { try { return crypto.randomUUID(); } catch (e) {} }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function getCookie(n) {
    var m = doc.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(n, v, days) {
    var s = n + '=' + encodeURIComponent(v) + '; Max-Age=' + days * 86400 + '; Path=/; SameSite=Lax';
    if (location.protocol === 'https:') s += '; Secure';
    doc.cookie = s;
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }

  function readParams() {
    var out = null, q;
    try { q = new URLSearchParams(location.search); } catch (e) { return null; }
    ALL_KEYS.forEach(function (k) {
      var v = q.get(k);
      if (v) { out = out || {}; out[k] = v.slice(0, 500); }
    });
    return out;
  }
  function loadAttr() {
    var raw = getCookie(ATTR_KEY) || lsGet(ATTR_KEY);
    if (!raw) return null;
    try {
      var o = JSON.parse(raw);
      if (!o || !o.ts || Date.now() - o.ts > TTL_DAYS * 864e5) return null;
      return o;
    } catch (e) { return null; }
  }
  function saveAttr(params) {
    var raw = JSON.stringify({ p: params, ts: Date.now() });
    setCookie(ATTR_KEY, raw, TTL_DAYS);
    lsSet(ATTR_KEY, raw);
  }
  function visitorId() {
    var v = getCookie(VID_KEY) || lsGet(VID_KEY);
    if (!v) {
      v = uuid();
      setCookie(VID_KEY, v, 365);
      lsSet(VID_KEY, v);
    }
    return v;
  }
  function inject(form, obj) {
    Object.keys(obj).forEach(function (k) {
      if (!obj[k] || form.querySelector('input[name="' + k + '"]')) return;
      var i = doc.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = obj[k];
      form.appendChild(i);
    });
  }

  function track() {
    if (started) return;
    started = true;
    if (NEED_CONSENT && window.__ck_consent !== true) return;
    var vid = visitorId();
    var current = readParams();
    var stored = loadAttr();
    // Só sobrescreve quando a visita atual trouxe parâmetro pago: direto não apaga pago.
    if (current) { stored = { p: current, ts: Date.now() }; saveAttr(current); }

    var payload = JSON.stringify({
      site: SITE,
      vid: vid,
      url: location.href.slice(0, 1000),
      ref: doc.referrer ? doc.referrer.slice(0, 1000) : null,
      attr: stored ? stored.p : null,
      ts: Date.now()
    });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, payload);
      else fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true });
    } catch (e) {}

    // ck_vid + UTMs entram no pedido como campos ocultos do formulário.
    doc.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || f.tagName !== 'FORM') return;
      inject(f, { ck_vid: vid });
      if (stored) inject(f, stored.p);
    }, true);

    // Propaga UTMs nos links internos (o clique continua atribuído na próxima página).
    doc.addEventListener('click', function (ev) {
      if (!stored) return;
      var el = ev.target;
      var a = el && el.closest ? el.closest('a[href]') : null;
      if (!a) return;
      try {
        var u = new URL(a.getAttribute('href'), location.href);
        if (u.origin !== location.origin) return;
        var changed = false;
        UTM_KEYS.forEach(function (k) {
          if (stored.p[k] && !u.searchParams.get(k)) { u.searchParams.set(k, stored.p[k]); changed = true; }
        });
        if (changed) a.href = u.toString();
      } catch (e) {}
    }, true);
  }

  window.Clickify = window.Clickify || {};
  window.Clickify.attribution = function () { var s = loadAttr(); return s ? s.p : null; };
  window.Clickify.visitorId = visitorId;
  window.Clickify.consent = function (v) {
    window.__ck_consent = !!v;
    if (v) { started = false; track(); }
  };

  if (doc.readyState === 'complete' || doc.readyState === 'interactive') track();
  else doc.addEventListener('DOMContentLoaded', track);
})();
