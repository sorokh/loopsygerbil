var app = require('../../server/server');
const utils = require('./utils.js');
const lbUtils = require('loopback-datasource-juggler/lib/utils');
const debug = require('debug')('innergerbil-model-contactInfo');
const createPromiseCallback = require('loopback-datasource-juggler/lib/utils').createPromiseCallback;

module.exports = function(Contactinfo) {
  Contactinfo.disableRemoteMethod('create', true);
  Contactinfo.disableRemoteMethod('upsert', true); // Disable updating People via global list path. Update only allowed by id
  Contactinfo.disableRemoteMethod('upsertWithWhere', true);
  // Contactinfo.disableRemoteMethod('updateAll', false);
  // Contactinfo.disableRemoteMethod('updateAttributes', false);
  Contactinfo.disableRemoteMethod('replaceOrCreate', true);
  Contactinfo.disableRemoteMethod('replaceById', true);

  Contactinfo.disableRemoteMethod('find', true);
  Contactinfo.disableRemoteMethod('findById', true);
  Contactinfo.disableRemoteMethod('findOne', true);
  Contactinfo.disableRemoteMethod('deleteById', true);

  Contactinfo.disableRemoteMethod('__get__owner', false);

/*

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

	/* Contactinfo.observe('access', function logQuery(ctx, next) {
	  console.log('Accessing %s matching', ctx.Model.modelName, ctx.query.where,ctx);
	  next();
	}); */

  /* TODO: properly handle GEO queries as usage of GeoPoint will only work when using PostGIS
  PostGIS is not available in Heroku Home only on Enterprise editions.
  So it will be best to avoid its use and foresee a custom mechanism, either via custom where parameters of
  via the usage of a stored procedure. */

  Contactinfo.beforeRemote('prototype.updateAttributes', function(ctx, instance, next) {
    /*
    if owner is user then must be owner
    else if group is owner
    must be group admin
    */
    if (ctx.req.accessToken.userId) {
      if (ctx.instance.partytype == 'Person') {
        debug('Person');
        if (ctx.req.accessToken.userId === ctx.instance.partyId) {
          next();
        } else {
          next({code: 'AUTHORIZATION_REQUIRED', status: 401});
        }
      } else if (ctx.instance.partytype == 'Group') {
        debug('Group');
        app.accessUtils.hasRoleInGroup(ctx.req.accessToken.userId, 'admin',
          ctx.instance.partyId).then(function(isAdmin) {
            debug(isAdmin);
            if (!isAdmin) {
              next({code: 'AUTHORIZATION_REQUIRED', status: 401});
            } else {
              next();
            }
          });
      }
    } else {
      next({code: 'AUTHORIZATION_REQUIRED', status: 401});
    }
  });

  Contactinfo.beforeRemote('find', function(ctx, instance, next) {
    /* if(ctx.req.accessToken.userId !== ctx.instance.id){
      if(!ctx.query){
      ctx.query = {};
      }
      if(!ctx.query.filter){
          ctx.query.filter = {}
      }
      if(!ctx.query.filter.where){
          ctx.query.filter.where = []
      }
    }
    ctx.query.filter.where = { public:false}; */
    console.log(ctx.req.accessToken.userId, ctx.instance, ctx.query);
    next();
  });

  function isAllowed(operation, contact, options) {
    var cb = createPromiseCallback();
    app.models.Role.isInRole('admin', options, function(err, isInRole){
      if (isInRole) {
        cb(null, true);
      } else {
        switch (operation) {
          case 'create':
            if ((contact.partytype == 'Person') && (contact.partyId == options.accessToken.userId)) {
              cb(null, true);
            } else {
              if (contact.partytype == 'Group') {
                app.accessUtils.hasRoleInGroup(options.accessToken.userId, 'admin', contact.partyId)
                .then(function(isAdmin) {
                  if (isAdmin) {
                    cb(null, true);
                  } else {
                    cb(null, false);
                  }
                });
              } else {
                cb(null, false);
              }
            }
            break;
          default:
            cb(null, false);
            break;
        }
      }
    });
    return cb.promise;
  }

  Contactinfo.register  = function(contactInfo, options, next) {
    var contactinfo = new Contactinfo(utils.jsonapiToJSON(contactInfo));
    if (contactinfo.isValid) {
      var contact = contactinfo;
      if (!contact.partyId) {
        contact.partyId = options.accessToken.userId;
        contact.partytype = 'Person';
      }
      isAllowed('create', contact , options)
      .then(function(allowed) {
        if (allowed) {
          Contactinfo.create(contact)
          .then(function(result) {
            if (!result) {
              next({message: 'Failed to register contactinfo.', status: 400});
            } else {
              next(null, contact);
            }
          });
        } else {
           next({message: 'Not allowed to add contactinfo', status: 403});
        }
      })
      .catch(function(err) {
        console.error(err);
        next(err);
      });
    } else if (contactinfo.errors) {
      console.error(contactinfo.errors);
      var err = new Model.ValidationError(contactinfo);
      next(err);
    } else {
      debug('INVALID_CONTACTINFO');
      var e = new Error(g.f('Invalid ContactInfo'));
      e.status = e.statusCode = 422;
      e.code = 'INVALID_CONTACTINFO';
      next(e);
    }
  };

  Contactinfo.remoteMethod(
    'register',
    {
      http: {path: '/', verb: 'post'},
      description: 'Create new contactInfo, by default linked to logged in person',
      accepts: [
        {
          arg: 'data',
          type: 'object',
          model: Contactinfo,
          allowArray: true,
          description: 'Model instance data',
          http: {source: 'body'},
        },
        {arg: 'options', type: 'object', http: 'optionsFromRequest'}],
      returns: [
        {arg: 'data', type: 'ContactInfo', root: true}]});

};
