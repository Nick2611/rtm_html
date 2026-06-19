/**
 * RTM Pantallas LED - Sistema de Productos
 * Maneja la carga dinámica de productos, navegación y búsqueda
 */

window.RTM_ASSET_VERSION = window.RTM_ASSET_VERSION || '20260619-cache2';
window.RTM_GET_VERSIONED_DATA_PATH = window.RTM_GET_VERSIONED_DATA_PATH || function(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(window.RTM_ASSET_VERSION)}`;
};
window.RTM_FETCH_PRODUCTS_DATA = window.RTM_FETCH_PRODUCTS_DATA || function() {
  if (!window.RTM_PRODUCTS_DATA_PROMISE) {
    const fetchJson = path => fetch(window.RTM_GET_VERSIONED_DATA_PATH(path), { cache: 'no-store' });
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

class RTMProducts {
  constructor() {
    this.data = null;
    this.currentCategory = null;
    this.currentSubcategory = null;
    this.currentFilter = 'all'; // 'all', 'indoor', 'outdoor'
    this.searchIndex = [];
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.buildSearchIndex();
      this.renderMegaMenu();
      this.initSearch();
      await this.handleRouting();
    } catch (error) {
      console.error('Error initializing RTM Products:', error);
    }
  }

  normalizeImagePath(imagePath) {
    if (!imagePath || typeof imagePath !== 'string') return '';

    const trimmedPath = imagePath.trim();
    if (trimmedPath.startsWith('data:')) return trimmedPath;

    // El catalogo de productos debe usar imagenes locales.
    if (/^(https?:)?\/\//i.test(trimmedPath)) return '';

    const cleanedPath = trimmedPath
      .replace(/^\.?\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');

    return cleanedPath ? `/${cleanedPath}` : '';
  }

  escapeAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  getModelImages(model) {
    const declaredImages = Array.isArray(model.images) && model.images.length > 0
      ? model.images
      : (model.image ? [model.image] : []);

    return [...new Set(
      declaredImages
        .map(image => this.normalizeImagePath(image))
        .filter(Boolean)
    )];
  }

  getImageErrorHandler() {
    return 'this.onerror=null;this.style.display="none";this.classList.add("image-load-error");';
  }

  findProductCard(container, modelSlug) {
    return Array.from(container.querySelectorAll('.product-card'))
      .find(card => card.dataset.model === modelSlug);
  }

  initProductCarousels(subcategories) {
    subcategories.forEach(subcategory => {
      (subcategory.models || []).forEach(model => {
        if (this.getModelImages(model).length > 1) this.initCarousel(model.id);
      });
    });
  }

  renderProductEnvironmentBadge(model, subcategory) {
    const modelEnvironment = model.environment || subcategory.environment || 'all';
    return modelEnvironment !== 'all'
      ? `<span class="product-env-badge env-${modelEnvironment}">${modelEnvironment}</span>`
      : '';
  }

  renderProductMedia(model, options = {}) {
    const images = this.getModelImages(model);
    const detail = Boolean(options.detail);
    const carouselId = options.carouselId || model.id;
    const frameClass = detail ? 'model-media-frame' : 'product-media-frame';
    const carouselClass = detail ? 'model-carousel' : 'product-carousel';
    const firstImageLoading = detail ? 'eager' : 'lazy';
    const firstImagePriority = detail ? 'high' : 'low';
    const imageErrorHandler = this.getImageErrorHandler();

    if (images.length > 1) {
      return `
        <div class="${carouselClass}" data-carousel-id="${carouselId}">
          <div class="product-carousel-container">
            ${images.map((img, index) => `
              <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
                <img ${index === 0 ? `src="${this.escapeAttribute(img)}"` : `data-src="${this.escapeAttribute(img)}"`} alt="${this.escapeAttribute(model.name)} - Imagen ${index + 1}" loading="${index === 0 ? firstImageLoading : 'lazy'}" fetchpriority="${index === 0 ? firstImagePriority : 'low'}" decoding="async" onerror="${this.escapeAttribute(imageErrorHandler)}">
              </div>
            `).join('')}
          </div>
          <div class="carousel-indicators">
            ${images.map((_, index) => `
              <button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-slide-to="${index}" aria-label="Ir a imagen ${index + 1}"></button>
            `).join('')}
          </div>
          <button class="carousel-nav carousel-prev" aria-label="Imagen anterior"><i class="fas fa-chevron-left"></i></button>
          <button class="carousel-nav carousel-next" aria-label="Imagen siguiente"><i class="fas fa-chevron-right"></i></button>
        </div>
      `;
    }

    return `
      <div class="${frameClass}" ${images[0] ? '' : 'data-empty="true"'}>
        ${images[0] ? `<img src="${this.escapeAttribute(images[0])}" alt="${this.escapeAttribute(model.name)}" loading="${firstImageLoading}" fetchpriority="${firstImagePriority}" decoding="async" onerror="${this.escapeAttribute(imageErrorHandler)}">` : ''}
      </div>
    `;
  }

  async loadData() {
    this.data = await window.RTM_FETCH_PRODUCTS_DATA();
  }

  buildSearchIndex() {
    this.searchIndex = [];
    this.data.categories.forEach(category => {
      this.searchIndex.push({
        type: 'category',
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        url: `productos.html?cat=${category.slug}`
      });
      if (category.subcategories) {
        category.subcategories.forEach(subcategory => {
          this.searchIndex.push({
            type: 'subcategory',
            id: subcategory.id,
            name: subcategory.name,
            slug: subcategory.slug,
            categoryName: category.name,
            categorySlug: category.slug,
            description: subcategory.description,
            url: `productos.html?cat=${category.slug}&sub=${subcategory.slug}`
          });
          if (subcategory.models) {
            subcategory.models.forEach(model => {
              this.searchIndex.push({
                type: 'model',
                id: model.id,
                name: model.name,
                slug: model.slug,
                categoryName: category.name,
                categorySlug: category.slug,
                subcategoryName: subcategory.name,
                subcategorySlug: subcategory.slug,
                description: model.description,
                url: `productos.html?cat=${category.slug}&sub=${subcategory.slug}&model=${model.slug}`
              });
            });
          }
        });
      }
    });
  }

  renderMegaMenu() {
    const megaMenuContainer = document.getElementById('mega-menu');
    const mobileMenuContainer = document.getElementById('mobile-mega-menu');
    if (!megaMenuContainer && !mobileMenuContainer) return;
    const menuHTML = this.generateMegaMenuHTML();
    const mobileMenuHTML = this.generateMobileMenuHTML();
    if (megaMenuContainer) megaMenuContainer.innerHTML = menuHTML;
    if (mobileMenuContainer) mobileMenuContainer.innerHTML = mobileMenuHTML;
    this.attachMegaMenuEvents();
  }

  generateMegaMenuHTML() {
    let html = '<div class="mega-menu-grid">';
    this.data.categories.forEach(category => {
      html += `
        <div class="mega-menu-category" data-category="${category.slug}">
          <a href="productos.html?cat=${category.slug}" class="mega-menu-category-title">
            <i class="fas ${category.icon || 'fa-cube'}"></i>
            <span>${category.name}</span>
          </a>
          ${this.generateSubcategoriesHTML(category)}
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  generateSubcategoriesHTML(category) {
    if (!category.subcategories || category.subcategories.length === 0) {
      if (category.isSpecialPage) return '';
      return '';
    }

    // ── CAMBIO ──
    // Si la categoría tiene una sola subcategoría útil (caso Pisos LED),
    // listar los modelos directamente para evitar la "carpeta" intermedia.
    const subcatsConModelos = category.subcategories.filter(s =>
      s.models && s.models.length > 0 && !s.parentSubcategory
    );
    if (subcatsConModelos.length === 1) {
      const sub = subcatsConModelos[0];
      let html = '<ul class="mega-menu-subcategories">';
      sub.models.forEach(model => {
        html += `
          <li>
            <a href="productos.html?cat=${category.slug}&sub=${sub.slug}&model=${model.slug}">
              ${model.name}
            </a>
          </li>
        `;
      });
      html += '</ul>';
      return html;
    }

    let html = '<ul class="mega-menu-subcategories">';
    category.subcategories.forEach(subcategory => {
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) return;
      html += `
        <li>
          <a href="productos.html?cat=${category.slug}&sub=${subcategory.slug}">
            ${subcategory.name}
            ${subcategory.environment ? `<span class="env-badge env-${subcategory.environment}">${subcategory.environment}</span>` : ''}
          </a>
        </li>
      `;
    });
    html += '</ul>';
    return html;
  }

  generateMobileMenuHTML() {
    let html = '';
    this.data.categories.forEach(category => {
      const hasSubcats = category.subcategories && category.subcategories.length > 0;
      html += `
        <li class="mobile-menu-item ${hasSubcats ? 'has-children' : ''}">
          <a href="productos.html?cat=${category.slug}" class="mobile-menu-link">
            <i class="fas ${category.icon || 'fa-cube'}"></i>
            ${category.name}
            ${hasSubcats ? '<span class="mobile-menu-arrow"><i class="fas fa-chevron-down"></i></span>' : ''}
          </a>
          ${hasSubcats ? this.generateMobileSubcategoriesHTML(category) : ''}
        </li>
      `;
    });
    return html;
  }

  generateMobileSubcategoriesHTML(category) {
    let html = '<ul class="mobile-submenu">';
    category.subcategories.forEach(subcategory => {
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) return;
      html += `
        <li>
          <a href="productos.html?cat=${category.slug}&sub=${subcategory.slug}">
            ${subcategory.name}
          </a>
        </li>
      `;
    });
    html += '</ul>';
    return html;
  }

  attachMegaMenuEvents() {
    const mobileMenuItems = document.querySelectorAll('.mobile-menu-item.has-children');
    mobileMenuItems.forEach(item => {
      const link = item.querySelector('.mobile-menu-link');
      link.addEventListener('click', (e) => {
        if (item.classList.contains('has-children')) {
          e.preventDefault();
          item.classList.toggle('active');
        }
      });
    });
  }

  initSearch() {
    const searchInput = document.getElementById('global-search');
    const searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.performSearch(e.target.value, searchResults);
      }, 200);
    });
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.length > 0) searchResults.classList.add('active');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) searchResults.classList.remove('active');
    });
  }

  performSearch(query, resultsContainer) {
    if (query.length < 2) {
      resultsContainer.classList.remove('active');
      resultsContainer.innerHTML = '';
      return;
    }
    const stripDiacritics = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const normalizedQuery = stripDiacritics(query.toLowerCase()).replace(/\s+/g, '');
    const results = this.searchIndex.filter(item => {
      const normalizedName = stripDiacritics(item.name.toLowerCase()).replace(/\s+/g, '');
      const normalizedDesc = stripDiacritics((item.description || '').toLowerCase()).replace(/\s+/g, '');
      const normalizedCategory = stripDiacritics((item.categoryName || '').toLowerCase()).replace(/\s+/g, '');
      return normalizedName.includes(normalizedQuery) ||
             normalizedDesc.includes(normalizedQuery) ||
             normalizedCategory.includes(normalizedQuery);
    }).slice(0, 10);
    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>';
    } else {
      resultsContainer.innerHTML = results.map(result => `
        <a href="${result.url}" class="search-result-item">
          <span class="search-result-type search-type-${result.type}">${this.getTypeLabel(result.type)}</span>
          <div class="search-result-content">
            <span class="search-result-name">${this.highlightMatch(result.name, query)}</span>
            ${result.categoryName ? `<span class="search-result-path">${result.categoryName}${result.subcategoryName ? ' > ' + result.subcategoryName : ''}</span>` : ''}
          </div>
        </a>
      `).join('');
    }
    resultsContainer.classList.add('active');
  }

  getTypeLabel(type) {
    const labels = { category: 'Categoría', subcategory: 'Familia', model: 'Modelo' };
    return labels[type] || type;
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const categorySlug = params.get('cat');
    const subcategorySlug = params.get('sub');
    const modelSlug = params.get('model');
    if (categorySlug) await this.loadCategoryPage(categorySlug, subcategorySlug, modelSlug);
  }

  async loadCategoryPage(categorySlug, subcategorySlug = null, modelSlug = null) {
    const category = this.data.categories.find(c => c.slug === categorySlug);
    if (!category) { this.showNotFound(); return; }
    this.currentCategory = category;
    if (category.isSpecialPage) { this.renderSpecialPage(category); return; }
    if (subcategorySlug) {
      const subcategory = category.subcategories.find(s => s.slug === subcategorySlug);
      if (subcategory) {
        this.currentSubcategory = subcategory;
        if (modelSlug) await this.renderModelDetail(category, subcategory, modelSlug);
        else await this.renderSubcategoryPage(category, subcategory);
      } else {
        await this.renderCategoryPage(category);
      }
    } else {
      await this.renderCategoryPage(category);
    }
  }

  async renderCategoryPage(category) {
    const subcatsConModelos = (category.subcategories || []).filter(s =>
      s.models && s.models.length > 0 && !s.parentSubcategory
    );

    // Si la categoría se divide por entorno, "Todos" debe mostrar todos los modelos.
    if (category.hasEnvironmentFilter && subcatsConModelos.length > 0) {
      await this.renderEnvironmentCategoryPage(category, subcatsConModelos);
      return;
    }

    // Si la categoría tiene una sola subcategoría con modelos (caso Pisos LED),
    // saltear esa carpeta y mostrar directamente los productos.
    if (subcatsConModelos.length === 1) {
      this.currentSubcategory = subcatsConModelos[0];
      await this.renderSubcategoryPage(category, subcatsConModelos[0]);
      return;
    }

    const container = document.getElementById('product-content');
    if (!container) return;
    document.title = `${category.name} — RTM Pantallas LED`;
    let html = `
      <div class="category-header">
        <nav class="breadcrumb">
          <a href="index.html">Inicio</a>
          <span class="separator">/</span>
          <a href="productos.html">Productos</a>
          <span class="separator">/</span>
          <span class="current">${category.name}</span>
        </nav>
        <h1 class="category-title">
          <i class="fas ${category.icon || 'fa-cube'}"></i>
          ${category.name}
        </h1>
        <p class="category-description">${category.description}</p>
      </div>
      <div class="subcategories-grid" id="subcategories-container">
    `;

    category.subcategories.forEach(subcategory => {
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) return;
      html += `
        <a href="productos.html?cat=${category.slug}&sub=${subcategory.slug}"
           class="subcategory-card ${subcategory.environment ? 'env-' + subcategory.environment : ''}"
           data-environment="${subcategory.environment || 'all'}">
          <div class="subcategory-card-icon">
            <i class="fas fa-folder-open"></i>
          </div>
          <h3 class="subcategory-card-title">${subcategory.name}</h3>
          <p class="subcategory-card-description">${subcategory.description}</p>
          ${subcategory.environment ? `<span class="subcategory-env-badge">${subcategory.environment}</span>` : ''}
          <span class="subcategory-card-count">${subcategory.models ? subcategory.models.length : 0} modelo${subcategory.models && subcategory.models.length !== 1 ? 's' : ''}</span>
        </a>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  async renderEnvironmentCategoryPage(category, subcategories) {
    const container = document.getElementById('product-content');
    if (!container) return;

    document.title = `${category.name} — RTM Pantallas LED`;

    let html = `
      <div class="category-header">
        <nav class="breadcrumb">
          <a href="index.html">Inicio</a>
          <span class="separator">/</span>
          <a href="productos.html">Productos</a>
          <span class="separator">/</span>
          <span class="current">${category.name}</span>
        </nav>
        <h1 class="category-title">
          <i class="fas ${category.icon || 'fa-cube'}"></i>
          ${category.name}
        </h1>
        <p class="category-description">${category.description}</p>
        ${this.renderEnvironmentFilter()}
      </div>
      <div class="products-grid" id="products-container">
    `;

    subcategories.forEach(subcategory => {
      subcategory.models.forEach(model => {
        html += this.renderProductCard(model, category, subcategory);
      });
    });

    html += '</div>';
    container.innerHTML = html;

    this.attachImageLinkEvents(container);
    this.attachFilterEvents();
    this.initProductCarousels(subcategories);
  }

  async renderSubcategoryPage(category, subcategory) {
    const container = document.getElementById('product-content');
    if (!container) return;
    document.title = `${subcategory.name} - ${category.name} — RTM Pantallas LED`;
    let html = `
      <div class="category-header">
        <nav class="breadcrumb">
          <a href="index.html">Inicio</a>
          <span class="separator">/</span>
          <a href="productos.html">Productos</a>
          <span class="separator">/</span>
          <a href="productos.html?cat=${category.slug}">${category.name}</a>
          <span class="separator">/</span>
          <span class="current">${subcategory.name}</span>
        </nav>
        <h1 class="category-title">${subcategory.name}</h1>
        <p class="category-description">${subcategory.description}</p>
      </div>
      <div class="products-grid" id="products-container">
    `;
    if (subcategory.models && subcategory.models.length > 0) {
      subcategory.models.forEach(model => {
        html += this.renderProductCard(model, category, subcategory);
      });
    } else {
      html += '<p class="no-products">No hay modelos disponibles en esta categoría.</p>';
    }
    html += '</div>';
    container.innerHTML = html;
    // ── CAMBIO ──
    // Hacer las imágenes clickeables para ir al detalle del modelo.
    this.attachImageLinkEvents(container);
    this.initProductCarousels([subcategory]);
  }

  // ── NUEVO ──
  attachImageLinkEvents(container) {
    container.querySelectorAll('.product-card-image[data-link]').forEach(imgEl => {
      const goTo = () => { window.location.href = imgEl.dataset.link; };
      imgEl.addEventListener('click', (e) => {
        if (e.target.closest('.carousel-nav') || e.target.closest('.carousel-indicator')) return;
        goTo();
      });
      imgEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goTo();
        }
      });
    });
  }

  renderProductCard(model, category, subcategory) {
    // ── CAMBIO ──
    // URL al detalle del modelo + atributos para que la imagen sea clickeable.
    const modelUrl = `productos.html?cat=${category.slug}&sub=${subcategory.slug}&model=${model.slug}`;

    const modelEnvironment = model.environment || subcategory.environment || 'all';

    return `
      <div class="product-card" data-model="${model.slug}" data-environment="${modelEnvironment}">
        <div class="product-card-image"
             data-link="${modelUrl}"
             role="link"
             tabindex="0"
             aria-label="Ver detalles de ${model.name}">
          ${this.renderProductMedia(model)}
          ${this.renderProductEnvironmentBadge(model, subcategory)}
        </div>
        <div class="product-card-content">
          <h3 class="product-card-title">${model.name}</h3>
          <p class="product-card-description">${model.description}</p>
          ${model.pixelPitch ? `<span class="product-spec">Pixel Pitch: ${model.pixelPitch}</span>` : ''}
          <a href="${modelUrl}" class="product-card-link">
            Ver detalles <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }

  async renderModelDetail(category, subcategory, modelSlug) {
    const model = subcategory.models.find(m => m.slug === modelSlug);
    if (!model) { await this.renderSubcategoryPage(category, subcategory); return; }
    const container = document.getElementById('product-content');
    if (!container) return;
    document.title = `${model.name} - ${category.name} — RTM Pantallas LED`;
    let specsHTML = '';
    if (model.specs) {
      specsHTML = '<div class="model-specs"><h3>Especificaciones</h3><ul>';
      for (const [key, value] of Object.entries(model.specs)) {
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        specsHTML += `<li><strong>${label}:</strong> ${value}</li>`;
      }
      specsHTML += '</ul></div>';
    }
    const html = `
      <div class="category-header">
        <nav class="breadcrumb">
          <a href="index.html">Inicio</a>
          <span class="separator">/</span>
          <a href="productos.html">Productos</a>
          <span class="separator">/</span>
          <a href="productos.html?cat=${category.slug}">${category.name}</a>
          <span class="separator">/</span>
          <a href="productos.html?cat=${category.slug}&sub=${subcategory.slug}">${subcategory.name}</a>
          <span class="separator">/</span>
          <span class="current">${model.name}</span>
        </nav>
      </div>
      <div class="model-detail">
        <div class="model-detail-image">${this.renderProductMedia(model, { detail: true, carouselId: `${model.id}-detail` })}</div>
        <div class="model-detail-info">
          <h1 class="model-detail-title">${model.name}</h1>
          ${model.environment ? `<span class="model-env-badge env-${model.environment}">${model.environment}</span>` : ''}
          <p class="model-detail-description">${model.description}</p>
          ${model.pixelPitch ? `<p class="model-pixel-pitch"><strong>Pixel Pitch:</strong> ${model.pixelPitch}</p>` : ''}
          ${specsHTML}
          <div class="model-projects-cta">
            <p>¿Querés verlo en un proyecto real? Visitá nuestra página de proyectos.</p>
            <a href="proyectos.html" class="btn btn-projects">
              <i class="fas fa-images"></i> Ver proyectos
            </a>
          </div>
          <div class="model-actions">
            <a href="index.html#contacto" class="btn btn-primary">
              <i class="fas fa-envelope"></i> Solicitar cotización
            </a>
            <a href="https://wa.me/5491173736308?text=Hola!%20Estoy%20interesado%20en%20el%20modelo%20${encodeURIComponent(model.name)}" class="btn btn-whatsapp" target="_blank">
              <i class="fab fa-whatsapp"></i> Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
    if (this.getModelImages(model).length > 1) this.initCarousel(`${model.id}-detail`);
  }

  renderSpecialPage(category) {
    const container = document.getElementById('product-content');
    if (!container) return;
    document.title = `${category.name} — RTM Pantallas LED`;
    const content = category.content;
    const imageErrorHandler = this.getImageErrorHandler();
    let galleryHTML = '';
    if (content.gallery && content.gallery.length > 0) {
      galleryHTML = '<div class="special-gallery">';
      content.gallery.forEach(item => {
        const galleryImage = this.normalizeImagePath(item.image);
        galleryHTML += `
          <div class="gallery-item">
            ${galleryImage ? `<img src="${this.escapeAttribute(galleryImage)}" alt="${this.escapeAttribute(item.caption)}" loading="lazy" decoding="async" onerror="${this.escapeAttribute(imageErrorHandler)}">` : ''}
            <p class="gallery-caption">${item.caption}</p>
          </div>
        `;
      });
      galleryHTML += '</div>';
    }
    let featuresHTML = '';
    if (content.features && content.features.length > 0) {
      featuresHTML = '<ul class="special-features">';
      content.features.forEach(feature => {
        featuresHTML += `<li><i class="fas fa-check"></i> ${feature}</li>`;
      });
      featuresHTML += '</ul>';
    }
    const html = `
      <div class="category-header">
        <nav class="breadcrumb">
          <a href="index.html">Inicio</a>
          <span class="separator">/</span>
          <a href="productos.html">Productos</a>
          <span class="separator">/</span>
          <span class="current">${category.name}</span>
        </nav>
      </div>
      <div class="special-page">
        <div class="special-hero">
          <h1 class="special-title">${content.title}</h1>
          <p class="special-subtitle">${content.subtitle}</p>
        </div>
        <div class="special-content">
          <p class="special-description">${content.description}</p>
          ${featuresHTML}
        </div>
        ${galleryHTML}
        <div class="special-cta">
          <h3>¿Interesado en nuestros LED Trucks?</h3>
          <p>Contáctanos para más información sobre disponibilidad y cotización.</p>
          <div class="special-actions">
            <a href="index.html#contacto" class="btn btn-primary">
              <i class="fas fa-envelope"></i> Contactar
            </a>
            <a href="proyectos.html" class="btn btn-projects">
              <i class="fas fa-images"></i> Ver proyectos
            </a>
            <a href="https://wa.me/5491173736308?text=Hola!%20Me%20interesa%20información%20sobre%20LED%20Trucks" class="btn btn-whatsapp" target="_blank">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = html;
  }

  renderEnvironmentFilter() {
    return `
      <div class="environment-filter">
        <button class="filter-btn active" data-filter="all">Todos</button>
        <button class="filter-btn" data-filter="indoor"><i class="fas fa-home"></i> Indoor</button>
        <button class="filter-btn" data-filter="outdoor"><i class="fas fa-sun"></i> Outdoor</button>
      </div>
    `;
  }

  attachFilterEvents() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('[data-environment]');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        this.currentFilter = filter;
        items.forEach(item => {
          const itemEnv = item.dataset.environment;
          if (filter === 'all' || itemEnv === filter || itemEnv === 'all') item.style.display = '';
          else item.style.display = 'none';
        });
      });
    });
  }

  showNotFound() {
    const container = document.getElementById('product-content');
    if (!container) return;
    container.innerHTML = `
      <div class="not-found">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Categoría no encontrada</h2>
        <p>La categoría que buscas no existe o ha sido movida.</p>
        <a href="productos.html" class="btn btn-primary">Ver todos los productos</a>
      </div>
    `;
  }

  initCarousel(carouselId) {
    const carousel = document.querySelector(`[data-carousel-id="${carouselId}"]`);
    if (!carousel) return;
    const slides = carousel.querySelectorAll('.carousel-slide');
    const indicators = carousel.querySelectorAll('.carousel-indicator');
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    let currentSlide = 0;
    const totalSlides = slides.length;
    const loadSlideImage = index => {
      const img = slides[index]?.querySelector('img[data-src]');
      if (!img) return;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    };
    const showSlide = (index) => {
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;
      currentSlide = index;
      loadSlideImage(currentSlide);
      slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
      indicators.forEach((indicator, i) => indicator.classList.toggle('active', i === currentSlide));
    };
    loadSlideImage(currentSlide);
    if (prevBtn) prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
    indicators.forEach((indicator, index) => indicator.addEventListener('click', () => showSlide(index)));
    let touchStartX = 0;
    let touchEndX = 0;
    carousel.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
    carousel.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); });
    const handleSwipe = () => {
      if (touchEndX < touchStartX - 50) showSlide(currentSlide + 1);
      if (touchEndX > touchStartX + 50) showSlide(currentSlide - 1);
    };
  }

  getCategories() { return this.data ? this.data.categories : []; }

  search(query) {
    return this.searchIndex.filter(item => {
      const normalizedQuery = query.toLowerCase();
      return item.name.toLowerCase().includes(normalizedQuery) ||
             (item.description || '').toLowerCase().includes(normalizedQuery);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.rtmProducts = new RTMProducts();
});
