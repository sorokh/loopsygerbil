var app = require('../../server/server');
var utils = require('./utils.js');
var lbUtils = require('loopback-datasource-juggler/lib/utils');
const serialize = require('loopback-jsonapi-model-serializer');
const debug = require('debug')('innergerbil-model-message');
const Person = app.models.Person;
const Group = app.models.Group;

module.exports = function(Message) {
    Message.disableRemoteMethod('__get__aanbod', false);
    Message.disableRemoteMethod('__create__aanbod', false);
    Message.disableRemoteMethod('__delete__aanbod', false);
    Message.disableRemoteMethod('__count__aanbod', false);
    Message.disableRemoteMethod('__get__vragen', false);
    Message.disableRemoteMethod('__create__vragen', false);
    Message.disableRemoteMethod('__delete__vragen', false);
    Message.disableRemoteMethod('__count__vragen', false);
    // prototype methods
    Message.disableRemoteMethod('__get__user', false);

    /**
     * Add Message visibility: - public (default): messages are visible to
     * audience + group subgroup and interlets relations - protected : messages
     * are visible to audience + group subgroup relations - private : messages
     * are visible only to the explicitely defined audience, i.e. not to related
     * groups! Message types: - vraag - aanbod - ... Automatic filter: with
     * logged on user get messages that you own get messages that are for a
     * group you are member of get messages that are not private for parents
     * groups of groups you are member of. get messages that are not private for
     * subgroups of groups you are member of. get messages that are public for
     * groups your member groups have an interlets relation with. filter:
     * partyId === loggedOnUser.id or { partyId != loggedOnUser.id and { {
     * message.audience where partyType === 'person' and partyId ===
     * loggedOnUser.id or message.audience where partyType === 'group' and
     * partyId in loggedOnUser.subscribedTo.ids } or { with messages where
     * visibility != private message.audience where partyType ==='group' and
     * partyId == group.id and group.parents.id in loggedOnUser.subscribedTo.ids
     * or message.audience where partyType ==='group' and partyId == group.id
     * and group.subgroup.id in loggedOnUser.subscribedTo.ids } or { with
     * messages where visibility === public message.audiences where partyType
     * === 'group' and partyId == group.id and group.interletsgroups.id in
     * loggedOnUser.subscribedTo.ids } } } Message access policy. -Read: Owner,
     * Target Group Member, Target Group Admin, Target Person -Write: Owner, if
     * owner is group admin
     */

    Message.prototype.isInAudience = function() {

    }

    Message.messagesForPerson = function(ctx) {

    };

    Message.beforeRemote('find', function(ctx, instance, next) {
        console.log('TRIGGERING BEFORE');
        // get messages for me
        /**
         * messages where 'owner' = me messages where 'to' = me +
         * user.subscribedTo.messages user.subscribedTo.parents -> messages that
         * are not private user.subscribedTo.children -> messages that are not
         * private user.subscribedTo.interlets -> messages that are public
         * 
         */
        // add ids to filter for inclusion in list.
        if (ctx.req.accessToken.userId) {
            var filter = {
                where : {
                    partyId : ctx.req.accessToken.userId
                }
            };
            if (ctx.args.filter) {
                ctx.args.filter = JSON.stringify(lbUtils.mergeQuery(JSON
                        .parse(ctx.args.filter), filter));
            } else {
                ctx.args.filter = JSON.stringify(filter);
            }
            next();
        } else {
            next({
                code : 'AUTHORIZATION_REQUIRED',
                status : 401
            });
        }
    });

    Message.afterRemote('find', function(ctx, output, next) {
        var Group = app.models.Group;
        var Person = app.models.Person;
        var MessageAudience = app.models.MessageAudience;
        var messages = output;
        console.log('TRIGGERING BEFORE');
        console.log(output);
        var groups = [];
        return MessageAudience.find({where: {partyId: ctx.req.accessToken.userId}},{include:"message"})
        .then(function(relations){
           var msgs = []
           for(var rel in relations){
               rel.push(rel.message);
           }
           messages = utils.mergeModelArray(messages,msgs);
           next(null,messages);
        })
        /*return Person.findById(ctx.req.accessToken.userId, {
            include : {
                relation : 'subscribedTo',
                scope : {
                    fields : ['id' ]
                }
            }
        }).then(function(user) {
            var usr = JSON.stringify(user);
            var subscribedgroups = [];
            for(var group in user.subscribedTo){
                subscribedgroups.push(group.id);
            }
            if (subscribedgroups.length >0){
                MessageAudience.find({where: {partyId: {inq: subscribedgroups}}},{fields: {id:true,messageId:true}}, {include:"message"})
                .then(function(audience){
                    var messageIds = [];
                    for(var relation in audience){
                        messageIds.push(relations.from);
                    }
                    Message.find({where: {id: {inq: messageIds}}})
                    .then(function(messages){
                        
                    })
                    })
                }
        })*/
        .catch(function(err){     
           console.error(err);             
           next(err);
        });
    });

    Message.audience = function(id, options, next) {
        var MessageAudience = app.models.MessageAudience;
        var Audience = app.models.Audience;
        var Group = app.models.Group;
        var Person = app.models.Person;

        return MessageAudience.find({
            where : {
                'messageId' : id
            },
            include : 'audience'
        }).then(function(audiences) {
            var res = {};
            res.groups = [];
            res.people = [];
            if (audiences) {
                for (var i = audiences.length - 1; i >= 0; i--) {
                    var entry = audiences[i].toJSON();
                    if (audiences[i].partyType === 'Group') {
                        res.groups.push(new Group(entry.audience));
                    }
                    if (audiences[i].partyType === 'Person') {
                        res.people.push(new Person(entry.audience));
                    }
                }
                ;
            }
            next(null, new Audience(res));
        });
    };

    Message.afterRemote('audience', function(ctx, instance, next) {
        app.models.Audience.jsonApiSerialize({
            topLevelLinks : {
                self : ctx.req.protocol + '://' + ctx.req.get('host')
                        + ctx.req.originalUrl
            },
            results : ctx.result
        }, function(err, options) {
            ctx.result = options.results;
            next();
        });
    });

    Message.afterJsonApiSerialize = function(options, callback) {
        if (Array.isArray(options.results.data)) {
            for (var i = options.results.data.length - 1; i >= 0; i--) {
                delete options.results.data[i].relationships.user;
                options.results.data[i].relationships.audience = utils
                        .createLink(options.results.data[i].links.self
                                + '/audience');
            }
            ;
        } else if (options.results.data) {
            delete options.results.data.relationships.user;
            options.results.data.relationships.audience = utils
                    .createLink(options.results.data.links.self + '/audience');
        }
        callback(null, options);
    };

    Message.remoteMethod('audience', {
        http : {
            path : '/:id/audiences',
            verb : 'get'
        },
        description : 'Get all top level parties that have'
                + ' been granted read access to this message',
        accepts : [
                {
                    arg : 'id',
                    type : 'string',
                    required : true
                }, {
                    arg : 'options',
                    type : 'object',
                    http : 'optionsFromRequest'
                } ],
        returns : [
            {
                arg : 'audience',
                type : 'Audience',
                root : true
            } ]
    });

    Message.remoteMethod('audience', {
        http : {
            path : '/:id/audience',
            verb : 'post'
        },
        description : 'Set all top level parties that are'
                + ' to be granted read access to this message',
        accepts : [
                {
                    arg : 'data',
                    type : 'object',
                    model : 'MessageAudience',
                    required : true,
                    http : {
                        source : 'body'
                    },
                }, {
                    arg : 'options',
                    type : 'object',
                    http : 'optionsFromRequest'
                } ],
        returns : [
            {
                arg : 'audience',
                type : 'MessageAudience',
                root : true
            } ]
    });
};
