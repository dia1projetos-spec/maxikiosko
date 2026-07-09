// ============================================================
// CONFIGURACIÓN DE CLOUDINARY — Kiosko D. Diego
// ============================================================
// IMPORTANTE: El "API Secret" de Cloudinary NUNCA debe ir en este
// archivo ni en ningún código que corra en el navegador. Si se
// expone, cualquier persona podría usar tu cuenta de Cloudinary
// libremente.
//
// En su lugar, usamos un "Upload Preset" sin firma (unsigned),
// que permite subir imágenes desde el navegador de forma segura,
// sin exponer credenciales.
//
// CÓMO CREAR EL UPLOAD PRESET (una sola vez):
//   1. Entrá a https://cloudinary.com/console
//   2. Settings (ícono de tuerca) → pestaña "Upload"
//   3. Buscá "Upload presets" → "Add upload preset"
//   4. Signing Mode: "Unsigned"
//   5. (Opcional) Poné una carpeta fija, ej: "kiosko-d-diego"
//   6. Guardá y copiá el nombre del preset acá abajo, en
//      CLOUDINARY_UPLOAD_PRESET.
// ============================================================

export const CLOUDINARY_CLOUD_NAME = "v6wla33d";

// ⚠️ Reemplazá este valor por el nombre real del preset que crees
// en el paso de arriba. Mientras tanto, las subidas de imágenes
// no van a funcionar.
export const CLOUDINARY_UPLOAD_PRESET = "maxikiosko";

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Sube un archivo de imagen a Cloudinary usando el preset "unsigned".
 * @param {File} file - archivo de imagen (input type="file")
 * @param {string} [folder] - subcarpeta opcional dentro de Cloudinary
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadImageToCloudinary(file, folder = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const rawMessage = errorBody?.error?.message || "";

    // Mensajes más claros según el error típico de Cloudinary
    if (/preset not found/i.test(rawMessage)) {
      throw new Error(
        `No se encontró el upload preset "${CLOUDINARY_UPLOAD_PRESET}" en Cloudinary. ` +
          `Verificá en Cloudinary → Settings → Upload → Upload presets que el nombre sea ` +
          `exactamente ese (sin espacios ni mayúsculas de más) y que el "Signing Mode" esté en "Unsigned".`
      );
    }
    if (/whitelisted|not allowed/i.test(rawMessage)) {
      throw new Error(
        `Cloudinary rechazó la subida. Revisá que el preset "${CLOUDINARY_UPLOAD_PRESET}" esté ` +
          `configurado como "Unsigned" en Settings → Upload → Upload presets.`
      );
    }
    throw new Error(rawMessage || "No se pudo subir la imagen a Cloudinary. Verificá el upload preset.");
  }

  const data = await response.json();
  return { url: data.secure_url, publicId: data.public_id };
}
