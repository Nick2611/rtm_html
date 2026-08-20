(function () {
  var lightbox, lightboxImg, lightboxCloseBtn, lastFocused;

  function ensureLightbox() {
    if (lightbox) return;
    lightbox = document.createElement('div');
    lightbox.className = 'lp-lightbox';
    lightbox.hidden = true;
    lightbox.innerHTML =
      '<button type="button" class="lp-lightbox__close" aria-label="Cerrar foto">&times;</button>' +
      '<img class="lp-lightbox__img" alt="">';
    document.body.appendChild(lightbox);
    lightboxImg = lightbox.querySelector('.lp-lightbox__img');
    lightboxCloseBtn = lightbox.querySelector('.lp-lightbox__close');
    lightboxCloseBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
  }

  function openLightbox(img, triggerEl) {
    ensureLightbox();
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || '';
    lightbox.hidden = false;
    document.documentElement.classList.add('lp-lightbox-open');
    lastFocused = triggerEl;
    lightboxCloseBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.documentElement.classList.remove('lp-lightbox-open');
    if (lastFocused) lastFocused.focus();
  }

  function initCarousel(root) {
    var track = root.querySelector('.lp-carousel__track');
    var items = Array.prototype.slice.call(track.children);
    var prevBtn = root.querySelector('.lp-carousel__arrow--prev');
    var nextBtn = root.querySelector('.lp-carousel__arrow--next');
    var active = Math.floor((items.length - 1) / 2);

    var n = items.length;

    function render() {
      var spacing = root.clientWidth < 560 ? 160 : 240;
      items.forEach(function (item, i) {
        var offset = i - active;
        if (offset > n / 2) offset -= n;
        if (offset < -n / 2) offset += n;
        var dist = Math.abs(offset);
        var scale = dist === 0 ? 1 : dist === 1 ? .82 : .68;
        item.style.transform = 'translateX(' + offset * spacing + 'px) scale(' + scale + ')';
        item.style.filter = dist === 0 ? 'blur(0)' : 'blur(' + Math.min(dist * 1.5 + 1, 4) + 'px)';
        item.style.opacity = dist > 2 ? '0' : dist === 0 ? '1' : '0.6';
        item.style.zIndex = String(n - dist);
        item.style.pointerEvents = dist > 2 ? 'none' : 'auto';
        item.classList.toggle('is-active', dist === 0);
        item.setAttribute('aria-hidden', dist === 0 ? 'false' : 'true');
        var btn = item.querySelector('button');
        if (btn) btn.tabIndex = dist === 0 ? 0 : -1;
      });
    }

    function goTo(index) {
      active = ((index % n) + n) % n;
      render();
    }

    prevBtn.addEventListener('click', function () { goTo(active - 1); });
    nextBtn.addEventListener('click', function () { goTo(active + 1); });

    items.forEach(function (item, i) {
      var btn = item.querySelector('.lp-carousel__item-btn');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (i !== active) {
          goTo(i);
        } else {
          openLightbox(btn.querySelector('img'), btn);
        }
      });
    });

    var startX = null;
    var startY = null;
    track.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        goTo(active + (dx < 0 ? 1 : -1));
      }
      startX = null;
      startY = null;
    });

    window.addEventListener('resize', render);
    render();
  }

  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
})();
