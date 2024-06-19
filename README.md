
# Sistema de Gerenciamento de Artigos

## Pré-Requisitos

### 1) Criação de Certificados Digitais X.509 v3

O acesso à aplicação é feito mediante certificados digitais X.509 v3 no formato .pem. O campo estendido com OID 1.2.3.4.5.6.7.1 é utilizado para controlar o acesso dos três tipos de usuário:

| Usuário | Função |
|---------|--------|
|Administrador | Atribui revisores e aprova/rejeita artigos baseado no feedback deles|
|Revisor | Revisa o artigo que foi atribuído a ele |
|Autor | Faz o upload de um artigo para ser revisado |


#### Observação:

* É necessário que três revisores façam comentários sobre o artigo antes do mesmo aparecer na tela de administrador para aprovação/rejeição.
* Para realização de testes, estão disponibilizados alguns certificados digitais na pasta testes-certificados, criptografados com curvas elípticas. Eles podem ser conferidos através do seguinte comando:

```
openssl x509 -noout -text -in seuCertificado.cert.pem
```

### 2) Criação do Banco de Dados no RethinkDB

O projeto utiliza o RethinkDB para armazenar os arquivos que são enviados pelo usuário. Cada usuário também possui uma ID única que será sua representação na blockchain a fim de preservar a identidade dos autores como dita o sistema de revisão por pares duplo-cego.

## Sobre o Servidor HTTPS

O servidor HTTPS de testes já contém uma chave privada e certificado digital associado, localizado na pasta

```
/webserver/certificados
```

Como é apenas um servidor criado para motivos de teste e instanciado em localhost, a chave privada associada está sendo divulgada livremente.

## Tecnologia de Livro-Razão Distribuído

Para preservar a integridade dos artigos, o sistema é construído como uma solução blockchain utilizando o algoritmo de consenso pBFT. A quantidade de nós utilizados e o limite de transações colocadas em uma pool antes do início da rodada de consenso são definidos no arquivo localizado em:

```
resources/blockchain/config.js
```

É possível conferir a pool de transações e os blocos adicionados à blockchain nos respectivos endpoints.

```
https://localhost:8443/blocks
https://localhost:8443/transactions

```

* A implementação do algoritmo é crédito de: [Kashish Khullar](https://medium.com/coinmonks/implementing-pbft-in-blockchain-12368c6c9548)

## Rede P2P
Para que os nós se comuniquem entre si via WebSocket para transmitir as mensagens conforme o funcionamento do pBFT, primeiro é necessária a inicialização dos mesmos. Atualmente, é passada uma semente (SECRET) que gera um par de chaves para que as mensagens enviadas sejam assinadas e conferidas seguindo o padrão de criptografia assimétrica.


* Inicialização do primeiro nó:

```
SECRET="NODE0" P2P_PORT=5000 HTTPS_PORT=8443 nodemon index.js
```

* Inicialização do segundo nó: 

```
SECRET="NODE1" P2P_PORT=5001 HTTPS_PORT=8444 PEERS=ws://localhost:5000 nodemon index.js
```

O restante dos nós deverão seguir a mesma condição. A variável PEERS são os nós previamente conectados, então para inicializar o terceiro nó, por exemplo, basta separar por vírgula os pares:

```
SECRET="NODE2" P2P_PORT=5002 HTTPS_PORT=8445 PEERS=ws://localhost:5001,ws://localhost:5000 nodemon index.js
```

## TODO

Ainda há algumas melhorias a serem feitas no projeto, como por exemplo:

* Implementar a recuperação dos dados imutáveis da blockchain ao invés do banco de dados;
* Utilizar máquinas virtuais ou reais para validar a comunicação entre os WebSockets dos diferentes participantes em diferentes redes;
* Utilizar o par de chaves do próprio usuário ao invés de utilizar a passagem de parâmetro via terminal para criação de um. Feito isso, também é necessário garantir que a chave pública seja distribuída de forma correta entre os participantes;
* Tornar a blockchain não-efêmera para caso haja problemas de disponibilidade com os nós participantes;
* Criar uma lista de certificados revogados e autorizados para controlar acesso;
* Melhorar a navegação e layout dentro da aplicação construída.
