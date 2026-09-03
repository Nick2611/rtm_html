/**
 * RTM Pantallas LED - main.js
 * JS compartido para todas las páginas
 */

window.RTM_ASSET_VERSION = window.RTM_ASSET_VERSION || '20260805-conversion2';
window.RTM_GET_VERSIONED_DATA_PATH = window.RTM_GET_VERSIONED_DATA_PATH || function(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(window.RTM_ASSET_VERSION)}`;
};
window.RTM_FETCH_PRODUCTS_DATA = window.RTM_FETCH_PRODUCTS_DATA || function() {
  if (!window.RTM_PRODUCTS_DATA_PROMISE) {
    const fetchJson = path => fetch(window.RTM_GET_VERSIONED_DATA_PATH(path));
    window.RTM_PRODUCTS_DATA_PROMISE = fetchJson('data/products.json')
      .then(async response => {
        if (response.ok) return response.json();
        const altResponse = await fetchJson('../data/products.json');
        if (!altResponse.ok) throw new Error('Could not load products data');
        return altResponse.json();
      })
      .catch(error => {
        window.RTM_PRODUCTS_DATA_PROMISE = null;
        throw error;
      });
  }

  return window.RTM_PRODUCTS_DATA_PROMISE;
};

/* ===== SCROLL SUAVE ===== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ===== MENÚ MÓVIL ===== */
function initMobileMenu() {
  const navToggle = document.getElementById('nav-toggle');
  const drawer    = document.querySelector('.drawer');
  if (!navToggle || !drawer) return;

  const syncMenuState = () => {
    const open = navToggle.checked;
    drawer.style.maxHeight     = open ? '100vh' : '0';
    drawer.style.opacity       = open ? '1' : '0';
    drawer.style.pointerEvents = open ? 'auto' : 'none';
    drawer.style.visibility    = open ? 'visible' : 'hidden';
    navToggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };

  navToggle.addEventListener('change', syncMenuState);

  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.checked = false;
      navToggle.dispatchEvent(new Event('change'));
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !navToggle.checked) return;
    navToggle.checked = false;
    syncMenuState();
    navToggle.focus();
  });

  syncMenuState();
}

/* ===== DROPDOWN MÓVIL (servicios.html) ===== */
function initMobileDropdown() {
  document.querySelectorAll('.drawer .dropdown-toggle-mobile').forEach(toggle => {
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      const menuItem = this.closest('.menu-item-dropdown');
      if (!menuItem) return;
      document.querySelectorAll('.drawer .menu-item-dropdown').forEach(item => {
        if (item !== menuItem) item.classList.remove('active');
      });
      menuItem.classList.toggle('active');
    });
  });
}

/* ===== POPUP ===== */
function showPopup() {
  const popup = document.getElementById('popup-overlay');
  if (!popup) return;
  popup._rtmReturnFocus = document.activeElement;
  popup.classList.add('show');
  popup.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => popup.querySelector('.popup-close')?.focus());
}

function closePopup() {
  const popup = document.getElementById('popup-overlay');
  if (!popup) return;
  popup.classList.remove('show');
  popup.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  popup._rtmReturnFocus?.focus?.();
  popup._rtmReturnFocus = null;
}

function initPopup() {
  document.getElementById('popup-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) closePopup();
  });
  document.addEventListener('keydown', event => {
    const popup = document.getElementById('popup-overlay');
    if (event.key === 'Escape' && popup?.classList.contains('show')) closePopup();
    if (event.key === 'Tab' && popup?.classList.contains('show')) {
      event.preventDefault();
      popup.querySelector('.popup-close')?.focus();
    }
  });
}

/* ===== ACCESO PERSISTENTE A COTIZACIÓN ===== */
const RTM_WHATSAPP_NUMBER = '5491151531530';

function getConversionContext() {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;
  const product = params.get('producto') || params.get('model') || '';
  const category = params.get('categoria') || params.get('cat') || '';
  const subcategory = params.get('subcategoria') || params.get('sub') || '';

  return {
    pathname,
    product,
    category,
    subcategory,
    origin: params.get('origen') || 'sitio'
  };
}

function readableSlug(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim();
}

function getConversionCopy(context) {
  const productName = readableSlug(context.product);

  if (productName) {
    return {
      label: 'Consultar este producto',
      message: `Hola, estoy viendo ${productName} en la web de RTM y quiero consultar precio, disponibilidad y asesoramiento.`
    };
  }

  if (context.pathname.includes('proyectos')) {
    return {
      label: 'Cotizar un proyecto similar',
      message: 'Hola, vi los proyectos de RTM y quiero asesoramiento para una solución LED similar.'
    };
  }

  if (context.pathname.includes('guia') || context.category) {
    return {
      label: 'Hablar con un asesor',
      message: `Hola, estoy evaluando ${readableSlug(context.category) || 'soluciones LED'} y necesito ayuda para elegir la opción adecuada.`
    };
  }

  return {
    label: 'Hablar con un asesor',
    message: 'Hola, quiero asesoramiento para una pantalla o letrero LED.\n\n'
      + 'Qué necesito (pantalla, letrero, tótem, piso, pórtico): \n'
      + 'Dónde va instalado: \n'
      + 'Medida aproximada: '
  };
}

function buildWhatsAppUrl(message) {
  return `https://wa.me/${RTM_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function hideDockNearPrimaryActions(container) {
  if (!('IntersectionObserver' in window)) return;

  const targets = document.querySelectorAll([
    '.hero [data-conversion^="whatsapp"]',
    '.guia-hero [data-conversion^="whatsapp"]',
    '.proyectos-cta',
    '.guia-elegir-cta',
    'form[data-contact-form]'
  ].join(','));
  if (!targets.length) return;

  const visibleTargets = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visibleTargets.add(entry.target);
      else visibleTargets.delete(entry.target);
    });
    container.hidden = visibleTargets.size > 0;
  }, { threshold: 0.15 });

  targets.forEach(target => observer.observe(target));
}

