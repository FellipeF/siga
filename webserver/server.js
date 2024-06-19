
const {
    blockchain,
    poolTransacoes,
    identidadeDigital,
    poolBlocos,
    poolPreparos,
    poolCommits,
    poolMensagens,
    validadores
} = require('./blockchain-setup');

//--------------------------------- MÓDULOS --------------------------------------------------//

const ServidorP2P = require('./servidorp2p');
const fs = require('fs');
const https = require('https');
const express = require('express');
const session = require('express-session')
const path = require('path');
const multer = require("multer");       //Para o upload de certificados e artigos
const r = require('rethinkdb'); //Banco de Dados para armazenamento dos arquivos PDF
const { PDFDocument } = require('pdf-lib')    //Leitura dos Artigos em PDF enviados
const { render } = require('ejs');

const Certificado = require('./resources/script/certificados');
const Banco = require('./resources/script/banco');

let idUser = null;
let totalArtigosUsuario = 0;

//--------------------------------- CONFIGURAÇÕES SERVIDOR-APP --------------------------------------------------//
const servidorP2P = new ServidorP2P(blockchain, poolTransacoes, identidadeDigital, poolBlocos, poolPreparos, poolCommits, poolMensagens, validadores);
const app = express();
app.use(express.json());
app.use(express.urlencoded(
    {
        extended: true
    }
))

//Arquivos estáticos - CSS, HTML, JS
app.use(express.static(path.join(__dirname, 'resources')));

/*
Sessão de usuário para não necessitar de autenticação contínua
Please note that secure: true is a recommended option. However, it requires an https-enabled website, i.e., HTTPS is necessary for secure cookies. 
If secure is set, and you access your site over HTTP, the cookie will not be set.
- https://expressjs.com/en/resources/middleware/session.html
*/

app.use(session(
    {
        secret: 'secret',
        resave: true,
        saveUninitialized: true
    }));


// Configurar rota básica - redirecionamento para página de Login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'resources', 'login.html'));
});

//Após rodar npm install ejs, é necessário setar o view engine, permitindo a renderização de componentes HTML com variáveis definidas pela sessão
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'resources', 'views'));

//Pasta de Uploads. Caso não exista, será criada quando o projeto for executado. Não remover durante execução para não causar Error: ENOENT: no such file or directory
const upload = multer({ dest: "uploads/" });

//Certificados para o Servidor Web
const chavePrivada = fs.readFileSync(path.resolve(__dirname, 'certificados/key.pem'));
const certificado = fs.readFileSync(path.resolve(__dirname, 'certificados/cert.pem'));

const credenciais = {
    key: chavePrivada,
    cert: certificado
};

//----------------------- SERVIDOR HTTPS -----------------------//

const server = https.createServer(credenciais, app);

//----------------------- UPLOAD DE CERTIFICADOS NA TELA INICIAL -----------------------//


// sends all transactions in the transaction pool to the user
app.get("/transactions", (req, res) => {
    res.json(poolTransacoes.transactions);
});

// sends the entire chain to the user
app.get("/blocks", (req, res) => {
    res.json(blockchain.chain);
});

// creates transactions for the sent data
app.post("/transact", (req, res) => {
    const { data } = req.body;
    const transaction = wallet.createTransaction(data);
    servidorP2P.broadcastTransaction(transaction);
    res.redirect("/transactions");
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'upload.html'));
});

// Rota para lidar com o upload de certificados
app.post('/upload', upload.single('certificate'), (req, res) => {

    if (!req.file) {
        res.status(500).send('Nenhum arquivo foi enviado.');
        return;
    }

    const caminhoArquivo = req.file.path;
    fs.readFile(caminhoArquivo, 'utf8', (err, data) => {
        if (err) {
            res.status(500).send('Erro ao ler o arquivo.');
            return;
        }

        //Callback: Manipulação do req dentro da função ao passá-lo como referência

        Certificado.lerCertificado(data, req, () => {
            res.redirect('/inicio');
        });

    });
});

//Rota para a página inicial. 

app.get('/inicio', async function (req, res) {

    if (req.session.loggedin) {

        const conexao = await Banco.conectarBanco();
        idUser = await Banco.logar(conexao, req);

        conexao.close();

        renderizarPagina(req.session.tipoUsuario, req, res);
    } else {
        res.send('Por favor, faça o login para visitar a página');
    }
});

