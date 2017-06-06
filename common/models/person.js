
var app = require('../../server/server');
var utils = require('./utils.js');
var lbUtils = require('loopback-datasource-juggler/lib/utils');
const debug = require('debug')('innergerbil-model-person');

module.exports = function(Person) {
  // Activation of Methods
  Person.disableRemoteMethod('create', true); //Disable creating Persons -> must be done via user registration
  Person.disableRemoteMethod('upsert', true); //Disable updating People via global list path. Update only allowed by id
  Person.disableRemoteMethod('upsertWithWhere', true);
  Person.disableRemoteMethod('updateAll', true);
  Person.disableRemoteMethod('updateAttributes', true);
  Person.disableRemoteMethod('replaceOrCreate', true);
  Person.disableRemoteMethod('replaceById', true);
  Person.disableRemoteMethod('find', false);
  Person.disableRemoteMethod('findById', false);
  Person.disableRemoteMethod('findOne', false);

  Person.disableRemoteMethod('deleteById', true);
  Person.disableRemoteMethod('__get__user', false);
  
  //Protoptype Methods
  Person.disableRemoteMethod('__count__subscriptions',false);
  Person.disableRemoteMethod('__count__subscribedTo',false);
  Person.disableRemoteMethod('__count__pendingMemberships',false);
  Person.disableRemoteMethod('__count__contactDetails',false);
  Person.disableRemoteMethod('__count__adminFor',false);
  
  /*
  Luser.disableRemoteMethod("create", true);
  Luser.disableRemoteMethod("upsert", true);
  Luser.disableRemoteMethod("upsertWithWhere", true);
  Luser.disableRemoteMethod("updateAll", true);
  Luser.disableRemoteMethod("updateAttributes", false);
  Luser.disableRemoteMethod("replaceOrCreate", true);
  Luser.disableRemoteMethod("replaceById", true);

  Luser.disableRemoteMethod("find", true);
  Luser.disableRemoteMethod("findById", false);
  Luser.disableRemoteMethod("findOne", true);

  Luser.disableRemoteMethod("deleteById", false);

  Luser.disableRemoteMethod("confirm", false);
  Luser.disableRemoteMethod("count", true);
  Luser.disableRemoteMethod("exists", true);
  Luser.disableRemoteMethod("resetPassword", false);

  Luser.disableRemoteMethod('__count__accessTokens', false);
  Luser.disableRemoteMethod('__create__accessTokens', false);
  Luser.disableRemoteMethod('__delete__accessTokens', false);
  Luser.disableRemoteMethod('__destroyById__accessTokens', false);
  Luser.disableRemoteMethod('__findById__accessTokens', false);
  Luser.disableRemoteMethod('__get__accessTokens', false);
  Luser.disableRemoteMethod('__updateById__accessTokens', false);
  */

  /*TODO: process near filter such that query parameters are changed to query in a radius around specified point.
  Radius kan also be specified as parameter*/

  Person.accessibleGroups = function(id, options, cb) {
    var Group = app.models.Group;
    var sql =
        'with recursive accessibleGroups (key, id) as ( ' +
        'select null as key, r.to as id from innergerbil.partyrelations r where r.from  = \'' +
          id + '\'  and r.type=\'member\' and r.status= \'active\'' +
        'union all ' +
        'select s.key, r.to from innergerbil.partyrelations r, accessibleGroups s where r.from = s.id and ' +
        'r.type=\'subgroup\' and r.status =\'active\'' +
        ') ' +
        'select distinct c.id as id from accessibleGroups c';
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
  };

  Person.accessibleMembers = function(id, options, cb) {
    var sql =
        'with recursive accessiblePersons (key, personid) as ( ' +
        'values(null,\'' + id + '\'::uuid) ' +
        'union all ' +
        'select s.key, r.to from innergerbil.partyrelations r, accessiblePersons s where r.from = s.personid and ' +
        '(r.type = \'member\' or r.type=\'subgroup\') and r.status =\'active\'' +
        '),' +
        'children(key) as (' +
        '  select distinct ac.personid from accessiblePersons ac' +
        '  union all' +
        '  select r.from from innergerbil.partyrelations r, children c where r.to  = c.key and ' +
        '(r.type = \'member\' or r.type=\'subgroup\') and r.status = \'active\'' +
        ')' +
        'select distinct p.key as id from children c, innergerbil.parties p where c.key = p.key ' +
        'and (p.type = \'person\' or p.type = \'organisation\')';
    var ds = Person.dataSource;
    ds.connector.execute(sql, [], function(err, memberids) {
      if (err) {
        console.error(err);
        cb(err);
      } else {
        console.info(memberids);
        var pid = [];
        for (var i = memberids.length - 1; i >= 0; i--) {
          pid.push(memberids[i].id);
        };
        return Person.find({where: {id: {inq: pid}}}, function(err, people) {
          //console.log(people);
          cb(err, people);
        });
      }
    });
  };

  Person.afterRemote('accessibleGroups', function(ctx, instance, next) {
    var Group = app.models.Group;
    var serialized = {
      links: {self: ctx.req.protocol + '://' + ctx.req.get('host') + ctx.req.originalUrl}};
    var baseUrl = utils.findBaseUrl(serialized.links.self, 'People');
    var data = [];
    if (Array.isArray(ctx.result)) {
      for (var i = ctx.result.length - 1; i >= 0; i--) {
        data.push(Group.toJSONApi(ctx.result[i], baseUrl));
      };
    } else {
      data.push(Group.toJSONApi(ctx.result, baseUrl));
    }
    serialized.data = data;
    serialized.included = [];
    ctx.result = serialized;
    next();
  });

  Person.beforeRemote(
    'prototype.__get__subscribedTo',
    function(ctx, instance, next) {
      var filter = {where: {visibility: 'public'}};
      if (ctx.req.accessToken.userId !== ctx.instance.id) { // TODO: refine access should be able to see non public group accesses if you are self a member
        if (ctx.args.filter) {
          ctx.args.filter = JSON.stringify(lbUtils.mergeQuery(JSON.parse(ctx.args.filter), filter));
        } else {
          ctx.args.filter = JSON.stringify(filter);
        }
      }
      next();
    });

  Person.beforeRemote(
    'prototype.__get__contactDetails',
    function(ctx, instance, next) {
    //TODO: correct the filter modifier.
      if (ctx.req.accessToken.userId !== ctx.instance.id) {
        if (!ctx.query) {
          ctx.query = {};
        }
        if (!ctx.query.filter) {
          ctx.query.filter = {};
        }
        if (!ctx.query.filter.where) {
          ctx.query.filter.where = [];
        }
        /*By default only public contacts are returned. As self you will get all*/
        ctx.query.filter.where = {public: true};
      }
      next();
    });

  Person.beforeRemote('prototype.patchAttributes', function(ctx, instance, next) {
    console.log('###' + instance);
    next();
  });

  Person.beforeJsonApiSerialize = function (options, callback) {
    debug(JSON.stringify(options.relationships));
    if(options.method == 'requestMembership'){
      options.type = 'Subscription';
      options.relationships = app.models.Subscription.relations;
    }
    callback(null, options);
  }

  Person.afterJsonApiSerialize = function(options, callback) {
    //console.log(options.model.app.request);
    if (Array.isArray(options.results.data)) {
      for (var i = options.results.data.length - 1; i >= 0; i--) {
        delete options.results.data[i].relationships.user;
        options.results.data[i].relationships.accessibleMembers =
          utils.createLink(options.results.data[i].links.self +
            '/accessibleMembers');
        options.results.data[i].relationships.accessibleGroups  =
          utils.createLink(options.results.data[i].links.self +
            '/accessibleGroups');
      };
    } else if (options.results.data) {
      delete options.results.data.relationships.user;
      options.results.data.relationships.accessibleMembers =
        utils.createLink(options.results.data.links.self +
            '/accessibleMembers');
      options.results.data.relationships.accessibleGroups =
        utils.createLink(options.results.data.links.self + '/accessibleGroups');
    }
    callback(null, options);
  };

  Person.observe('beforeDestroy', function(ctx, next) {
    console.log(ctx);
    next();
  });

  Person.observe('access', function(ctx, next) {
    if (!ctx.query) {
      ctx.query = {};
    }
    if (!ctx.query.where) {
      ctx.query.where = {};
    }
    ctx.query.where.type = 'person';
    next();
  });

   Person.observe('before save', function(ctx, next) {
    if (ctx.data) {
      ctx.data.type = 'person';
    } else if (ctx.instance) {
      ctx.instance.type = 'person';
    }
    next();
  });

  Person.toJSONApi = function(person, base) {
    var json = {};
    json.type = 'People';
    json.id = person.id;
    var attrib = JSON.parse(JSON.stringify(person));
    delete attrib.id;
    json.attributes = attrib;
    json.links = {};
    json.links.self = base + 'People/' + json.id;
    return json;
  };

   Person.remoteMethod(
    'accessibleGroups',
    {
      http: {path: '/:id/accessibleGroups', verb: 'get'},
      description: 'Recursively query all accessible groups including subgroup scenarios.',
      accepts: [
        {arg: 'id', type: 'string', required: true},
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'accessibleGroups', type: '[Group]', root: true}]}
  );

  Person.remoteMethod(
    'accessibleMembers',
    {
      http: {path: '/:id/accessibleMembers', verb: 'get'},
      description: 'Recursively query all accessible members including subgroup scenarios.',
      accepts: [
        {arg: 'id', type: 'string', required: true},
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'accessibleMembers', type: '[Person]', root: true}]}
  );
};
