const debug = require('debug')('innergerbil-mixin-inactive');

module.exports = function(Model, options) {
  Model.defineProperty('status', {
    type: String,
    required: true,
    description: 'activity indicator',
    default: 'active',
    postgresql: {
      columnName: 'status',
      dataType: 'text',
      nullable: 'NO'}});

  /*
  Model.scope('active', {where: {status: 'active'}});
  Model.scope('pending', {where: {status: 'pending'}});
  Model.scope('inactive', {where: {status: 'inactive'}});
  */
};