async function renderizarPagina(tipoUsuario, req, res) {    //TODO: Implementar paginação
    let view;

    /*Os artigos que serão mostrados na página estarão sob controle da sessão:
    1) Administrador = Todos que ainda não possuem revisores atribuídos ou já retornaram do estado de revisão
    2) Revisor = Apenas os que foram atribuídos a ele
    3) Autor = Apenas os que foram escritos por ele
    */

    let artigos = await listarArtigos(req);

    if (tipoUsuario === 'autor') {
        view = 'inicio-autor';
    }
    else if (tipoUsuario === 'revisor') {
        view = 'revisor';
    }
    else if (tipoUsuario === 'administrador') {
        view = 'admin'
    }

    res.render(view, {
        artigos,
        nome: req.session.nome,
        username: req.session.username,
        tipoUsuario: req.session.tipoUsuario,
        email: req.session.email,
        total: totalArtigosUsuario
    })

}

async function listarArtigos(req) {

    totalArtigosUsuario = 0;
    //Recupera os artigos do Banco de Dados.

    const tabelaArtigos = 'artigos';
    const tabelaUsuarios = 'usuarios';
    const database = 'sistema';
    let artigos = [];

    try {
        const conexao = await Banco.conectarBanco();

        if (req.session.tipoUsuario === 'autor') {
            const cursor = await r.db(database).table(tabelaArtigos).filter({ autor: idUser }).run(conexao);

            const artigosCorrespondentes = await cursor.toArray();
            artigosCorrespondentes.forEach(artigo => {
                artigos.push(
                    {
                        id: artigo.id,
                        titulo: artigo.titulo,
                        palavrasChave: artigo.palavrasChave,
                        resumo: artigo.resumo,
                        status: artigo.status
                    }
                );
                totalArtigosUsuario++;
            }
            );

        } else if (req.session.tipoUsuario === 'administrador') {       //Se administrador, os artigos aparecem para atribuir revisores OU para aprovar/recusar com base em comentários

            const cursor = await r.db(database).table(tabelaArtigos).filter(article =>
                r.or(
                    article('revisoresAtribuidos').eq([]),
                    r.and(
                        article('revisoresAtribuidos').ne([]),
                        article('comentarios').count().eq(3)
                    )
                )
            ).run(conexao);

            const artigosCorrespondentes = await cursor.toArray();

            //Recuperação de E-mail dos revisores com base no ID
            for (const artigo of artigosCorrespondentes) {
                let revisoresEmails = [];
                if (artigo.revisoresAtribuidos.length === 3) {
                    const revisoresCursor = await r.db(database).table(tabelaUsuarios).getAll(r.args(artigo.revisoresAtribuidos)).pluck('email').run(conexao);
                    const revisores = await revisoresCursor.toArray();
                    revisoresEmails = revisores.map(revisor => revisor.email);
                }

                artigos.push({
                    id: artigo.id,
                    titulo: artigo.titulo,
                    palavrasChave: artigo.palavrasChave,
                    resumo: artigo.resumo,
                    revisores: revisoresEmails,
                    comentarios: artigo.comentarios,
                    estado: artigo.estados
                });

            }
        }
        else {
            const cursor = await r.db(database).table(tabelaArtigos).filter(r.row('revisoresAtribuidos').contains(idUser)).run(conexao);

            const artigosCorrespondentes = await cursor.toArray();
            artigosCorrespondentes.forEach(artigo => {
                artigos.push(
                    {
                        id: artigo.id,
                        titulo: artigo.titulo,
                        palavrasChave: artigo.palavrasChave,
                        resumo: artigo.resumo
                    }
                )
            })
        }

        await conexao.close();
    } catch (error) {
        console.error('Erro ao listar artigos:', error);
    }

    return artigos;

}

app.get('/consultar-artigos', async function (req, res) {
    const artigos = await listarArtigos(req);

    res.render('consultar-artigos', {
        artigos,
        nome: req.session.nome,
        username: req.session.username,
        tipoUsuario: req.session.tipoUsuario,
        email: req.session.email
    })
});

