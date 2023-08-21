'use strict';
const moduleName = 'milk_controller.js';

const common = require("../common.js");
const db = require("../db");

const collection = 'milk';
const itemName = 'milk'

function _validateData(body) {

    let res = []

    if (body.id) res.push('id (should not be informed)');
    if (body._id) res.push('_id (should not be informed)');
    if (body.isDeleted) res.push('isDeleted (should not be informed)');
    if (body.deletedAt) res.push('deletedAt (should not be informed)');
    if (body.createdAt) res.push('createdAt (should not be informed)');
    if (body.insertedAt) res.push('insertedAt (should not be informed)');
    if (body.updatedAt) res.push('updatedAt (should not be informed)');

    if (!body.day) res.push('day is required!');
    if (!body.month) res.push('month is required!');
    if (!body.year) res.push('year is required!');
    if (!body.volume) res.push('volume is required!');

    return res;

}

exports.list = function (req, res, next) {
    common.log(moduleName, 'list', 'Got a request to list all items from collection "' + collection + '"...');

    let farmId = req.params['farmId'];
    if (!farmId){
        return common.REST.BAD_REQUEST(res, 'Field "farmId" is required', moduleName, 'list');
    }

    return db.collection(collection).find({farm_id: common.convertStringToUUID(farmId), isDeleted: {$ne: true}}, {})
        .then(function (result) {
            common.log(moduleName, 'list', '   Returning ' + result.length + ' ' + collection + '...');
            return common.REST.OK(res, result);
        })
        .catch(function (ex) {
            common.log(moduleName, 'list', '   Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'list');
        });

}

exports.create = function (req, res, next) {
    common.log(moduleName, 'create', 'Got a request to create an items on collection "' + collection + '"...');

    let farmId = req.params['farmId'];
    if (!farmId){
        return common.REST.BAD_REQUEST(res, 'Field "farmId" is required', moduleName, 'create');
    }

    if (!req.body) {
        return common.REST.BAD_REQUEST(res, 'Body is required', moduleName, 'create');
    }

    let invalidFields = _validateData(req.body);
    if (invalidFields.length > 0){
        return common.REST.BAD_REQUEST(res, 'Invalid fields: ' + invalidFields.join(', ') + '.', moduleName, 'create');
    }

    let insertQuery = req.body;
    insertQuery._id = common.convertStringToUUID(common.newUUID());
    insertQuery.createdAt = new Date().toISOString();
    insertQuery.farm_id = common.convertStringToUUID(farmId);

    db.collection(collection).insert(insertQuery, {returnDocument: 'after',upsert: true, multi: false})
        .then(function (result){
            if (result.hasOwnProperty('insertedCount') && result.insertedCount !== 1) {
                common.log(moduleName, 'create', '   Item failed to be inserted.');
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to create item!', moduleName, 'create');
            }
            let item = result.value;
            common.log(moduleName, 'create', '   Returning ' + itemName + ' id "' + item._id + '"...');
            return common.REST.OK(res, item);
        })
        .catch(function (ex){
            common.log(moduleName, 'create', '   Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'create');
        });

}

exports.read  = function (req, res, next) {
    common.log(moduleName, 'read', 'Got a request to read an item from collection "' + collection + '"...');

    let farmId = req.params['farmId'];
    if (!farmId){
        return common.REST.BAD_REQUEST(res, 'Field "farmId" is required', moduleName, 'read');
    }

    let milkId = req.params['milkId'];
    if (!milkId){
        return common.REST.BAD_REQUEST(res, 'Field "milkId" is required', moduleName, 'read');
    }

    let findQuery = {
        _id: common.convertStringToUUID(milkId),
        farm_id: common.convertStringToUUID(farmId),
        isDeleted: {$ne: true}
    }
    return db.collection(collection).find(findQuery, {})
        .then(function (result) {
            if (!result) {
                return common.REST.NOT_FOUND(res, itemName, moduleName, 'read');
            }
            if (result.length == 0){
                return common.REST.NOT_FOUND(res, itemName + 'Id ' + farmId, moduleName, 'read');
            }
            common.log(moduleName, 'read', '   Returning ' + itemName + ' id "' +  farmId + '"...');
            return common.REST.OK(res,  result[0]);
        })
        .catch(function (ex) {
            common.log(moduleName, 'read', '   Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'read');
        });
}

exports.update  = function (req, res, next) {
    common.log(moduleName, 'update', 'Got a request to update an item from collection "' + collection + '"...');

    let farmId = req.params['farmId'];
    if (!farmId){
        return common.REST.BAD_REQUEST(res, 'Field "farmId" is required', moduleName, 'update');
    }

    let milkId = req.params['milkId'];
    if (!milkId){
        return common.REST.BAD_REQUEST(res, 'Field "milkId" is required', moduleName, 'update');
    }

    if (!req.body) {
        return common.REST.BAD_REQUEST(res, 'Body is required', moduleName, 'update');
    }

    let invalidFields = _validateData(req.body);
    if (invalidFields.length > 0){
        return common.REST.BAD_REQUEST(res, 'Invalid fields: ' + invalidFields.join(', ') + '.', moduleName, 'update');
    }

    let insertQuery = req.body;
    insertQuery.updatedAt = new Date().toISOString()

    let findQuery = {
        _id: common.convertStringToUUID(milkId),
        farm_id: common.convertStringToUUID(farmId),
        isDeleted: {$ne: true}
    }

    return db.collection(collection).update(findQuery, insertQuery,  {upsert: false, multi: false, returnDocument: 'after'})
        .then(function (result){
            if (!result) {
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to update item' , moduleName, 'update');
            }
            if (!result.value){
                return common.REST.NOT_FOUND(res, itemName + 'Id ' + farmId, moduleName, 'update');
            }
            let currentItem = result[0];
            common.log(moduleName, 'update', '   Returning ' + itemName + ' id "' +  farmId + '"...');
            return common.REST.OK(res, currentItem);
        })
        .catch(function (ex){
            common.log(moduleName, 'update', '   Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'update');
        });

}

exports.delete = function (req, res, next) {
    common.log(moduleName, 'delete', 'Got a request to delete an item from collection "' + collection + '"...');

    let farmId = req.params['farmId'];
    if (!farmId){
        return common.REST.BAD_REQUEST(res, 'Field "farmId" is required', moduleName, 'delete');
    }

    let milkId = req.params['milkId'];
    if (!milkId){
        return common.REST.BAD_REQUEST(res, 'Field "milkId" is required', moduleName, 'delete');
    }

    let findQuery = {
        _id: common.convertStringToUUID(milkId),
        farm_id: common.convertStringToUUID(farmId),
        isDeleted: {$ne: true}
    }

    return db.collection(collection).delete(findQuery)
        .then(function (result) {
            if (!result) {
                return common.REST.INTERNAL_SERVER_ERROR(res, 'Failed to delete item' , moduleName, 'delete');
            }
            if (!result.deletedCount || result.deletedCount !== 1){
                return common.REST.NOT_FOUND(res, itemName + 'Id ' + farmId, moduleName, 'delete');
            }
            common.log(moduleName, 'delete', '   Returning ' + itemName + ' "' + farmId + '"...');
            return common.REST.OK(res, farmId);
        })
        .catch(function (ex) {
            common.log(moduleName, 'delete', '   Failed: ' + ex);
            return common.REST.INTERNAL_SERVER_ERROR(res, ex.message, moduleName, 'delete (hardDelete)');
        });

}