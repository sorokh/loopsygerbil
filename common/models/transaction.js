
const createPromiseCallback = require('loopback-datasource-juggler/lib/utils').createPromiseCallback;
const debug = require('debug')('innergerbil-model-transactions');
var app = require('../../server/server');
const uuid = require('uuid');

module.exports = function(Transaction) {
  Transaction.disableRemoteMethod('upsert', true);
  Transaction.disableRemoteMethod('create', true);
  Transaction.disableRemoteMethod('find', false); //allow
  Transaction.disableRemoteMethod('findById', false); //allow
  Transaction.disableRemoteMethod('upsertWithWhere', true);
  Transaction.disableRemoteMethod('updateAll', false);
  Transaction.disableRemoteMethod('updateAttributes', false);
  Transaction.disableRemoteMethod('replaceOrCreate', true);
  Transaction.disableRemoteMethod('replaceById', true);
  Transaction.disableRemoteMethod('deleteById', true);
  Transaction.disableRemoteMethod('__get__accountentries', true);//allow
  Transaction.disableRemoteMethod('__create__accountentries', false);
  Transaction.disableRemoteMethod('__updateById__accountentries', false);
  Transaction.disableRemoteMethod('__delete__accountentries', false);
  Transaction.disableRemoteMethod('__findById__accountentries', false);
  Transaction.disableRemoteMethod('__destroyById__accountentries', false);
  Transaction.disableRemoteMethod('__exists__messages', false);
  Transaction.disableRemoteMethod('__link__messages', false);
  Transaction.disableRemoteMethod('__unlink__messages', false);
  

	/*
		from group to group
	*/

  Transaction.afterJsonApiSerialize = function(options, callback) {
    //console.log(options.model.app.request);
    if (Array.isArray(options.results.data)) {
      for (var i = options.results.data.length - 1; i >= 0; i--) {
        delete options.results.data[i].relationships.accountentries;
       /* TODO: check if we can inject the group relations.
        options.result.data[i].relationships.payergroup
        options.result.data[i].relationships.payeegroup
        */
      };
    } else {
      delete options.results.data.relationships.accountentries;
      /* TODO: check if we can inject the group relations.
      options.result.data[i].relationships.payergroup
      options.result.data[i].relationships.payeegroup
      */
    }
    callback(null, options);
  };

};
