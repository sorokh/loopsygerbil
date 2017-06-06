'use strict';

const should = require('chai').should();
var request = require('supertest-as-promised');
var expect = require('chai').expect;
var app = require('../server/server');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
const stripServerPath = common.stripServerPath;
var LUser, Transaction, Group;
var responseCodes = common.responses;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};
var debug = require('debug')('loopsy:test:Groups');
var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
var LOGGED_IN_MEMBER = {
  id: 'fa17e7f5-ade9-49d4-abf3-dc3722711504',
  username: 'stevenb',
  password: 'bar'};
var MODEL_ROOT = '/api/Groups';

describe('/Groups', function() {
  before(function(done) {
    LUser = app.models.LUser;
    Group = app.models.Group;
    LUser.upsert(USER, function(err, instance) {
      if (!err) {
        USER = instance;
        done();
      } else {
        LUser.findOne(USER, function(err, instance) {
          if (!err) {
            USER = instance;
          } else {
            console.log(err);
          }
          done();
        });
      }
    });
  });

  beforeEach(function(done) {
    LUser.login(LOGGED_IN_USER, function(err, token) {
      if (err) {
        done(err);
      } else {
        LOGGED_IN_USER.loggedInAccessToken = token;
        LUser.login(LOGGED_IN_MEMBER, function(err2, token2) {
          if (err2) {
            done(err2);
          } else {
            LOGGED_IN_MEMBER.loggedInAccessToken = token2;
            done();
          }
        });
      }
    });
  });

  afterEach(function(done) {
    LUser.logout(LOGGED_IN_USER.loggedInAccessToken.id, function(err) {
      if (err) return done(err);
      LOGGED_IN_USER.loggedInAccessToken = undefined;
      LUser.logout(LOGGED_IN_MEMBER.loggedInAccessToken.id, function(err2) {
        if(err2) return done(err2);
        LOGGED_IN_MEMBER.loggedInAccessToken = undefined;
        done();
      });
    });
  });

  describe('As Anonymous it: ', function() {
    it('Must not be allowed to list Groups.', function(done) {
      jsonapi('get', MODEL_ROOT)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to access a Group.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to create a Group');
    it('Must not be allowed to update a Group.', function(done) {
      jsonapi('put', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE)
      .send({alias: 'Tester'})
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to delete a Group.', function(done) {
      jsonapi('delete', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
  });
  describe('As Authenticated User it: ', function() {
    it('Must be allowed to list Groups.', function(done) {
      jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to access a Group.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must not be allowed to create a Group');
    it('Must have correct references in Group response.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(function(res) {
        var Errs = [];
        if (!res.body.data.relationships.members) {
          Errs.push(new Error('Missing members'));
        }
        if (!res.body.data.relationships.memberAccounts) {
          Errs.push(new Error('Missing member accounts'));
        }
        if (!res.body.data.relationships.admins) {
          Errs.push(new Error('Missing admins'));
        }
        if (!res.body.data.relationships.contactDetails) {
          Errs.push(new Error('Missing contactdetails'));
        }
        if (!res.body.data.relationships.messages) {
          Errs.push(new Error('Missing messages'));
        }
        if (!res.body.data.relationships.parent) {
          Errs.push(new Error('Missing parent'));
        }
        if (!res.body.data.relationships.subgroups) {
          Errs.push(new Error('Missing subgroups'));
        }
        if (res.body.data.relationships.user) {
          Errs.push(new Error('Must not contain user relationship'));
        }
        if (Errs.length > 0) throw new Error(Errs);
      })
      .expect(responseCodes.OK, done);
    });
    it('Must not be allowed to list members.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME + '/members')
      .set('authorization', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to list group member accounts.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME + '/memberAccounts')
      .set('authorization', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to list group Transactions.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME + '/transactions')
      .set('authorization', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must be allowed to list only public contactdetails.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME + '/contactDetails', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(function(res) {
        var Errors = [];
        res.body.data.forEach(function(element, index) {
          if (!element.attributes.public) {
            Errors.push(new Error('Non Public ContactDetail Found #' + element.id));
          }
        });
        if (Errors.length > 0) throw new Error(Errors);
      })
      .expect(responseCodes.OK, done);
    });
    it('Must not be allowed to access group contactdetails via nesting', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_DENDERMONDE + '/contactDetails/' +
        common.ids.CONTACTDETAIL_ADDRESS_LETSDENDERMONDE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.NOT_FOUND, done);
    });
    it('Must not be allowed to update group contactdetails via provided url', function() {
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_DENDERMONDE + '/contactDetails', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data.find(function(el) {
          return el.id === common.ids.CONTACTDETAIL_ADDRESS_LETSDENDERMONDE;
        });
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.street = 'Beekveldlaan';
        return jsonapi('put', stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(401);
      });
    });
    it('Must not be allowed to update group', function() {
      return jsonapi('get',  MODEL_ROOT + '/' + common.ids.LETS_DENDERMONDE,
        LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data;
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.currencyname = 'dollar';
        return jsonapi('put', stripServerPath(selfURL),  LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.UNAUTHORIZED);
      });
    });
    it('Must not be allowed to delete group', function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.LETS_DENDERMONDE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be allowed to request membership of an accessible group via group relation', function() {
      var person = {};
      person.data = {};
      person.data.type = 'Person';
      person.data.attributes = {};
      person.data.attributes.id = LOGGED_IN_USER.id;
      return jsonapi('post', MODEL_ROOT + '/' + common.ids.LETS_DENDERMONDE + '/' + 'members', LOGGED_IN_USER.loggedInAccessToken.id)
      .send(person)
      .expect(responseCodes.NOT_FOUND);
    })
    it('Must not be allowed to authorize membership request', function() {
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res){
        var pendingSubscription = res.body.data.find(function(el){
          return el.attributes.status === 'active';
        });
        var update = {"data":{}};
        update.data.type = pendingSubscription.type;
        update.data.id = pendingSubscription.id;
        update.data.attributes = pendingSubscription.attributes;
        update.data.attributes.status = 'approved';
        return jsonapi('post', MODEL_ROOT + '/' + pendingSubscription.relationships.group.data.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id, false)
        .send(update)
        .expect(responseCodes.NOT_FOUND)
        .then(function(res){
          return jsonapi('put', stripServerPath(pendingSubscription.links.self), LOGGED_IN_USER.loggedInAccessToken.id, false)
          .send(update)
          .expect(responseCodes.UNAUTHORIZED);
        });
      })
    });
  });
  describe('As pending group member it:', function() {
    it('Must not be possible to list members', function() {
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_HAMME + '/' + 'members', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be possible to update membership', function() {
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res){
        var pendingSubscription = res.body.data.find(function(el){
          return el.attributes.status === 'active';
        });
        var update = {"data":{}};
        update.data.type = pendingSubscription.type;
        update.data.id = pendingSubscription.id;
        update.data.attributes = pendingSubscription.attributes;
        update.data.attributes.status = 'active';
        return jsonapi('post', MODEL_ROOT + '/' + pendingSubscription.relationships.group.data.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id, false)
        .send(update)
        .expect(responseCodes.NOT_FOUND)
        .then(function(res){
          return jsonapi('put', stripServerPath(pendingSubscription.links.self), LOGGED_IN_USER.loggedInAccessToken.id, false)
          .send(update)
          .expect(responseCodes.UNAUTHORIZED);
        });
      })
    });
    it('Must not be allowed to create a Group');
    it('Must not be allowed to delete group', function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.LETS_HAMME , LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be allowed to update group', function() {
      return jsonapi('get',  MODEL_ROOT + '/' + common.ids.LETS_HAMME,
        LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data;
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.currencyname = 'dollar';
        return jsonapi('put', stripServerPath(selfURL),  LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.UNAUTHORIZED);
      });
    });
  })
  describe('As group member it:', function() {
    it('Must be allowed to access your group.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to list group members', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/members', LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to list group member accounts.', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/memberAccounts', LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to list group Transactions', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/transactions', LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to list group contactdetails', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/contactDetails', LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(function(res) {
        var Errors = [];
        var count = 0;
        res.body.data.forEach(function(element, index) {
          if (!element.attributes.public) {
            count++;
          }
        });
        if (count === 0) throw new Error('Private ContactDetails not Found #');
      })
      .expect(responseCodes.OK, done);
    });
    it('Must not be allowed to access group contactdetails via nesting', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/contactDetails/' +
        common.ids.CONTACTDETAIL_ADDRESS_LETSLEBBEKE, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.NOT_FOUND, done);
    });
    it('Must not be allowed to update group contactdetails via provided url', function() {
      var token = LOGGED_IN_MEMBER.loggedInAccessToken.id;
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE + '/contactDetails', LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(function(res) {
        var update = {};
        var selfURL;
        update.data = res.body.data.find(function(el) {
          return el.id === common.ids.CONTACTDETAIL_ADDRESS_LETSLEBBEKE;
        });
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.street = 'Beekveldlaan';
        return jsonapi('put', stripServerPath(selfURL), LOGGED_IN_MEMBER.loggedInAccessToken.id)
        .send(update)
        .expect(401);
      });
    });
    it('Must not be allowed to update group', function() {
      return jsonapi('get',  MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE,
        LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data;
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.currencyname = 'dollar';
        return jsonapi('put', stripServerPath(selfURL),  LOGGED_IN_MEMBER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.UNAUTHORIZED);
      });
    });
    it('Must not be allowed to create a Group');
    it('Must not be allowed to delete group', function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be allowed to authorize membership request.');
  });
  describe('As group admin it: ', function() {
    it('Must be allowed to update group', function() {
      return jsonapi('get',  MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE,
        LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data;
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.currencyname = 'dollar';
        return jsonapi('put', stripServerPath(selfURL),  LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.OK);
      });
    });
    it('Must not be allowed to create a Group');
    it('Must not be allowed to delete group', function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.LETS_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must be allowed to authorize membership request', function() {
      //TODO!!
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res){
        var pendingSubscription = res.body.data.find(function(el){
          return el.attributes.status === 'active';
        });
        var update = {"data":{}};
        update.data.type = pendingSubscription.type;
        update.data.id = pendingSubscription.id;
        update.data.attributes = pendingSubscription.attributes;
        update.data.attributes.status = 'active';
        return jsonapi('post', MODEL_ROOT + '/' + pendingSubscription.relationships.group.data.id + '/pendingMemberships', LOGGED_IN_USER.loggedInAccessToken.id, false)
        .send(update)
        .expect(responseCodes.NOT_FOUND)
        .then(function(res){
          return jsonapi('put', stripServerPath(pendingSubscription.links.self), LOGGED_IN_USER.loggedInAccessToken.id, false)
          .send(update)
          .expect(responseCodes.UNAUTHORIZED);
        });
      })
    });
    it('Must be allowed to revoke membership');
    it('Must be allowed to give a member group admin rights');
    it('Must be allowed to revoke admin rights for a member');
    it('Must be allowed to revoke admin rights for self unless no other admins available!');
    it('Must be allowed to create a subgroup');
  });
  describe('As System admin it: ', function() {
    it('Must not be allowed to create a Group');
    it('Must be allowed to logically delete a group');
    it('Must be allowed to reactivate a group');
  });
});
