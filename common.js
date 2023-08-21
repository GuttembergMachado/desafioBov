'use strict';
const moduleName = 'common.js';
const pack = require('./package.json')
const uuidGenerator = require('uuid');
const uuidParser = require('uuid-parse');
const binary = require('mongodb').Binary;

function _log(module, procedure, data){
    try {
        let curDate = new Date().toISOString();
        let curTime = curDate.split('T')[1];
        let buffer = (curTime.substring(0,8) + ' '.repeat(8)).substring(0,8) + ' | ' +
            (module + ' '.repeat(24)).substring(0,24) + ' | ' +
            (procedure + ' '.repeat(24)).substring(0,24) + ' | ' +
            data;
        console.log(buffer);

    } catch (ex) {
        console.error('Failed to log: ' + ex + '!');
    }
}
module.exports.log = _log;

function _send(res, status, content, module, procedure){

    try{

        if (!res || !res.status){
            throw new Error('Missing res object');
        }

        let result = {
            source: pack.name + ' v' + pack.version,
            module: module,
            procedure: procedure,
            createdAt: new Date().toISOString()
        };

        switch (status) {
            case 200: result.message = 'Success';                                               break;
            case 201: result.message = 'Created';                                               break;
            case 202: result.message = 'Accepted';                                              break;
            case 204: result.message = 'No Content';                                            break;
            case 400: result.message = 'Bad Request';            result.type = 'Client Error';  break;
            case 401: result.message = 'Unauthorized';           result.type = 'Client Error';  break;
            case 403: result.message = 'Forbidden';              result.type = 'Client Error';  break;
            case 404: result.message = 'Not Found';              result.type = 'Client Error';  break;
            case 500: result.message = 'Internal Server Error';  result.type = 'Server Error';  break;
            case 501: result.message = 'Not Implemented';        result.type = 'Server Error';  break;
        }

        if (content && content !== '') {
            if (Array.isArray(content) && content.length === 0) {
                result.content = [];
            }else{
                result.content = content;
            }
        }

        _log(moduleName, 'send', 'Sending a "' + status + ' (' + result.message + ')" response'  + (status !== 200 ? ' ("' + result.content + '")' : '') + '...');
        res.status(status).send(result);

    }catch(ex){
        _log(moduleName, 'send', 'Failed to send: ' + ex.message);
    }

}

module.exports.REST = {
    OK:                    (res, content)                    => {_send(res, 200, content                   );},
    NO_CONTENT:            (res, content, module, procedure) => {_send(res, 204, content, module, procedure);},
    BAD_REQUEST:           (res, content, module, procedure) => {_send(res, 400, content, module, procedure);},
    UNAUTHORIZED:          (res, content, module, procedure) => {_send(res, 401, content, module, procedure);},
    NOT_FOUND:             (res, content, module, procedure) => {_send(res, 404, content, module, procedure);},
    INTERNAL_SERVER_ERROR: (res, content, module, procedure) => {_send(res, 500, content, module, procedure);},
    NOT_IMPLEMENTED:       (res,          module, procedure) => {_send(res, 501,          module, procedure);},

    CREATED:               (res, content)                    => {_send(res, 201, content                   );},
    ACCEPTED:              (res, content)                    => {_send(res, 202, content                   );},
    FORBIDDEN:             (res, content, module, procedure) => {_send(res, 403, content, module, procedure);},
};

module.exports.newUUID = function(){
    return uuidGenerator.v4();
}
module.exports.convertStringToUUID = function(id){
    return new binary(new Buffer.from(uuidParser.parse(id)), binary.SUBTYPE_UUID)
}
module.exports.convertUUIDtoString = function(id){
    return uuidParser.unparse(id.buffer)
}


module.exports.cleanResource = function (req, name){
    _log(moduleName, 'cleanResource', 'Cleaning ' + name + ' from "req.resources"...');
    if (req.resources){
        delete req.resources[name];
    }
}

module.exports.saveResource = function (req, resource, name){
    _log(moduleName, 'saveResource', 'Saving ' + name + ' (' + name + 'Id "'  + resource._id + '") on "req.resources"...');
    if (!req.resources) {
        _log(moduleName, 'saveResource', '   Creating "req.resources"....');
        req.resources = {};
    }
    _log(moduleName, 'saveResource', '   Saving "req.resources.' + name + '" as ' + JSON.stringify(resource) + '...');
    req.resources[name] = resource;
}

module.exports.readResource = function (req, name){
    _log(moduleName, 'readResource', 'Reading ' + name + ' from "req.resources"...');
    if (!req.resources) {
        _log(moduleName, 'saveResource', '   Could not find "req.resources!');
        return;
    }
    if (!req.resources[name]) {
        _log(moduleName, 'saveResource', '   Could not find "req.resources[' + name + ']!');
        return;
    }
    let id = req.resources[name]._id;
    _log(moduleName, 'saveResource', '   Found "req.resources.' + name + '" with ' + name + 'Id "' + id + '").');
    return id;
}