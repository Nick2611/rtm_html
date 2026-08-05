# RTM Pantallas LED: reglas obligatorias de edición

Este archivo debe leerse completo antes de modificar código, contenido o estilos del sitio. Toda intervención debe conservar la misma estructura visual, editorial y de conversión definida aquí.

## 1. Principio rector

El sitio debe verse sobrio, técnico y confiable. La conversión se obtiene con jerarquía clara, proyectos reales y un contacto fácil; no con acumulación de banners, ventanas, badges o llamados repetidos.

Usar como referencia conceptual a sitios industriales contemporáneos como Cirrus LED: una promesa clara, pocas acciones, producto visible, prueba real y secciones con aire. No copiar textos, identidad ni componentes de terceros.

## 2. Estructura obligatoria de las páginas comerciales

Respetar este orden cuando la página incluya esas secciones:

1. Header: navegación y un solo CTA comercial.
2. Hero: un H1, una breve explicación y hasta dos acciones.
3. Oferta: productos, servicios o usos presentados sin repetir la promesa del hero.
4. Prueba: clientes o proyectos reales. Los logos de clientes aparecen una sola vez en todo el home.
5. Argumentos: hasta cuatro beneficios concretos, únicamente si aportan información nueva.
6. Contacto: WhatsApp contextual o formulario breve.
7. Footer: datos de contacto y navegación secundaria.

No insertar nuevas franjas entre estas secciones sin demostrar que agregan información o una decisión distinta.

## 3. Jerarquía de conversión

- Prioridad 1: hablar con un asesor o pedir cotización.
- Prioridad 2: ver proyectos o detalles del producto.
- En un mismo bloque puede haber un CTA principal y, como máximo, uno secundario.
- Las tarjetas de catálogo tienen una sola acción visible. La cotización vive en el detalle del producto.
- El acceso persistente a WhatsApp debe ser un único pill compacto. En móvil puede ocupar el ancho inferior; en desktop no debe competir con el contenido.
- No usar popups por scroll, modales promocionales, barras duplicadas ni mensajes que persigan al usuario.
- No duplicar el carrusel, los logos de clientes, testimonios o beneficios.
- Los enlaces de WhatsApp deben llevar un mensaje breve y contextual.
- Los formularios piden solo nombre, teléfono/WhatsApp y necesidad como datos obligatorios. Los demás datos permanecen opcionales y agrupados.

## 4. Lenguaje visual

- Paleta base: negro/gris oscuro, blanco y el rojo institucional. El verde se reserva para acciones de WhatsApp.
- Usar tipografía, radios, bordes y espaciados existentes antes de introducir variantes.
- Priorizar espacios amplios, alineación limpia y contraste. Evitar tarjetas dentro de tarjetas.
- No sumar gradientes, sombras intensas, pills, bordes o íconos decorativos si no tienen función.
- No usar emojis. Los íconos de Font Awesome se permiten solo cuando mejoran reconocimiento o accesibilidad.
- No agregar ilustraciones o imágenes generadas por IA. Usar material real de productos, instalaciones y clientes.
- Preferir WebP para fotografías y fondos rasterizados. Mantener dimensiones adecuadas y una alternativa compatible solo si es técnicamente necesaria.
- Cada sección debe tener un único foco visual y suficiente espacio en blanco.

## 5. Reglas de copy

- Escribir en español claro y natural para Argentina.
- Hacer promesas específicas y comprobables. No inventar métricas, certificaciones, plazos, testimonios ni garantías.
- Evitar frases genéricas de IA como “llevá tu proyecto al siguiente nivel”, “soluciones innovadoras” o repeticiones de “te ayudamos”.
- H1: una idea, preferentemente en dos líneas y sin superar unas 12 palabras.
- Bajada de hero: una o dos oraciones breves.
- Párrafos de sección: máximo tres líneas visuales en desktop cuando sea posible.
- Los botones describen la acción: “Pedir cotización”, “Hablar con un asesor”, “Ver proyectos”, “Ver producto”.
- No usar mayúsculas sostenidas salvo etiquetas muy breves del sistema existente.

## 6. Reglas técnicas y de datos

- No enviar PII a Microsoft Clarity. Los eventos solo incluyen página, sección, producto, categoría, origen y estado técnico.
- Mantener sincronizados `js/contact-form.js` y `backend/lambda/send-email/`.
- Si cambia la Lambda, regenerar `backend/lambda/send-email/send-email.zip` y validar el archivo.
- Versionar los assets modificados para evitar caché obsoleto.
- Preservar navegación por teclado, labels, estados de foco, `aria-label`, `aria-live` y contraste.
- No agregar dependencias para resolver una interacción simple.

## 7. Flujo obligatorio antes y después de editar

Antes de editar:

1. Leer este archivo completo.
2. Revisar el diff actual y distinguir cambios propios de cambios del usuario.
3. Inspeccionar la sección existente y buscar componentes equivalentes antes de crear uno nuevo.
4. Comprobar que el contenido o CTA propuesto no esté ya presente en la página.

Después de editar:

1. Revisar desktop y mobile cuando haya navegador disponible.
2. Ejecutar `git diff --check` y validaciones de sintaxis.
3. Probar el formulario sin enviar una consulta real, salvo autorización explícita.
4. Confirmar que no haya contenido tapado por elementos fijos ni acciones duplicadas.
5. Informar cualquier validación visual que no haya sido posible realizar.

## 8. Criterio de finalización

Un cambio no está terminado si aumenta la cantidad de elementos sin mejorar la decisión del usuario. Ante dos alternativas funcionalmente equivalentes, elegir la más simple, clara y coherente con la estructura existente.
