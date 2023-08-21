'use strict';
const moduleName = 'server.js';

// ---------------------------------------------------------------------------------------------------------------------
// Please be aware:
//    - This code is not created with a performance, security or failure recovery focus;
//    - Authentication is omitted;
//    - Server answer requests on HTTP and not HTTPS
//    - No pagination is used for large amount of data
//    - All data is returned with no criteria and no filtering
//    - Database collections do not have any indexes
//    - Some error handling is omitted
// ---------------------------------------------------------------------------------------------------------------------

const common = require('./common.js');
const db = require('./db.js');

const express = require('express');
const http = require("http");

const farms = require('./controllers/farms.js');
const farmers = require('./controllers/farmers.js')
const milk = require('./controllers/milk.js')

const serverPort = 3001;
const dbUri = "mongodb://127.0.0.1:27017/desafioBov"

process.on('unhandledRejection', function (reason, promise) {
    common.log(moduleName, 'unhandledRejection', 'Promise "' +  promise + ' rejected. Reason: ' + reason);
});

process.on('uncaughtException', function (err) {
    common.log(moduleName, 'process.uncaughtException', err);
    throw err;
});

function _renderSwagger(req, res){
    common.log(moduleName, '_renderSwagger', 'Rendering swagger files');
    return common.REST.NOT_IMPLEMENTED(res, moduleName, '_renderSwagger');
}

function startServer(){

    common.log(moduleName, 'startServer', 'Starting server...');

    common.log(moduleName, 'startServer', '   Setting up database...');
    return db.setup(dbUri)
        .then(function () {

            let app = express();

            app.on('uncaughtException', function (req, res, route, error){
                common.log(moduleName, 'app.uncaughtException', error);
                throw error;
            });

            common.log(moduleName, 'startServer', '      Using express json middleware...');
            app.use(express.json());

            common.log(moduleName, 'startServer', '      Using a dummy logger middleware...');
            app.use(function (req, res, next) {
                try {
                    let data = req.method + ' ' + req.url + '';
                    common.log(moduleName, 'startServer', 'Logging: ' + data + '.');
                }catch (ex) {
                    common.log(moduleName, 'startServer', 'Logger - Failed: ' + ex.message);
                }
                return next();
            });

            common.log(moduleName, 'startServer', '      Configuring routes...');

            //Generic routes:
            app.route('/')
                .get(_renderSwagger);

            //Farms routes:
            app.route('/farms')
                .get(farms.list)
                .post(farms.create);
            app.route('/farms/:farmId')
                .get(farms.read)
                .put(farms.update)
                .delete(farms.delete);

            // Farmers routes:
            app.route('/farms/:farmId/farmers', {mergeParams: true})
               .get(farmers.list)
                .post(farmers.create);
            app.route('/farms/:farmId/farmers/:farmerId')
                .get(farmers.read)
                .put(farmers.update)
                .delete(farmers.delete);

            //Milk routes:
            app.route('/farms/:farmId/milk')
                .get(milk.list)
                .post(milk.create);
            app.route('/farms/:farmId/milk/:milkId')
                .get(milk.read)
                .put(milk.update)
                .delete(milk.delete);

            //Consultas
            // cadastro de fazendeiro e fazenda;
            // cadastro da produção de leite diário, em litros;
            // consulta do volume de leite entregue para cada dia e a média mensal, dado uma fazenda e um mês de parâmetro;
            // consulta do preço do litro de leite pago ao fazendeiro, dado um código de fazenda e um mês de parâmetro. Apresentar o preço no formato numérico brasileiro e inglês;
            // consulta do preço do litro de leite pago para cada mês do ano, dado uma fazenda e um ano de parâmetro. Apresentar o preço no formato numérico brasileiro e inglês;




            app._router.stack.forEach(function (middleware){
                if (middleware.route) {
                    //middleware.route.methods.get
                    let methods = [
                        (middleware.route.methods.get    ? 'GET' : ''),
                        (middleware.route.methods.put    ? 'PUT' : ''),
                        (middleware.route.methods.post   ? 'POST' : ''),
                        (middleware.route.methods.delete ? 'DELETE': '')
                    ].filter(function (item){
                        return item;
                    }).join(', ');
                    //let desc = '';
                    common.log(moduleName, 'startServer', '         ' + middleware.route.path + ' (' + methods + ')');
                }
            });

            common.log(moduleName, 'startServer', '   Creating server...');
            let server = http.createServer(app);

            server.on('error',  function (err) {
                common.log(moduleName, 'server_onError', 'server_onError: ' + err );
            });

            return server.listen(serverPort, function (){
                let host = (server.address().address === '::' ? 'localhost' : server.address().address) || 'localhost';
                let port = server.address().port;

                common.log(moduleName, 'server_onListen', 'Server is listening for incoming requests on "http://' + host + ':' + port + '"...');
                return;
            });
        })
        .catch(function (err) {
            common.log(moduleName, 'startServer', '   Server failed to start: ' + err);
        });

}

startServer();