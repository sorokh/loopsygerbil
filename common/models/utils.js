var app = require('../../server/server');
var _ = require('underscore');

exports = module.exports = {
    isInRole : function(role, options) {
        var cb = exports.createPromiseCallback();
        app.models.Role.isInRole(role, options, cb);
        return cb.promise;
    },
    jsonapiToJSON : function(jsonapi) {
        var object = {};
        if (jsonapi.data.id) {
            object.id = jsonapi.data.id;
        }
        Object.keys(jsonapi.data.attributes).forEach(function(key) {
            object[key] = jsonapi.data.attributes[key];
        });
        return object;
    },
    createPromiseCallback : function() {
        var cb;

        if (!global.Promise) {
            cb = function() {
            };
            cb.promise = {};
            Object.defineProperty(cb.promise, 'then', {
                get : throwPromiseNotDefined
            });
            Object.defineProperty(cb.promise, 'catch', {
                get : throwPromiseNotDefined
            });
            return cb;
        }

        var promise = new Promise(function(resolve, reject) {
            cb = function(err, data) {
                if (err) return reject(err);
                return resolve(data);
            };
        });
        cb.promise = promise;
        return cb;
    },

    createLink : function(ref) {
        var links = {};
        var link = {};
        link.related = ref;
        links.links = link;
        return links;
    },

    findBaseUrl : function(url, key) {
        var base = url || '';
        base = base.split(key)[0];
        if (base === url) {
            base = undefined;
        }
        ;
        return base;
    },

    createSelfLink : function(data, baseurl, type, id) {
        var base = baseurl || '';
        if (!data.links) {
            data.links = {};
        }
        if (!data.links.self) {
            data.links.self = base + type + '/' + id;
        }
        return data;
    },
    createSelfLinks : function(data, baseurl) {
        if (Array.isArray(data)) {
            for (var i = data.length - 1; i >= 0; i--) {
                data[i] = exports.createSelfLinks(data[i], baseurl,
                        data[i].type, data[i].id);
            }
        } else {
            data = exports.createSelfLink(data, baseurl, data.type, data.id);
        }
        return data;
    },
    removeRelation : function(jsonApiData, relationName) {
        if (jsonApiData && jsonApiData.data) {
            if (Array.isArray(jsonApiData.data)) {
                jsonApiData.data.forEach(function(element, index) {
                    if (element.relationships) {
                        delete element.relationships[relationName];
                    }
                });
            } else {
                if (jsonApiData.data.relationships) {
                    delete jsonApiData.data.relationships[relationName];
                }
            }
        }
        return jsonApiData;
    },
    mergeModelArray : function(array1, array2) {
        /*var out = Array.clone(array1);
        for ( var element in array2) {
            var matched = false;
            for ( var el in array1) {
                if (el.id === element.id) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                out.push(element);
            }
        }*/
        return _.union(array1, array2);
    }
};
