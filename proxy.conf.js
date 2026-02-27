const PROXY_CONFIG = {
  "/api": {
    "target": "https://wsautenticacionside.devida.gob.pe",
    "secure": false,
    "changeOrigin": true
  },
  "/geodais/api": {
    "target": getTarget(),
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": {
      "^/geodais": ""
    }
  }
};

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

module.exports = PROXY_CONFIG;
