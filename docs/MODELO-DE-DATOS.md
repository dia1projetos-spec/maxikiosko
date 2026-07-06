# Modelo de Datos — Firestore (Kiosko D. Diego)

Este documento define la estructura de datos usada en todo el sistema.
Todos los módulos (tienda pública y panel administrativo) deben respetar
estos nombres de colecciones y campos para que todo funcione en conjunto.

## Colecciones

### `config` (documento único: `config/general`)
```
{
  businessName: string,
  logoUrl: string | null,
  whatsappNumber: string,      // formato: "5493511234567" (código país + área + número, sin + ni espacios)
  deliveryEnabled: boolean,
  deliveryCost: number,        // 0 si es gratis
  updatedAt: timestamp
}
```

### `slides`
```
slides/{slideId}
{
  imageUrl: string,
  cloudinaryPublicId: string,
  order: number,
  createdAt: timestamp
}
```

### `categories`
```
categories/{categoryId}
{
  name: string,
  createdAt: timestamp
}
```

### `products`
```
products/{productId}
{
  name: string,
  costPrice: number | null,
  salePrice: number,           // obligatorio. Si soldBy = 'weight', este es el precio POR KILO
  barcode: string | null,
  categoryId: string | null,
  stock: number | null,
  profit: number | null,       // ganancia unitaria (opcional, informada por el usuario)
  soldBy: 'unit' | 'weight',   // 'unit' = por unidad, 'weight' = por peso (kg/gramos)
  imageUrl: string | null,
  qrCodeDataUrl: string,       // el QR se genera y guarda como dataURL en el momento de crear el producto
  totalSold: number,           // acumulador de unidades/kg vendidos (para el ranking)
  totalProfit: number,         // acumulador de ganancia generada (para el resumen)
  createdAt: timestamp
}
```

### `clients`
```
clients/{clientId}
{
  name: string,
  contact: string,
  clientNumber: string,        // número identificador visible (ej: correlativo)
  type: 'common' | 'family',
  fiadoOpen: boolean,
  fiadoAmount: number,
  historyRetentionDays: number | null,  // si se define, se borra historial viejo automáticamente
  history: [
    {
      saleId: string,
      date: timestamp,
      total: number,
      paymentMethod: 'efectivo' | 'transferencia' | 'fiado',
      isJoint: boolean,
      isFamilyWithdrawal: boolean,
      paidAt: timestamp | null     // se completa cuando el fiado se salda
    }
  ],
  createdAt: timestamp
}
```

### `sales` (ventas hechas por Caja/PDV)
```
sales/{saleId}
{
  items: [
    { productId, name, qty, unitPrice, subtotal, soldBy }
  ],
  total: number,
  clientId: string | null,
  jointClientIds: string[],      // si isJoint = true
  isJoint: boolean,
  isFamilyWithdrawal: boolean,   // true si el cliente es 'family' (no paga)
  paymentMethod: 'efectivo' | 'transferencia' | 'fiado',
  cashGiven: number | null,
  change: number | null,
  fiadoPaid: boolean,            // si paymentMethod = fiado, indica si ya fue saldado
  fiadoPaidAt: timestamp | null,
  createdAt: timestamp
}
```

### `orders` (pedidos hechos desde la tienda online / delivery)
```
orders/{orderId}
{
  items: [ { productId, name, qty, unitPrice, subtotal } ],
  subtotal: number,
  deliveryCost: number,
  total: number,
  customerName: string,
  customerContact: string,
  address: {
    street: string,
    number: string,
    complement: string | null,
    neighborhood: string
  },
  status: 'nuevo' | 'enviado_whatsapp',
  createdAt: timestamp
}
```

### `expenses` (gastos del negocio)
```
expenses/{expenseId}
{
  description: string,
  amount: number,
  date: string,          // formato "YYYY-MM-DD", fácil de ordenar y filtrar por mes
  createdAt: timestamp
}
```

## Autenticación
- Firebase Authentication (Email/Password), usuarios creados manualmente desde la
  consola de Firebase. Todos los usuarios autenticados tienen el mismo nivel de
  acceso a `/admin`.

## Cloudinary
- Subida "unsigned" desde el navegador usando un **Upload Preset** sin firma
  (se crea en el panel de Cloudinary: Settings → Upload → Upload presets → Add
  upload preset → Signing Mode: Unsigned).
- Nunca se usa el API Secret en el código del frontend.
