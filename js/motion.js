/* KPN Tech: page motion. Everything here is skipped when the visitor
   asks for reduced motion, and the page reads fine without JavaScript. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (reduce) root.classList.add('reduce');

  // 1. Headline: words rise into place on load.
  var title = document.querySelector('[data-split]');
  if (title && !reduce) {
    var words = title.textContent.trim().split(/\s+/);
    title.setAttribute('aria-label', title.textContent.trim());
    title.textContent = '';
    words.forEach(function (w, i) {
      var outer = document.createElement('span');
      outer.className = 'word';
      outer.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.textContent = w;
      inner.style.animationDelay = (120 + i * 70) + 'ms';
      outer.appendChild(inner);
      title.appendChild(outer);
      if (i < words.length - 1) title.appendChild(document.createTextNode(' '));
    });
    title.style.setProperty('--after', (120 + words.length * 70 + 120) + 'ms');
  }
  requestAnimationFrame(function () { root.classList.add('is-loaded'); });

  // 2. Reveal blocks as they scroll into view.
  var reveals = document.querySelectorAll('[data-reveal]');
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        var counters = e.target.querySelectorAll('[data-count]');
        counters.forEach(countUp);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // 3. Prices count up once, when first seen.
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (!target) return;
    var t0 = null, dur = 900;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = 'LKR ' + (Math.round(target * eased / 100) * 100).toLocaleString('en-US');
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 4. Mobile call bar: appears once the hero is scrolled past.
  var bar = document.querySelector('.callbar');
  var hero = document.querySelector('.hero, .page-head');
  if (bar && hero && 'IntersectionObserver' in window) {
    var pastHero = false, atContact = false;
    function sync() { bar.classList.toggle('is-shown', pastHero && !atContact); }
    new IntersectionObserver(function (entries) {
      pastHero = !entries[0].isIntersecting; sync();
    }, { rootMargin: '-40% 0px 0px 0px' }).observe(hero);
    var contact = document.getElementById('contact');
    if (contact) {
      new IntersectionObserver(function (entries) {
        atContact = entries[0].isIntersecting; sync();
      }, { threshold: 0.25 }).observe(contact);
    }
  } else if (bar) {
    bar.classList.add('is-shown');
  }
})();
