'use strict';
const moduleName = 'db.js';

const common = require('./common.js');
const mongoClient = require('mongodb').MongoClient;

let _database;

let debugDetails = true;

let colDef = [
    {
        name: 'farms',
        indexes: [
            {index: {_id: 1},  options: {name: 'idx_farms_id'}},
            {index: {name: 1}, options: {name: 'idx_farms_name', unique: true}},
        ]
    },
    {
        name: 'farmers',
        indexes: [
            {index: {_id: 1},  options: {name: 'idx_farmers_id'}},
            {index: {name: 1}, options: {name: 'idx_farmers_name', unique: true}},
        ]
    },
    {
        name: 'milk',
        indexes: [
            {index: {_id: 1}, options: {name: 'idx_milk_id'}},
            {index: {day: 1, month: 1, year: 1, farmId: 1},     options: {name: 'idx_milk_day_month_year_farm', unique: true}},
        ]
    },
];

exports.setup = function(uri){

    return new Promise(function (resolve, reject) {

        try {

            common.log(moduleName, 'setup', '   Connecting to database "' + uri + '"...');
            return mongoClient.connect(uri)
                .then(function (client){

                    //Takes note of the database instance
                    _database = client.db(client.s.options.dbName);
                    _database.collections=[];

                    common.log(moduleName, 'setup', '      Server is now connected to "' + _database.databaseName + '".');

                    common.log(moduleName, 'setup', '         Setting event handlers....');

                    client.on('close',                         function(){ eventHandler('Db', 'close'); });
                    client.on('error',                         function(){ eventHandler('Db', 'error'); });
                    client.on('fullsetup',                     function(){ eventHandler('Db', 'fullsetup'); });
                    client.on('parseError',                    function(){ eventHandler('Db', 'parseError'); });
                    client.on('reconnect',                     function(){ eventHandler('Db', 'reconnect'); });
                    client.on('timeout',                       function(){ eventHandler('Db', 'timeout'); });


                    return setupCollections(colDef);

                })
                .then(function(res){
                    return resolve();
                });

        } catch (ex) {
            common.log(moduleName, 'setup', '      Error: ' + ex.message);
            return reject(ex);
        }

    });
}

exports.collection = function (collectionName){

    let c = _database.collections[collectionName];
    if (!c) {
        let errMsg = 'Collection "' + collectionName + '" was not found or was not initialized!';
        common.log(moduleName, 'collection', errMsg);
        throw new Error(errMsg);
    }
    return c;

};

function setupCollections(collectionsDefinition){

    _database.collections=[];

    if (collectionsDefinition.length > 0) {
        common.log(moduleName, 'setupCollections', '         Checking all ' + collectionsDefinition.length + ' collections...');
    } else {
        common.log(moduleName, 'setupCollections', '         No collection to setup.');
    }

    let collectionPromise = Promise.resolve();
    let collectionsPromises = collectionsDefinition.map(function (colDef) {
        collectionPromise = collectionPromise
            .then(function(){
                return _database.createCollection(colDef.name)
                    .then(function(collection){
                        common.log(moduleName, 'setupCollections', '            Collection "' +  colDef.name + '" created.');
                        return collection;
                    })
                    .catch(function (ex) {
                        if (ex.code == 48 && ex.codeName == 'NamespaceExists'){
                            common.log(moduleName, 'setupCollections', '            Collection "' +  colDef.name + '" already exists.');
                            return _database.collection(colDef.name);
                        }
                        common.log(moduleName, 'setupCollections', '            Failed to create collection "' + colDef.name + '": ' + ex.message);
                        throw(ex);
                    });

            })
            .then(function (collection) {
                return setupIndexes(collection, colDef.indexes);
            })
            .then(function (collection){

                common.log(moduleName, 'setupCollections', '               Adding custom functions...');

                //Add the new collection object to the collections array;
                _database.collections[collection.collectionName] = {
                    find: function (findQuery, projectionQuery, options, returnCursor, cursorLimit) {
                        return _find(collection, findQuery, projectionQuery, options, returnCursor, cursorLimit);
                    },
                    insert: function (insertQuery, options) {
                        return _insert(collection, insertQuery, options);
                    },
                    update: function (findQuery, updateQuery, options) {
                        return _update(collection, findQuery, updateQuery, options);
                    },
                    delete: function (findQuery, options) {
                        return _delete(collection, findQuery, options);
                    },
                    aggregate: function (aggregateQuery, options) {
                        return _aggregate(collection, aggregateQuery, options);
                    }
                };

                return true;
            });

        return collectionPromise;

    });

    return Promise.all(collectionsPromises)
        .then(function () {
            common.log(moduleName, 'setupCollections', '         All collections OK.');
            return true;
        })
        .catch(function (ex) {
            common.log(moduleName, 'setupCollections', '         Collection setup failed: ' + ex.message);
            throw(ex);
        });
}

