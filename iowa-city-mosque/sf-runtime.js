/*
 * SiteForge runtime: tiny dependency-free script that powers interactive
 * pieces of a site (mobile menu, forms, calendars, entrance animations).
 * It is used both inside the Angular builder and in exported static sites.
 */
(function () {
  'use strict';
  if (window.SFRuntime) return;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // ---- calendar -------------------------------------------------------------
  function renderCalendar(el) {
    var cfg;
    try { cfg = JSON.parse(el.getAttribute('data-sf-calendar') || '{}'); } catch (e) { cfg = {}; }
    var events = (cfg.events || []).filter(function (e) { return e && e.date; });
    var view = cfg.view || 'month';
    if (view === 'list') {
      var today = ymd(new Date());
      var up = events.filter(function (e) { return e.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      if (!up.length) up = events.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
      el.innerHTML = '<div class="sf-cal"><ul class="sf-cal-list">' + (up.length ? up.map(function (e) {
        var d = new Date(e.date + 'T00:00:00');
        return '<li class="sf-cal-item"><div class="sf-cal-date"><small>' + MONTHS[d.getMonth()].slice(0, 3) + '</small><b>' + d.getDate() + '</b></div>' +
          '<div class="sf-cal-info"><b>' + esc(e.title) + '</b><small>' + esc([e.time, e.location].filter(Boolean).join(' · ')) + '</small>' +
          (e.description ? '<div>' + esc(e.description) + '</div>' : '') + '</div></li>';
      }).join('') : '<li class="sf-cal-item">No upcoming events</li>') + '</ul></div>';
      return;
    }
    var cur = el.__sfMonth;
    if (!cur) {
      var now = new Date();
      cur = el.__sfMonth = { y: now.getFullYear(), m: now.getMonth() };
    }
    var first = new Date(cur.y, cur.m, 1);
    var start = new Date(first);
    start.setDate(1 - first.getDay());
    var todayS = ymd(new Date());
    var html = '<div class="sf-cal"><div class="sf-cal-head"><button type="button" class="sf-cal-nav" data-sf-cal-step="-1" aria-label="Previous month">‹</button>' +
      '<div class="sf-cal-title">' + MONTHS[cur.m] + ' ' + cur.y + '</div>' +
      '<button type="button" class="sf-cal-nav" data-sf-cal-step="1" aria-label="Next month">›</button></div><div class="sf-cal-grid">';
    DOW.forEach(function (d) { html += '<div class="sf-cal-dow">' + d + '</div>'; });
    for (var i = 0; i < 42; i++) {
      var d = new Date(start);
      d.setDate(start.getDate() + i);
      if (i >= 35 && d.getMonth() !== cur.m) break;
      var key = ymd(d);
      var evs = events.filter(function (e) { return e.date === key; });
      html += '<div class="sf-cal-day' + (d.getMonth() !== cur.m ? ' sf-out' : '') + (key === todayS ? ' sf-today' : '') + '"><span class="sf-cal-num">' + d.getDate() + '</span>' +
        evs.map(function (e) { return '<span class="sf-cal-ev" title="' + esc([e.title, e.time, e.location, e.description].filter(Boolean).join(' · ')) + '">' + esc((e.time ? e.time + ' ' : '') + e.title) + '</span>'; }).join('') +
        '</div>';
    }
    el.innerHTML = html + '</div></div>';
  }

  // ---- entrance animations ------------------------------------------------------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('sf-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 }) : null;

  // ---- header: collapse the menu into the burger when the links do not fit ----------
  function fitHeader(h) {
    var inner = h.querySelector('.sf-header-inner');
    var burger = h.querySelector('[data-sf-burger]');
    if (!inner || !burger) return;
    var was = h.classList.contains('sf-collapse');
    if (was) h.classList.remove('sf-collapse');
    // The container query already shows the burger on narrow screens.
    if (getComputedStyle(burger).display !== 'none') return;
    var overflow = inner.scrollWidth > inner.clientWidth + 1;
    if (overflow) h.classList.add('sf-collapse');
    else if (was) h.classList.remove('sf-nav-open');
  }
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) { fitHeader(en.target); });
  }) : null;

  function init(root) {
    root = root || document;
    if (root.querySelectorAll) {
      root.querySelectorAll('.sf-header').forEach(function (h) {
        if (!h.__sfFit) { h.__sfFit = true; if (ro) ro.observe(h); }
        fitHeader(h);
      });
      root.querySelectorAll('[data-sf-calendar]').forEach(function (el) {
        if (!el.__sfDone || !el.firstChild) { el.__sfDone = true; renderCalendar(el); }
      });
      root.querySelectorAll('.sf-anim[data-sf-anim]:not(.sf-in)').forEach(function (el) {
        if (io) io.observe(el); else el.classList.add('sf-in');
      });
    }
  }

  // ---- event delegation -----------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    var burger = t.closest('[data-sf-burger]');
    if (burger) {
      var h = burger.closest('.sf-header');
      if (h) {
        var open = h.classList.toggle('sf-nav-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    var navLink = t.closest('.sf-header .sf-nav a');
    if (navLink) {
      var hh = navLink.closest('.sf-header');
      if (hh) hh.classList.remove('sf-nav-open');
    }
    var step = t.closest('[data-sf-cal-step]');
    if (step) {
      var cal = step.closest('[data-sf-calendar]');
      if (cal && cal.__sfMonth) {
        var m = cal.__sfMonth.m + parseInt(step.getAttribute('data-sf-cal-step'), 10);
        cal.__sfMonth = { y: cal.__sfMonth.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
        renderCalendar(cal);
      }
    }
  });

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-sf-form')) return;
    ev.preventDefault();
    var wrap = form.closest('.sf-form-wrap') || form.parentElement;
    if (wrap && wrap.closest('.sf-mode-edit')) return;
    var data = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name) return;
      if (f.type === 'checkbox') data[f.name] = f.checked ? 'Yes' : 'No';
      else data[f.name] = f.value;
    });
    var title = form.getAttribute('data-sf-form') || 'Form';
    var action = form.getAttribute('data-action');
    var email = form.getAttribute('data-email');
    var err = form.querySelector('.sf-form-error');
    function done() {
      if (wrap) wrap.classList.add('sf-form-done');
      window.dispatchEvent(new CustomEvent('sf-form-submit', { detail: { title: title, data: data } }));
    }
    if (action) {
      fetch(action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); done(); })
        .catch(function (e) { if (err) err.textContent = 'Sorry, the form could not be sent (' + e.message + '). Please try again.'; });
      return;
    }
    if (email) {
      var body = Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n');
      window.location.href = 'mailto:' + email + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    }
    done();
  });

  // Auto-initialise content that appears later (e.g. rendered by Angular).
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; init(document); });
  }
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes' && m.target.hasAttribute && m.target.hasAttribute('data-sf-calendar')) { renderCalendar(m.target); continue; }
        if (m.addedNodes.length) { schedule(); }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sf-calendar'] });
  }
  // Web fonts change text widths after the first layout.
  if (document.fonts) {
    document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', schedule);
    document.fonts.ready.then(schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document); });
  else init(document);

  window.SFRuntime = { init: init, renderCalendar: renderCalendar };
})();
