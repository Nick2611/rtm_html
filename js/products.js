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
    this.defaultProductImageBaseUrl = 'https://imagenes-productos-rtm-158129172701-us-east-1-an.s3.us-east-1.amazonaws.com';
    this.productImageExtensions = ['jpeg', 'jpg', 'png', 'webp'];
    this.productImageMaxImages = 12;
    this.productImageProbeCache = new Map();
    this.productImageDirectoryCache = new Map();
    this.productImageBaseUrl = this.resolveProductImageBaseUrl();
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

  resolveProductImageBaseUrl() {
    const metaBaseUrl = document
      .querySelector('meta[name="rtm-product-image-base-url"]')
      ?.getAttribute('content');
    const configuredBaseUrl = window.RTM_PRODUCT_IMAGE_BASE_URL || metaBaseUrl || this.defaultProductImageBaseUrl;
    return configuredBaseUrl.trim().replace(/\/+$/, '');
  }

  isRemoteImagePath(imagePath) {
    return /^(https?:)?\/\//.test(imagePath);
  }

  normalizeBucketPath(imagePath) {
    if (!imagePath || this.isRemoteImagePath(imagePath) || imagePath.startsWith('data:')) return '';
    return imagePath
      .trim()
      .replace(/^\.\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .split('/')
      .map(part => part.trim())
      .filter(Boolean)
      .join('/');
  }

  normalizeImagePath(imagePath) {
    if (!imagePath) return '';
    if (this.isRemoteImagePath(imagePath)) return imagePath;
    if (imagePath.startsWith('data:')) return '';

    const cleanedPath = this.normalizeBucketPath(imagePath);
    return cleanedPath ? this.toBucketImageUrl(cleanedPath) : '';
  }

  escapeAttribute(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  toBucketImageUrl(imagePath) {
    if (!imagePath) return '';
    if (this.isRemoteImagePath(imagePath)) return imagePath;
    const cleanedPath = this.normalizeBucketPath(imagePath);
    return cleanedPath ? `${this.productImageBaseUrl}/${cleanedPath}` : '';
  }

  slugifyPathSegment(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  compactPathSegment(value) {
    return this.slugifyPathSegment(value).replace(/_/g, '');
  }

  compactCasePathSegment(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '');
  }

  isProductBucketPath(imagePath) {
    return this.normalizeBucketPath(imagePath).startsWith('imagenes_productos/');
  }

  getDeclaredProductImagePaths(model) {
    const declaredImages = [
      ...(Array.isArray(model.images) ? model.images : []),
      model.image
    ];

    return [...new Set(declaredImages
      .map(imagePath => this.normalizeBucketPath(imagePath))
      .filter(imagePath => imagePath.startsWith('imagenes_productos/')))];
  }

  getCanonicalProductImageDirectory(category, subcategory) {
    const categorySegment = this.slugifyPathSegment(category.imageFolder || category.slug || category.id || category.name);
    const rawSubcategorySegment = subcategory?.imageFolder || subcategory?.environment || subcategory?.name || subcategory?.slug || '';
    const subcategorySegment = this.slugifyPathSegment(rawSubcategorySegment);
    const segments = ['imagenes_productos', categorySegment];

    if (subcategorySegment && subcategorySegment !== 'modelos') segments.push(subcategorySegment);
    return segments.filter(Boolean).join('/');
  }

  getDeclaredProductImageDirectories(model) {
    return this.getDeclaredProductImagePaths(model)
      .map(imagePath => imagePath.split('/').slice(0, -1).join('/'))
      .filter(Boolean);
  }

  getProductImageDirectories(category, subcategory, model) {
    return [...new Set([
      this.getCanonicalProductImageDirectory(category, subcategory),
      ...this.getDeclaredProductImageDirectories(model)
    ].filter(Boolean))];
  }

  parseImageFilename(imagePath) {
    const filename = this.normalizeBucketPath(imagePath).split('/').pop() || '';
    const match = filename.match(/^(.+?)(\.[a-z0-9]+)$/i);
    if (!match) return null;

    const name = match[1].trim();
    const extension = match[2].slice(1).toLowerCase();
    const numberedMatch = name.match(/^(.*?)([-_]?)(\d+)$/);
    const numberedIndex = numberedMatch ? Number(numberedMatch[3]) : null;
    const hasImageIndex = Boolean(numberedMatch && (numberedMatch[2] || numberedIndex <= this.productImageMaxImages));
    return {
      prefix: (hasImageIndex ? numberedMatch[1] : name).trim(),
      separator: hasImageIndex ? numberedMatch[2] : '-',
      extension,
      index: hasImageIndex ? numberedIndex : null
    };
  }

  getDeclaredProductImageDetails(model) {
    return this.getDeclaredProductImagePaths(model)
      .map(imagePath => ({
        path: imagePath,
        directory: imagePath.split('/').slice(0, -1).join('/'),
        url: this.toBucketImageUrl(imagePath),
        parts: this.parseImageFilename(imagePath)
      }))
      .filter(item => item.directory && item.url && item.parts);
  }

  getProductImageProbePlans(model) {
    const plans = [];
    const seenPlans = new Set();
    const addPlan = (prefix, extension = 'jpeg', separator = '-', fromDeclared = false) => {
      const cleanPrefix = String(prefix || '').trim();
      const cleanExtension = String(extension || 'jpeg').replace(/^\./, '').toLowerCase();
      if (!cleanPrefix || !cleanExtension) return;
      const key = `${cleanPrefix}|${separator}|${cleanExtension}`;
      if (seenPlans.has(key)) return;
      seenPlans.add(key);
      plans.push({ prefix: cleanPrefix, separator, extension: cleanExtension, fromDeclared });
    };

    this.getDeclaredProductImagePaths(model)
      .map(imagePath => this.parseImageFilename(imagePath))
      .filter(Boolean)
      .forEach(parts => addPlan(parts.prefix, parts.extension, parts.separator, true));

    const compactCandidates = [
      model.imagePrefix,
      model.slug,
      model.id,
      model.name
    ].map(value => this.compactPathSegment(value)).filter(Boolean);

    const caseSensitiveCandidates = [
      model.imagePrefix,
      model.name,
      model.id,
      model.slug
    ].map(value => this.compactCasePathSegment(value)).filter(Boolean);

    const candidatePrefixes = [...new Set([...compactCandidates, ...caseSensitiveCandidates])];

    candidatePrefixes.forEach(prefix => {
      addPlan(prefix, 'jpeg');
      if (prefix.endsWith('led')) addPlan(prefix.replace(/led$/, ''), 'jpeg');
    });

    const productSegment = this.slugifyPathSegment(model.slug || model.id || model.name);
    addPlan(productSegment, 'jpeg');

    candidatePrefixes.slice(0, 2).forEach(prefix => {
      this.productImageExtensions.forEach(extension => addPlan(prefix, extension));
    });

    return plans;
  }

  getImagesMatchingProbePlans(imageUrls, probePlans) {
    const planKeys = new Set(probePlans.map(plan =>
      `${plan.prefix.toLowerCase()}|${plan.extension.toLowerCase()}`
    ));

    return this.sortImageUrls(imageUrls.filter(imageUrl => {
      const parsed = this.parseImageFilename(imageUrl);
      if (!parsed) return false;
      return planKeys.has(`${parsed.prefix.toLowerCase()}|${parsed.extension.toLowerCase()}`);
    }));
  }

  sortImageUrls(imageUrls) {
    const getImageOrder = imageUrl => {
      const filename = decodeURIComponent(String(imageUrl).split('/').pop() || '').split('?')[0];
      const parsed = this.parseImageFilename(filename);
      return parsed?.index || 1;
    };

    return [...new Set(imageUrls.filter(Boolean))]
      .sort((a, b) =>
        getImageOrder(a) - getImageOrder(b) ||
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
  }

  async listBucketImages(directory) {
    if (!directory || !this.productImageBaseUrl) return [];
    if (this.productImageDirectoryCache.has(directory)) return this.productImageDirectoryCache.get(directory);

    const listUrl = `${this.productImageBaseUrl}/?list-type=2&prefix=${encodeURIComponent(directory + '/')}`;
    const request = fetch(listUrl)
      .then(response => response.ok ? response.text() : '')
      .then(text => {
        if (!text) return [];
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        const directoryPrefix = `${directory}/`;
        const keys = Array.from(doc.querySelectorAll('Key'))
          .map(key => key.textContent.trim())
          .filter(key => key.startsWith(directoryPrefix))
          .filter(key => !key.slice(directoryPrefix.length).includes('/'))
          .filter(key => /\.(jpe?g|png|webp)$/i.test(key));
        return this.sortImageUrls(keys.map(key => this.toBucketImageUrl(key)));
      })
      .catch(() => []);

    this.productImageDirectoryCache.set(directory, request);
    return request;
  }

  imageExists(imageUrl) {
    if (!imageUrl) return Promise.resolve(false);
    if (this.productImageProbeCache.has(imageUrl)) return this.productImageProbeCache.get(imageUrl);

    const request = new Promise(resolve => {
      const image = new Image();
      const timeout = window.setTimeout(() => resolve(false), 4000);
      const finish = exists => {
        window.clearTimeout(timeout);
        resolve(exists);
      };
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = imageUrl;
    });

    this.productImageProbeCache.set(imageUrl, request);
    return request;
  }

  async probeSequentialProductImages(directory, plan, startIndex = 1) {
    const foundImages = [];
    let firstNumberedIndex = startIndex;
    let foundAnyForPlan = false;

    if (startIndex <= 1) {
      const baseImageUrl = this.toBucketImageUrl(`${directory}/${plan.prefix}.${plan.extension}`);
      if (await this.imageExists(baseImageUrl)) {
        foundImages.push(baseImageUrl);
        firstNumberedIndex = 2;
        foundAnyForPlan = true;
      }
    }

    for (let index = firstNumberedIndex; index <= this.productImageMaxImages; index++) {
      const filename = `${plan.prefix}${plan.separator}${index}.${plan.extension}`;
      const imageUrl = this.toBucketImageUrl(`${directory}/${filename}`);
      const exists = await this.imageExists(imageUrl);
      if (!exists) {
        if (foundAnyForPlan || index >= 2) break;
        continue;
      }
      foundImages.push(imageUrl);
      foundAnyForPlan = true;
    }

    return foundImages;
  }

  async discoverProductImages(category, subcategory, model) {
    const cacheKey = `${category.slug || category.id}|${subcategory?.slug || subcategory?.id || ''}|${model.slug || model.id}`;
    if (model._bucketImagesCacheKey === cacheKey && Array.isArray(model._bucketImages)) return model._bucketImages;

    const directories = this.getProductImageDirectories(category, subcategory, model);
    const probePlans = this.getProductImageProbePlans(model);
    const declaredDetails = this.getDeclaredProductImageDetails(model);

    for (const directory of directories) {
      const listedImages = await this.listBucketImages(directory);
      const matchingImages = this.getImagesMatchingProbePlans(listedImages, probePlans);
      if (matchingImages.length > 0) {
        model._bucketImagesCacheKey = cacheKey;
        model._bucketImages = matchingImages;
        return matchingImages;
      }
    }

    for (const directory of directories) {
      const declaredInDirectory = declaredDetails.filter(item => item.directory === directory);
      const discoveredMatches = (await Promise.all(declaredInDirectory.map(async item =>
        await this.imageExists(item.url) ? item.url : ''
      ))).filter(Boolean);

      const declaredGroups = new Map();
      declaredInDirectory.forEach(item => {
        const groupKey = `${item.parts.prefix}|${item.parts.separator}|${item.parts.extension}`;
        const group = declaredGroups.get(groupKey) || {
          prefix: item.parts.prefix,
          separator: item.parts.separator,
          extension: item.parts.extension,
          maxIndex: 0,
          hasBaseImage: false
        };
        if (item.parts.index === null) group.hasBaseImage = true;
        if (item.parts.index) group.maxIndex = Math.max(group.maxIndex, item.parts.index);
        declaredGroups.set(groupKey, group);
      });

      for (const plan of declaredGroups.values()) {
        const startIndex = plan.hasBaseImage ? 1 : plan.maxIndex + 1;
        if (!plan.hasBaseImage && (plan.maxIndex < 1 || plan.maxIndex >= this.productImageMaxImages)) continue;
        discoveredMatches.push(...await this.probeSequentialProductImages(directory, plan, startIndex));
      }

      for (const plan of probePlans.filter(item => !item.fromDeclared)) {
        discoveredMatches.push(...await this.probeSequentialProductImages(directory, plan));
      }

      if (discoveredMatches.length > 0) {
        const images = this.sortImageUrls(discoveredMatches);
        model._bucketImagesCacheKey = cacheKey;
        model._bucketImages = images;
        return images;
      }
    }

    model._bucketImagesCacheKey = cacheKey;
    model._bucketImages = [];
    return [];
  }

  async hydrateModelImages(category, subcategory, model) {
    const images = await this.discoverProductImages(category, subcategory, model);
    model.bucketImages = images;
    return images;
  }

  async hydrateModelsImages(category, subcategories) {
    const models = subcategories.flatMap(subcategory =>
      (subcategory.models || []).map(model => ({ subcategory, model }))
    );
    await Promise.all(models.map(({ subcategory, model }) => this.hydrateModelImages(category, subcategory, model)));
  }

  getModelImages(model) {
    return Array.isArray(model.bucketImages) ? model.bucketImages : [];
  }

  getImageErrorHandler() {
    return 'this.onerror=null;this.style.display="none";this.classList.add("image-load-error");';
  }

  findProductCard(container, modelSlug) {
    return Array.from(container.querySelectorAll('.product-card'))
      .find(card => card.dataset.model === modelSlug);
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
    const imageErrorHandler = this.getImageErrorHandler();

    if (images.length > 1) {
      return `
        <div class="${carouselClass}" data-carousel-id="${carouselId}">
          <div class="product-carousel-container">
            ${images.map((img, index) => `
              <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
                <img src="${this.escapeAttribute(img)}" alt="${this.escapeAttribute(model.name)} - Imagen ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" onerror="${this.escapeAttribute(imageErrorHandler)}">
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
        ${images[0] ? `<img src="${this.escapeAttribute(images[0])}" alt="${this.escapeAttribute(model.name)}" loading="eager" decoding="async" onerror="${this.escapeAttribute(imageErrorHandler)}">` : ''}
      </div>
    `;
  }

  hydrateRenderedModelImages(category, subcategories, container) {
    subcategories.forEach(subcategory => {
      (subcategory.models || []).forEach(model => {
        this.hydrateModelImages(category, subcategory, model)
          .then(images => {
            if (!images.length) return;
            const card = this.findProductCard(container, model.slug);
            const imageContainer = card?.querySelector('.product-card-image');
            if (!imageContainer) return;
            imageContainer.innerHTML = this.renderProductMedia(model) + this.renderProductEnvironmentBadge(model, subcategory);
            if (images.length > 1) this.initCarousel(model.id);
          })
          .catch(error => console.warn(`No se pudieron cargar imágenes para ${model.name}:`, error));
      });
    });
  }

  hydrateRenderedModelDetailImage(category, subcategory, model, container) {
    this.hydrateModelImages(category, subcategory, model)
      .then(images => {
        if (!images.length) return;
        const imageContainer = container.querySelector('.model-detail-image');
        if (!imageContainer) return;
        const carouselId = `${model.id}-detail`;
        imageContainer.innerHTML = this.renderProductMedia(model, { detail: true, carouselId });
        if (images.length > 1) this.initCarousel(carouselId);
      })
      .catch(error => console.warn(`No se pudieron cargar imágenes para ${model.name}:`, error));
  }

  async loadData() {
    const response = await fetch('data/products.json');
    if (!response.ok) {
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
      if (category.isSpecialPage) return '<span class="mega-menu-special-tag">Página especial</span>';
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
    this.hydrateRenderedModelImages(category, subcategories, container);
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
    this.hydrateRenderedModelImages(category, [subcategory], container);
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
    this.hydrateRenderedModelDetailImage(category, subcategory, model, container);
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
            ${galleryImage ? `<img src="${this.escapeAttribute(galleryImage)}" alt="${this.escapeAttribute(item.caption)}" onerror="${this.escapeAttribute(imageErrorHandler)}">` : ''}
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
    const showSlide = (index) => {
      if (index < 0) index = totalSlides - 1;
      if (index >= totalSlides) index = 0;
      currentSlide = index;
      slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
      indicators.forEach((indicator, i) => indicator.classList.toggle('active', i === currentSlide));
    };
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
