var utils = require('./utils.js');
const debug = require('debug')('innergerbil-model-subscriptions');

module.exports = function(Subscription) {

    /**
     * TODO: - find method -> add filter to only owned subscriptions unless
     * admin
     */
    Subscription.initMembership = function(group, relation) {
        debug('3');
        var rel = relation;
        var cb = utils.createPromiseCallback();
        if (group.options) {
            rel.balance = group.options.startingbalance;
            group.nextCode().then(function(code) {
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

    Subscription.observe('access', function(ctx, next) {
        console.log(ctx.options);
        if (!ctx.query) {
            ctx.query = {};
        }
        if (!ctx.query.where) {
            ctx.query.where = {};
        }
        /*
         * if (JSON.stringify(ctx.query.where).indexOf('status') == -1) {
         * ctx.query.where.status = 'active'; }
         */
        ctx.query.where.type = 'member';
        next();
    });

    Subscription.observe('before save', function(ctx, next) {
        if (ctx.data) {
            ctx.data.type = 'member';
        } else if (ctx.instance) {
            ctx.instance.type = 'member';
        }
        next();
    });

    Subscription.afterJsonApiSerialize = function(options, callback) {
        // console.log(options.model.app.request);
        if (Array.isArray(options.results.data)) {
            var baseUrl = utils.findBaseUrl(options.topLevelLinks.self,
                    'Subscriptions');
            for (var i = options.results.data.length - 1; i >= 0; i--) {
                delete options.results.data[i].relationships.user;
                if (baseUrl) {
                    options.results.data[i] = utils.createSelfLink(
                            options.results.data[i], baseUrl,
                            options.results.data[i].type,
                            options.results.data[i].id);
                } else {
                    if (options.results.data[i].links.self) {
                        baseUrl = utils.findBaseUrl(
                                options.results.data[i].links.self,
                                'Subscriptions');
                    }
                }
                if (baseUrl && options.results.data[i].relationships) {
                    Object
                            .keys(options.results.data[i].relationships)
                            .forEach(
                                    function(key, index) {
                                        if (options.results.data[i].relationships[key].data) {
                                            options.results.data[i].relationships[key].data = utils
                                                    .createSelfLinks(
                                                            options.results.data[i].relationships[key].data,
                                                            baseUrl);
                                        }
                                    });
                }
            }
        } else {
            delete options.results.data.relationships.user;
        }
        callback(null, options);
    };
};