app.get('/enviar-artigos', async function (req, res) {

    if (req.session.loggedin) {
        res.render('enviar-artigos', {
            nome: req.session.nome,
            username: req.session.username,
            tipoUsuario: req.session.tipoUsuario,
            email: req.session.email
        })
    }
    else {
        res.send('Por favor, faça o login para visitar a página');
    }
});

app.post('/upload-pdf', upload.single('pdfFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo foi enviado.');
    }

    const pdfPath = req.file.path;

    fs.readFile(pdfPath, async (err) => {
        if (err) {
            return res.status(500).send('Erro ao ler o arquivo.');
        }

        // Recupera campos que serão inseridos na blockchain
        const { pdfTitle, pdfKeywords, resumo } = req.body;

        const pdfBytes = await fs.promises.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        //Criando nova transação para inserção no Bloco
        const data =
        {
            idAutor: idUser,
            idRevisores: '',        //Vazio, que o administrador ainda necessitará atribuir revisores
            timestampCriacao: Date.now(),
            titulo: pdfTitle,
            palavrasChave: pdfKeywords,
            paginas: pdfDoc.getPageCount(),
            resumo: resumo,
            comentarios: '',         //Também vazios, pois os comentários e estados serão deixados pelos revisores
            estados: ''
        };


        const transacao = identidadeDigital.createTransaction(data);
        servidorP2P.broadcastTransaction(transacao);

        const conexao = await Banco.conectarBanco();
        await Banco.inserirArtigo(conexao, pdfBytes, transacao.getID(), idUser, pdfTitle, pdfKeywords, resumo, pdfDoc.getPageCount());
        conexao.close();

        renderizarPagina(req.session.tipoUsuario, req, res);

        //Usuário 1: 2533a4b6-a2f1-4c2c-8df9-bd66c6809c9f
        //Usuário 2: c3494411-bd5f-4d8a-bbff-c4521b948fc7

        /*if (blockchain.chain.length == 4) {
            const indice = 1; // Índice do bloco a ser modificado
            const novoAutor = 'c3494411-bd5f-4d8a-bbff-c4521b948fc7'; // Substitui pela ID do usuário 2, por exemplo

            servidorP2P.modificarBloco(indice, novoAutor)
        } */
    });
});

//----------------------- ATRIBUIÇÃO DE REVISORES ATRAVÉS DO E-MAIL VIA PAINEL DE ADMINISTRAÇÃO -----------------------//

app.post('/atribuir-revisores', async (req, res) => {

    //No momento, assume-se  que todos os 3 revisores estejam com seus respectivos cadastros no banco de dados.

    const { artigoId, revisor1, revisor2, revisor3 } = req.body;
    const tabelaArtigos = 'artigos';
    const tabelaUsuarios = 'usuarios';
    const database = 'sistema';
    const revisores = [];


    try {
        const conexao = await Banco.conectarBanco();
        const cursorArtigo = await r.db(database).table(tabelaArtigos).filter({ id: artigoId }).run(conexao);     //Como está armazenando via UUID, fazer "get" dá erro porque encontra um Objeto
        const artigoProcurado = await cursorArtigo.toArray();

        const cursorRevisores = await r.db(database).table(tabelaUsuarios)
            .filter(r.row("email").eq(revisor1)
                .or(r.row("email").eq(revisor2))
                .or(r.row("email").eq(revisor3)))
            .run(conexao);

        const revisoresCorrespondentes = await cursorRevisores.toArray();

        revisoresCorrespondentes.forEach(revisor => {
            revisores.push(revisor.id);
        })

        //Prepara transação para ser colocada na blockchain

        const data =
        {
            idAutor: artigoProcurado[0].autor,
            idRevisores: revisores,
            timestampCriacao: Date.now(),
            titulo: artigoProcurado[0].titulo,
            palavrasChave: artigoProcurado[0].palavrasChave,
            paginas: artigoProcurado[0].paginas,
            resumo: artigoProcurado[0].resumo,
            comentarios: '',         //Ainda vazio, pois os comentários serão deixados pelos revisores
            estados: ''
        };

        const transacao = identidadeDigital.createTransaction(data);
        servidorP2P.broadcastTransaction(transacao);
        await r.db(database).table(tabelaArtigos).filter({ id: artigoId }).update({ revisoresAtribuidos: revisores }).run(conexao);

        res.send('Atribuiu corretamente');

    } catch (error) {
        console.error('Erro na atribuição dos revisores', error);
        res.status(500).send('Erro ao atribuir revisores. Tente novamente mais tarde.')
    }
})

