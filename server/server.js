const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
// Configurar variables de entorno básicas si no existe .env
try {
  require('dotenv').config();
  console.log('Variables de entorno cargadas con dotenv');
} catch (error) {
  console.log('Error cargando dotenv:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'tu-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'tu-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'tu-api-secret'
});

console.log('Configurando Cloudinary con:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'No configurado',
  api_key: process.env.CLOUDINARY_API_KEY ? '***' + process.env.CLOUDINARY_API_KEY.slice(-4) : 'No configurado'
});

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo por archivo
    files: 5 // Máximo 5 archivos
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif)'));
    }
  }
});

// Configuración del transportador de email
const emailUser = process.env.EMAIL_USER || 'aledoalbumabierto@gmail.com';
const emailPass = process.env.EMAIL_PASS || 'venp vtpt lmhs gjdd';

console.log('Configurando email con:', {
  user: emailUser,
  pass: emailPass ? '***' + emailPass.slice(-4) : 'No configurado'
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailUser,
    pass: emailPass
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar archivos estáticos - intentar diferentes rutas para compatibilidad
const publicPath = path.join(__dirname, '../public');
const alternativePublicPath = path.join(__dirname, 'public');

if (fs.existsSync(publicPath)) {
  console.log('Sirviendo archivos estáticos desde:', publicPath);
  app.use(express.static(publicPath));
} else if (fs.existsSync(alternativePublicPath)) {
  console.log('Sirviendo archivos estáticos desde:', alternativePublicPath);
  app.use(express.static(alternativePublicPath));
} else {
  console.log('No se encontró la carpeta public, sirviendo desde:', __dirname);
  app.use(express.static(__dirname));
}

// Cache para miniaturas
const thumbnailCache = new Map();

// ===== FUNCIONES AUXILIARES =====

// Función para subir archivo a Cloudinary
async function subirArchivoACloudinary(filePath, carpeta = 'aledo-album') {
  try {
    console.log('☁️ Subiendo archivo a Cloudinary:', filePath);
    
    const resultado = await cloudinary.uploader.upload(filePath, {
      folder: carpeta,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });
    
    console.log('✅ Archivo subido a Cloudinary:', resultado.secure_url);
    return {
      url: resultado.secure_url,
      public_id: resultado.public_id,
      width: resultado.width,
      height: resultado.height,
      format: resultado.format,
      bytes: resultado.bytes
    };
  } catch (error) {
    console.error('❌ Error subiendo archivo a Cloudinary:', error);
    throw error;
  }
}

// Función para enviar email de notificación
async function enviarEmailNotificacion(participacion) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tu-email@gmail.com',
      to: 'aledoalbumabierto@gmail.com', // Email donde quieres recibir las notificaciones
      subject: `Nueva participación en Aledo Álbum Abierto - ${participacion.nombre}`,
      html: `
        <h2>Nueva participación recibida</h2>
        <p><strong>Participante:</strong> ${participacion.nombre}</p>
        <p><strong>Email:</strong> ${participacion.email}</p>
        <p><strong>Teléfono:</strong> ${participacion.telefono || 'No proporcionado'}</p>
        <p><strong>Fecha de la foto:</strong> ${participacion.fechaFoto || 'No especificada'}</p>
        <p><strong>Descripción:</strong> ${participacion.descripcion}</p>
        <p><strong>Categoría:</strong> ${participacion.categoria || 'No especificada'}</p>
        <p><strong>Comentarios:</strong> ${participacion.comentarios || 'No hay comentarios adicionales'}</p>
        <p><strong>Archivos subidos:</strong> ${participacion.archivos.length}</p>
        <ul>
          ${participacion.archivos.map(archivo => `<li>${archivo.nombreOriginal} (${Math.round(archivo.tamaño/1024)}KB)</li>`).join('')}
        </ul>
        <p><strong>Fecha de envío:</strong> ${new Date(participacion.fecha).toLocaleString('es-ES')}</p>
        <p><strong>ID de participación:</strong> ${participacion.id}</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de notificación enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando email de notificación:', error);
    return false;
  }
}

// Función para enviar email de confirmación al participante
async function enviarEmailConfirmacion(participacion) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'tu-email@gmail.com',
      to: participacion.email,
      subject: 'Confirmación de participación - Aledo Álbum Abierto',
      html: `
        <h2>¡Gracias por tu participación!</h2>
        <p>Hola ${participacion.nombre},</p>
        <p>Hemos recibido correctamente tu contribución al proyecto <strong>Aledo Álbum Abierto</strong>.</p>
        <p><strong>Detalles de tu participación:</strong></p>
        <ul>
          <li><strong>Descripción:</strong> ${participacion.descripcion}</li>
          <li><strong>Archivos subidos:</strong> ${participacion.archivos.length}</li>
          <li><strong>Fecha de envío:</strong> ${new Date(participacion.fecha).toLocaleString('es-ES')}</li>
        </ul>
        <p>Tu participación será revisada y, si es apropiada, será incluida en nuestro álbum colectivo.</p>
        <p>Te mantendremos informado sobre el estado de tu contribución.</p>
        <p>¡Gracias por ayudar a preservar la memoria histórica de Aledo!</p>
        <br>
        <p>Saludos,</p>
        <p>Equipo de Aledo Álbum Abierto</p>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de confirmación enviado:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error enviando email de confirmación:', error);
    return false;
  }
}

