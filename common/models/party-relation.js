'use strict';
const app = require('../../server/server');
const debug = require('debug')('innergerbil-model-partyrelation');

module.exports = function(Partyrelation) {
	Partyrelation.observe('access', function(ctx, next) {
    debug('global access check');
    if (!ctx.query) {
      ctx.query = {};
    }
    if (!ctx.query.where) {
      ctx.query.where = {};
    }
    app.models.Role.isInRole('admin', ctx.options, function(err, isInRole){
      if(!isInRole){
        if (JSON.stringify(ctx.query.where).indexOf('status') == -1) {
          ctx.query.where.status = 'active';
        }
      }
    });
    next();
  });
};
