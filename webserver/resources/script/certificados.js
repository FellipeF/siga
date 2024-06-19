//Esse arquivo lida com o que é referente aos certificados digitais X.509 v3 que são utilizados pelo usuário.

const { Certificate } = require('@fidm/x509');    //https://github.com/fidm/x509 ----> Instalar via npm i --save @fidm/x509 (Para a leitura dos certificados)

function lerCertificado(data, req, callback) {

    /*TODO: 
    Verificar se é um certificado digital X.509 v3 que está sendo enviado como arquivo ao invés de outro para previnir erro
    Verificar Autoridade Certificadora para ver se é válida
    Verificar se o certificado não está expirado.
    Verificar se o Certificado não consta na lista de Certificados Revogados
    */

    //Logou
    req.session.loggedin = true

    //Leitura do certificado
    certificadoUsuario = Certificate.fromPEM(data)

    /* Analisa a OOID 1.2.3.4.5.6.7.1 que foi definida como Tipo de Usuário no momento da geração do certificado
    Como está armazenado como Buffer, retorna em UTF-8, remove espaços e caracteres de controle que possam ser gerados
    Além disso, pega somente "Autor", "Revisor" ou "Administrador" do campo estendido "Tipo de Usuário"
    */

    const campoEstendido = (certificadoUsuario.getExtension('1.2.3.4.5.6.7.1').value.toString('utf8').trim().replace(/[^\x20-\x7E]/g, '')).replace('Tipo de Usuario:', '').toLowerCase();

    //const campoEstendidoLimpo = campoEstendido.replace;

    //Recupera o Common Name, cria um login - o CN sem espaços - e verifica se é autor ou revisor

    let usuario = certificadoUsuario.subject.commonName.replace(/\s/g, "")
    const email = certificadoUsuario.subject.attributes.find(attr => attr.shortName === 'E').value;

    req.session.nome = certificadoUsuario.subject.commonName;
    req.session.username = usuario.toLowerCase();
    req.session.tipoUsuario = campoEstendido;
    req.session.email = email;

    callback();
}

module.exports = { lerCertificado }; 