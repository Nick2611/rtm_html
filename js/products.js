/**
 * RTM Pantallas LED - Sistema de Productos
 * Maneja la carga dinámica de productos, navegación y búsqueda
 */

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
      this.handleRouting();
    } catch (error) {
      console.error('Error initializing RTM Products:', error);
    }
  }

  // Normalizar rutas de imágenes para que sean absolutas desde la raíz del sitio
  normalizeImagePath(imagePath) {
    if (!imagePath) return '';
    // Si la ruta ya empieza con /, devolverla tal cual (pero limpiar dobles barras)
    if (imagePath.startsWith('/')) {
      return imagePath.replace(/\/+/g, '/');
    }
    // Si la ruta empieza con http:// o https://, devolverla tal cual
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Si la ruta es un data URI, devolverla tal cual
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Normalizar: limpiar rutas relativas y agregar / al inicio
    const cleanedPath = imagePath.replace(/^\.\//, '').replace(/\/+/g, '/');
    return '/' + cleanedPath;
  }

  async loadData() {
    const response = await fetch('data/products.json');
    if (!response.ok) {
      // Try relative path for subpages
      const altResponse = await fetch('../data/products.json');
      if (!altResponse.ok) throw new Error('Could not load products data');
      this.data = await altResponse.json();
    } else {
      this.data = await response.json();
    }
  }

  buildSearchIndex() {
    this.searchIndex = [];
    
    this.data.categories.forEach(category => {
      // Add category to index
      this.searchIndex.push({
        type: 'category',
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        url: `productos.html?cat=${category.slug}`
      });

      // Add subcategories and models
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

          // Add models
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

    if (megaMenuContainer) {
      megaMenuContainer.innerHTML = menuHTML;
    }
    
    if (mobileMenuContainer) {
      mobileMenuContainer.innerHTML = mobileMenuHTML;
    }

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
      if (category.isSpecialPage) {
        return '<span class="mega-menu-special-tag">Página especial</span>';
      }
      return '';
    }

    let html = '<ul class="mega-menu-subcategories">';
    
    category.subcategories.forEach(subcategory => {
      // Skip subcategories that are just containers (like "Cabezales Móviles")
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) {
        return;
      }
      
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
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) {
        return;
      }
      
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
    // Mobile menu toggle
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
      if (searchInput.value.length > 0) {
        searchResults.classList.add('active');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        searchResults.classList.remove('active');
      }
    });
  }

  performSearch(query, resultsContainer) {
    if (query.length < 2) {
      resultsContainer.classList.remove('active');
      resultsContainer.innerHTML = '';
      return;
    }

    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const results = this.searchIndex.filter(item => {
      const normalizedName = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedDesc = (item.description || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedCategory = (item.categoryName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
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
    const labels = {
      category: 'Categoría',
      subcategory: 'Familia',
      model: 'Modelo'
    };
    return labels[type] || type;
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const categorySlug = params.get('cat');
    const subcategorySlug = params.get('sub');
    const modelSlug = params.get('model');

    if (categorySlug) {
      this.loadCategoryPage(categorySlug, subcategorySlug, modelSlug);
    }
  }

  loadCategoryPage(categorySlug, subcategorySlug = null, modelSlug = null) {
    const category = this.data.categories.find(c => c.slug === categorySlug);
    if (!category) {
      this.showNotFound();
      return;
    }

    this.currentCategory = category;

    // Check if it's a special page (like LED Trucks)
    if (category.isSpecialPage) {
      this.renderSpecialPage(category);
      return;
    }

    if (subcategorySlug) {
      const subcategory = category.subcategories.find(s => s.slug === subcategorySlug);
      if (subcategory) {
        this.currentSubcategory = subcategory;
        if (modelSlug) {
          this.renderModelDetail(category, subcategory, modelSlug);
        } else {
          this.renderSubcategoryPage(category, subcategory);
        }
      } else {
        this.renderCategoryPage(category);
      }
    } else {
      this.renderCategoryPage(category);
    }
  }

  renderCategoryPage(category) {
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
        ${category.hasEnvironmentFilter ? this.renderEnvironmentFilter() : ''}
      </div>
      <div class="subcategories-grid" id="subcategories-container">
    `;

    category.subcategories.forEach(subcategory => {
      // Skip empty container subcategories
      if (subcategory.models && subcategory.models.length === 0 && !subcategory.parentSubcategory) {
        return;
      }

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

    if (category.hasEnvironmentFilter) {
      this.attachFilterEvents();
    }
  }

  renderSubcategoryPage(category, subcategory) {
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
    
    // Inicializar carruseles para productos con múltiples imágenes
    if (subcategory.models && subcategory.models.length > 0) {
      subcategory.models.forEach(model => {
        if (model.images && model.images.length > 1) {
          this.initCarousel(model.id);
        }
      });
    }
  }

  renderProductCard(model, category, subcategory) {
    const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect fill="%23141416" width="300" height="200"/%3E%3Ctext fill="%23e84a45" font-family="Montserrat,sans-serif" font-size="14" text-anchor="middle" x="150" y="100"%3E' + encodeURIComponent(model.name) + '%3C/text%3E%3C/svg%3E';
    
    // Verificar si hay múltiples imágenes
    const hasMultipleImages = model.images && model.images.length > 1;
    const images = model.images || (model.image ? [model.image] : []);
    
    // Normalizar todas las rutas de imágenes
    const normalizedImages = images.map(img => this.normalizeImagePath(img));
    
    // Generar HTML del carrusel o imagen única
    let imageHTML = '';
    if (hasMultipleImages) {
      // Carrusel con múltiples imágenes
      imageHTML = `
        <div class="product-carousel" data-carousel-id="${model.id}">
          <div class="carousel-container">
            ${normalizedImages.map((img, index) => `
              <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
                <img src="${img}" 
                     alt="${model.name} - Imagen ${index + 1}" 
                     loading="lazy"
                     onerror="this.src='${placeholderImage}'">
              </div>
            `).join('')}
          </div>
          <div class="carousel-indicators">
            ${normalizedImages.map((_, index) => `
              <button class="carousel-indicator ${index === 0 ? 'active' : ''}" 
                      data-slide-to="${index}" 
                      aria-label="Ir a imagen ${index + 1}"></button>
            `).join('')}
          </div>
          <button class="carousel-nav carousel-prev" aria-label="Imagen anterior">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="carousel-nav carousel-next" aria-label="Imagen siguiente">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      `;
    } else {
      // Imagen única
      imageHTML = `
        <img src="${this.normalizeImagePath(normalizedImages[0] || placeholderImage)}" 
             alt="${model.name}" 
             loading="lazy"
             onerror="this.src='${placeholderImage}'">
      `;
    }
    
    return `
      <div class="product-card" data-model="${model.slug}">
        <div class="product-card-image">
          ${imageHTML}
          ${model.environment ? `<span class="product-env-badge env-${model.environment}">${model.environment}</span>` : ''}
        </div>
        <div class="product-card-content">
          <h3 class="product-card-title">${model.name}</h3>
          <p class="product-card-description">${model.description}</p>
          ${model.pixelPitch ? `<span class="product-spec">Pixel Pitch: ${model.pixelPitch}</span>` : ''}
          <a href="productos.html?cat=${category.slug}&sub=${subcategory.slug}&model=${model.slug}" 
             class="product-card-link">
            Ver detalles <i class="fas fa-arrow-right"></i>
          </a>
        </div>
      </div>
    `;
  }

  renderModelDetail(category, subcategory, modelSlug) {
    const model = subcategory.models.find(m => m.slug === modelSlug);
    if (!model) {
      this.renderSubcategoryPage(category, subcategory);
      return;
    }

    const container = document.getElementById('product-content');
    if (!container) return;

    document.title = `${model.name} - ${category.name} — RTM Pantallas LED`;

    const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"%3E%3Crect fill="%23141416" width="600" height="400"/%3E%3Ctext fill="%23e84a45" font-family="Montserrat,sans-serif" font-size="24" text-anchor="middle" x="300" y="200"%3E' + encodeURIComponent(model.name) + '%3C/text%3E%3C/svg%3E';

    // Verificar si hay múltiples imágenes
    const hasMultipleImages = model.images && model.images.length > 1;
    const images = model.images || (model.image ? [model.image] : []);

    // Normalizar todas las rutas de imágenes
    const normalizedImages = images.map(img => this.normalizeImagePath(img));

    // Generar HTML del carrusel o imagen única
    let imageHTML = '';
    if (hasMultipleImages) {
      // Carrusel con múltiples imágenes
      imageHTML = `
        <div class="model-carousel" data-carousel-id="${model.id}-detail">
          <div class="carousel-container">
            ${normalizedImages.map((img, index) => `
              <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
                <img src="${img}" 
                     alt="${model.name} - Imagen ${index + 1}"
                     onerror="this.src='${placeholderImage}'">
              </div>
            `).join('')}
          </div>
          <div class="carousel-indicators">
            ${normalizedImages.map((_, index) => `
              <button class="carousel-indicator ${index === 0 ? 'active' : ''}" 
                      data-slide-to="${index}" 
                      aria-label="Ir a imagen ${index + 1}"></button>
            `).join('')}
          </div>
          <button class="carousel-nav carousel-prev" aria-label="Imagen anterior">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="carousel-nav carousel-next" aria-label="Imagen siguiente">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      `;
    } else {
      // Imagen única
      imageHTML = `
        <img src="${this.normalizeImagePath(normalizedImages[0] || placeholderImage)}" 
             alt="${model.name}"
             onerror="this.src='${placeholderImage}'">
      `;
    }

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
        <div class="model-detail-image">
          ${imageHTML}
        </div>
        <div class="model-detail-info">
          <h1 class="model-detail-title">${model.name}</h1>
          ${model.environment ? `<span class="model-env-badge env-${model.environment}">${model.environment}</span>` : ''}
          <p class="model-detail-description">${model.description}</p>
          ${model.pixelPitch ? `<p class="model-pixel-pitch"><strong>Pixel Pitch:</strong> ${model.pixelPitch}</p>` : ''}
          ${specsHTML}
          <div class="model-actions">
            <a href="index.html#contacto" class="btn btn-primary">
              <i class="fas fa-envelope"></i> Solicitar cotización
            </a>
            <a href="https://wa.me/5491173736308?text=Hola!%20Estoy%20interesado%20en%20el%20modelo%20${encodeURIComponent(model.name)}" 
               class="btn btn-whatsapp" target="_blank">
              <i class="fab fa-whatsapp"></i> Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    
    // Inicializar carrusel si hay múltiples imágenes
    if (hasMultipleImages) {
      this.initCarousel(`${model.id}-detail`);
    }
  }

  renderSpecialPage(category) {
    const container = document.getElementById('product-content');
    if (!container) return;

    document.title = `${category.name} — RTM Pantallas LED`;

    const content = category.content;
    const placeholderImage = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"%3E%3Crect fill="%23141416" width="600" height="400"/%3E%3Ctext fill="%23e84a45" font-family="Montserrat,sans-serif" font-size="24" text-anchor="middle" x="300" y="200"%3ELED Trucks%3C/text%3E%3C/svg%3E';

    let galleryHTML = '';
    if (content.gallery && content.gallery.length > 0) {
      galleryHTML = '<div class="special-gallery">';
      content.gallery.forEach(item => {
        galleryHTML += `
          <div class="gallery-item">
            <img src="${item.image || placeholderImage}" 
                 alt="${item.caption}"
                 onerror="this.src='${placeholderImage}'">
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
            <a href="https://wa.me/5491173736308?text=Hola!%20Me%20interesa%20información%20sobre%20LED%20Trucks" 
               class="btn btn-whatsapp" target="_blank">
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
        <button class="filter-btn" data-filter="indoor">
          <i class="fas fa-home"></i> Indoor
        </button>
        <button class="filter-btn" data-filter="outdoor">
          <i class="fas fa-sun"></i> Outdoor
        </button>
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
          if (filter === 'all' || itemEnv === filter || itemEnv === 'all') {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
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

    const showSlide = (index) => {
      // Asegurar que el índice esté en rango
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;
      
      currentSlide = index;
      
      // Actualizar slides
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === currentSlide);
      });
      
      // Actualizar indicadores
      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === currentSlide);
      });
    };

    // Event listeners
    if (prevBtn) {
      prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));
    }
    
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => showSlide(index));
    });

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;
    
    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });
    
    carousel.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });
    
    const handleSwipe = () => {
      if (touchEndX < touchStartX - 50) {
        showSlide(currentSlide + 1); // Swipe left - next
      }
      if (touchEndX > touchStartX + 50) {
        showSlide(currentSlide - 1); // Swipe right - prev
      }
    };
  }

  // Public method to get all categories for external use
  getCategories() {
    return this.data ? this.data.categories : [];
  }

  // Public method to search
  search(query) {
    return this.searchIndex.filter(item => {
      const normalizedQuery = query.toLowerCase();
      return item.name.toLowerCase().includes(normalizedQuery) ||
             (item.description || '').toLowerCase().includes(normalizedQuery);
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.rtmProducts = new RTMProducts();
});


