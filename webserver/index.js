process.title = 'ServidorWebTCCDois';

const { server, servidorP2P } = require('./server');

const httpsPort = process.env.HTTPS_PORT || 8443;

// Iniciando o servidor HTTPS
server.listen(httpsPort, () => {
    console.log(`Servidor HTTPS rodando na porta ${httpsPort}`);
});

servidorP2P.listen();