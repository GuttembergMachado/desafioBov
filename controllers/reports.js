'use strict';
const moduleName = 'reports.js';

const common = require("../common.js");
const db = require("../db");

// consulta do volume de leite entregue para cada dia e a média mensal, dado uma fazenda e um mês de parâmetro;
exports.milkVolumeReport = function (req, res, next) {
    common.log(moduleName, 'milkVolumeReport', 'Got a request to show a milk volume report...');

    if (!req.query || !req.query.farmId || !req.query.month ){
        return common.REST.BAD_REQUEST(res, 'This report requires parameters farmId and month', moduleName, 'milkVolumeReport');
    }

    let farmId = common.convertStringToUUID(req.query.farmId);
    let month = parseInt(req.query.month);
    let year = parseInt(2022);

    let query = [
        {$match: {"_id": farmId }},

        {$lookup: {from: 'farmers', localField: '_id', foreignField: 'farmId', as: 'farmers' }},
        {$unwind: '$farmers'},

        {$lookup: {from: 'milk', localField: '_id', foreignField: 'farmId', as: 'milk' }},
        {$unwind: '$milk'},

        {$match: {$expr: {$eq: [year, '$milk.year']} }},
        {$match: {$expr: {$eq: [month, '$milk.month']} }},

        {$group: {
            _id: {
                farmId: '$_id',
                farmName: '$name',
                farmer: '$farmers.name',
                month: '$milk.month'
            },
            milk: { $addToSet: {
                day: '$milk.volume',
                volume: '$milk.volume',
            }}
        }},

        {$addFields: {
            volumeAvg: {$avg: '$milk.volume'}
        }},

        {$project: {
            _id: 0,
            farmId: '$_id.farmId',
            farmName: '$_id.farmName',
            farmer: '$_id.farmer',
            month: '$_id.month',
            volumeAvg: '$volumeAvg',
            milk: '$milk'
        }},
    ];

    return db.collection('farms').aggregate(query, {'allowDiskUse': true})
        .then(function (result) {

            if (!result || !result[0]) {
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to create report!', moduleName, 'milkVolumeReport');
            }

            common.log(moduleName, 'milkVolumeReport', 'Returning report...');
            return common.REST.OK(res, result[0]);

        })
        .catch(function (ex){
            common.log(moduleName, 'milkVolumeReport', 'Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'milkVolumeReport');
        });

}

// consulta do preço do litro de leite pago ao fazendeiro, dado um código de fazenda e um mês de parâmetro. Apresentar o preço no formato numérico brasileiro e inglês;
exports.milkPriceReport = function (req, res, next) {
    common.log(moduleName, 'milkPriceReport', 'Got a request to show a milk price report...');

    if (!req.query || !req.query.farmId || !req.query.month ){
        return common.REST.BAD_REQUEST(res, 'This report requires parameters farmId and month', moduleName, 'milkPriceReport');
    }

    let farmId = common.convertStringToUUID(req.query.farmId);
    let month = parseInt(req.query.month);
    let year = parseInt(2022);

    let query = [
        {$match: {"_id": farmId }},

        {$lookup: {from: 'farmers', localField: '_id', foreignField: 'farmId', as: 'farmers' }},
        {$unwind: '$farmers'},

        {$lookup: {from: 'milk', localField: '_id', foreignField: 'farmId', as: 'milk' }},
        {$unwind: '$milk'},

        {$match: {$expr: {$eq: [year, '$milk.year']} }},
        {$match: {$expr: {$eq: [month, '$milk.month']} }},

        {$group: {
            _id: {
                farmId: '$_id',
                farmName: '$name',
                farmDistance: '$distance',
                farmer: '$farmers.name',
                month: '$milk.month'
            },
            milkVolume: { $sum: '$milk.volume'},
        }},

        {$addFields: {
            basePrice: {$cond: [ {$lt: ['$_id.month', 7]}, 1.8, 1.95 ] },
            distanceCost: {$cond: [ {$lt: ['$_id.farmDistance', 51]}, 0.5, 0.6 ] },
            bonus: {$cond: [ {$lt: ['$milkVolume', 10001]}, 0, 0.1 ] },
        }},

        {$addFields: {
            price:  {$add: [{$subtract: [ {$multiply: ['$milkVolume', '$basePrice']}, {$multiply: ['$distanceCost', '$_id.farmDistance']}]},  {$multiply: ['$milkVolume', '$bonus']}]}
        }},

        {$project: {
            _id: 0,
            farmId: '$_id.farmId',
            farmName: '$_id.farmName',
            farmDistance: '$_id.farmDistance',
            farmer: '$_id.farmer',
            month: '$_id.month',
            volume: '$milkVolume',
            price_us: {$concat: [ 'U$ ', {$substr: [{$round : ['$price', 2]}, 0, -1]} ]},
            price_br: {$concat: [ 'R$ ', {$replaceOne: { input: {$substr: [{$round : ['$price', 2]}, 0, -1]}, find: ".", replacement: "," }}     ]},
        }}
    ];

    return db.collection('farms').aggregate(query, {'allowDiskUse': true})
        .then(function (result) {

            if (!result || !result[0]) {
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to create report!', moduleName, 'milkPriceReport');
            }

            common.log(moduleName, 'milkPriceReport', 'Returning report...');
            return common.REST.OK(res, result[0]);

        })
        .catch(function (ex){
            common.log(moduleName, 'milkPriceReport', 'Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'milkPriceReport');
        });

}

// consulta do preço do litro de leite pago para cada mês do ano, dado uma fazenda e um ano de parâmetro. Apresentar o preço no formato numérico brasileiro e inglês;
exports.monthlyReport = function (req, res, next) {
    common.log(moduleName, 'monthlyReport', 'Got a request to show a monthly report...');

    if (!req.query || !req.query.farmId || !req.query.year ){
        return common.REST.BAD_REQUEST(res, 'This report requires parameters farmId and month', moduleName, 'monthlyReport');
    }

    let farmId = common.convertStringToUUID(req.query.farmId);
    let year = parseInt(req.query.year);

    let query = [
        {$match: {"_id": farmId }},

        {$lookup: {from: 'farmers', localField: '_id', foreignField: 'farmId', as: 'farmers' }},
        {$unwind: '$farmers'},

        {$lookup: {from: 'milk', localField: '_id', foreignField: 'farmId', as: 'milk' }},
        {$unwind: '$milk'},

        {$match: {$expr: {$eq: [year, '$milk.year']} }},

        {$group: {
            _id: {
                farmId: '$_id',
                farmName: '$name',
                farmDistance: '$distance',
                farmer: '$farmers.name',
                month: '$milk.month',
            },
            milkVolume: { $sum: '$milk.volume'},
        }},

        {$addFields: {
            basePrice: {$cond: [ {$lt: ['$_id.month', 7]}, 1.8, 1.95 ] },
            distanceCost: {$cond: [ {$lt: ['$_id.farmDistance', 51]}, 0.5, 0.6 ] },
            bonus: {$cond: [ {$lt: ['$milkVolume', 10001]}, 0, 0.1 ] },
        }},

        {$addFields: {
            price:  {$add: [{$subtract: [ {$multiply: ['$milkVolume', '$basePrice']}, {$multiply: ['$distanceCost', '$_id.farmDistance']}]},  {$multiply: ['$milkVolume', '$bonus']}]}
        }},

        {$project: {
            _id: 0,
            farmId: '$_id.farmId',
            farmName: '$_id.farmName',
            farmDistance: '$_id.farmDistance',
            farmer: '$_id.farmer',
            month: '$_id.month',
            volume: '$milkVolume',
            price_us: {$concat: [ 'U$ ', {$substr: [{$round : ['$price', 2]}, 0, -1]} ]},
            price_br: {$concat: [ 'R$ ', {$replaceOne: { input: {$substr: [{$round : ['$price', 2]}, 0, -1]}, find: ".", replacement: "," }}     ]},
        }}
    ];

    return db.collection('farms').aggregate(query, {'allowDiskUse': true})
        .then(function (result) {

            if (!result || !result[0]) {
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to create report!', moduleName, 'monthlyReport');
            }

            common.log(moduleName, 'monthlyReport', 'Returning report...');
            return common.REST.OK(res, result[0]);

        })
        .catch(function (ex){
            common.log(moduleName, 'monthlyReport', 'Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'monthlyReport');
        });

}