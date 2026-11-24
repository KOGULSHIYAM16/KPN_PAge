/* KPN Tech hero: a network of local businesses, lit like the logo.
   Page-load ignition, small signals travelling between businesses,
   and a ripple wherever you tap or move the pointer. */
(function () {
  var canvas = document.getElementById('network');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CYAN = '53,227,238';
  var LABELS = ['Pharmacy', 'Clinic', 'Bakery', 'Tailor', 'Salon', 'Hardware', 'Grocery', 'Phone repair', 'Dental care'];

  // Seeded random so the network looks the same on every visit.
  var seed = 7;
  function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  // Points inside a brain-like shape (two overlapping lobes and a stem), in 0..1 space.
  function inShape(x, y) {
    var a = Math.pow((x - 0.40) / 0.36, 2) + Math.pow((y - 0.46) / 0.34, 2) < 1;
    var b = Math.pow((x - 0.62) / 0.32, 2) + Math.pow((y - 0.50) / 0.36, 2) < 1;
    var stem = x > 0.50 && x < 0.62 && y > 0.70 && y < 0.92;
    return a || b || stem;
  }

  var nodes = [];
  var tries = 0;
  while (nodes.length < 52 && tries < 4000) {
    tries++;
    var x = 0.06 + rand() * 0.9, y = 0.06 + rand() * 0.88;
    if (!inShape(x, y)) continue;
    var ok = true;
    for (var i = 0; i < nodes.length; i++) {
      var dx = nodes[i].x - x, dy = nodes[i].y - y;
      if (dx * dx + dy * dy < 0.0085) { ok = false; break; }
    }
    if (ok) nodes.push({ x: x, y: y, r: 2.2 + rand() * 2.6, label: null, t: 0, glow: 0, flash: 0 });
  }

  // A label needs clear room to its right, so no two labels collide.
  var labelled = 0;
  var picked = [];
  var order = nodes.slice().sort(function (a, b) { return (a.y * 3 + a.x) - (b.y * 3 + b.x); });
  for (var k = 0; k < order.length && labelled < LABELS.length; k++) {
    var n = order[k];
    if (n.x > 0.72) continue;
    var clash = picked.some(function (p) { return Math.abs(p.y - n.y) < 0.075 && Math.abs(p.x - n.x) < 0.3; });
    if (clash) continue;
    n.label = LABELS[labelled++]; n.r = 5.5; picked.push(n);
  }

  // Connect each node to its nearest neighbours.
  var edges = [];
  var seen = {};
  nodes.forEach(function (n, i) {
    nodes
      .map(function (m, j) { return { j: j, d: Math.pow(m.x - n.x, 2) + Math.pow(m.y - n.y, 2) }; })
      .filter(function (o) { return o.j !== i; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, 3)
      .forEach(function (o) {
        var key = i < o.j ? i + '-' + o.j : o.j + '-' + i;
        if (!seen[key] && o.d < 0.05) { seen[key] = 1; edges.push([i, o.j]); }
      });
  });

  // Ignition order: spreading out from the leftmost labelled node.
  var origin = nodes.reduce(function (a, b) { return (b.label && b.x < a.x) ? b : a; }, nodes[0]);
  var maxD = 0;
  nodes.forEach(function (n) {
    n.d = Math.sqrt(Math.pow(n.x - origin.x, 2) + Math.pow(n.y - origin.y, 2));
    if (n.d > maxD) maxD = n.d;
  });

  var W = 0, H = 0, dpr = 1;
  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduce) draw(performance.now());
  }

  var pointer = { x: -9999, y: -9999, active: false };
  var packets = [];
  var ripples = [];
  var start = null, lastSpawn = 0, lastFrame = 0;
  var DURATION = 1600;
  var visible = true;

  function spawnPacket() {
    var e = edges[Math.floor(Math.random() * edges.length)];
    var fwd = Math.random() < 0.5;
    packets.push({ from: fwd ? e[0] : e[1], to: fwd ? e[1] : e[0], t: 0, speed: 0.0011 + Math.random() * 0.0009 });
  }

  function draw(now) {
    if (!W) return;
    if (start === null) { start = now; lastFrame = now; }
    var dt = Math.max(0, Math.min(48, now - lastFrame)); lastFrame = now;
    var elapsed = reduce ? Infinity : now - start;
    ctx.clearRect(0, 0, W, H);

    // Ripples light the nodes they pass.
    ripples.forEach(function (rp) { if (rp.start === null || rp.start > now) rp.start = now; });
    ripples = ripples.filter(function (rp) { return now - rp.start < 900; });
    var rings = ripples.map(function (rp) {
      var life = Math.min(1, Math.max(0, (now - rp.start) / 900));
      return { x: rp.x, y: rp.y, r: Math.max(0, life * Math.max(W, H) * 0.7), life: life };
    });

    nodes.forEach(function (n) {
      var appear = (n.d / maxD) * DURATION;
      n.t = Math.max(0, Math.min(1, (elapsed - appear) / 380));
      var px = n.x * W, py = n.y * H;
      var dist = Math.sqrt(Math.pow(px - pointer.x, 2) + Math.pow(py - pointer.y, 2));
      var target = pointer.active ? Math.max(0, 1 - dist / 140) : 0;
      n.glow += (target - n.glow) * (reduce ? 1 : 0.18);
      rings.forEach(function (rr) {
        var dd = Math.sqrt(Math.pow(px - rr.x, 2) + Math.pow(py - rr.y, 2));
        if (Math.abs(dd - rr.r) < 18) n.flash = 1;
      });
      n.flash = Math.max(0, n.flash - dt / 700);
    });

    ctx.lineWidth = 1.4;
    edges.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      var t = Math.min(a.t, b.t);
      if (t <= 0) return;
      var g = Math.max(a.glow, b.glow, a.flash * 0.7, b.flash * 0.7);
      ctx.strokeStyle = 'rgba(' + CYAN + ',' + (0.26 + 0.55 * g) * t + ')';
      ctx.beginPath();
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    });

    // Signals travelling between businesses.
    if (!reduce && elapsed > DURATION) {
      if (now - lastSpawn > 420 && packets.length < 7) { spawnPacket(); lastSpawn = now; }
      packets = packets.filter(function (p) {
        p.t += p.speed * dt;
        var a = nodes[p.from], b = nodes[p.to];
        if (p.t >= 1) { b.flash = Math.max(b.flash, 0.8); return false; }
        var px = (a.x + (b.x - a.x) * p.t) * W, py = (a.y + (b.y - a.y) * p.t) * H;
        var back = Math.max(0, p.t - 0.25);
        var tx = (a.x + (b.x - a.x) * back) * W, ty = (a.y + (b.y - a.y) * back) * H;
        var grad = ctx.createLinearGradient(tx, ty, px, py);
        grad.addColorStop(0, 'rgba(' + CYAN + ',0)');
        grad.addColorStop(1, 'rgba(' + CYAN + ',0.95)');
        ctx.strokeStyle = grad; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#E9FDFF';
        ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      ctx.lineWidth = 1.4;
    }

    rings.forEach(function (rr) {
      ctx.strokeStyle = 'rgba(' + CYAN + ',' + 0.45 * (1 - rr.life) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rr.x, rr.y, rr.r, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.lineWidth = 1.4;

    nodes.forEach(function (n) {
      if (n.t <= 0) return;
      var px = n.x * W, py = n.y * H;
      var lift = Math.max(n.glow, n.flash);
      var r = n.r * (1 + 0.45 * lift);
      ctx.shadowColor = 'rgba(' + CYAN + ',0.9)';
      ctx.shadowBlur = 10 + 18 * lift;
      ctx.fillStyle = 'rgba(' + CYAN + ',' + (0.75 + 0.25 * lift) * n.t + ')';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

    });
  }

  var raf = null;
  function loop(now) {
    raf = (visible && !reduce) ? requestAnimationFrame(loop) : null;
    try { draw(now); } catch (err) { ripples = []; packets = []; }
  }
  function wake() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }

  function local(evt) {
    var rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }
  canvas.addEventListener('pointermove', function (evt) {
    if (evt.pointerType === 'touch') return;
    var p = local(evt); pointer.x = p.x; pointer.y = p.y; pointer.active = true; wake();
  });
  canvas.addEventListener('pointerleave', function () { pointer.active = false; });
  canvas.addEventListener('pointerdown', function (evt) {
    if (reduce) return;
    var p = local(evt);
    if (ripples.length > 4) ripples.shift();
    ripples.push({ x: p.x, y: p.y, start: null });
    wake();
  });

  // Pause when the hero scrolls out of view, to save battery on phones.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) wake();
    }).observe(canvas);
  }

  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  resize();
  if (reduce) draw(performance.now()); else wake();
})();
