const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'mariadb',
  user: 'turnos_app',
  password: 'Basalto1974',
  database: 'basalto'
});

module.exports = pool;

app.get('/api/turnos', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM turnos');
  res.json(rows);
});
