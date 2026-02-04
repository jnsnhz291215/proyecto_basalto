<?php
// reporte_trabajadores.php
// Conecta a la misma base de datos y genera un Excel (CSV) descargable

$dbHost = getenv('DB_HOST') ?: '100.100.40.80';
$dbUser = getenv('DB_USER') ?: 'turnos_app';
$dbPass = getenv('DB_PASSWORD') ?: 'Basalto1974';
$dbName = getenv('DB_NAME') ?: 'basalto';
$dbPort = getenv('DB_PORT') ?: 3306;

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) {
    header('HTTP/1.1 500 Internal Server Error');
    echo 'DB connection error: ' . htmlspecialchars($e->getMessage());
    exit;
}

// Query para obtener todos los trabajadores de trabajadoresTest2
$stmt = $pdo->prepare('SELECT RUT, nombres, apellido_paterno, apellido_materno, email, telefono, id_grupo, cargo FROM trabajadoresTest2');
$stmt->execute();
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Preparar CSV
$filename = 'trabajadores_' . date('Ymd_His') . '.csv';
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
// output BOM for Excel compatibility with UTF-8
echo chr(0xEF) . chr(0xBB) . chr(0xBF);

$out = fopen('php://output', 'w');
// Cabeceras
fputcsv($out, ['RUT', 'Nombres', 'Apellido Paterno', 'Apellido Materno', 'Email', 'Telefono', 'Id Grupo', 'Cargo']);

foreach ($rows as $r) {
    fputcsv($out, [$r['RUT'], $r['nombres'], $r['apellido_paterno'], $r['apellido_materno'], $r['email'], $r['telefono'], $r['id_grupo'], $r['cargo']]);
}
fclose($out);
exit;

?>