(() => {
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const dotsWrap = document.getElementById('dots');
  const nextBtn = document.getElementById('nextBtn');
  const openBtn = document.getElementById('openBtn');
  const track = document.getElementById('track');
  let current = 0;

  // ---- build dots ----
  scenes.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'dots__item';
    dotsWrap.appendChild(d);
  });
  const dotEls = Array.from(dotsWrap.children);

  function render() {
    scenes.forEach((s, i) => {
      s.classList.toggle('is-active', i === current);
      s.classList.toggle('is-prev', i < current);
    });
    dotEls.forEach((d, i) => d.classList.toggle('is-active', i === current));
    // hide the scroll-down arrow on the landing scene (use "Buka Suratnya") and on the last scene
    nextBtn.classList.toggle('is-hidden', current === 0 || current === scenes.length - 1);

    if (current === scenes.length - 1) {
      launchConfetti();
    }
  }

  function goTo(i) {
    if (i < 0 || i >= scenes.length) return;
    current = i;
    render();
    scenes[current].scrollTop = 0;
    // restart reveal animations on hero each time it becomes active
    if (scenes[current].id === 'scene-1') {
      const els = scenes[current].querySelectorAll('.reveal');
      els.forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    }
  }

  function next() { goTo(current + 1); }

  nextBtn.addEventListener('click', next);
  openBtn.addEventListener('click', next);

  // letter scene (and any tall scene) can be scrolled internally — only
  // change section once the user has reached the top/bottom edge of it
  function atTop(el) { return el.scrollTop <= 1; }
  function atBottom(el) { return el.scrollTop + el.clientHeight >= el.scrollHeight - 1; }

  // ---- navigation lock so one scroll/swipe = exactly one section ----
  let locked = false;
  function unlockSoon() { setTimeout(() => { locked = false; }, 750); }
  function tryNav(dir) {
    // on the landing scene, scroll/swipe/keyboard navigation is disabled —
    // the visitor must press "Buka Suratnya" to continue (which also starts music)
    if (current === 0 && dir > 0) return;
    if (locked) return;
    locked = true;
    dir > 0 ? next() : goTo(current - 1);
    unlockSoon();
  }

  // desktop: mouse wheel
  window.addEventListener('wheel', (e) => {
    const sceneEl = scenes[current];
    const scrollable = sceneEl.scrollHeight > sceneEl.clientHeight + 2;
    if (scrollable) {
      if (e.deltaY > 0 && !atBottom(sceneEl)) return; // let it scroll down internally
      if (e.deltaY < 0 && !atTop(sceneEl)) return;     // let it scroll up internally
    }
    e.preventDefault();
    if (Math.abs(e.deltaY) < 8) return;
    tryNav(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // keyboard support
  window.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); tryNav(1); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); tryNav(-1); }
  });

  // mobile: swipe up/down
  let touchStartY = null;
  track.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    const sceneEl = scenes[current];
    const scrollable = sceneEl.scrollHeight > sceneEl.clientHeight + 2;
    if (scrollable && touchStartY !== null) {
      const dy = touchStartY - e.touches[0].clientY;
      if (dy > 0 && !atBottom(sceneEl)) return; // allow native scroll down
      if (dy < 0 && !atTop(sceneEl)) return;     // allow native scroll up
    }
    e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', (e) => {
    if (touchStartY === null) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    const sceneEl = scenes[current];
    const scrollable = sceneEl.scrollHeight > sceneEl.clientHeight + 2;
    const blocked = scrollable && ((dy > 0 && !atBottom(sceneEl)) || (dy < 0 && !atTop(sceneEl)));
    if (!blocked && Math.abs(dy) > 40) tryNav(dy > 0 ? 1 : -1);
    touchStartY = null;
  }, { passive: true });

  // ---- initial render ----
  render();

  // ---- gallery lightbox: tap a photo in "Sejauh ini, bersamamu" to preview it bigger ----
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxSpinner = document.getElementById('lightboxSpinner');

  let loadToken = 0; // bumped on every click so a slow-loading older photo never overwrites a newer one

  function openLightbox(src, alt) {
    lightbox.classList.add('is-open');
    if (lightboxImg.src.endsWith(src)) return; // already showing this exact photo

    loadToken++;
    const myToken = loadToken;

    lightboxImg.classList.add('is-loading');
    lightboxSpinner.classList.add('is-visible');

    const preloader = new Image();
    preloader.onload = () => {
      if (myToken !== loadToken) return; // a newer photo was requested meanwhile — ignore this stale result
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightboxImg.classList.remove('is-loading');
      lightboxSpinner.classList.remove('is-visible');
    };
    preloader.src = src;
  }
  function closeLightbox() {
    lightbox.classList.remove('is-open');
  }

  document.querySelectorAll('.gallery .gallery__item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation(); // don't trigger section navigation
      const img = item.querySelector('img');
      if (img) openLightbox(img.src, img.alt);
    });
  });

  lightboxClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox(); // click on the dark backdrop closes it
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });


  document.querySelectorAll('[data-stack]').forEach(stack => {
    const items = Array.from(stack.querySelectorAll('.stack__item'));
    let order = [0, 1, 2]; // indices into items, order[0] = currently on top

    function applyOrder() {
      const classes = ['stack__item--1', 'stack__item--2', 'stack__item--3'];
      // order[2] is the topmost visually (back -> front), so reverse-map
      order.forEach((itemIndex, posFromTop) => {
        const el = items[itemIndex];
        el.classList.remove('stack__item--1', 'stack__item--2', 'stack__item--3');
        // posFromTop 0 = top/front -> should get class --3 (highest, matches existing CSS front position)
        el.classList.add(classes[2 - posFromTop]);
      });
    }

    stack.addEventListener('click', (e) => {
      e.stopPropagation();
      // move current top (order[0]) to the back of the pile
      order.push(order.shift());
      applyOrder();
    });
  });

  // ---- petals ----
  const petalsWrap = document.getElementById('petals');
  const PETAL_COUNT = window.innerWidth < 640 ? 10 : 18;
  for (let i = 0; i < PETAL_COUNT; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    const left = Math.random() * 100;
    const dur = 9 + Math.random() * 10;
    const delay = Math.random() * 12;
    const size = 8 + Math.random() * 10;
    p.style.left = left + 'vw';
    p.style.width = size + 'px';
    p.style.height = (size * 1.25) + 'px';
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = '-' + delay + 's';
    p.style.opacity = (0.18 + Math.random() * 0.3).toFixed(2);
    petalsWrap.appendChild(p);
  }

  // ---- parallax (pointer + gyroscope-lite via mousemove) ----
  let mx = 0, my = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
    applyParallax();
  });

  function applyParallax() {
    const blobs = document.querySelectorAll('.blob');
    blobs.forEach((b, i) => {
      const factor = (i + 1) * 6;
      b.style.transform = `translate(${mx * factor}px, ${my * factor}px)`;
    });
  }

  // ---- confetti for final scene ----
  let confettiLaunched = false;
  function launchConfetti() {
    if (confettiLaunched) return;
    confettiLaunched = true;
    const wrap = document.getElementById('confetti');
    const colors = ['#D8748F', '#C9A36A', '#F6CADA', '#B9587A', '#FFF8F3'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      c.style.animationDuration = (3 + Math.random() * 3) + 's';
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      wrap.appendChild(c);
    }
  }
})();

