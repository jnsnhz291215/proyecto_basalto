// Script para verificar y crear tablas de autenticación
const { pool } = require('./ejemploconexion.js');

async function verificarYCrearTablas() {
  try {
    console.log('\n=== VERIFICANDO BASE DE DATOS ===\n');

    // Verificar tabla admin_users
    console.log('1. Verificando tabla admin_users...');
    try {
      const [adminUsers] = await pool.execute('SELECT COUNT(*) as total FROM admin_users');
      console.log(`   ✓ Tabla admin_users existe. Registros: ${adminUsers[0].total}`);
    } catch (err) {
      console.log('   ✗ Tabla admin_users NO existe');
      console.log('   Creando tabla admin_users...');
      await pool.execute(`
        CREATE TABLE admin_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rut VARCHAR(12) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          nombres VARCHAR(100),
          apellido_paterno VARCHAR(100),
          apellido_materno VARCHAR(100),
          email VARCHAR(100),
          activo TINYINT(1) DEFAULT 1,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rut (rut)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla admin_users creada');
      
      // Insertar admin por defecto
      await pool.execute(`
        INSERT INTO admin_users (rut, password, nombres, apellido_paterno, apellido_materno, email)
        VALUES ('123456789', 'admin123', 'Administrador', 'Sistema', 'Basalto', 'admin@basalto.cl')
      `);
      console.log('   ✓ Admin creado: RUT=123456789, Password=admin123');
    }

    // Verificar tabla users
    console.log('\n2. Verificando tabla users...');
    try {
      const [users] = await pool.execute('SELECT COUNT(*) as total FROM users');
      console.log(`   ✓ Tabla users existe. Registros: ${users[0].total}`);
      
      if (users[0].total === 0) {
        console.log('\n   ⚠ La tabla users está vacía.');
        console.log('   ¿Deseas importar trabajadores desde la tabla trabajadores? (edita este script)');
      }
    } catch (err) {
      console.log('   ✗ Tabla users NO existe');
      console.log('   Creando tabla users...');
      await pool.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rut VARCHAR(12) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          nombres VARCHAR(100),
          apellido_paterno VARCHAR(100),
          apellido_materno VARCHAR(100),
          email VARCHAR(100),
          activo TINYINT(1) DEFAULT 1,
          fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rut (rut)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('   ✓ Tabla users creada');
    }

    // Mostrar todos los usuarios
    console.log('\n=== USUARIOS EXISTENTES ===\n');
    
    console.log('ADMINISTRADORES:');
    const [admins] = await pool.execute('SELECT rut, nombres, apellido_paterno, apellido_materno FROM admin_users WHERE activo = 1');
    if (admins.length === 0) {
      console.log('  (ninguno)');
    } else {
      admins.forEach(a => {
        const nombre = `${a.nombres || ''} ${a.apellido_paterno || ''} ${a.apellido_materno || ''}`.trim();
        console.log(`  - RUT: ${a.rut} | Nombre: ${nombre}`);
      });
    }

    console.log('\nTRABAJADORES CON ACCESO:');
    const [workers] = await pool.execute('SELECT rut, nombres, apellido_paterno, apellido_materno FROM users WHERE activo = 1 LIMIT 10');
    if (workers.length === 0) {
      console.log('  (ninguno)');
    } else {
      workers.forEach(w => {
        const nombre = `${w.nombres || ''} ${w.apellido_paterno || ''} ${w.apellido_materno || ''}`.trim();
        console.log(`  - RUT: ${w.rut} | Nombre: ${nombre}`);
      });
      if (workers.length === 10) {
        const [total] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE activo = 1');
        console.log(`  ... y ${total[0].total - 10} más`);
      }
    }

    console.log('\n=== VERIFICACIÓN COMPLETA ===\n');
    
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    process.exit(0);
  }
}

verificarYCrearTablas();
