//Esse arquivo trata das operações com o Banco de Dados RethinkDB

const r = require('rethinkdb');

const banco = 'sistema';
const tabelaArtigos = 'artigos';
const tabelaUsuarios = 'usuarios';

//----------------------- CONEXÃO -----------------------//

async function conectarBanco() {
    try {
        const conexao = await r.connect(
            {
                host: 'localhost',
                port: 28015,
                db: banco
            }
        );

        //Salva alguns cliques. O banco já existe? Não. Então, cria ao invés de ter que ir no RethinkDB.

        try {
            const bd = await r.dbList().run(conexao);
            if (!bd.includes(banco)) {
                await r.dbCreate(banco).run(conexao)
                await r.db(banco).tableCreate(tabelaArtigos).run(conexao);
                await r.db(banco).tableCreate(tabelaUsuarios).run(conexao);
            }
        } catch (error) {
            console.error('Erro na criação do banco de Dados');
            throw error;
        }
        return conexao;
    } catch (error) {
        console.error('Erro ao se conectar com o Banco de Dados', error);
        throw error;
    }
}

//----------------------- OPERAÇÕES DE USUÁRIOS -----------------------//

async function logar(conexao, req) {
    try {
        let cursor = await r.table(tabelaUsuarios).filter({ email: req.session.email }).run(conexao);
        let usuario = await cursor.toArray();
        if (usuario.length === 0) {
            //Não encontrou, insere no Banco junto com o UUID e nome.

            await r.table(tabelaUsuarios).insert(
                {
                    nome: req.session.nome,
                    email: req.session.email,
                }
            ).run(conexao);

            //Agora que inseriu, refaz a consulta e atualiza o usuario a fim de recuperar o id. Previne erro de TypeError em primeiro acesso.

            cursor = await r.table(tabelaUsuarios).filter({ email: req.session.email }).run(conexao);
            usuario = await cursor.toArray();
            
        }
        return usuario[0].id;
    }
    catch (error) {
        console.error('Erro ao inserir Usuário', error);
    }
}

//----------------------- OPERAÇÕES DE ARTIGOS -----------------------//

async function inserirArtigo(conexao, bytes, idTransacao, idUser, titulo, palavrasChave, resumo, paginas) {

    //Adaptar assim que a recuperação dos metadados for resolvida pela blockchain para evitar redundância de dados.
    try {
        await r.table(tabelaArtigos).insert(
            {
                id: idTransacao,
                autor: idUser,
                titulo: titulo,
                palavrasChave: palavrasChave,
                resumo: resumo,
                conteudo: bytes,
                paginas: paginas,
                revisoresAtribuidos: [],
                comentarios: [],
                estados: [],
                status: 'ainda não definido'
            }
        ).run(conexao);

        console.log('Artigo inserido com sucesso!');
    } catch (error)
    {
        console.error('Erro ao inserir o artigo', error);
    }
}

module.exports = { conectarBanco, logar, inserirArtigo };