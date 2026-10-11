// Carrusel de fotos (widget carrusel.html).
// Lista las fotos de UNA carpeta de tu Drive para que el widget las muestre.
// Las fotos nuevas que pongas en la carpeta aparecen solas.
const CARPETA = 'PON-AQUI-EL-ID-DE-LA-CARPETA';

function doGet() {
  const files = [];
  try {
    const it = DriveApp.getFolderById(CARPETA).getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (/^image\//.test(f.getMimeType())) files.push({ id: f.getId(), name: f.getName(), t: f.getLastUpdated().getTime() });
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ files: [], error: 'carpeta' })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ files: files })).setMimeType(ContentService.MimeType.JSON);
}
