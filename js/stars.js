(function () {
  const COUNT = 850;

  const field = document.createElement('div');
  field.className = 'star-field';
  field.setAttribute('aria-hidden', 'true');
  document.body.prepend(field);

  for (let i = 0; i < COUNT; i++) {
    const s = document.createElement('span');
    s.className = 'star';

    const x    = (Math.random() * 100).toFixed(2);
    const y    = (Math.random() * 100).toFixed(2);
    const roll = Math.random();
    let   sz, baseOp;

    if      (roll < 0.55) { sz = 1;   baseOp = +(0.30 + Math.random() * 0.35).toFixed(2); }
    else if (roll < 0.80) { sz = 1.5; baseOp = +(0.45 + Math.random() * 0.35).toFixed(2); }
    else if (roll < 0.95) { sz = 2;   baseOp = +(0.55 + Math.random() * 0.35).toFixed(2); }
    else                  { sz = 3;   baseOp = +(0.70 + Math.random() * 0.28).toFixed(2); }

    // ~30% of stars get a cool blue-white tint
    s.style.background = Math.random() < 0.3 ? '#bcd6ff' : '#ffffff';
    s.style.width   = sz + 'px';
    s.style.height  = sz + 'px';
    s.style.left    = x  + '%';
    s.style.top     = y  + '%';
    s.style.opacity = baseOp;

    // ~65% of stars twinkle
    if (Math.random() < 0.65) {
      const dur   = (1.6 + Math.random() * 5.5).toFixed(2);
      const delay = (-Math.random() * 10).toFixed(2); // negative = start mid-cycle
      s.style.setProperty('--base-op', baseOp);
      s.style.animationDuration = dur + 's';
      s.style.animationDelay   = delay + 's';
      s.classList.add('t');
    }

    field.appendChild(s);
  }
}());
