/**
 * RTM Pantallas LED - main.js
 * JS compartido para todas las páginas
 */

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

  navToggle.addEventListener('change', function() {
    const open = this.checked;
    drawer.style.maxHeight     = open ? '100vh' : '0';
    drawer.style.opacity       = open ? '1' : '0';
    drawer.style.pointerEvents = open ? 'auto' : 'none';
    document.body.style.overflow = open ? 'hidden' : '';
  });

  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navToggle.checked = false;
      navToggle.dispatchEvent(new Event('change'));
    });
  });
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
  popup.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePopup() {
  const popup = document.getElementById('popup-overlay');
  if (!popup) return;
  popup.classList.remove('show');
  document.body.style.overflow = '';
}

function initPopup() {
  document.getElementById('popup-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) closePopup();
  });
}

/* ===== FORMULARIO DE CONTACTO ===== */
function validateForm(form) {
  let valid = true;
  form.querySelectorAll('[required]').forEach(field => {
    const empty = field.tagName === 'SELECT' ? !field.value : !field.value.trim();
    if (empty) {
      field.closest('.form-field')?.classList.add('error');
      valid = false;
    }
  });
  return valid;
}

function clearFieldError(field) {
  field.closest('.form-field')?.classList.remove('error');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form      = e.target;
  const submitBtn = form.querySelector('.btn-submit') || document.getElementById('submit-btn');

  form.querySelectorAll('.form-field').forEach(f => f.classList.remove('error'));

  if (!validateForm(form)) {
    const firstError = form.querySelector('.form-field.error');
    firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstError?.querySelector('input, select, textarea')?.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    const response = await fetch('https://2j77uv25gk.execute-api.us-east-1.amazonaws.com/Prod/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      mode: 'cors',
      credentials: 'omit'
    });

    const result = await response.json();

    if (response.ok && result.message?.includes('exitosamente')) {
      showPopup();
      form.reset();
    } else {
      throw new Error(result.error || result.message || 'Error al enviar el formulario');
    }
  } catch (error) {
    let msg = 'Hubo un error al enviar tu consulta. ';
    if (error.name === 'TypeError') {
      msg += 'Verificá tu conexión a internet e intentá nuevamente.';
    } else {
      msg += error.message;
    }
    msg += ' También podés contactarnos por WhatsApp.';
    alert(msg);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
}

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.querySelectorAll('input, select, textarea').forEach(field => {
    field.addEventListener('input',  () => clearFieldError(field));
    field.addEventListener('change', () => clearFieldError(field));
  });

  form.addEventListener('submit', handleFormSubmit);
}

/* ===== LEAD POPUP (index.html) ===== */
function initLeadPopup() {
  const popup    = document.getElementById('lead-popup');
  const closeBtn = document.getElementById('lead-popup-close');
  if (!popup || sessionStorage.getItem('leadPopupShown')) return;

  let triggered = false;

  window.addEventListener('scroll', function onScroll() {
    if (triggered) return;
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    if (pct >= 50) {
      popup.classList.add('show');
      triggered = true;
      sessionStorage.setItem('leadPopupShown', '1');
      window.removeEventListener('scroll', onScroll);
    }
  }, { passive: true });

  closeBtn?.addEventListener('click', () => popup.classList.remove('show'));
  popup.addEventListener('click', e => { if (e.target === popup) popup.classList.remove('show'); });
}

/* ===== CARRUSEL (index.html) ===== */
function initCarousel() {
  const track = document.getElementById('carousel-track');
  if (!track || track.dataset.carouselReady === 'true') return;

  const logos = Array.from(track.children);
  if (!logos.length) return;

  /* Forzar carga eager */
  logos.forEach(logo => {
    logo.querySelectorAll('img[loading="lazy"]').forEach(img => {
      img.loading = 'eager';
    });
  });

  /* Clonar logos para loop infinito */
  logos.forEach(logo => {
    const clone = logo.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });

  track.dataset.carouselReady = 'true';

  /* Esperar a que TODAS las imágenes carguen antes de medir y animar */
  const images = Array.from(track.querySelectorAll('img'));
  const pending = images.filter(img => !img.complete);

  if (pending.length) {
    let loaded = 0;
    const onReady = () => { if (++loaded >= pending.length) startCarousel(track, logos); };
    pending.forEach(img => {
      img.addEventListener('load', onReady, { once: true });
      img.addEventListener('error', onReady, { once: true });
    });
  } else {
    startCarousel(track, logos);
  }
}

function startCarousel(track, origLogos) {
  track.style.animation = 'none';
  const gap = parseFloat(getComputedStyle(track).gap) || 60;
  const w = origLogos.reduce((sum, el) => sum + el.offsetWidth, 0) + gap * origLogos.length;

  const id = 'carousel-scroll';
  const style = document.createElement('style');
  style.textContent = `@keyframes ${id} { to { transform: translate3d(-${w}px, 0, 0); } }`;
  document.head.appendChild(style);

  /* Velocidad: ~40px por segundo */
  track.style.animation = `${id} ${w / 40}s linear infinite`;
}

/* ===== VIDEOS DE PROYECTOS (index.html) ===== */
function initProjectVideos() {
  document.querySelectorAll('.proyectos-video-item').forEach(item => {
    const video     = item.querySelector('video');
    const thumbnail = item.querySelector('.video-thumbnail');
    const overlay   = item.querySelector('.play-overlay');
    if (!video || !thumbnail || !overlay) return;

    item.addEventListener('click', () => {
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

async function loadProductsData() {
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) return;
    buildSearchIndex(await res.json());
  } catch { /* se carga al visitar productos.html */ }
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
}

function initMegaMenuSearch() {
  const input   = document.getElementById('mega-menu-search');
  const results = document.getElementById('mega-menu-search-results');
  if (!input || !results) return;

  let timer;
  input.addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => renderSearchResults(e.target.value, results), 200);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.mega-menu-search')) results.classList.remove('active');
  });
}

function renderSearchResults(query, container) {
  if (query.length < 2 || !searchIndex.length) {
    container.classList.remove('active');
    return;
  }

  const q    = normalize(query);
  const hits = searchIndex.filter(item =>
    normalize(item.name).includes(q) ||
    normalize(item.categoryName || '').includes(q)
  ).slice(0, 8);

  const labels = { category: 'Categoría', subcategory: 'Familia', model: 'Modelo' };

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
  return text.replace(new RegExp(`(${query})`, 'gi'), '<mark>$1</mark>');
}

/* ===== HERO VIDEOS (index.html) ===== */
function initHeroVideoSequence() {
  const videos = Array.from(document.querySelectorAll('.hero__video'));
  const fadeOverlay = document.getElementById('hero-fade-overlay');
  if (!videos.length || !fadeOverlay) return;

  let current = 0;
  const fadeMs = 800;
  const fadeBeforeEnd = .8;

  function playVideo(index) {
    videos.forEach((video, i) => {
      video.classList.toggle('active', i === index);
      if (i !== index) {
        video.pause();
        video.currentTime = 0;
      }
    });

    const video = videos[index];
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
  initContactForm();
  initLeadPopup();
  initCarousel();
  initProjectVideos();
  initHeroVideoSequence();
  loadProductsData();
  initMegaMenuSearch();
});
