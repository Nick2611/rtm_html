/**
 * RTM Pantallas LED - Main JavaScript
 * Optimizado para AWS Amplify
 */

// ===== NAVEGACIÓN SUAVE =====
document.addEventListener('DOMContentLoaded', function() {
    // Navegación suave
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Cerrar menú móvil al hacer clic en un enlace
    document.querySelectorAll('.drawer a').forEach(link => {
        link.addEventListener('click', () => {
            const navToggle = document.getElementById('nav-toggle');
            if (navToggle) {
                navToggle.checked = false;
            }
        });
    });
});

// ===== CARRUSEL DE LOGOS DE CLIENTES =====
function loadClientLogos() {
    const carouselTrack = document.getElementById('carousel-track');
    if (!carouselTrack) return;

    // Lista de imágenes optimizadas
    const logoImages = [
        { src: 'assets/images/optimized/BCRA_logo.svg_optimized.jpg', alt: 'Banco Central de la República Argentina' },
        { src: 'assets/images/optimized/Mincienciaarg_optimized.jpg', alt: 'Ministerio de Ciencia, Tecnología e Innovación' },
        { src: 'assets/images/optimized/Logo-Shell_optimized.jpg', alt: 'Shell' },
        { src: 'assets/images/optimized/logo_ee_v2-01_optimized.jpg', alt: 'Municipio de Esteban Echeverría' },
        { src: 'assets/images/optimized/TyCSp_optimized.jpg', alt: 'TyC Sports' },
        { src: 'assets/images/optimized/2560px-Aerop_arg_2000_logo.svg_optimized.jpg', alt: 'Aeropuertos Argentina 2000' },
        { src: 'assets/images/optimized/Logotipo_de_la_Ciudad_de_Buenos_Aires.svg_optimized.jpg', alt: 'Ciudad de Buenos Aires' },
        { src: 'assets/images/optimized/speed-lider-png-blanco-e1707416060742_optimized.jpg', alt: 'Speed Lider' },
        { src: 'assets/images/optimized/Olympic_rings_without_rims.svg_optimized.jpg', alt: 'Comité Olímpico' }
    ];

    // Crear elementos de logo
    logoImages.forEach(logo => {
        const logoElement = document.createElement('div');
        logoElement.className = 'carousel-item';
        logoElement.innerHTML = `
            <img src="${logo.src}" alt="${logo.alt}" loading="lazy">
        `;
        carouselTrack.appendChild(logoElement);
    });

    // Duplicar logos para carrusel infinito
    const items = carouselTrack.querySelectorAll('.carousel-item');
    items.forEach(item => {
        const clone = item.cloneNode(true);
        carouselTrack.appendChild(clone);
    });

    // Iniciar animación del carrusel
    startCarousel();
}

// ===== ANIMACIÓN DEL CARRUSEL =====
function startCarousel() {
    const carouselTrack = document.getElementById('carousel-track');
    if (!carouselTrack) return;

    let currentPosition = 0;
    const itemWidth = 200; // Ancho de cada item
    const speed = 1; // Velocidad de desplazamiento

    function animate() {
        currentPosition -= speed;
        carouselTrack.style.transform = `translateX(${currentPosition}px)`;
        
        // Reset cuando se completa un ciclo
        if (Math.abs(currentPosition) >= itemWidth * (carouselTrack.children.length / 2)) {
            currentPosition = 0;
        }
        
        requestAnimationFrame(animate);
    }

    animate();
}

// ===== CONTROL DE VIDEOS =====
function initProductVideos() {
    const videoItems = document.querySelectorAll('.proyectos-video-item');
    
    videoItems.forEach(item => {
        const video = item.querySelector('video');
        const overlay = item.querySelector('.play-overlay');
        
        if (!video || !overlay) return;

        // Asegurar que el video esté pausado al inicio
        video.pause();
        video.currentTime = 0;

        // Event listener para el clic en el overlay
        item.addEventListener('click', function() {
            if (video.paused) {
                video.play();
                overlay.style.display = 'none';
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            } else {
                video.pause();
                overlay.style.display = 'flex';
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
            }
        });

        // Event listener para cuando el video se reproduce
        video.addEventListener('play', function() {
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
        });

        // Event listener para cuando el video se pausa
        video.addEventListener('pause', function() {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
        });

        // Prevenir autoplay
        video.addEventListener('loadstart', function() {
            video.pause();
        });

        video.addEventListener('canplay', function() {
            video.pause();
        });

        video.addEventListener('loadeddata', function() {
            video.pause();
        });
    });
}

// ===== LAZY LOADING =====
function initLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }
}

// ===== FORMULARIO DE CONTACTO =====
function initContactForm() {
    const form = document.querySelector('.contact-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obtener datos del formulario
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Validación básica
        if (!data.nombre || !data.email || !data.mensaje) {
            alert('Por favor, completa todos los campos obligatorios.');
            return;
        }
        
        // Simular envío (aquí se integraría con el backend)
        console.log('Datos del formulario:', data);
        alert('¡Mensaje enviado! Te contactaremos pronto.');
        form.reset();
    });
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    // Cargar logos de clientes
    loadClientLogos();
    
    // Inicializar videos
    initProductVideos();
    
    // Inicializar lazy loading
    initLazyLoading();
    
    // Inicializar formulario
    initContactForm();
});

// ===== OPTIMIZACIONES DE PERFORMANCE =====

// Debounce para eventos de scroll
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle para eventos de resize
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Event listeners optimizados
window.addEventListener('scroll', debounce(function() {
    // Lógica de scroll optimizada
}, 100));

window.addEventListener('resize', throttle(function() {
    // Lógica de resize optimizada
}, 250));
