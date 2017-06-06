
module.exports = function(app) {
  var LUser = app.models.LUser;
  var Role = app.models.Role;
  var Message = app.models.Message;

  var connector = Message.dataSource.connector;
  connector.observe('before execute', function(ctx, next) {
  		//console.log(ctx.req);
  		/*TODO validate performance impact as this is run for each query!!,
  		Would be better to work with a model driven context parameter.
  		It is unclear however if this context parameter would be passed to the connector!*/
    if (ctx.req.sql.includes('"tags" IN')) {
  			/* fix SQL such that for array type @> is used instead of in*/
      ctx.req.sql = ctx.req.sql.replace(/"tags"\ IN\ /, '"tags" @> ');
    }
    next();
  });
};