// Función para generar miniaturas
async function generarMiniatura(imagenPath, carpeta, nombreArchivo) {
  try {
    // Intentar diferentes rutas para compatibilidad
    let thumbnailDir = path.join(__dirname, '../public/assets/images/thumbnails', carpeta);
    if (!fs.existsSync(thumbnailDir)) {
      thumbnailDir = path.join(__dirname, 'public/assets/images/thumbnails', carpeta);
    }
    if (!fs.existsSync(thumbnailDir)) {
      thumbnailDir = path.join(__dirname, 'assets/images/thumbnails', carpeta);
    }
    
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    const thumbnailPath = path.join(thumbnailDir, nombreArchivo);
    const cacheKey = `${carpeta}/${nombreArchivo}`;

    if (thumbnailCache.has(cacheKey)) {
      return thumbnailCache.get(cacheKey);
    }

    await sharp(imagenPath)
      .resize(300, 200, { 
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ 
        quality: 80,
        progressive: true,
        mozjpeg: true
      })
      .toFile(thumbnailPath);

    const thumbnailUrl = `assets/images/thumbnails/${carpeta}/${nombreArchivo}`;
    thumbnailCache.set(cacheKey, thumbnailUrl);
    return thumbnailUrl;
  } catch (error) {
    console.error(`Error generando miniatura para ${nombreArchivo}:`, error);
    return null;
  }
}

// Función para contar fotos en una carpeta
function contarFotos(carpetaPath) {
  if (!fs.existsSync(carpetaPath)) return 0;
  
  const archivos = fs.readdirSync(carpetaPath)
    .filter(archivo => {
      const ext = path.extname(archivo).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });
  
  return archivos.length;
}