function initPersistentConversionDock() {
  const context = getConversionContext();
  if (context.pathname.includes('privacidad')) return;
  const copy = getConversionCopy(context);
  let container = document.querySelector('.floating-buttons');

  if (!container) {
    container = document.createElement('div');
    container.className = 'floating-buttons';
    container.setAttribute('aria-label', 'Acceso rápido a cotización');
    document.body.appendChild(container);
  }

  container.querySelectorAll('.floating-btn:not(.floating-btn--whatsapp)').forEach(button => button.remove());

  let whatsapp = container.querySelector('.floating-btn--whatsapp');
  if (!whatsapp) {
    whatsapp = document.createElement('a');
    whatsapp.className = 'floating-btn floating-btn--whatsapp';
    whatsapp.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i>';
    container.appendChild(whatsapp);
  }

  if (whatsapp.id === 'catalog-whatsapp-cta') {
    whatsapp.classList.add('floating-btn--expanded');
    document.body.classList.add('conversion-dock-active');
    return;
  }

  whatsapp.classList.add('floating-btn--expanded');
  whatsapp.href = buildWhatsAppUrl(copy.message);
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  whatsapp.dataset.conversion = whatsapp.dataset.conversion || 'whatsapp_persistent';
  whatsapp.dataset.context = context.product || context.category || context.pathname || 'site';
  whatsapp.setAttribute('aria-label', copy.label);

  let copyContainer = whatsapp.querySelector('.floating-btn__copy');
  if (!copyContainer) {
    copyContainer = document.createElement('span');
    copyContainer.className = 'floating-btn__copy';
    whatsapp.appendChild(copyContainer);
  }

  Array.from(whatsapp.children).forEach(child => {
    if (child.classList.contains('floating-btn__label') || child.classList.contains('floating-btn__title')) {
      child.remove();
    }
  });
  copyContainer.replaceChildren();
  const label = document.createElement('span');
  label.className = 'floating-btn__label';
  label.textContent = copy.label;
  copyContainer.appendChild(label);

  document.body.classList.add('conversion-dock-active');
  hideDockNearPrimaryActions(container);
}

/* ===== CARRUSEL (index.html) ===== */
function initCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track || track.dataset.carouselReady === 'true') return;

  const logos = Array.from(track.children);
  if (!logos.length) return;

  let restartFrame = null;
  let resizeTimer = null;

  const scheduleStart = () => {
    if (restartFrame) cancelAnimationFrame(restartFrame);
    restartFrame = requestAnimationFrame(() => {
      restartFrame = null;
      startCarousel(track, logos);
    });
  };

  /* Forzar carga eager y recalcular si algun logo cambia su layout */
  logos.forEach(logo => {
    logo.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.loading = 'eager';
      img.decoding = 'async';
      img.addEventListener('load', scheduleStart, { once: true });
      img.addEventListener('error', scheduleStart, { once: true });
    });
  });

  /* Clonar logos para loop infinito */
  logos.forEach(logo => {
    const clone = logo.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  track.dataset.carouselReady = 'true';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  scheduleStart();

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(scheduleStart, 150);
  }, { passive: true });
}

