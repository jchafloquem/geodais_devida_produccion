function getTarget() {
  // Capturamos el argumento --configuration de la terminal
  const argv = process.argv;

  if (argv.includes('qa')) {
    console.log('>>> PROXY: Apuntando a QA (sisqa)');
    return "https://sisqa.devida.gob.pe";
  } else if (argv.includes('production')) {
    console.log('>>> PROXY: Apuntando a PRODUCCION (sistemas)');
    return "https://sistemas.devida.gob.pe";
  }

  console.log('>>> PROXY: Apuntando a LOCAL (8080)');
  return "http://localhost:8080";
}

const target = getTarget();
const isLocal = target.includes('localhost');

const PROXY_CONFIG = {
  "/layers": {
    "target": target,
    "secure": false,
    "logLevel": "debug",
    "bypass": function (req, res, proxyOptions) {
      console.log('>>> PROXY: Silenciando error fantasma en /layers');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ currentVersion: 10.81, layers: [] }));
      return true;
    }
  },
  "/api": {
    "target": "https://wsautenticacionside.devida.gob.pe",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  },
  "/geodais/api": {
    "target": target,
    "secure": false,
    "changeOrigin": true,
    // Si el backend local corre en la raíz (sin /geodais), esto elimina ese prefijo de la URL.
    // Para QA y Prod, donde la URL base sí incluye /geodais, no se aplica ninguna reescritura.
    "pathRewrite": isLocal ? { "^/geodais": "" } : undefined,
    "logLevel": "debug"
  }
};

module.exports = PROXY_CONFIG;