//Página para revisar artigos individualmente

app.get('/revisar-artigo', async (req, res) => {

    const database = 'sistema';
    const tabelaArtigos = 'artigos';

    try {
        const conexao = await Banco.conectarBanco();
        const cursor = await r.db(database).table(tabelaArtigos).filter({ id: req.query.id }).run(conexao);

        const artigoProcurado = await cursor.toArray();

        const artigo =
        {
            id: req.query.id,
            idRevisores: artigoProcurado[0].revisoresAtribuidos,
            titulo: artigoProcurado[0].titulo,
            palavrasChave: artigoProcurado[0].palavrasChave,
            paginas: artigoProcurado[0].paginas,
            resumo: artigoProcurado[0].resumo
        }

        res.render('revisar-artigo', { artigo: artigo });

    }
    catch (error) {
        console.error('Erro ao recuperar detalhes', error);
        res.status(500).send('Algo deu errado');
    }

});

app.get('/baixar-artigo', async (req, res) => {

    const tabelaArtigos = 'artigos';
    const conexao = await Banco.conectarBanco();
    const idArtigo = req.query.id;
    const titulo = req.query.titulo;

    try {
        let cursorArtigo = await r.table(tabelaArtigos).filter({ id: idArtigo }).pluck('conteudo').run(conexao);
        let artigoArray = await cursorArtigo.toArray();
        const conteudo = artigoArray[0].conteudo;

        const nome = titulo + ".pdf";

        res.setHeader('Content-Disposition', 'attachment; filename=' + nome);
        res.setHeader('Content-Type', 'application/pdf');

        res.send(conteudo);

    } catch (error) {
        console.error('Erro ao recuperar e baixar artigo:', error);
    } finally {
        if (conexao) await conexao.close();
    }
});

app.post('/enviar-comentarios', async (req, res) => {
    const { artigoId, comentarios, estado } = req.body;
    const database = 'sistema';
    const tabelaArtigos = 'artigos';
    let todosComentarios = [];
    let todosEstados = [];

    try {
        const conexao = await Banco.conectarBanco();
        const cursor = await r.db(database).table(tabelaArtigos).filter({ id: artigoId }).run(conexao);

        const artigoProcurado = await cursor.toArray();

        if (artigoProcurado.length > 0) {
            const artigo = artigoProcurado[0];

            // Inicializa os arrays se estiverem indefinidos
            todosComentarios = artigo.comentarios || [];
            todosEstados = artigo.estados || [];

            todosComentarios.push(comentarios);
            todosEstados.push(estado);

            // Prepara transação para ser colocada na blockchain
            const data = {
                idAutor: artigo.autor,
                idRevisores: artigo.revisoresAtribuidos,
                timestampCriacao: Date.now(),
                titulo: artigo.titulo,
                palavrasChave: artigo.palavrasChave,
                paginas: artigo.paginas,
                resumo: artigo.resumo,
                comentarios: todosComentarios,
                estados: todosEstados
            };

            const transacao = identidadeDigital.createTransaction(data);
            servidorP2P.broadcastTransaction(transacao);
            await r.db(database).table(tabelaArtigos).filter({ id: artigoId }).update({ comentarios: todosComentarios, estados: todosEstados }).run(conexao);

            await conexao.close();
            res.end();
        } else {
            throw new Error('Artigo não encontrado');
        }
    }
    catch (error) {
        console.error('Erro ao recuperar informações do formulário', error);
    }
})

app.post('/conferir-status', async (req, res) => {
    const { artigoId, status } = req.body;
    const database = 'sistema';
    const tabelaArtigos = 'artigos';

    //Prepara uma nova transação para ser colocada na blockchain

    const data =
    {
        idArtigo: artigoId,
        status: status
    }

    const transacao = identidadeDigital.createTransaction(data);
    servidorP2P.broadcastTransaction(transacao);

    const conexao = await Banco.conectarBanco();
    await r.db(database).table(tabelaArtigos).filter({ id: artigoId }).update({ status: status }).run(conexao);
    conexao.close();

    res.status(200).send(`Artigo ${status} com sucesso!`);
});


module.exports = {
    server,
    servidorP2P
};