function startCarousel(track, origLogos) {
  const gap = parseFloat(getComputedStyle(track).gap) || 60;
  const w = origLogos.reduce((sum, el) => sum + el.offsetWidth, 0) + gap * origLogos.length;
  if (!w) return;

  const id = 'carousel-scroll';
  let style = document.getElementById(`${id}-style`);
  if (!style) {
    style = document.createElement('style');
    style.id = `${id}-style`;
    document.head.appendChild(style);
  }
  style.textContent = `@keyframes ${id} { to { transform: translate3d(-${w}px, 0, 0); } }`;

  /* Velocidad: ~40px por segundo */
  track.style.animation = 'none';
  track.offsetHeight;
  track.style.animation = `${id} ${w / 40}s linear infinite`;
}

/* ===== VIDEOS DE PROYECTOS (index.html) ===== */
function initProjectVideos() {
  document.querySelectorAll('.proyectos-video-item').forEach(item => {
    const video     = item.querySelector('video');
    const thumbnail = item.querySelector('.video-thumbnail');
    const overlay   = item.querySelector('.play-overlay');
    if (!video || !thumbnail || !overlay) return;

    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', 'Reproducir o pausar video del proyecto');

    const togglePlayback = () => {
      const isPlaying = thumbnail.style.display === 'none';
      if (isPlaying) {
        video.pause();
        thumbnail.style.display    = 'block';
        video.style.display        = 'none';
        overlay.style.opacity      = '1';
        overlay.style.pointerEvents = 'auto';
      } else {
        pauseAllVideos(item);
        thumbnail.style.display    = 'none';
        video.style.display        = 'block';
        video.play();
        overlay.style.opacity      = '0';
        overlay.style.pointerEvents = 'none';
      }
    };

    item.addEventListener('click', togglePlayback);
    item.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      togglePlayback();
    });
  });
}

function pauseAllVideos(except) {
  document.querySelectorAll('.proyectos-video-item').forEach(item => {
    if (item === except) return;
    const video     = item.querySelector('video');
    const thumbnail = item.querySelector('.video-thumbnail');
    const overlay   = item.querySelector('.play-overlay');
    if (video && !video.paused) {
      video.pause();
      if (thumbnail) { thumbnail.style.display = 'block'; video.style.display = 'none'; }
      if (overlay)   { overlay.style.opacity = '1'; overlay.style.pointerEvents = 'auto'; }
    }
  });
}

/* ===== MEGA MENU SEARCH (index.html) ===== */
let searchIndex = [];
let searchDataPromise = null;

async function loadProductsData() {
  const data = await window.RTM_FETCH_PRODUCTS_DATA();
  buildSearchIndex(data);
}

function ensureProductsSearchIndex() {
  if (searchIndex.length) return Promise.resolve(searchIndex);
  if (!searchDataPromise) {
    searchDataPromise = loadProductsData()
      .then(() => searchIndex)
      .catch(error => {
        searchDataPromise = null;
        throw error;
      });
  }
  return searchDataPromise;
}

function buildSearchIndex(data) {
  searchIndex = [];
  data.categories?.forEach(cat => {
    searchIndex.push({ type: 'category', name: cat.name, url: `productos.html?cat=${cat.slug}` });
    cat.subcategories?.forEach(sub => {
      if (!sub.models?.length) return;
      searchIndex.push({ type: 'subcategory', name: sub.name, categoryName: cat.name, url: `productos.html?cat=${cat.slug}&sub=${sub.slug}` });
      sub.models.forEach(model => {
        searchIndex.push({ type: 'model', name: model.name, categoryName: cat.name, subcategoryName: sub.name, url: `productos.html?cat=${cat.slug}&sub=${sub.slug}&model=${model.slug}` });
      });
    });
  });
  // Landing pages that present existing hardware for a different use.
  // They are not catalogue categories, so they carry their own synonyms.
  data.landings?.forEach(lp => {
    searchIndex.push({ type: 'landing', name: lp.name, keywords: lp.keywords || '', url: lp.url });
  });
}

