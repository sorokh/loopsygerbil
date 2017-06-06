
module.exports = function(GroupAdmin) {
  GroupAdmin.observe('access', function(ctx, next) {
    if (!ctx.query) {
      ctx.query = {};
    }
    if (!ctx.query.where) {
      ctx.query.where = {};
    }
    ctx.query.where.type = 'admin';
    next();
  });
};
