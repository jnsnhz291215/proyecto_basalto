require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../database.js');

/**
 * Script para recrear usuarios de trabajadores
 * 
 * Este script lee todos los trabajadores existentes y crea/actualiza
 * sus cuentas de usuario con la contraseña inicial basada en los 
 * últimos 4 dígitos del RUT (sin DV).
 * 
 * Uso: node server/scripts/recreate-users.js
 */

function limpiarRUT(rut) {
  return String(rut || '').replace(/[.\-\s]/g, '').trim().toUpperCase();
}

function generarPasswordBase(rutLimpio) {
  // Remover el DV (último carácter)
  const rutSinDv = rutLimpio.length > 1 ? rutLimpio.slice(0, -1) : '';
  // Extraer solo dígitos
  const cuerpoNumerico = rutSinDv.replace(/\D/g, '');
  // Tomar últimos 4 dígitos
  const passwordBase = cuerpoNumerico.length > 4 
    ? cuerpoNumerico.slice(-4) 
    : cuerpoNumerico;
  
  return passwordBase;
}

async function recreateUsers() {
  let connection;
  
  try {
    console.log('🔄 Iniciando recreación de usuarios...\n');
    
    connection = await pool.getConnection();
    
    // Obtener todos los trabajadores activos
    const [trabajadores] = await connection.execute(
      `SELECT 
        RUT, 
        nombres, 
        apellido_paterno, 
        apellido_materno, 
        email,
        activo
      FROM trabajadores
      ORDER BY RUT`
    );
    
    if (!trabajadores || trabajadores.length === 0) {
      console.log('⚠️  No se encontraron trabajadores en la base de datos.');
      return;
    }
    
    console.log(`📋 Se encontraron ${trabajadores.length} trabajadores.\n`);
    
    let creados = 0;
    let actualizados = 0;
    let errores = 0;
    
    for (const trabajador of trabajadores) {
      const { RUT, nombres, apellido_paterno, apellido_materno, email, activo } = trabajador;
      
      try {
        const rutLimpio = limpiarRUT(RUT);
        
        if (!rutLimpio || rutLimpio.length < 2) {
          console.log(`❌ [${RUT}] RUT inválido - Omitiendo`);
          errores++;
          continue;
        }
        
        // Generar password base (últimos 4 dígitos del RUT sin DV)
        const passwordBase = generarPasswordBase(rutLimpio);
        
        if (!passwordBase || passwordBase.length < 4) {
          console.log(`❌ [${RUT}] No se pudo generar password base (requiere al menos 4 dígitos) - Omitiendo`);
          errores++;
          continue;
        }
        
        // Hashear password con bcrypt (10 rounds)
        const passwordHash = await bcrypt.hash(passwordBase, 10);
        
        // Verificar si el usuario ya existe
        const [existingUsers] = await connection.execute(
          'SELECT id_user FROM users WHERE rut = ?',
          [RUT]
        );
        
        const existe = existingUsers && existingUsers.length > 0;
        
        // Insertar o actualizar usuario
        // Nota: Si el usuario existe y quieres actualizar la contraseña, 
        // cambia "password = password" por "password = VALUES(password)"
        await connection.execute(
          `INSERT INTO users (rut, nombres, apellido_paterno, apellido_materno, email, password, activo) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             nombres = VALUES(nombres),
             apellido_paterno = VALUES(apellido_paterno),
             apellido_materno = VALUES(apellido_materno),
             email = VALUES(email),
             activo = VALUES(activo),
             password = password`,
          [
            RUT,
            nombres,
            apellido_paterno,
            apellido_materno,
            email,
            passwordHash,
            activo
          ]
        );
        
        if (existe) {
          console.log(`✅ [${RUT}] ${nombres} ${apellido_paterno || ''} - Usuario actualizado`);
          actualizados++;
        } else {
          console.log(`✨ [${RUT}] ${nombres} ${apellido_paterno || ''} - Usuario creado (password: últimos 4 dígitos)`);
          creados++;
        }
        
      } catch (error) {
        console.log(`❌ [${RUT}] Error procesando: ${error.message}`);
        errores++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN:');
    console.log(`   ✨ Usuarios creados: ${creados}`);
    console.log(`   ✅ Usuarios actualizados: ${actualizados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📋 Total procesados: ${trabajadores.length}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Proceso completado exitosamente.\n');
    console.log('💡 Nota: Los usuarios pueden iniciar sesión con:');
    console.log('   - Usuario: Su RUT (con o sin puntos/guión)');
    console.log('   - Contraseña: Últimos 4 dígitos de su RUT (sin DV)\n');
    
  } catch (error) {
    console.error('❌ Error fatal:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Ejecutar script
recreateUsers()
  .then(() => {
    console.log('🎉 Script finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error ejecutando script:', error);
    process.exit(1);
  });
