const utils = require('./utils.js');
const g = require('strong-globalize')()
const lbUtils = require('loopback-datasource-juggler/lib/utils');
const serialize = require('loopback-jsonapi-model-serializer');
const createPromiseCallback = require('loopback-datasource-juggler/lib/utils').createPromiseCallback;
const app = require('../../server/server');
const debug = require('debug')('innergerbil-model-pendingMembership');
const uuid = require('uuid');

module.exports = function(PendingMembership) {
	PendingMembership.disableRemoteMethod('create', true);
	PendingMembership.disableRemoteMethod('upsert', true); //Disable updating People via global list path. Update only allowed by id
	PendingMembership.disableRemoteMethod('upsertWithWhere', true);
	PendingMembership.disableRemoteMethod('updateAll', true);
	//PendingMembership.disableRemoteMethod('updateAttributes', false);
  PendingMembership.disableRemoteMethod('replaceOrCreate', true);
  PendingMembership.disableRemoteMethod('replaceById', true);
  PendingMembership.disableRemoteMethod('deleteById', false);
  PendingMembership.disableRemoteMethod('find', false);

	/*
		Can be created.
		Can be updated by group admin
		Can be updated by admin
		Can be deleted by admin

		States: created as active
		group admin and admin can set to 'approved' or 'rejected'
		If approved a subscription is created.
	*/
	function isInFinalState(membershipRequest){
    debug(membershipRequest);
		var returnValue = false;
		if(membershipRequest && ((membershipRequest.status === 'approved') || (membershipRequest.status === 'rejected'))){
			returnValue = true;
		}
		return returnValue;
	}

  function approveAndCreateSubscription(pendingmembership, group) {
    var ctx;
    var cb = utils.createPromiseCallback();
    PendingMembership.beginTransaction( 
      {isolationLevel: PendingMembership.READ_COMMITTED})
    .then(tx => {
      debug('DB TRANSACTION CREATED');
      if (tx) {
        ctx = {transaction: tx};
        return ctx;
      } else {
        throw ({message: 'Unable to start DB transaction.', status: 400});
      }
    })
    .then(context => {
      var relation = {};
      relation.id = uuid.v4();
      relation.from = pendingmembership.from;
      relation.to = pendingmembership.to;
      return app.models.Subscription.initMembership(group, relation);
    })
    .then(rel =>{
      debug(rel);
      return app.models.Subscription.create(rel, {transaction: ctx.transaction});
    })
    .then((subscription) => {
      debug(subscription);
      if(subscription){ 
        return pendingmembership.updateAttributes({status:'approved', subscriptionId: subscription.id}, {transaction: ctx.transaction});        
      } else {
        throw({message: "Failed to register subscription.", status: 400});
      }
    })
    .then(function(pending){
      if(!pending){
        throw({message: "Failed to approve pending membership.", status: 400});
      }
      ctx.transaction.commit(function(err){
        if(err){
          debug(err);
          throw({message: "Failed to approve pending membership.", status: 400});
        }else{
          debug("commit successful");
          cb(null,pending);         
        }
      })
    })
    .catch(function(err){     
      console.error(err);         
          ctx.transaction.rollback();
          cb(err);
    });             
    return cb.promise;
  };

  PendingMembership.beforeRemote('prototype.updateAttributes', (ctx, modelInstance, next) => {
      debug('Intercepted updateAttributes');
      const { body } = ctx.req;
      const requestedStatus = body.data.attributes.status;
      delete body.data.attributes;
      debug('body: ', body);
      if (!body) {
        return next();
      }
      debug('Logged on user is:', ctx.req.accessToken.userId);
      PendingMembership.findById(body.data.id)
      .then(function(record){
        if(record.status === requestedStatus){
          debug('no change needed');
          return next(null, record);
        } else {
          app.models.Group.findById(record.to)
          .then(function(group) {
            if(group){
              utils.isInRole('admin', ctx.req)
              .then(value => {
                debug('User is system admin: ', value);
                if(!value && !(group.isMembershipRequestingAllowed())){
                  throw ({message: 'Not Authorized', status: 401});
                } else {
                  if(isInFinalState(record)) {
                    throw ({message: 'State Transition Not Allowed', status: 400});
                  } else {
                    debug('Requesting status change to :', requestedStatus);
                    switch ( requestedStatus ){
                      case 'rejected':
                        record.updateAttributes({status: 'rejected'},next);
                        break;
                      case 'approved':
                        approveAndCreateSubscription(record, group)
                        .then(pending => {
                          if(!pending) {
                            throw({message:'failed to approve subscription', status: 400});
                          } else {
                            return next(null,pending);
                          }
                        })
                        break;
                      default:
                        throw ({message: 'Unsupported state found', status:400});
                        break;
                    }
                  }
                }
              });
            } else {
              throw({message: 'Membership Request Not Found', status: 404})
            }
          })
          .catch(function(err) {
            debug(err);
            return next(err);
          });
        } 
      })
      .catch(function(err) {
        debug(err);
        return next(err);
      });
  });

/*PendingMembership.on('dataSourceAttached', function(obj){
    var _updateAttributes = PendingMembership.prototype.updateAttributes;
    PendingMembership.prototype.updateAttributes = function(filter, cb) {
      debug('OVERRULED UPDATEATTRIBUTES',filter);
    };
  });*/
	PendingMembership.updateRequest = function(pendingmembership, options, next) {
		var ctx;
		debug('Logged on user is:', options.accessToken.userId);
	    debug('Updating membership:', pendingmembership);
      debug('options:', options);
	    PendingMembership.findById(pendingmembership.id)
	    .then(function(record){
	    	if(record.status === pendingmembership.status){
	    		debug('no change needed')
	    		next(null, record);
	    	} else {
	    		app.models.Group.findById(pendingmembership.to)
	    		.then(function(group) {
	    			if(group){
	    				utils.isInRole('admin, options')
  						.then(value => {
  							debug('User is system admin: ', value);
  							if(!value && !(isMembershipRequestingAllowed(group))){
  								throw ({message: 'Not Authorized', status: 401});
  							} else {
  								if(isInFinalState(record)) {
  									throw ({message: 'State Transition Not Allowed', status: 400});
  								} else {
  									switch ( pendingmembership.status ){
  										case 'rejected':
  											var updated = record.updateAttributes({status: 'rejected'});
                        debug(updated);
                        next(null,updated);
  											break;
  										case 'approved':
                        approveAndCreateSubscription(record, group)
                        .then(pending => {
                          if(!pending) {
                            throw({message:'failed to approve subscription', status: 400});
                          } else {
                            next(null,pending);
                          }
                        })
  											break;
  										default:
  											throw ({message: 'Unsupported state found', status:400});
                        break;
  									}
  								}
  							}
  						});
	    			} else {
              throw({message: 'Membership Request Not Found', status: 404})
            }
	    		})
	    		.catch(function(err) {
			      debug(err);
			      next(err);
			    });
	    	} 
	    })
	    .catch(function(err) {
	      debug(err);
	      next(err);
	    });
	};

	PendingMembership.requestMembership = function(pendingmembership, options, next) {
	    debug('Logged on user is:', options.accessToken.userId);
	    debug('Request for membership:', pendingmembership);
      const targetGroup = pendingmembership.data.attributes.to;
      const sourcePerson = pendingmembership.data.attributes.from;
	    //TODO: assure that pending memberships are included!
	    app.models.Group.findById(targetGroup, {
	          include: ['memberAccounts','pendingMemberships']})
	    .then(function(group) {
	      	if (group) {
		        var member = group.toJSON().memberAccounts.find(
		          function(el) {
		            return el.from === sourcePerson;
		        });
		        var applicant = group.toJSON().pendingMemberships.find(
		          function(el) {
		            return el.from === sourcePerson;
		        });
		        if (member) {
		          //already a member, do nothing
		          debug('Membership request for user who is already member.');
		          //TODO: return error !
		          throw ({message: 'Unable to request membership: already member.', status: 400})
		        } else if (applicant) {
		        	debug('Already pending member');
		        	throw ({message: 'Unable to request membership: already pending member.', status: 409})
				} else {
					utils.isInRole('admin, options')
					.then(value => {
						debug('User is system admin: ', value);
						if(!value && !((sourcePerson === options.accessToken.userId) && group.isMembershipRequestingAllowed())){
							throw ({message: 'Not Authorized', status: 401});
						} else {
              var rel = pendingmembership.data.attributes;
              rel.id = pendingmembership.data.id;
							initRelation(rel)
							.then(rel => {
								app.models.PendingMembership.create(rel)
		        				.then(function(pendingmembership) {
		          					debug('pending member saved:', pendingmembership);
		          					if(pendingmembership) {
							            next(null,pendingmembership);
							          } else {
							            throw({message:'Unable to create pendingmembership', status: 400});
							          }
							    });
							});
						}
					})
          .catch(function(err) {
            debug(err);
            next(err);
          });
				}
			}
		})
		.catch(function(err) {
	      debug(err);
	      next(err);
	    });
	};

  function initRelation(relation){
    var rel = relation;
    var cb = utils.createPromiseCallback();
    rel.status = 'active';
    cb(null,rel);
    return cb.promise;
  };

  /*PendingMembership.remoteMethod(
    'updateAttributes',
    {
      http: {path: '/:id', verb: 'put'},
      description: 'Request membership of a group.',
      accepts: [
       	{arg: 'id', type: 'string', required: true},
        {
          arg: 'data',
          type: 'object',
          model: app.models.PendingMembership,
          allowArray: false,
          description: 'Pending Membership Relation Object',
          http: {source: 'body'}
        },
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}
      ],
      returns: [
        {args: 'data', type: 'PendingMembership', root: true}
      ]
    }
  );*/

  PendingMembership.remoteMethod(
    'requestMembership',
    {
      http: {path: '/', verb: 'post'},
      description: 'Request membership of a group.',
      accepts: [
        {
          arg: 'data',
          type: 'object',
          model: app.models.PendingMembership,
          allowArray: false,
          description: 'Pending Membership Relation Object',
          http: {source: 'body'}
        },
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}
      ],
      returns: [
        {args: 'data', type: 'PendingMembership', root: true}
      ]
    }
    );
}