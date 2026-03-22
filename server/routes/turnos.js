const express = require('express');
const router = express.Router();
const { isWorkerOnShiftToday } = require('../helpers/shiftValidation');

// ============================================
// ENDPOINT: CHECK SI EL TRABAJADOR TIENE TURNO HOY
// ============================================
router.get('/check-hoy/:rut', async (req, res) => {
  try {
    const { rut } = req.params;
    
    if (!rut) {
      return res.status(400).json({ error: 'Falta parametro RUT', onShift: false });
    }

    // Usar la función helper
    const onShift = await isWorkerOnShiftToday(rut);
    
    res.json({
      success: true,
      rut: rut,
      onShift: onShift
    });

  } catch (error) {
    console.error('[API] Error verificando turno:', error);
    res.status(500).json({ error: 'Error interno verificando el turno', onShift: false });
  }
});

module.exports = router;
