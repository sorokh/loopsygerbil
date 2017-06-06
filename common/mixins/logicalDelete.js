
const debug = require('debug')('innergerbil-mixin-logicalDelete');

module.exports = function(Model, options) {
  const idName = Model.dataSource.idName(Model.modelName);

  Model.defineProperty('deletedAt', {
    type: Date,
    required: false,
    postgresql: {
      columnName: '$$meta.deleted_at',
      dataType: 'timestamp with time zone',
      nullable: 'YES'}});

  Model.defineProperty('isDeleted', {
    type: Boolean,
    required: true,
    description: 'logical delete indicator',
    default: false,
    postgresql: {
      columnName: '$$meta.deleted',
      dataType: 'boolean',
      nullable: 'NO'}});

  /**
     * When ever model tries to access data, we add by default isDeleted: false to where query
     * if there is already in query isDeleted property, then we do not modify query
     */
  /*Model.observe('access', function logQuery(ctx, next) {
    if (!ctx.query.where) {
      ctx.query.where = {};
    }
    if (JSON.stringify(ctx.query.where).indexOf('isDeleted') == -1) {
      ctx.query.where.isDeleted = false;
    }
    next();
  });*/

  /**
  TODO: modify JSON API serialize to hide the isDeleted property?
  */

  /**
     * Watches destroyAll(), deleteAll(), destroyById() , deleteById(), prototype.destroy(), prototype.delete() methods
     * and instead of deleting object, sets properties deletedAt and isDeleted.
     */
  /*Model.observe('before delete', function(ctx, next) {
    Model.updateAll(ctx.where,
      {deleted: true, deletedAt: Date.now()}).then(function(result) {
        next(null);
      });
  });*/

  Model.destroyAll = function softDestroyAll(where, cb) {
    Model.updateAll(where, {isDeleted: true, deletedAt: new Date() })
      .then(result => (typeof cb === 'function') ? cb(null, result) : result)
      .catch(error => (typeof cb === 'function') ? cb(error) : Promise.reject(error));
  };

  Model.remove = Model.destroyAll;
  Model.deleteAll = Model.destroyAll;

  Model.destroyById = function softDestroyById(id, cb) {
    Model.updateAll({ [idName]: id }, {isDeleted: true, deletedAt: new Date()})
      .then(result => {
        return  (typeof cb === 'function') ? cb(null, result) : result;})
      .catch(error => {
        return (typeof cb === 'function')? cb(error) : Promise.reject(error);
    });
  };

  Model.removeById = Model.destroyById;
  Model.deleteById = Model.destroyById;

  Model.prototype.destroy = function softDestroy(options, cb) {
    const callback = (cb === undefined && typeof options === 'function') ? options : cb;

    return this.updateAttributes({ isDeleted: true, deletedAt: new Date() })
      .then(result => (typeof callback === 'function') ? callback(null, result) : result)
      .catch(error => (typeof callback === 'function') ? callback(error) : Promise.reject(error));
  };

  Model.prototype.remove = Model.prototype.destroy;
  Model.prototype.delete = Model.prototype.destroy;

   // Emulate default scope but with more flexibility.
  const queryNonDeleted = {isDeleted: false};

  const _findOrCreate = Model.findOrCreate;
  Model.findOrCreate = function findOrCreateDeleted(query = {}, ...rest) {
    if (!query.deleted) { 
      if (!query.where || Object.keys(query.where).length === 0) {
        query.where = queryNonDeleted;
      } else {
        query.where = { and: [ query.where, queryNonDeleted ] };
      }
    }

    return _findOrCreate.call(Model, query, ...rest);
  };

  const _find = Model.find;
  Model.find = function findDeleted(query = {}, ...rest) {
    if (!query.deleted) {
      if (!query.where || Object.keys(query.where).length === 0) {
        query.where = queryNonDeleted;
      } else {
        query.where = { and: [ query.where, queryNonDeleted ] };
      }
    }

    return _find.call(Model, query, ...rest);
  };

  const _count = Model.count;
  Model.count = function countDeleted(where = {}, ...rest) {
    // Because count only receives a 'where', there's nowhere to ask for the deleted entities.
    let whereNotDeleted;
    if (!where || Object.keys(where).length === 0) {
      whereNotDeleted = queryNonDeleted;
    } else {
      whereNotDeleted = { and: [ where, queryNonDeleted ] };
    }
    return _count.call(Model, whereNotDeleted, ...rest);
  };

  const _update = Model.update;
  Model.update = Model.updateAll = function updateDeleted(where = {}, ...rest) {
    // Because update/updateAll only receives a 'where', there's nowhere to ask for the deleted entities.
    let whereNotDeleted;
    if (!where || Object.keys(where).length === 0) {
      whereNotDeleted = queryNonDeleted;
    } else {
      whereNotDeleted = { and: [ where, queryNonDeleted ] };
    }
    return _update.call(Model, whereNotDeleted, ...rest);
  };

};
