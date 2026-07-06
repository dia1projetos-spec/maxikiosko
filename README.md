# Kiosko D. Diego — Sistema de Caja + Tienda Online

Sistema completo en HTML, CSS y JavaScript puro (sin frameworks, sin build step),
con Firebase (Firestore + Authentication) como base de datos y Cloudinary como
banco de imágenes. Todo el texto visible para el usuario está en español,
pensado para uso en Argentina.

## 📁 Estructura del proyecto

```
kiosko-d-diego/
├── index.html              → Tienda pública (slider, productos, carrito, checkout)
├── login.html              → Login del panel administrativo
├── firestore.rules         → Reglas de seguridad de Firestore (pegar en Firebase)
├── css/
│   ├── variables.css       → Paleta de colores y tipografía (tokens de diseño)
│   ├── style.css           → Estilos globales (header, footer, botones)
│   └── store.css           → Estilos específicos de la tienda pública
├── js/
│   ├── firebase-config.js  → Conexión a Firebase (ya cargada con tus datos)
│   ├── cloudinary-config.js→ Subida de imágenes (necesita el Upload Preset, ver abajo)
│   ├── auth.js              → Login / logout / protección de páginas admin
│   ├── cart.js              → Lógica del carrito (localStorage)
│   ├── utils.js             → Funciones compartidas (moneda, toasts, etc.)
│   └── store.js             → Lógica de la tienda pública
├── admin/
│   ├── dashboard.html, productos.html, categorias.html, clientes.html,
│   │   caja.html, compras.html, compras-familiares.html,
│   │   resumen-productos.html, resumen-financiero.html, slides.html,
│   │   configuracion.html
│   ├── css/admin.css
│   └── js/  (lógica de cada módulo + admin-layout.js compartido)
└── docs/
    └── MODELO-DE-DATOS.md  → Estructura completa de las colecciones de Firestore
```

## ✅ Pasos obligatorios antes de usar el sistema

### 1. Crear el Upload Preset de Cloudinary (subida de imágenes)

Tu **API Secret nunca debe estar en el código** (por seguridad, cualquiera podría
usar tu cuenta si lo viera). Por eso el sistema sube imágenes usando un
"Upload Preset" sin firma:

1. Entrá a [cloudinary.com/console](https://cloudinary.com/console)
2. `Settings` (⚙️) → pestaña **Upload** → **Upload presets** → **Add upload preset**
3. **Signing Mode: Unsigned**
4. Guardá y copiá el nombre del preset
5. Abrí `js/cloudinary-config.js` y reemplazá el valor de `CLOUDINARY_UPLOAD_PRESET`
   por ese nombre

Sin este paso, las subidas de imágenes (logo, slides, fotos de productos) no van a funcionar.

### 2. Configurar Firestore

1. En la consola de Firebase, activá **Firestore Database** (modo producción)
2. Andá a la pestaña **Reglas** y pegá el contenido completo de `firestore.rules`
   → **Publicar**
3. Firestore va a crear las colecciones automáticamente la primera vez que
   guardes datos desde el panel (no hace falta crearlas a mano)

**Índice necesario:** la página de "Retiros familiares" hace una consulta que
combina `where` + `orderBy`. La primera vez que abras esa página, Firestore va
a mostrar en la consola del navegador un link para crear el índice compuesto
automáticamente. Solo hay que hacer clic en ese link una vez.

### 3. Crear tus usuarios administradores

Como pediste, todos los logins comparten el mismo acceso (no hay roles
distintos). Para crear cada usuario:

1. Firebase Console → **Authentication** → pestaña **Sign-in method** →
   activá **Correo electrónico/contraseña**
2. Pestaña **Users** → **Add user** → cargá el correo y contraseña de cada
   persona que necesite entrar al panel

No hace falta tocar código para esto.

### 4. Cargar la configuración inicial del negocio

Una vez logueado en `/admin/configuracion.html`, cargá:
- Nombre del negocio
- Logo (opcional)
- Número de WhatsApp (formato: código de país + área + número, sin espacios
  ni el signo `+`. Ejemplo Argentina: `5493511234567`)
- Si ofrecés delivery y su costo

## 🚀 Cómo publicar el proyecto

### GitHub + Vercel

1. Creá un repositorio en GitHub y subí esta carpeta completa
2. Entrá a [vercel.com](https://vercel.com) → **Add New Project** → importá
   el repositorio
3. Como es un sitio estático (sin build), en la configuración de Vercel dejá:
   - **Framework Preset:** Other
   - **Build Command:** (vacío)
   - **Output Directory:** `./` (la raíz del proyecto)
4. Deploy. Vercel te da un dominio `.vercel.app` (podés conectar tu propio
   dominio después desde **Settings → Domains**)

No hace falta ningún paso de build: son archivos HTML/CSS/JS servidos tal cual.

## 🧭 Cómo funciona cada parte (resumen rápido)

- **Tienda pública (`index.html`):** carga slides, categorías y productos desde
  Firestore. El carrito se guarda en el navegador (localStorage). Al finalizar,
  se guarda el pedido en la colección `orders` y se abre WhatsApp con todo el
  detalle del pedido y el total.
- **Login (`login.html`):** usa Firebase Authentication. Si falla, muestra un
  mensaje de error sin revelar si fue el correo o la contraseña (por seguridad).
- **Panel admin (`/admin/*.html`):** todas las páginas llaman a
  `requireAuth()` al cargar — si no hay sesión activa, redirigen solas al login.
- **Productos:** al guardar un producto nuevo, el sistema genera automáticamente
  un código QR (basado en el ID del producto) y lo guarda como imagen en el
  propio documento de Firestore, con botón de descarga.
- **Caja (PDV):** permite buscar productos por nombre, tocar directamente de la
  lista, o escanear el QR con la cámara del celular. Calcula vuelto en efectivo,
  y maneja fiado (individual o compra conjunta dividiendo el monto en partes
  iguales — este es un criterio que elegí porque el pedido original no
  especificaba cómo dividir el monto; se puede ajustar fácilmente en
  `admin/js/caja.js`, función `confirmSaleBtn`).
- **Clientes:** guarda historial de compras con fecha, y si configurás días de
  retención, el sistema borra automáticamente las entradas del historial más
  viejas que esa cantidad de días cada vez que se abre la página.

## ⚠️ Cosas a revisar / decisiones que tomé

Como el pedido original tenía algunos puntos abiertos a interpretación, así los resolví:

1. **División de compra conjunta a fiado:** divido el total en partes iguales
   entre todos los clientes seleccionados (incluyendo el principal).
2. **Venta por peso:** en la tienda online y en caja, se pide el peso en gramos
   mediante una ventana simple (`prompt`). Si preferís un control más visual
   (por ejemplo, con botones +/- de a 50g), decime y lo agrego.
3. **QR del producto:** codifica un texto interno (`KIOSKO-PROD:<id>`), no el
   precio ni el nombre — así, si cambiás el precio del producto, el QR sigue
   funcionando sin necesidad de reimprimirlo.

Cualquiera de estos puntos se puede ajustar sin rehacer nada — avisame y lo
modifico.