function setupIndexes(collection, indexesDefinition){

    if (indexesDefinition.length > 0) {
        common.log(moduleName, 'setupIndexes', '               Checking all ' + indexesDefinition.length + ' indexes...');
    } else {
        common.log(moduleName, 'setupIndexes', '               No index to setup.');
    }

    let indexPromise = Promise.resolve();
    let indexesPromises = indexesDefinition.map(function (idx) {
        indexPromise = indexPromise
            .then(function () {
                return collection.createIndex(idx.index, idx.options)
                    .then(function () {
                        common.log(moduleName, 'setupIndexes', '                  Index "' + idx.options.name + '" OK.');
                        return true;
                    })
                    .catch(function (ex) {
                        common.log(moduleName, 'setupIndexes', '                  Failed to setup index "' + idx.options.name + '": ' + ex.message);
                        throw(ex);
                    });
            });
        return indexPromise;
    });

    return Promise.all(indexesPromises)
        .then(function () {
            return collection;
        })
        .catch(function (ex) {
            common.log(moduleName, 'setupIndexes', '                  Index setup failed: ' + ex.message);
            throw(ex);
        });
}

function getReadableDbReturn(data){

    let desc;
    try{

        function joinIds(object){
            if (Array.isArray(object)){
                return Object.values(object).map(function(item){
                    return item;
                }).join(', ').trim()
            }else{
                return object;
            }
        }

        if(data){
            if (Array.isArray(data)){
                desc = 'returned an ' +  (data.length === 0 ? 'empty array' : 'array' + (data.length === 1 ? ' with a single item' : ' with ' + data.length + ' items')) ;
            }else {
                if(data.hasOwnProperty('acknowledged') && data.acknowledged) {
                    if(data.hasOwnProperty('deletedCount')) {
                        desc = 'returned that ' + data.deletedCount + (data.deletedCount === 1 ? ' item was' : ' items were' ) + ' deleted';
                    }else{
                        if(data.hasOwnProperty('insertedCount')) {
                            let ids = joinIds(data.insertedIds);
                            desc = 'returned that ' + data.insertedCount + (data.insertedCount === 1 ? ' item was' : ' items were' ) + ' inserted' + (ids.length > 0 ? ' (' + ids + ')' : '');
                        }else{
                            let ids = joinIds(data.upsertedId);
                            let matched = data.matchedCount;
                            let upserted = data.upsertedCount;
                            let modified = data.modifiedCount;
                            desc = 'matched ' + matched + ', modified ' + modified + ' and upserted ' + upserted + ' items ' + (ids.length > 0 ? ' (' + ids + ')' : '');
                        }
                    }
                }else{
                    if(data.hasOwnProperty('ok') && data.ok === 1){
                        if(data.hasOwnProperty('lastErrorObject')) {
                            if(data.lastErrorObject.hasOwnProperty('updatedExisting') && data.lastErrorObject.updatedExisting){
                                let updated = data.lastErrorObject.n;
                                let ids = joinIds(data.value);
                                desc = 'updated ' + updated + ' item' + (updated === 1 ? '': 's') + (ids.length > 0 ? ' (' + ids + ')' : '');
                            }else{
                                if(data.lastErrorObject.hasOwnProperty('upserted')){
                                    let upserted = data.lastErrorObject.n;
                                    let ids = joinIds(data.lastErrorObject.upserted);
                                    desc = 'upserted ' + upserted + ' item' + (upserted === 1 ? '': 's') + (ids.length > 0 ? ' (' + ids + ')' : '');
                                }else{
                                    desc = 'updated 0 items'
                                }
                            }
                        }else{
                            common.log(moduleName, 'getReadableDbReturn', '    UNKNOWN RETURN FROM DATABASE (2): ' + JSON.stringify(data, null, 3))
                        }
                    }else{
                        common.log(moduleName, 'getReadableDbReturn', '    UNKNOWN RETURN FROM DATABASE (1): ' + JSON.stringify(data, null, 3))
                    }
                }
            }
        }else{
            desc = 'returned undefined.'
        }
    }catch(ex){
        desc = JSON.stringify(data);
    }

    return desc;

}