function initMegaMenuSearch() {
  const input   = document.getElementById('mega-menu-search');
  const results = document.getElementById('mega-menu-search-results');
  if (!input || !results) return;

  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ensureProductsSearchIndex().catch(() => []);
      renderSearchResults(e.target.value, results);
    }, 200);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.mega-menu-search')) results.classList.remove('active');
  });
}

/* ===== BÚSQUEDA GLOBAL del navbar (todas las páginas) ===== */
function initGlobalSearch() {
  const input   = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await ensureProductsSearchIndex().catch(() => []);
      renderSearchResults(e.target.value, results);
    }, 200);
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 2) {
      ensureProductsSearchIndex()
        .then(() => renderSearchResults(input.value, results))
        .catch(() => {});
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) results.classList.remove('active');
  });
}

function renderSearchResults(query, container) {
  if (query.length < 2 || !searchIndex.length) {
    container.classList.remove('active');
    return;
  }

  const q    = normalize(query).replace(/\s+/g, '');
  const hits = searchIndex.filter(item =>
    normalize(item.name).replace(/\s+/g, '').includes(q) ||
    normalize(item.categoryName || '').replace(/\s+/g, '').includes(q) ||
    normalize(item.keywords || '').replace(/\s+/g, '').includes(q)
  ).slice(0, 8);

  const labels = { category: 'Categoría', subcategory: 'Familia', model: 'Modelo', landing: 'Página' };

  container.innerHTML = hits.length
    ? hits.map(r => `
        <a href="${r.url}" class="search-result-item">
          <span class="search-result-type search-type-${r.type}">${labels[r.type]}</span>
          <div class="search-result-content">
            <span class="search-result-name">${highlight(r.name, query)}</span>
            ${r.categoryName ? `<span class="search-result-path">${r.categoryName}${r.subcategoryName ? ' › ' + r.subcategoryName : ''}</span>` : ''}
          </div>
        </a>`).join('')
    : '<div class="search-no-results">No se encontraron resultados</div>';

  container.classList.add('active');
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlight(text, query) {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<mark>$1</mark>');
}

/* ===== HERO VIDEOS (index.html) ===== */
function initHeroVideoSequence() {
  const videos = Array.from(document.querySelectorAll('.hero__video'));
  const fadeOverlay = document.getElementById('hero-fade-overlay');
  if (!videos.length || !fadeOverlay) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;

  let current = 0;
  const fadeMs = 800;
  const fadeBeforeEnd = .8;

  function ensureVideoSource(video) {
    const pendingSource = video.querySelector('source[data-src]');
    if (!pendingSource) return;
    pendingSource.src = pendingSource.dataset.src;
    pendingSource.removeAttribute('data-src');
    video.preload = 'auto';
    video.load();
  }

  function playVideo(index) {
    videos.forEach((video, i) => {
      video.classList.toggle('active', i === index);
      if (i !== index) {
        video.pause();
        video.currentTime = 0;
      }
    });

    const video = videos[index];
    ensureVideoSource(video);
    video.currentTime = 0;
    fadeOverlay.classList.remove('fade-out');
    video.play().catch(() => {});
  }

  function nextVideo() {
    fadeOverlay.classList.add('fade-out');
    window.setTimeout(() => {
      current = (current + 1) % videos.length;
      playVideo(current);
    }, fadeMs / 4);
  }

  videos.forEach(video => {
    video.addEventListener('timeupdate', () => {
      if (!video.duration || Number.isNaN(video.duration)) return;
      if (video.currentTime >= video.duration - fadeBeforeEnd) {
        fadeOverlay.classList.add('fade-out');
      }
    });
    video.addEventListener('ended', nextVideo);
  });

  playVideo(current);
}

/* ===== EXPONER GLOBALS ===== */
window.closePopup = closePopup;
window.showPopup  = showPopup;

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  initSmoothScroll();
  initMobileMenu();
  initMobileDropdown();
  initPopup();
  initPersistentConversionDock();
  initCarousel();
  initProjectVideos();
  initHeroVideoSequence();
  initMegaMenuSearch();
  initGlobalSearch();
});
