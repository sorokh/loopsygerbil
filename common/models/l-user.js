
var app = require('../../server/server');
var LoopBackContext = require('loopback-context');

module.exports = function(Luser) {
  Luser.disableRemoteMethod('create', true);
  Luser.disableRemoteMethod('upsert', true);
  Luser.disableRemoteMethod('upsertWithWhere', true);
  Luser.disableRemoteMethod('updateAll', true);
  Luser.disableRemoteMethod('updateAttributes', false);
  Luser.disableRemoteMethod('replaceOrCreate', true);
  Luser.disableRemoteMethod('replaceById', true);

  Luser.disableRemoteMethod('find', true);
  Luser.disableRemoteMethod('findById', false);
  Luser.disableRemoteMethod('findOne', true);

  Luser.disableRemoteMethod('deleteById', false);

  Luser.disableRemoteMethod('confirm', false);
  Luser.disableRemoteMethod('count', true);
  Luser.disableRemoteMethod('exists', true);
  Luser.disableRemoteMethod('resetPassword', false);

  Luser.disableRemoteMethod('__count__accessTokens', false);
  Luser.disableRemoteMethod('__create__accessTokens', false);
  Luser.disableRemoteMethod('__delete__accessTokens', false);
  Luser.disableRemoteMethod('__destroyById__accessTokens', false);
  Luser.disableRemoteMethod('__findById__accessTokens', false);
  Luser.disableRemoteMethod('__get__accessTokens', false);
  Luser.disableRemoteMethod('__updateById__accessTokens', false);

  Luser.defineProperty('type', {
    type: String,
    required: true,
    description: 'the discriminator for the party',
    default: 'person',
    postgresql: {
      columnName: 'type',
      dataType: 'text',
      nullable: 'NO'}});

  Luser.me = function(accessToken, cb) {
    //console.log(accessToken.userId);
    var Person = app.models.Person;
    Person.findById(accessToken.userId, {}, function(err, currentUser) {
      /*currentUser["_links"] = {};
      Link.href = "/api/People/"+accessToken.userId;
      currentUser._links.self = Link;*/
      //console.log(currentUser);
      //TODO: add user messages, user transactions and balance?
      cb(err, currentUser);
    });
  };

  Luser.observe('access', function(ctx, next) {
    if (!ctx.query) {
      ctx.query = {};
    }
    if (!ctx.query.where) {
      ctx.query.where = {};
    }
    ctx.query.where.type = 'person';
    next();
  });

  Luser.observe('before save', function(ctx, next) {
    if (ctx.isNewInstance) {
      if (!ctx.instance.deleted) {
        ctx.instance.deleted = false;
      }
      if (!ctx.instance.name) {
        ctx.instance.name = ctx.instance.username;
      }
    }
    next();
  });

  Luser.beforeRemote('count', function(ctx, instance, next) {
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
    }
    ctx.query.filter.where.type = 'person';
    next();
  });

  Luser.afterRemote('create', function(context, userInstance, next) {
    console.log('> user.afterRemote triggered');

    var options = {
      type: 'email',
      to: userInstance.email,
      from: 'noreply@rosseel.net',
      subject: 'Thanks for registering.',
      template: path.resolve(__dirname, '../../server/views/verify.ejs'),
      redirect: '/verified',
      user: user};

    userInstance.verify(options, function(err, response, next) {
      if (err) return next(err);

      console.log('> verification email sent:', response);

      context.res.render('response', {
        title: 'Signed up successfully',
        content: 'Please check your email and click on the verification link ' -
            'before logging in.',
        redirectTo: '/',
        redirectToLinkText: 'Log in'});
    });
  });

  Luser.afterJsonApiSerialize = function(options, callback) {
    //console.log(options.model.app.request);
    if (Array.isArray(options.results.data)) {
      for (var i = options.results.data.length - 1; i >= 0; i--) {
        delete options.results.data[i].relationships.accessTokens;
        /*options.results.data[i].relationships.accessibleMembers = createLink(options.results.data[i].links.self + "/accessibleMembers");
        options.results.data[i].relationships.accessibleGroups  = createLink(options.results.data[i].links.self + "/accessibleGroups");*/
        options.results.data[i].links.self =
          options.results.data[i].links.self.replace(/LUsers/, 'People');
      };
    } else {
      delete options.results.data.relationships.accessTokens;
      /*options.results.data.relationships.accessibleMembers= createLink(options.results.data.links.self + "/accessibleMembers");
      options.results.data.relationships.accessibleGroups= createLink(options.results.data.links.self + "/accessibleGroups");*/
      options.results.data.links.self =
        options.results.data.links.self.replace(/LUsers/, 'People');
    }
    callback(null, options);
  };

  Luser.remoteMethod(
    'me',
    {
      http: {path: '/me', verb: 'get'},
      description: 'Get information on current logged in user,' +
      ' including some accessible references.',
      accepts: [
        {
          arg: 'accessToken',
          type: 'object',
          http: function(ctx) {
            return ctx.req.accessToken;
          }}],
      returns: [
        {arg: 'self', type: '[Person]', root: true}]}
  );

  Luser.remoteMethod(
    'loginGoogle',
    {
      http: {path: '/loginGoogle', verb: 'post'},
      description: 'Login with google credentials',
      accepts: [],
      returns: [
        {arg: 'token', type: 'AccessToken'}]
    }
  );
};