// Función para obtener información de una foto
function obtenerInfoFoto(archivo, carpeta, categoria = null) {
  const nombreSinExt = path.parse(archivo).name;
  
  // Extraer información de fecha disponible (año, mes, dia)
  let año = null;
  let mes = null;
  let dia = null;
  let tituloLimpio = nombreSinExt;
  
  // Buscar diferentes patrones de fecha al inicio del nombre
  const patrones = [
    /^(\d{4})(\d{2})(\d{2})/, // YYYYMMDD - Fecha completa
    /^(\d{4})(\d{2})XX/,      // YYYYMMXX - Solo año y mes
    /^(\d{4})XXXX/,           // YYYYXXXX - Solo año
  ];
  
  for (const patron of patrones) {
    const fechaMatch = nombreSinExt.match(patron);
    if (fechaMatch) {
      const añoTemp = parseInt(fechaMatch[1]);
      
      // Validar año
      if (añoTemp >= 1900 && añoTemp <= 2030) {
        if (patron.source === /^(\d{4})(\d{2})(\d{2})/.source) {
          // YYYYMMDD - Fecha completa
          const mesTemp = parseInt(fechaMatch[2]);
          const diaTemp = parseInt(fechaMatch[3]);
          
          if (mesTemp >= 1 && mesTemp <= 12 && diaTemp >= 1 && diaTemp <= 31) {
            const fechaObj = new Date(añoTemp, mesTemp - 1, diaTemp);
            if (fechaObj.getFullYear() === añoTemp && fechaObj.getMonth() === mesTemp - 1 && fechaObj.getDate() === diaTemp) {
              año = añoTemp;
              mes = mesTemp;
              dia = diaTemp;
              tituloLimpio = nombreSinExt.substring(8).replace(/^[-_\s]+/, '');
              break;
            }
          }
        } else if (patron.source === /^(\d{4})(\d{2})XX/.source) {
          // YYYYMMXX - Solo año y mes
          const mesTemp = parseInt(fechaMatch[2]);
          if (mesTemp >= 1 && mesTemp <= 12) {
            año = añoTemp;
            mes = mesTemp;
            // dia = null (no se conoce)
            tituloLimpio = nombreSinExt.substring(6).replace(/^[-_\s]+/, '');
            break;
          }
        } else if (patron.source === /^(\d{4})XXXX/.source) {
          // YYYYXXXX - Solo año
          año = añoTemp;
          // mes = null, dia = null (no se conocen)
          tituloLimpio = nombreSinExt.substring(8).replace(/^[-_\s]+/, '');
          break;
        }
      }
    }
  }
  
  // Crear fecha formateada según la información disponible
  let fecha = null;
  if (año && mes && dia) {
    fecha = `${año.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
  } else if (año && mes) {
    fecha = `${año.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}`;
  } else if (año) {
    fecha = año.toString();
  }
  // Si no hay información de fecha, fecha será null
  
  // Crear título limpio sin fecha
  let titulo = tituloLimpio
    // Eliminar patrones de fecha al inicio
    .replace(/^(\d{4})(\d{2})(\d{2})/, '') // YYYYMMDD
    .replace(/^(\d{4})(\d{2})XX/, '') // YYYYMMXX
    .replace(/^(\d{4})XXXX/, '') // YYYYXXXX
    .replace(/^XXXXXXXX/, '') // XXXXXXXX
    // Eliminar guiones y guiones bajos al inicio
    .replace(/^[-_\s]+/, '')
    // Reemplazar guiones y guiones bajos por espacios
    .replace(/[-_]/g, ' ')
    // Capitalizar primera letra de cada palabra
    .replace(/\b\w/g, l => l.toUpperCase())
    // Eliminar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim();
  
  // Si el título queda vacío, usar un título por defecto
  if (!titulo) {
    titulo = 'Fotografía sin título';
  }
  
  // Determinar década basada en la fecha extraída
  let decada = "2020s";
  if (año) {
    if (año >= 1950 && año < 1960) decada = "1950s";
    else if (año >= 1960 && año < 1970) decada = "1960s";
    else if (año >= 1970 && año < 1980) decada = "1970s";
    else if (año >= 1980 && año < 1990) decada = "1980s";
    else if (año >= 1990 && año < 2000) decada = "1990s";
    else if (año >= 2000 && año < 2010) decada = "2000s";
    else if (año >= 2010 && año < 2020) decada = "2010s";
    else if (año >= 2020) decada = "2020s";
  }

  // Verificar audio asociado
  const audioPath = path.join(__dirname, '../public/assets/audios', `${nombreSinExt}.mp3`);
  const audioUrl = fs.existsSync(audioPath) ? `assets/audios/${nombreSinExt}.mp3` : null;

  return {
    titulo,
    fecha,
    año,
    mes,
    dia,
    decada,
    audio: audioUrl,
    formato: path.extname(archivo).substring(1).toUpperCase()
  };
}

// ===== RUTAS API =====

// Ruta para manejar el formulario de participación
app.post('/api/participa', upload.array('fotos', 5), async (req, res) => {
  console.log('🚀 INICIO: Nueva petición POST a /api/participa');
  try {
    console.log('📝 Procesando nueva participación...');

    // Validar datos requeridos
    const { nombre, email, descripcion } = req.body;
    if (!nombre || !email || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: nombre, email y descripción son obligatorios'
      });
    }

    // Validar que se hayan subido archivos
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe subir al menos una imagen'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido'
      });
    }

    // Crear carpeta uploads si no existe
    const participanteId = Date.now().toString();
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Subir archivos a Cloudinary
    const archivosGuardados = [];
    for (const file of req.files) {
      try {
        console.log('📤 Procesando archivo:', file.originalname);
        
        // Subir archivo a Cloudinary
        const cloudinaryResult = await subirArchivoACloudinary(file.path, `aledo-album/${participanteId}`);
        
        // Verificar si existe audio asociado
        const nombreSinExt = path.parse(file.originalname).name;
        const audioPath = path.join(__dirname, '../public/assets/audios', `${nombreSinExt}.mp3`);
        const audioUrl = fs.existsSync(audioPath) ? `assets/audios/${nombreSinExt}.mp3` : null;
        
        archivosGuardados.push({
          nombreOriginal: file.originalname,
          nombreGuardado: file.originalname,
          ruta: cloudinaryResult.url,
          public_id: cloudinaryResult.public_id,
          tamaño: cloudinaryResult.bytes,
          tipo: file.mimetype,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          audio: audioUrl
        });
        
        // Eliminar archivo temporal
        fs.unlinkSync(file.path);
        console.log('🗑️ Archivo temporal eliminado:', file.path);
        
      } catch (error) {
        console.error('❌ Error procesando archivo:', file.originalname, error);
        // Eliminar archivo temporal en caso de error
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        throw error;
      }
    }

    // Crear registro de la participación
    console.log('📝 Creando objeto de participación...');
    const participacion = {
      id: participanteId,
      fecha: new Date().toISOString(),
      nombre: nombre,
      email: email,
      telefono: req.body.telefono || '',
      fechaFoto: req.body['fecha-foto'] || '',
      descripcion: descripcion,
      categoria: req.body.categoria || '',
      comentarios: req.body.comentarios || '',
      carpeta: participanteId,
      rutaCarpeta: `uploads`,
      archivos: archivosGuardados,
      estado: 'enviado'
    };
    console.log('✅ Objeto de participación creado:', participacion.id);

    // Guardar registro en archivo JSON
    const registrosPath = path.join(__dirname, 'data', 'participaciones.json');
    const registrosDir = path.dirname(registrosPath);
    if (!fs.existsSync(registrosDir)) {
      fs.mkdirSync(registrosDir, { recursive: true });
    }

    let participaciones = [];
    if (fs.existsSync(registrosPath)) {
      try {
        participaciones = JSON.parse(fs.readFileSync(registrosPath, 'utf8'));
        console.log('📄 Archivo de participaciones cargado:', participaciones.length, 'participaciones existentes');
      } catch (error) {
        console.error('Error leyendo archivo de participaciones:', error);
        participaciones = [];
      }
    } else {
      console.log('📄 Creando nuevo archivo de participaciones');
    }

    console.log('📊 Participaciones existentes:', participaciones.length);
    participaciones.push(participacion);
    console.log('💾 Guardando participación en JSON...');
    try {
      fs.writeFileSync(registrosPath, JSON.stringify(participaciones, null, 2));
      console.log('✅ Participación guardada correctamente en JSON');
      console.log('📁 Ruta del archivo:', registrosPath);
      console.log('📊 Tamaño del archivo:', fs.statSync(registrosPath).size, 'bytes');
    } catch (writeError) {
      console.error('❌ Error escribiendo archivo JSON:', writeError);
      throw writeError;
    }

    console.log('🎉 NUEVA PARTICIPACIÓN!');
    console.log(`📧 Email: ${participacion.email}`);
    console.log(`👤 Nombre: ${participacion.nombre}`);
    console.log(`📸 Archivos: ${archivosGuardados.length}`);
    console.log('─────────────────────────────────────');

    // Enviar emails de notificación
    console.log('📧 Intentando enviar emails...');
    Promise.all([
      enviarEmailNotificacion(participacion),
      enviarEmailConfirmacion(participacion)
    ]).then(([notificacionEnviada, confirmacionEnviada]) => {
      if (notificacionEnviada && confirmacionEnviada) {
        console.log('📧 Emails enviados correctamente');
      } else {
        console.log('⚠️  Algunos emails no se pudieron enviar');
      }
    }).catch(error => {
      console.log('⚠️  Error enviando emails:', error.message);
    });

    res.json({
      success: true,
      message: '¡Gracias por tu participación! Tus fotos han sido recibidas correctamente.',
      participacionId: participacion.id
    });

    console.log('✅ FINALIZADO: Procesamiento exitoso de participación');
  } catch (error) {
    console.error('❌ ERROR: Error procesando participación:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar la participación'
    });
  }
});

// Test del servidor
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Servidor funcionando correctamente' });
});

// Obtener carpetas principales
app.get('/api/coleccion/carpetas', (req, res) => {
  try {
    const coleccionDir = path.join(__dirname, '../public/assets/images/coleccion');
    let carpetas = [];

    if (fs.existsSync(coleccionDir)) {
      const directorios = fs.readdirSync(coleccionDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      carpetas = directorios.map(categoria => {
        const categoriaDir = path.join(coleccionDir, categoria);
        let totalFotos = 0;
        
        // Contar fotos directamente en la carpeta
        totalFotos += contarFotos(categoriaDir);
        
        // Contar fotos en subcarpetas
        const subcarpetas = fs.readdirSync(categoriaDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        subcarpetas.forEach(subcarpeta => {
          const subcarpetaDir = path.join(categoriaDir, subcarpeta);
          totalFotos += contarFotos(subcarpetaDir);
        });

        return {
          nombre: categoria,
          nombreFormateado: categoria.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          totalFotos: totalFotos
        };
      });
    }

    res.json({ success: true, carpetas });
  } catch (error) {
    console.error('Error al obtener carpetas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener carpetas' });
  }
});

// Obtener subcarpetas de una categoría
app.get('/api/coleccion/subcarpetas/:categoria', (req, res) => {
  try {
    const categoria = req.params.categoria;
    const categoriaDir = path.join(__dirname, '../public/assets/images/coleccion', categoria);
    let subcarpetas = [];

    if (fs.existsSync(categoriaDir)) {
      const directorios = fs.readdirSync(categoriaDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      subcarpetas = directorios.map(subcarpeta => {
        const subcarpetaDir = path.join(categoriaDir, subcarpeta);
        const totalFotos = contarFotos(subcarpetaDir);

        return {
          nombre: subcarpeta,
          nombreFormateado: subcarpeta.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          totalFotos: totalFotos,
          categoria: categoria
        };
      });
    }

    res.json({ success: true, subcarpetas });
  } catch (error) {
    console.error('Error al obtener subcarpetas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener subcarpetas' });
  }
});

// Obtener fotos de una carpeta
app.get('/api/coleccion/fotos/:carpeta', async (req, res) => {
  try {
    const carpeta = req.params.carpeta;
    const fotos = [];

    // Buscar la carpeta en todas las carpetas principales
    const coleccionDir = path.join(__dirname, '../public/assets/images/coleccion');
    const carpetasPrincipales = fs.readdirSync(coleccionDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    let carpetaEncontrada = false;

    // Buscar como subcarpeta
    for (const categoria of carpetasPrincipales) {
      const carpetaDir = path.join(coleccionDir, categoria, carpeta);
      if (fs.existsSync(carpetaDir)) {
        carpetaEncontrada = true;
        const archivos = fs.readdirSync(carpetaDir)
          .filter(archivo => {
            const ext = path.extname(archivo).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          });

        const fotosPromises = archivos.map(async (archivo, index) => {
          const info = obtenerInfoFoto(archivo, carpeta, categoria);
          
          // Generar miniatura
          const imagenPath = path.join(carpetaDir, archivo);
          let miniatura = null;
          
          const thumbnailPath = path.join(__dirname, '../public/assets/images/thumbnails', carpeta, archivo);
          if (fs.existsSync(thumbnailPath)) {
            miniatura = `assets/images/thumbnails/${carpeta}/${archivo}`;
          } else {
            generarMiniatura(imagenPath, carpeta, archivo).then(thumbnailUrl => {
              if (thumbnailUrl) console.log(`Miniatura generada para ${archivo}`);
            }).catch(error => {
              console.error(`Error generando miniatura para ${archivo}:`, error);
            });
          }

          return {
            id: `${carpeta}-${index}`,
            titulo: info.titulo,
            descripcion: `Fotografía de ${carpeta.replace(/_/g, ' ')}`,
            fecha: info.fecha,
            año: info.año,
            mes: info.mes,
            dia: info.dia,
            decada: info.decada,
            categoria: categoria,
            subcategoria: carpeta,
            localizacion: "aledo",
            personas: [],
            evento: carpeta.replace(/_/g, ' ').toUpperCase(),
            archivo: archivo,
            carpeta: carpeta,
            fechaSubida: new Date().toISOString().split('T')[0],
            coordenadas: { latitud: 37.7941, longitud: -1.5734 },
            estado: "publicada",
            imagen: `assets/images/coleccion/${categoria}/${carpeta}/${archivo}`,
            miniatura: miniatura || `assets/images/coleccion/${categoria}/${carpeta}/${archivo}`,
            audio: info.audio
          };
        });

        const fotosResult = await Promise.all(fotosPromises);
        fotos.push(...fotosResult);
        break;
      }
    }

    // Si no se encontró como subcarpeta, buscar como carpeta directa
    if (!carpetaEncontrada) {
      const carpetaDir = path.join(coleccionDir, carpeta);
      if (fs.existsSync(carpetaDir)) {
        const archivos = fs.readdirSync(carpetaDir)
          .filter(archivo => {
            const ext = path.extname(archivo).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          });

        const fotosPromises = archivos.map(async (archivo, index) => {
          const info = obtenerInfoFoto(archivo, carpeta);
          
          // Generar miniatura
          const imagenPath = path.join(carpetaDir, archivo);
          let miniatura = null;
          
          const thumbnailPath = path.join(__dirname, '../public/assets/images/thumbnails', carpeta, archivo);
          if (fs.existsSync(thumbnailPath)) {
            miniatura = `assets/images/thumbnails/${carpeta}/${archivo}`;
          } else {
            generarMiniatura(imagenPath, carpeta, archivo).then(thumbnailUrl => {
              if (thumbnailUrl) console.log(`Miniatura generada para ${archivo}`);
            }).catch(error => {
              console.error(`Error generando miniatura para ${archivo}:`, error);
            });
          }

          return {
            id: `${carpeta}-${index}`,
            titulo: info.titulo,
            descripcion: `Fotografía de ${carpeta.replace(/_/g, ' ')}`,
            fecha: info.fecha,
            año: info.año,
            mes: info.mes,
            dia: info.dia,
            decada: info.decada,
            categoria: carpeta,
            subcategoria: carpeta,
            localizacion: "aledo",
            personas: [],
            evento: carpeta.replace(/_/g, ' ').toUpperCase(),
            archivo: archivo,
            carpeta: carpeta,
            fechaSubida: new Date().toISOString().split('T')[0],
            coordenadas: { latitud: 37.7941, longitud: -1.5734 },
            estado: "publicada",
            imagen: `assets/images/coleccion/${carpeta}/${archivo}`,
            miniatura: miniatura || `assets/images/coleccion/${carpeta}/${archivo}`,
            audio: info.audio
          };
        });

        const fotosResult = await Promise.all(fotosPromises);
        fotos.push(...fotosResult);
      }
    }

    res.json({ success: true, fotos });
  } catch (error) {
    console.error('Error al obtener fotos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener fotos' });
  }
});

// Obtener estadísticas
app.get('/api/coleccion/stats', (req, res) => {
  try {
    const coleccionDir = path.join(__dirname, '../public/assets/images/coleccion');
    const stats = {
      totalFotos: 0,
      totalCarpetas: 0,
      porDecada: {},
      porCategoria: {},
      porLocalizacion: {},
      fotografos: []
    };

    if (fs.existsSync(coleccionDir)) {
      const carpetas = fs.readdirSync(coleccionDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      stats.totalCarpetas = carpetas.length;

      carpetas.forEach(categoria => {
        const categoriaDir = path.join(coleccionDir, categoria);
        
        // Contar fotos en la carpeta principal
        const fotosDirectas = fs.readdirSync(categoriaDir)
          .filter(archivo => {
            const ext = path.extname(archivo).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          });
        
        stats.totalFotos += fotosDirectas.length;
        stats.porCategoria[categoria] = (stats.porCategoria[categoria] || 0) + fotosDirectas.length;

        // Contar fotos en subcarpetas
        const subcarpetas = fs.readdirSync(categoriaDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        subcarpetas.forEach(subcarpeta => {
          const subcarpetaDir = path.join(categoriaDir, subcarpeta);
          const archivos = fs.readdirSync(subcarpetaDir)
            .filter(archivo => {
              const ext = path.extname(archivo).toLowerCase();
              return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            });
          
          stats.totalFotos += archivos.length;
          stats.porCategoria[categoria] = (stats.porCategoria[categoria] || 0) + archivos.length;
        });
      });
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    success: false, 
    message: error.message || 'Error interno del servidor' 
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('Variables de entorno configuradas correctamente');
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('Presiona Ctrl+C para detener el servidor');
});

// Manejar cierre del servidor
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(0);
  });
}); git 