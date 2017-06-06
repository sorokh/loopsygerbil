
const createPromiseCallback = require('loopback-datasource-juggler/lib/utils').createPromiseCallback;
const debug = require('debug')('innergerbil-model-transaction-registration');
var app = require('../../server/server');
const uuid = require('uuid');

module.exports = function(TransactionRegistration) {
  TransactionRegistration.disableRemoteMethod('upsert', true);
  TransactionRegistration.disableRemoteMethod('create', true);
  TransactionRegistration.disableRemoteMethod('find', true);
  TransactionRegistration.disableRemoteMethod('findById', true);
  TransactionRegistration.disableRemoteMethod('upsertWithWhere', true);
  TransactionRegistration.disableRemoteMethod('updateAll', false);
  TransactionRegistration.disableRemoteMethod('updateAttributes', false);
  TransactionRegistration.disableRemoteMethod('replaceOrCreate', true);
  TransactionRegistration.disableRemoteMethod('replaceById', true);
  TransactionRegistration.disableRemoteMethod('deleteById', true);
  TransactionRegistration.disableRemoteMethod('__get__payee', false);
  TransactionRegistration.disableRemoteMethod('__get__payer', false);
  TransactionRegistration.disableRemoteMethod('__get__user', false);

  function validateBusinessRules(transaction, options) {
    var cb = createPromiseCallback();
    var promise = cb.promise;
    if (!transaction.from === options.accessToken.userId) {
      promise.reject(new Error('Not Authorized to register transaction.'));
    } else {
      var errors = [];
      if (!transaction.payeegroup) {
        errors.push(new Model.ValidationError('Required field payeegroup missing!'));
      }
      if (!transaction.payergroup) {
        errors.push(new Model.ValidationError('Required field payergroup missing!'));
      }
      if (errors.length > 0) {
        promise.reject(new Model.ValidationError(errors));
      }
    }
    return promise;
  }
  
  TransactionRegistration.prototype.asTransaction = new function() {
	  if (!this._cachedEntities){
		  this._cachedEntities = {};
	  }
	  if (!this._cachedEntities.transaction) {
		  var transaction = {};
		  transaction.id = this.id;
		  transaction.from = this.payer
		  transaction.to = this.payee
		  transaction.amount = this.amount
		  transaction.description = this.description
		  this._cachedEntities.transaction = transaction;
	  }
	  return this._cachedEntities.transaction;
  }

  function registerTransaction(transactionRegistration, options, next) {
    var ctx;
    var Subscription = app.models.Subscription;
    var AccountEntry = app.models.AccountEntry;
    var Transaction = app.models.Transaction;
    var Message = app.models.Message;
    var MessageTransaction = app.models.MessageTransaction;
    TransactionRegistration.beginTransactionRegistration(
      {
    	  isolationLevel: TransactionRegistration.READ_COMMITTED})
    	  .then(function(tx) {
    		  debug('DB TRANSACTION CREATED');
    		  if (tx) {
    			  ctx = {transaction: tx};
    			  return ctx;
    		  } else {
    			  throw ({message: 'Unable to start DB transaction.', status: 400});
    		  }
    	  })
    	  .then(function(context) {
    		  // source account : find account where owner is from and group is fromgroup
    		  return Subscription.findOne(
    				  {where: {and: [{'from': transactionRegistration.from}, {'to': transactionRegistration.payergroup}]},
    					  include: {
    						  relation: 'group',
    						  scope: {
    							  fields: ['id', 'secondsperunit', 'currencyname']}},
    							  transaction: context.transaction}
    		  );
    	  })
		.then(function(subscription){
			if(!subscription){						
					throw({message: "Unable to find account for initiating Person.", status: 400});
			}				
			ctx.sourceSubscription = subscription;
			return ctx;
		})
		.then(function(context){
			//target account : find account where owner is from and group is fromgroup				
			return Subscription.findOne(
						{ where: {and : [{'from' : transactionRegistration.to}, {'to': transactionRegistration.payeegroup}]},
						  include: {
						  	relation: 'group',
						  	scope: {
						  		fields: ['id', 'secondsperunit', 'currencyname']
						  	}
						  }  , transaction : context.transaction });	
		})
		.then (function(subscription){
			if(!subscription){
					throw({message: "Unable to find account for target Person.", status: 400});
			}
			ctx.targetSubscription = subscription;
			return ctx;
		})
		.then(function(context){		
			return Transaction.create(transactionRegistration.asTransaction() , {transaction : context.transaction});
		})
		.then(function(trans){			
			if(!trans){
				throw({message: "Failed to register transaction.", status: 400});
			}
			ctx.userTransaction = trans;
			ctx.payerAmount = -ctx.userTransaction.amount;
			if(transactionRegistration.payergroup !== transactionRegistration.payeegroup){
				ctx.payeeAmount = ctx.userTransaction.amount * ctx.sourceSubscription.group.secondsperunit / ctx.targetSubscription.group.secondsperunit ;
			}else{
				ctx.payeeAmount = ctx.userTransaction.amount;
			}
							
			var entries = [];
			entries.push({
				"id" : uuid.v4(),
				"transactionId": ctx.userTransaction.id,
				"subscriptionId": ctx.sourceSubscription.id,
				"amount": ctx.payeramount
			});
			entries.push({
				"id" : uuid.v4(),
				"transactionId": transaction.id,
				"subscriptionId": ctx.targetSubscription.id,
				"amount": ctx.payeeamount
			});				
			return AccountEntry.create(entries, {transaction: ctx.transaction});
		})
		.then(function(entries){
			if(!entries){
				throw({message: "Failed to register transaction.", status: 400});
			}												
			return ctx.sourceSubscription.updateAttributes({balance : ctx.sourceSubscription.balance + ctx.payeramount},{transaction: ctx.transaction});
		})
		.then(function(subscription){
			if(!subscription){
				throw({message: "Failed to register transaction.", status: 400});
			}
			return ctx.targetSubscription.updateAttributes({balance: ctx.targetSubscription.balance + ctx.payeeamount},{transaction: ctx.transaction});			
		})
		.then(function(subscription){
			if(!subscription){
				throw({message: "Failed to register transaction.", status: 400});
			}
			if(transactionRegistration.messageContextId){
				//find message (do we have access?)
				// if message found create transaction-message relation.
				var instance = {};
				instance.id = uuid.v4();
				instance.messageId = transactionRegistration.messageContextId;
				instance.transactionId = ctx.userTransaction.id;
				return MessageTransaction.create( instances,{transaction : context.transaction});
				//if messagecontextId defined then set relation as reply
			} else {
				return {};
			}
		})
		.then(function(messageRelation){
			if(!messageRelation){
				throw({message: "Failed to link transaction to message", status:400})
			}
			ctx.transaction.commit(function(err){
				if(err){
					debug(err);
					throw({message: "Failed to register transaction.", status: 400});
				}else{
					debug("commit successful");
					next(null,transaction);					
				}
			})
		})
		.catch(function(err){     
			console.error(err);       	
        	ctx.transaction.rollback();
        	next(err);
    	});     	     	
  	}

  TransactionRegistration.register  = function(transactions, options, next) {
		//TODO: check array case!
    var transaction = new TransactionRegistration(transactions);
    if (transaction.isValid) {
      validateBusinessRules(transaction, options)
      .then(createTransactionRegistration(transaction, options, next))
      .catch(function(err) {
        //Something happened - Any thrown errors will end here - rollback changes
        console.error(err);
        next(err);
      });
    } else if (transaction.errors) {
      console.error(transaction.errors);
      var err = new Model.ValidationError(transaction);
      next(err);
    } else {
      debug('INVALID_TRANSACTION');
      var e = new Error(g.f('Invalid TransactionRegistration'));
      e.status = e.statusCode = 422;
      e.code = 'INVALID_TRANSACTION';
      next(e);
    }
  };

// TODO: if array is passed array must also be returned??
  	TransactionRegistration.remoteMethod(
    'register',
    {
      http: {path: '/', verb: 'post'},
      description: 'Create new transaction with dependant account entries and balance change and optional message relation',
      accepts: [
        {
          arg: 'data',
          type: 'object',
          model: TransactionRegistration,
          allowArray: true,
          description: 'Model instance data',
          http: {source: 'body'},
        },
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'data', type: 'Transaction', root: true}]});

	/*
		from group to group
	*/

  TransactionRegistration.afterJsonApiSerialize = function(options, callback) {
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
