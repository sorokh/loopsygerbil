const debug = require('debug')('innergerbil-mixin-tracking');

module.exports = function(Model, options) {
  //TODO: extend with optional createdBy and lastmodifiedBy fields that are automatically filled based on the logged on user.
  Model.defineProperty('createdon', {
    type: Date,
    required: true,
    description: 'tracking field for creation timestamp',
    defaultFn: 'now',
    postgresql: {
      columnName: '$$meta.created',
      dataType: 'timestamp with time zone',
      nullable: 'YES'}});

  Model.defineProperty('lastmodified', {
    type: Date,
    required: true,
    description: 'tracking field for last change timestamp',
    defaultFn: 'now',
    postgresql: {
      columnName: '$$meta.modified',
      dataType: 'timestamp with time zone',
      nullable: 'NO'}});

  if (options.trackUser) {
    Model.defineProperty('createdby', {
      type: String,
      required: true,
      description: 'tracking field for creation user',
      defaultFn: 'now',
      postgresql: {
        columnName: '$$meta.createdby',
        dataType: 'uuid',
        nullable: 'YES'}});

    Model.defineProperty('lastmodifiedby', {
      type: String,
      required: true,
      description: 'tracking field for user of the last change',
      defaultFn: 'now',
      postgresql: {
        columnName: '$$meta.modifiedby',
        dataType: 'uuid',
        nullable: 'NO'}});

    Model.observe('before save', function(ctx, next) {
      debug('Saving %s', ctx.Model.modelName);
      var userId = null;
      if (ctx.req.accessToken) {
        userId = ctx.req.accessToken.userId;
      }
      if (ctx.data) {
        ctx.data.lastmodified = Date.now();
        ctx.data.lastmodifiedby = userId;
        if ( ctx.currentInstance) {
          ctx.data.createdon = ctx.currentInstance.createdon;
          ctx.data.createdby = userId;
        }
      } else if (ctx.instance) {
        ctx.instance.lastmodified = ctx.instance.createdon;
        ctx.instance.lastmodifiedby = userId;
      }
      next();
    });
  } else {
    Model.observe('before save', function(ctx, next) {
      debug('Before Saving %s', ctx.Model.modelName);
      if (ctx.data) {
        ctx.data.lastmodified = Date.now();
        if ( ctx.currentInstance) {
          ctx.data.createdon = ctx.currentInstance.createdon;
        }
      } else if (ctx.instance) {
        ctx.instance.lastmodified = ctx.instance.createdon;
      }
      next();
    });
  }
};
