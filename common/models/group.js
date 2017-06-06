
const utils = require('./utils.js');
const g = require('strong-globalize')()
const lbUtils = require('loopback-datasource-juggler/lib/utils');
const serialize = require('loopback-jsonapi-model-serializer');
const createPromiseCallback = require('loopback-datasource-juggler/lib/utils').createPromiseCallback;
const app = require('../../server/server');
const debug = require('debug')('innergerbil-model-group');
const uuid = require('uuid');

// TODO: define an embedded configuration object for groups.

module.exports = function(Group) {
// Standard Api activation
// prototype methods
  Group.disableRemoteMethod('__count__subgroups', false);
  Group.disableRemoteMethod('__count__admins', false);
  Group.disableRemoteMethod('__count__contactDetails', false);
  Group.disableRemoteMethod('__count__memberAccounts', false);
  Group.disableRemoteMethod('__count__subgroups', false);
  Group.disableRemoteMethod('__count__members', false);
  Group.disableRemoteMethod('__count__messages', false);
  Group.disableRemoteMethod('__count__parent', false);
  Group.disableRemoteMethod('__count__pendingmembers', false);
  Group.disableRemoteMethod('__count__pendingMemberships', false);
// Instance methods
  Group.prototype.nextCode = function() {
    var cb = utils.createPromiseCallback();
    var code = null;
    if (this.options) {
      // TODO: implement counter logic
      cb(null,'');
    } else {
      cb(null,null);
    }
    return cb.promise;
  }

// Model Hooks
  Group.observe('before save', function(ctx, next) {
    if (ctx.data) {
      ctx.data.type = 'group';
    } else if (ctx.instance) {
      ctx.instance.type = 'group';
    }
    next();
  });

// Method Hooks
  Group.beforeRemote('prototype.__get__contactDetails', function(ctx, instance, next) {
    if (ctx.req.accessToken.userId) {
      app.models.Role.isInRole('admin', ctx.options, function(err, isInRole){
        if (isInRole) {

        } else {
          app.accessUtils.hasRoleInGroup(ctx.req.accessToken.userId, 'member', ctx.instance.id).then(function(isMember) {
            if (!isMember) {
              var filter = {where: {public: true}};
              if (ctx.args.filter) {
                ctx.args.filter = JSON.stringify(lbUtils.mergeQuery(JSON.parse(ctx.args.filter), filter));
              } else {
                ctx.args.filter = JSON.stringify(filter);
              }
            }
            next();
          });
      }});
    } else {
      next({code: 'AUTHORIZATION_REQUIRED', status: 401});
    }
  });

  Group.beforeRemote('prototype.___create__subgroups', function(ctx, instance, next) {
    debug('creating subgroup');
    next(null);
  });

// TODO: replace by standardized JSONAPI serializer instead of custom method.
  Group.toJSONApi = function(group, base) {
    var json = {};
    json.type = 'Groups';
    json.id = group.id;
    var attrib = JSON.parse(JSON.stringify(group));
    delete attrib.id;
    json.attributes = attrib;
    json.links = {};
    json.links.self = base + 'Groups/' + json.id;
    return json;
  };

  // TODO: add data self links
  Group.afterJsonApiSerialize = function(options, callback) {
    var baseUrl = utils.findBaseUrl(options.topLevelLinks.self, 'Groups');
    if (options.results && Array.isArray(options.results.data)) {
      for (var i = options.results.data.length - 1; i >= 0; i--) {
        options.results.data[i] = utils.createSelfLink(options.results.data[i],
          baseUrl, options.results.data[i].type,
          options.results.data[i].id);
        if (options.results.data[i].relationships) {
          Object.keys(options.results.data[i].relationships).forEach(function(key, index) {
            if (options.results.data[i].relationships[key].data) {
              options.results.data[i].relationships[key].data =
                utils.createSelfLink(options.results.data[i].relationships[key].data,
                baseUrl, options.results.data[i].relationships[key].data.type,
                options.results.data[i].relationships[key].data.id);
            }
          });
        }
      };
    } else {
      if (options.result) {
        options.result.data = utils.createSelfLink(options.result.data,
            baseUrl, options.result.data.type,
            options.result.data.id);
        if (options.result.data.relationships) {
          Object.keys(options.result.data.relationships).forEach(function(key, index) {
            if (options.result.data.relationships[key].data) {
              options.result.data.relationships[key].data =
                utils.createSelfLink(options.result.data.relationships[key].data,
                baseUrl, options.result.data.relationships[key].data.type,
                options.result.data.relationships[key].data.id);
            }
          });
        }
      }
    }
    callback(null, options);
  };

  Group.prototype.isMembershipRequestingAllowed = function() {
    debug('group has visibility set to:', this.visibility);
    if (this.visibility !== 'public' && this.visibility !== 'protected') {
      return false;
    } else {
      return true;
    }
  }

  Group.requestMembership = function(key, person, options, next) {
    debug('Logged on user is:', options.accessToken.userId);
    debug('Request for membership of:', person);
    // TODO: assure that pending memberships are included!
    Group.findById(key, {
          include: ['members','memberAccounts']})
    .then(function(group) {
      if (group) {
        var applicant = group.toJSON().members.find(
          function(el) {
            return el.id === person.id;
        });
        if (applicant) {
          // already a member, do nothing
          debug('Membership request for user who is already member.');
          // TODO: return error !
          var account = group.toJSON().memberAccounts.find(
            function(el) {
              return el.from === person.id;
            })
          next(null, account)
        } else {
          Promise.all([utils.isInRole('admin', options),app.accessUtils.hasRoleInGroup(options.accessToken.userId, 'admin', group.id)])
          .then(values => {
            debug(values[0],values[1]);
            if(values[0] || values[1]) {
              debug('setting relation as admin');
              addMember(group, person.id, 'active')
              .then(function(memberrelation) {
                debug('1');
                if(!memberrelation){
                  throw({message: "Failed to register as member", status: 400});
                }
                next(null, memberrelation);
              });
            } else {
              debug('setting relation as regular user', person.id, options.accessToken.userId, group.id);
              if((person.id === options.accessToken.userId) && isMembershipRequestingAllowed(group)){
                addMember(group, person.id, 'pending')
                .then(function(memberrelation) {
                  debug('1');
                  if(!memberrelation){
                    throw({message: "Failed to register as member", status: 400});
                  }
                  next(null, memberrelation);
                });
              } else {
                throw({message: 'Not Authorized', status: 401})
              }
            }
          })
          .catch(function(err) {
            debug(err);
            next(err);
          });
        }
      } else {
        throw ({message: 'Unable to find group.', status: 400});
      }
    })
    .catch(function(err) {
      debug(err);
      next(err);
    });
  }


  function initMembership(group, relation){
    debug('3');
    var rel = relation;
    var cb = utils.createPromiseCallback();
    if(group.options) {
      rel.balance = group.options.startingbalance;
      group.nextCode()
      .then(function(code) {
        rel.code = code;
        cb(null, rel);
      });
    } else {
      rel.balance = 0;
      rel.code = null;
      cb(null, rel);
    }
    return cb.promise;
  }

  function addMember(group, personId, status){
    debug(group, personId, status);
    var cb = utils.createPromiseCallback();
    var memberStatus = status || 'pending';
    debug(memberStatus);
    var relation = {}
    relation.id = uuid.v4();
    relation.from = personId;
    relation.to = group.id;
    relation.status = 'active'
    debug(relation);
    switch (memberStatus) {
      case 'active':
        initMembership(group, relation)
        .then(function(rel) {
          debug(rel);
          app.models.Subscription.create(rel)
          .then(function(subscription) {
            debug('subscription saved:', subscription);
            if(subscription) {
              cb(null,subscription);
            } else {
              throw({message:'Unable to create subscription', status: 400});
            }
          })
          .catch(function(err) {
            debug(err);
            cb(err);
          });
        })
        .catch(function(err) {
          debug(err);
          cb(err);
        });    
        break;
      case 'pending':
      default:
        app.models.PendingMembership.create(relation)
        .then(function(pendingmembership) {
          debug('pending member saved:', pendingmembership);
          if(pendingmembership) {
            cb(null,pendingmembership);
          } else {
            throw({message:'Unable to create pendingmembership', status: 400});
          }
        })
        .catch(function(err) {
          debug(err);
          cb(err);
        });
        break;
    }
    return cb.promise;
  }



  function addSubgroup(group, subgroup, options) {
    var cb = createPromiseCallback();
    var promise = cb.promise;
    Group.findById(subgroup.id, {
          include: 'parent'})
    .then(function(sub) {
      var parent = sub.toJSON().parent;
      if(parent) {
        cb({message: "Group already is a subgroup!", status: 400});
      } else {
        var ctx = {subgroup: sub};
        var relation = {
          "id" : uuid.v4(),
          "from": subgroup.id,
          "to": group.id
        };
        if (sub) {
          var cb2 = createPromiseCallback();
          cb2.promise.all([utils.isInRole('admin', options),app.accessUtils.hasRoleInGroup(options.accessToken.userId, 'admin', subgroup.id)])
          .then(values => {
            if(values[0] || values[1]) {
              app.models.SubGroup.create(relation)
              .then(function(subgrouprelation) {
                if(!subgrouprelation){
                  throw({message: "Failed to register as subgroup", status: 400});
                }
                cb(null, ctx.subgroup);
              });
            } else {
              cb({message: 'Not Authorized', status: 401})
            }
          })
          .catch(function(err) {
            cb(err);
          });
        } else {
          Group.beginTransaction({isolationLevel: Transaction.READ_COMMITTED})
          .then(function(tx) {
            debug('DB TRANSACTION CREATED');
            if (tx) {
              ctx.transaction = tx;
              return ctx;
            } else {
              throw ({message: 'Unable to start DB transaction.', status: 400});
            }
          })
          .then(function(context) {
            return Group.create(subgroup , {transaction : context.transaction});
          })
          .then(function(_group){
            if(!_group){            
                throw({message: "Unable to create subgroup.", status: 400});
            }     
            ctx.subgroup = _group;  
            var admin_relation = {
              "id" : uuid.v4(),
              "from": options.accessToken.userId,
              "to": _group.id,
              "type": 'admin',
              "balance": 0
            }
            return app.models.Subscription.create(subgroup, {transaction : context.transaction});
          })
          .then(function(subscription){
            if(!subscription) {
              throw({message: "Failed to register as group admin.", status: 400});
            }
            return app.models.SubGroup.create(relation, {transaction : context.transaction});
          })
          .then(function(subgrouprelation){
            if(!subgrouprelation){
              throw({message: "Failed to register as subgroup", status: 400});
            }
            ctx.transaction.commit(function(err){
              if(err){
                debug(err);
                throw({message: "Failed to register subgroup.", status: 400});
              }else{
                debug("commit successful");
                cb(null, ctx.subgroup);     
              }
            })
          })
          .catch(function(err){     
            console.error(err);         
            ctx.transaction.rollback();
            cb(err);
          });     
        } 
      }
    });
    return promise;
  }

  /**
     * Remote Methods
     */
  Group.listTransactions = function(key, options, next) {
    // TODO: verify correctness of transaction list in case of users with
    // multiple memberships
    var Transaction = app.models.Transaction;
    Group.findById(
        key, {
          include: 'members'})
    .then(function(group) {
      if (group) {
        var filter = {where: {or: [{to: {inq: []}}, {from: {inq: []}}]}};
        group.toJSON().members.forEach(
          function(member) {
            filter.where.or[0].to.inq.push(member.id.toString());
            filter.where.or[1].from.inq.push(member.id.toString());
          });
        return Transaction.find(filter);
      } else {
        throw ({message: 'Unable to find group.', status: 400});
      }
    })
    .then(function(transactions) {
      if (transactions) {
        next(null, utils.removeRelation(serialize(transactions, Transaction), 'user'));
      } else {
        throw ({message: 'Unable to resolve transactions for group', status: 400});
      }
    })
    .catch(function(err) {
      next(err);
    });
  };
  
  Group.createSubGroup = function(key, newgroup, options, next) {
	    Group.findById(
	        key, {
	          include: 'subgroups'})
	    .then(function(group) {
	      if (group) {
	        // check if passed group has Id and is in the subgroup list
	        var subgroup = group.toJSON().subgroups.find(
	          function(el) {
	            return el.id === newgroup.data.id;
	          });
	        if (subgroup) {
	          // group exist and subgroup is already a subgroup
	          // hence do nothing, just return subgroup.
	          next(null, subgroup);
	        } else {
	          addSubGroup(group, utils.jsonapiToJSON(newgroup), options)
	          .then(function(subgroup){
	            if(subgroup){
	              next(null, subgroup);
	            } else {
	              throw ({message: 'Unable to create subgroup.', status: 400});
	            }
	          })       
	        }
	      } else {
	        throw ({message: 'Unable to find group.', status: 400});
	      }
	    })
	    .catch(function(err) {
	      next(err);
	    });
	    next();
	  };

  Group.getAncestors = function(id, options, cb) {
	    var sql =
	        'with recursive parentGroups (key, id) as ( ' +
	        'select null as key, r.to as id from innergerbil.partyrelations r where r.from  = \'' +
	          id + '\'  and r.type=\'subgroup\' and r.status= \'active\'' +
	        'union all ' +
	        'select s.key, r.to from innergerbil.partyrelations r, parentGroups s where r.from = s.id and ' +
	        'r.type=\'subgroup\' and r.status =\'active\'' +
	        ') ' +
	        'select distinct c.id as id from parentGroups c';
	    var ds = Group.dataSource;
	    ds.connector.execute(sql, [], function(err, groupids) {
	      if (err) {
	        console.error(err);
	        cb(err);
	      } else {
	        console.info(groupids);
	        var pid = [];
	        for (var i = groupids.length - 1; i >= 0; i--) {
	          pid.push(groupids[i].id);
	        };
	        return Group.find({where: {id: {inq: pid}}}, function(err, groups) {
	          cb(err, groups);
	        });
	      }
	    });
  }
  
  Group.getChildren = function(id, options, cb) {
	  var sql =
	        'with recursive childGroups (key, id) as ( ' +
	        'select null as key, r.from as id from innergerbil.partyrelations r where r.to  = \'' +
	          id + '\'  and r.type=\'subgroup\' and r.status= \'active\'' +
	        'union all ' +
	        'select s.key, r.from from innergerbil.partyrelations r, childGroups s where r.to = s.id and ' +
	        'r.type=\'subgroup\' and r.status =\'active\'' +
	        ') ' +
	        'select distinct c.id as id from childGroups c';
	    var ds = Group.dataSource;
	    ds.connector.execute(sql, [], function(err, groupids) {
	      if (err) {
	        console.error(err);
	        cb(err);
	      } else {
	        console.info(groupids);
	        var pid = [];
	        for (var i = groupids.length - 1; i >= 0; i--) {
	          pid.push(groupids[i].id);
	        };
	        return Group.find({where: {id: {inq: pid}}}, function(err, groups) {
	          cb(err, groups);
	        });
	      }
	    });
  }

// Deserialization Hooks
  
// Serialization Hooks
  Group.beforeJsonApiSerialize = function (options, callback) {
	    callback(null, options);
	  }
// Custom Remote Method Definitions
  Group.remoteMethod(
     'createGroupMessage',
     {
         http: {path: '/:id/messages', verb:'post'},
         accepts: [
           {arg: 'id', type: 'string', required: true},
           {arg: 'message', type: 'Message', required: true},
           {arg: 'options', type: 'object', http: 'optionsFromRequest'}
         ],
         returns: [
             {arg: 'data', type: 'Message', root: true}
         ]
     });
  Group.remoteMethod(
    'listTransactions',
    {
      http: {path: '/:id/transactions', verb: 'get'},
      description: 'Find all the transaction done in this group',
      accepts: [
        {arg: 'id', type: 'string', required: true},
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'data', type: '[Transaction]', root: true}]});

  Group.remoteMethod(
    'createSubGroup',
    {
      http: {path: '/:id/subgroups', verb: 'post'},
      description: 'Create new subgroup within the current group. The admin doing this will automatically become admin of this group also.',
      accepts: [
        {arg: 'id', type: 'string', required: true},
        {
          arg: 'data',
          type: 'object',
          model: Group,
          allowArray: true,
          description: 'Model instance data for the subgroup',
          http: {source: 'body'}
        },
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'data', type: 'Group', root: true}]});
  
  Group.remoteMethod(
  	'getAncestors',
  	{
  		http: {path: '/:id/ancestors', verb: 'get'},
  		description: 'Get the groups parent groups in a recursive fashion. I.e. this will retrieve all parent groups including parent of parent relationships.',
  		accepts: [
  			{arg: 'id', type: 'string', required: true},
  			{arg: 'options', type: 'object', http: 'optionsFromRequest'}],
  		returns: [
  			{arg: 'data', type: '[Group]', root: true}]
  	});
  Group.remoteMethod(
          'getChildren',
          {
                  http: {path: '/:id/children', verb: 'get'},
                  description: 'Get the groups subgroups in a recursive fashion. I.e. this will retrieve all subgroups including subgroup of subgroup relationships.',
                  accepts: [
                          {arg: 'id', type: 'string', required: true},
                          {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
                  returns: [
                          {arg: 'data', type: '[Group]', root: true}]
          });
};
