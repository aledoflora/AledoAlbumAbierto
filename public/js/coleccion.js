// ===== VARIABLES GLOBALES =====
let carpetas = [];
let subcarpetas = [];
let fotos = [];
let carpetaActual = null;
let categoriaActual = null;

// ===== FUNCIONES PRINCIPALES =====

// Cargar carpetas principales
async function cargarCarpetas() {
  try {
    console.log('Iniciando carga de carpetas...');
    
    const serverUrl = 'http://localhost:3000';
    
    // Test del servidor
    const testResponse = await fetch(`${serverUrl}/api/test`);
    console.log('Test del servidor:', testResponse.status);
    
    const response = await fetch(`${serverUrl}/api/coleccion/carpetas`);
    console.log('Respuesta del servidor:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Datos recibidos:', data);
      carpetas = data.carpetas;
      console.log('Carpetas cargadas:', carpetas.length);
      mostrarCarpetas();
    } else {
      throw new Error(`Error al cargar carpetas: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error cargando carpetas:', error);
    mostrarError('Error al cargar las colecciones: ' + error.message);
  }
}

// Mostrar carpetas principales
function mostrarCarpetas() {
  console.log('Mostrando carpetas...');
  document.getElementById('carpetasView').style.display = 'block';
  document.getElementById('galleryView').style.display = 'none';
  document.getElementById('breadcrumb').innerHTML = '<a href="#" onclick="mostrarCarpetas()">Colección</a>';
  
  // Limpiar variables de contexto
  categoriaActual = null;
  carpetaActual = null;
  
  const grid = document.getElementById('carpetasGrid');
  grid.innerHTML = '';
  console.log('Creando tarjetas para', carpetas.length, 'carpetas');

  carpetas.forEach((carpeta, index) => {
    console.log('Creando tarjeta', index + 1, 'para carpeta:', carpeta.nombre);
    const card = crearTarjetaCarpeta(carpeta);
    grid.appendChild(card);
  });
  console.log('Carpetas mostradas correctamente');
}

// Crear tarjeta de carpeta principal
function crearTarjetaCarpeta(carpeta) {
  const card = document.createElement('div');
  card.className = 'carpeta-card';
  
  // Siempre intentar cargar subcarpetas primero
  card.onclick = () => cargarSubcarpetas(carpeta.nombre);

  card.innerHTML = `
    <div class="carpeta-image">
      <i class="fas fa-folder"></i>
    </div>
    <div class="carpeta-info">
      <h3 class="carpeta-title">${carpeta.nombreFormateado}</h3>
      <p class="carpeta-count">${carpeta.totalFotos} fotos</p>
    </div>
  `;

  return card;
}

// Cargar subcarpetas o fotos directamente
async function cargarSubcarpetas(categoria) {
  try {
    categoriaActual = categoria;
    const serverUrl = 'http://localhost:3000';
    const response = await fetch(`${serverUrl}/api/coleccion/subcarpetas/${categoria}`);
    if (response.ok) {
      const data = await response.json();
      if (data.subcarpetas && data.subcarpetas.length > 0) {
        subcarpetas = data.subcarpetas;
        mostrarSubcarpetas(categoria);
      } else {
        // Si no hay subcarpetas, cargar fotos directamente
        await cargarFotosCarpeta(categoria);
      }
    } else {
      // Si hay error, intentar cargar fotos directamente
      await cargarFotosCarpeta(categoria);
    }
  } catch (error) {
    console.error('Error cargando subcarpetas:', error);
    // Si hay error, intentar cargar fotos directamente
    try {
      await cargarFotosCarpeta(categoria);
    } catch (fotosError) {
      console.error('Error cargando fotos:', fotosError);
      mostrarError('Error al cargar el contenido');
    }
  }
}

// Cargar fotos de una carpeta
async function cargarFotosCarpeta(carpeta) {
  try {
    carpetaActual = carpeta;
    const serverUrl = 'http://localhost:3000';
    const response = await fetch(`${serverUrl}/api/coleccion/fotos/${carpeta}`);
    if (response.ok) {
      const data = await response.json();
      fotos = data.fotos;
      mostrarGaleria(carpeta);
    } else {
      throw new Error('Error al cargar fotos');
    }
  } catch (error) {
    console.error('Error cargando fotos:', error);
    mostrarError('Error al cargar las fotos');
  }
}

// Mostrar subcarpetas
function mostrarSubcarpetas(categoria) {
  document.getElementById('carpetasView').style.display = 'block';
  document.getElementById('galleryView').style.display = 'none';
  
  const nombreFormateado = categoria.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  document.getElementById('breadcrumb').innerHTML = `
    <a href="#" onclick="mostrarCarpetas()">Colección</a>
    <span class="separator">/</span>
    <span>${nombreFormateado}</span>
  `;
  
  const grid = document.getElementById('carpetasGrid');
  grid.innerHTML = '';
  
  subcarpetas.forEach((subcarpeta, index) => {
    const card = crearTarjetaSubcarpeta(subcarpeta);
    grid.appendChild(card);
  });
}

// Crear tarjeta de subcarpeta
function crearTarjetaSubcarpeta(subcarpeta) {
  const card = document.createElement('div');
  card.className = 'carpeta-card';
  card.onclick = () => cargarFotosCarpeta(subcarpeta.nombre);

  card.innerHTML = `
    <div class="carpeta-image">
      <i class="fas fa-folder"></i>
    </div>
    <div class="carpeta-info">
      <h3 class="carpeta-title">${subcarpeta.nombreFormateado}</h3>
      <p class="carpeta-count">${subcarpeta.totalFotos} fotos</p>
    </div>
  `;

  return card;
}

// Mostrar galería de fotos
function mostrarGaleria(carpeta) {
  document.getElementById('carpetasView').style.display = 'none';
  document.getElementById('galleryView').style.display = 'block';
  
  const nombreFormateado = carpeta.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  document.getElementById('galleryTitle').textContent = nombreFormateado;
  
  // Construir breadcrumb según el contexto
  let breadcrumbHTML = '<a href="#" onclick="mostrarCarpetas()">Colección</a>';
  
  if (categoriaActual) {
    const categoriaFormateada = categoriaActual.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    breadcrumbHTML += `<span class="separator">/</span><a href="#" onclick="cargarSubcarpetas('${categoriaActual}')">${categoriaFormateada}</a>`;
  }
  
  breadcrumbHTML += `<span class="separator">/</span><span>${nombreFormateado}</span>`;
  document.getElementById('breadcrumb').innerHTML = breadcrumbHTML;

  cargarGaleria();
}

// Cargar galería de fotos
function cargarGaleria() {
  const gallery = document.getElementById('galleryGrid');
  gallery.innerHTML = '';

  if (fotos.length === 0) {
    gallery.innerHTML = '<div class="loading"><p>No hay fotos en esta colección</p></div>';
    return;
  }

  fotos.forEach(foto => {
    const card = crearTarjetaFoto(foto);
    gallery.appendChild(card);
  });
}

// Crear tarjeta de foto
function crearTarjetaFoto(foto) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.onclick = () => abrirModal(foto);

  // Usar miniatura si está disponible, sino la imagen original
  const imagenSrc = foto.miniatura || foto.imagen;

  card.innerHTML = `
    <div class="photo-image-container">
      <img src="${imagenSrc}" alt="${foto.titulo}" class="photo-image" 
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
           loading="lazy">
      <div class="photo-placeholder" style="display: none; align-items: center; justify-content: center; height: 200px; background: #f5f5f5; color: #666; font-size: 14px;">
        Imagen no disponible
      </div>
    </div>
    <div class="photo-info">
      <h3 class="photo-title">${foto.titulo}</h3>
      <p class="photo-date">${formatearFecha(foto.fecha)}</p>
      <p class="photo-category">${foto.categoria.replace(/_/g, ' ').toUpperCase()}</p>
    </div>
  `;

  return card;
}

// ===== FUNCIONES AUXILIARES =====

// Formatear fecha
function formatearFecha(fecha) {
  console.log('Formateando fecha:', fecha, 'Tipo:', typeof fecha);
  
  if (!fecha) {
    return 'Fecha desconocida';
  }
  
  // Si es solo un año (formato: "1997")
  if (/^\d{4}$/.test(fecha)) {
    console.log('Fecha solo año:', fecha);
    return fecha;
  }
  
  // Si es año y mes (formato: "1997-07")
  if (/^\d{4}-\d{2}$/.test(fecha)) {
    const [año, mes] = fecha.split('-');
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesNombre = meses[parseInt(mes) - 1];
    console.log('Fecha año y mes:', `${mesNombre} de ${año}`);
    return `${mesNombre} de ${año}`;
  }
  
  // Si es fecha completa (formato: "1997-07-15")
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [año, mes, dia] = fecha.split('-');
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesNombre = meses[parseInt(mes) - 1];
    console.log('Fecha completa:', `${parseInt(dia)} de ${mesNombre} de ${año}`);
    return `${parseInt(dia)} de ${mesNombre} de ${año}`;
  }
  
  console.log('Fecha no reconocida:', fecha);
  return 'Fecha desconocida';
}

// Mostrar error
function mostrarError(mensaje) {
  const grid = document.getElementById('carpetasGrid');
  grid.innerHTML = `
    <div class="loading">
      <p style="color: #dc3545;">${mensaje}</p>
      <button onclick="cargarCarpetas()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Reintentar
      </button>
    </div>
  `;
}

// ===== FUNCIONES DEL MODAL =====

// Abrir modal con información de la foto
function abrirModal(foto) {
  const modal = document.getElementById('photoModal');
  const modalImage = document.getElementById('modalImage');
  const modalInfo = document.getElementById('modalInfo');

  // Usar imagen completa en el modal
  modalImage.src = foto.imagen;
  modalImage.alt = foto.titulo;

  // Crear contenido del modal
  let modalContent = `
    <h2>${foto.titulo}</h2>
    <p><strong>Descripción:</strong> ${foto.descripcion}</p>
    <p><strong>Fecha:</strong> ${formatearFecha(foto.fecha)}</p>
    <p><strong>Década:</strong> ${foto.decada}</p>
    <p><strong>Categoría:</strong> ${foto.categoria.replace(/_/g, ' ').toUpperCase()}</p>
    <p><strong>Localización:</strong> ${foto.localizacion.replace(/_/g, ' ').toUpperCase()}</p>
  `;

  // Añadir reproductor de audio si existe
  if (foto.audio) {
    modalContent += `
      <div class="audio-player">
        <h3><i class="fas fa-music"></i> Audio asociado</h3>
        <audio controls style="width: 100%; margin: 10px 0;">
          <source src="${foto.audio}" type="audio/mpeg">
          Tu navegador no soporta el elemento de audio.
        </audio>
      </div>
    `;
  }

  modalInfo.innerHTML = modalContent;
  modal.style.display = 'block';
}

// Cerrar modal
function closeModal() {
  document.getElementById('photoModal').style.display = 'none';
}

// ===== INICIALIZACIÓN =====

// Event listeners cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM cargado, iniciando aplicación...');
  
  // Cargar carpetas iniciales
  cargarCarpetas();

  // Cerrar modal con ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Cerrar modal haciendo clic fuera
  document.getElementById('photoModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
});
