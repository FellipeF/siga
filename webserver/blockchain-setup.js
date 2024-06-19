//--------------------------------- ARQUIVOS BLOCKCHAIN E INSTANCIAÇÕES --------------------------------------------------//

const IdentidadeDigital = require('./resources/blockchain/wallet');
const PoolTransacao = require('./resources/blockchain/transaction-pool');
const Validadores = require('./resources/blockchain/validators');
const Blockchain = require('./resources/blockchain/blockchain');
const PoolBloco = require('./resources/blockchain/block-pool');
const PoolCommit = require('./resources/blockchain/commit-pool');
const PoolPreparo = require('./resources/blockchain/prepare-pool');
const PoolMensagem = require('./resources/blockchain/message-pool');
const { NUMBER_OF_NODES } = require('./resources/blockchain/config');

const identidadeDigital = new IdentidadeDigital(process.env.SECRET);
const poolTransacoes = new PoolTransacao();
const validadores = new Validadores(NUMBER_OF_NODES);
const blockchain = new Blockchain(validadores);
const poolBlocos = new PoolBloco();
const poolPreparos = new PoolPreparo();
const poolCommits = new PoolCommit();
const poolMensagens = new PoolMensagem();

module.exports = {
  blockchain,
  poolTransacoes,
  identidadeDigital,
  poolBlocos,
  poolPreparos,
  poolCommits,
  poolMensagens,
  validadores
};