function _find (collection, findQuery, projectionQuery, optionQuery){
    common.log(moduleName, 'find', 'Searching "' + collection.collectionName + '" using query "' + JSON.stringify(findQuery) + '"...');

    let cursor = collection.find(findQuery, {projection: projectionQuery}, optionQuery)
    return cursor.toArray()
        .then(function (ret){
            common.log(moduleName, 'find', '   Database "' + collection.collectionName + '" ' + getReadableDbReturn(ret) + '.');
            return ret;
        })
        .catch(function (ex){
            throw ex;
        });
}

function _insert (collection, insertQuery, optionQuery) {
    common.log(moduleName, 'insert', 'Inserting "' + collection.collectionName + '" using query "' + JSON.stringify(insertQuery) + '"...');

    return collection.findOneAndUpdate(insertQuery, {$set: insertQuery}, optionQuery)
        .then(function (ret) {
            common.log(moduleName, 'insert', '   Database "' + collection.collectionName + '" ' + getReadableDbReturn(ret) + '.');
            return ret;
        })
        .catch(function (ex) {
            throw ex;
        });
}

function _update (collection, findQuery, updateQuery, optionQuery){

    common.log(moduleName, 'update', 'Updating "' + collection.collectionName + '" using method: "findOneAndUpdate", findQuery: "' + JSON.stringify(findQuery) + '", updateQuery: "' + JSON.stringify(updateQuery) + '", optionQuery: "' + JSON.stringify(optionQuery) + '"...');
    return collection.findOneAndUpdate(findQuery, {$set: updateQuery}, optionQuery)
        .then(function (ret) {
            common.log(moduleName, 'update', '   Database "' + collection.collectionName + '" ' + getReadableDbReturn(ret) + '.');
            return ret;
        })
        .catch(function (ex){
            throw ex;
        })

}

function _delete (collection, findQuery, optionQuery){

    common.log(moduleName, 'delete', 'Deleting "' + collection.collectionName + '" using query "' + JSON.stringify(findQuery) + '"...');

    return collection.deleteOne(findQuery, optionQuery)
        .then(function (ret){
            common.log(moduleName, 'delete', '   Database "' + collection.collectionName + '" ' + getReadableDbReturn(ret) + '.');
            return ret;
        })
        .catch(function (ex){
            throw ex;
        });

}

function _aggregate (collection, aggregateQuery, optionQuery){

    common.log(moduleName, 'aggregate', 'Aggregating "' + collection.collectionName + '" using a query of ' + JSON.stringify(aggregateQuery).length + ' bytes...');

    return collection.aggregate(aggregateQuery, optionQuery).toArray()
        .then(function (ret){
            common.log(moduleName, 'aggregate', '   Database "' + collection.collectionName + '" ' + getReadableDbReturn(ret) + '.');
            return ret;
        })
        .catch(function (ex){
            throw ex;
        });

}