/* =========================================================
   BACKGROUND MUSIC — autoplay, loop, floating mute button
========================================================= */
(function () {
  const audio = document.getElementById('bgMusic');
  const btn = document.getElementById('musicBtn');
  if (!audio || !btn) return;

  audio.volume = 0.55;
  let userMuted = false;

  function reflect() {
    // reflect the user's intent, not the autoplay-blocked state — so the
    // button shows "playing" by default even before the browser lets it start
    const on = !userMuted;
    btn.classList.toggle('is-muted', !on);
    btn.setAttribute('aria-label', on ? 'Matikan musik' : 'Nyalakan musik');
    btn.setAttribute('title', on ? 'Matikan musik' : 'Nyalakan musik');
  }

  function tryPlay() {
    if (userMuted) return;
    audio.muted = false;
    audio.play().then(reflect).catch(reflect);
  }

  // attempt autoplay immediately
  tryPlay();

  // browsers often block autoplay until first interaction — retry on first gesture
  // music starts only when the visitor actually navigates — i.e. presses
  // "Buka Suratnya" or a navigation arrow, NOT on a random click
  const openBtn = document.getElementById('openBtn');
  const nextBtn = document.getElementById('nextBtn');
  [openBtn, nextBtn].forEach(b => b && b.addEventListener('click', tryPlay));
  // keyboard navigation (arrows / enter / space) also counts
  window.addEventListener('keydown', (e) => {
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Enter', ' '].includes(e.key)) tryPlay();
  });

  // mute / unmute toggle
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (audio.paused || audio.muted) {
      userMuted = false;
      audio.muted = false;
      audio.play().catch(() => {});
    } else {
      userMuted = true;
      audio.pause();
    }
    reflect();
  });

  // reveal the floating button only once music has actually started playing
  audio.addEventListener('play', () => { btn.classList.remove('is-hidden'); reflect(); });
  audio.addEventListener('pause', reflect);
  reflect();
})();
