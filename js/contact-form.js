/**
 * RTM Pantallas LED - formularios de contacto
 * Validación de experiencia de usuario. La Lambda vuelve a validar todos los datos.
 */
(function initContactFormModule(globalScope) {
  'use strict';

  const API_ENDPOINT = 'https://2j77uv25gk.execute-api.us-east-1.amazonaws.com/Prod/send-email';
  const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]*$/u;
  const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]*$/;
  const SOLUTION_OPTIONS = Object.freeze([
    'Pantallas LED Indoor',
    'Pantallas LED Outdoor',
    'Tour Series Indoor',
    'Tour Series Outdoor',
    'Tótems LED Indoor',
    'Tótems LED Outdoor',
    'Pisos LED',
    'Cartelería LED para colectivos',
    'Unidades LED para comercios',
    'Pórticos y señalización vial',
    'Diseños especiales y proyectos a medida',
    'LED Trucks / publicidad móvil',
    'Iluminación: cabezales móviles Beam',
    'Iluminación: cabezales móviles 3 en 1',
    'Iluminación: barras móviles',
    'Iluminación: flashes',
    'No estoy seguro / necesito asesoramiento'
  ]);

  const CLIENT_TYPE_OPTIONS = Object.freeze([
    'Productora, rental, eventos o espectáculos',
    'Comercio, retail o centro comercial',
    'Agencia, publicidad o activación de marca',
    'Medios, televisión o streaming',
    'Transporte, logística o terminal',
    'Gobierno, municipio u organismo público',
    'Industria o empresa corporativa',
    'Gastronomía, hotelería o locales nocturnos',
    'Deportes, clubes o estadios',
    'Arquitectura, construcción o integración',
    'Educación, cultura o institución',
    'Usuario particular / uso personal',
    'Otro'
  ]);

  function sanitizePhoneInput(value) {
    const allowedCharacters = String(value).replace(/[^0-9+()\s-]/g, '');
    const withoutExtraPlusSigns = allowedCharacters
      .split('')
      .filter((character, index) => character !== '+' || index === 0)
      .join('');

    return withoutExtraPlusSigns.replace(/\s+/g, ' ').slice(0, 25);
  }

  function validateName(value) {
    if (value.length < 2 || value.length > 80 || !NAME_PATTERN.test(value)) {
      return 'Usá entre 2 y 80 caracteres: letras, espacios, apóstrofes o guiones.';
    }
    return '';
  }

  function validatePhone(value) {
    const digitCount = value.replace(/\D/g, '').length;
    if (value.length > 25 || !PHONE_PATTERN.test(value) || digitCount < 8 || digitCount > 15) {
      return 'Ingresá un teléfono válido de entre 8 y 15 números.';
    }
    return '';
  }

  function validateMessage(value) {
    if (value.length < 10 || value.length > 2000) {
      return 'La consulta debe tener entre 10 y 2000 caracteres.';
    }
    return '';
  }

  function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;

    if (field.required && !value) return 'Este campo es obligatorio.';
    if (!value) return '';

    if (fieldName === 'nombre' || fieldName === 'apellido') return validateName(value);
    if (fieldName === 'telefono') return validatePhone(value);

    if (fieldName === 'empresa') {
      if (value.length < 2 || value.length > 120) {
        return 'Ingresá entre 2 y 120 caracteres.';
      }
      return '';
    }

    if (fieldName === 'otroTipoCliente' && (value.length < 2 || value.length > 80)) {
      return 'Ingresá entre 2 y 80 caracteres.';
    }

    if (fieldName === 'consulta') return validateMessage(value);
    return '';
  }

  function fieldContainer(field) {
    return field.closest('.form-field, .field');
  }

  function setFieldError(field, message) {
    const container = fieldContainer(field);
    const errorElement = container?.querySelector('.error-message');

    container?.classList.toggle('error', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');

    if (errorElement) {
      errorElement.textContent = message;
      if (!errorElement.id) errorElement.id = `${field.id || field.name}-error`;
      field.setAttribute('aria-describedby', errorElement.id);
    }
  }

  function populateSelect(select, options) {
    if (!select || select.dataset.optionsReady === 'true') return;

    select.querySelectorAll('option:not([value=""])').forEach(option => option.remove());
    options.forEach(label => {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      select.appendChild(option);
    });
    select.dataset.optionsReady = 'true';
  }

  function syncOtherClientField(form) {
    const clientType = form.querySelector('[data-client-type-select]');
    const otherContainer = form.querySelector('[data-other-client-field]');
    const otherField = otherContainer?.querySelector('input');
    if (!clientType || !otherContainer || !otherField) return;

    const shouldShow = clientType.value === 'Otro';
    otherContainer.hidden = !shouldShow;
    otherField.disabled = !shouldShow;
    otherField.required = shouldShow;
    clientType.setAttribute('aria-expanded', String(shouldShow));

    if (!shouldShow) {
      otherField.value = '';
      setFieldError(otherField, '');
    }
  }

  function validateForm(form) {
    const fields = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea'));
    let firstInvalidField = null;

    fields.forEach(field => {
      const message = validateField(field);
      setFieldError(field, message);
      if (message && !firstInvalidField) firstInvalidField = field;
    });

    if (firstInvalidField) {
      firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalidField.focus();
      return false;
    }

    return true;
  }

  function getFormValue(formData, fieldName) {
    const value = formData.get(fieldName);
    return typeof value === 'string' ? value.trim() : '';
  }

  function buildPayload(form) {
    const formData = new FormData(form);
    return {
      nombre: getFormValue(formData, 'nombre'),
      apellido: getFormValue(formData, 'apellido'),
      empresa: getFormValue(formData, 'empresa'),
      tipoCliente: getFormValue(formData, 'tipoCliente'),
      otroTipoCliente: getFormValue(formData, 'otroTipoCliente'),
      telefono: getFormValue(formData, 'telefono'),
      tipoSolucion: getFormValue(formData, 'tipoSolucion'),
      consulta: getFormValue(formData, 'consulta')
    };
  }

  function findField(form, fieldName) {
    const field = form.elements.namedItem(fieldName);
    return field && typeof field.value === 'string' ? field : null;
  }

  function applyServerErrors(form, errors) {
    let firstInvalidField = null;

    Object.entries(errors || {}).forEach(([name, message]) => {
      const field = findField(form, name);
      if (!field) return;
      setFieldError(field, message);
      if (!firstInvalidField) firstInvalidField = field;
    });

    firstInvalidField?.focus();
  }

  function setFormStatus(form, message, type = '') {
    const status = form.querySelector('[data-form-status]');
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('success', type === 'success');
    status.classList.toggle('error', type === 'error');
  }

  function setSubmitting(button, submitting) {
    if (!button) return;

    const hasStructuredLabel = button.querySelector('.btn-text, .btn-loading');
    button.classList.toggle('loading', submitting);
    button.disabled = submitting;

    if (!hasStructuredLabel) {
      if (submitting) {
        button.dataset.defaultLabel = button.textContent;
        button.textContent = 'Enviando...';
      } else if (button.dataset.defaultLabel) {
        button.textContent = button.dataset.defaultLabel;
      }
    }
  }

  function showSuccess(form) {
    const popup = document.getElementById('popup-overlay');
    if (popup) {
      popup.classList.add('show');
      document.body.style.overflow = 'hidden';
      return;
    }

    setFormStatus(form, 'Consulta enviada correctamente. Nos pondremos en contacto a la brevedad.', 'success');
  }

  async function submitForm(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    setFormStatus(form, '');

    if (!validateForm(form)) return;

    setSubmitting(submitButton, true);
    const controller = new AbortController();
    const timeoutId = globalScope.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        applyServerErrors(form, result.fields);
        throw new Error(result.error || 'No pudimos enviar la consulta.');
      }

      form.reset();
      syncOtherClientField(form);
      form.querySelectorAll('[aria-invalid]').forEach(field => setFieldError(field, ''));
      showSuccess(form);
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'La solicitud tardó demasiado. Intentá nuevamente.'
        : error.message || 'No pudimos enviar la consulta. Intentá nuevamente.';

      setFormStatus(form, message, 'error');

      if (!form.querySelector('[data-form-status]')) {
        globalScope.alert(message);
      }
    } finally {
      globalScope.clearTimeout(timeoutId);
      setSubmitting(submitButton, false);
    }
  }

  function initializeForm(form) {
    if (form.dataset.contactFormReady === 'true') return;
    form.dataset.contactFormReady = 'true';

    populateSelect(form.querySelector('[data-solution-select]'), SOLUTION_OPTIONS);
    populateSelect(form.querySelector('[data-client-type-select]'), CLIENT_TYPE_OPTIONS);
    syncOtherClientField(form);

    form.querySelector('[data-client-type-select]')?.addEventListener('change', () => {
      syncOtherClientField(form);
    });

    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.name === 'telefono') {
        field.addEventListener('input', () => {
          field.value = sanitizePhoneInput(field.value);
          if (field.getAttribute('aria-invalid') === 'true') {
            setFieldError(field, validateField(field));
          }
        });
      } else {
        field.addEventListener('input', () => {
          if (field.getAttribute('aria-invalid') === 'true') setFieldError(field, validateField(field));
        });
      }

      field.addEventListener('blur', () => setFieldError(field, validateField(field)));
      field.addEventListener('change', () => setFieldError(field, validateField(field)));
    });

    form.addEventListener('submit', submitForm);
  }

  function initializeAllForms() {
    document.querySelectorAll('[data-contact-form]').forEach(initializeForm);
  }

  const publicApi = {
    sanitizePhoneInput,
    validateMessage,
    validateName,
    validatePhone
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = publicApi;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeAllForms);
    } else {
      initializeAllForms();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
