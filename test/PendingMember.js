'use strict';

const should = require('chai').should();
var request = require('supertest-as-promised');
var expect = require('chai').expect;
var app = require('../server/server');
var debug = require('debug')('innergerbil:test:PendingMember');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
const stripServerPath = common.stripServerPath;
var LUser, Transaction, Group;
var responseCodes = common.responses;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};

var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
var LOGGED_IN_MEMBER = {
  id: 'fa17e7f5-ade9-49d4-abf3-dc3722711504',
  username: 'stevenb',
  password: 'bar'};
var LOGGED_IN_PENDING = {
  id: 'ca17e7f5-ade9-49d4-abf3-ab3722711504',
  username: 'gloriast',
  password: 'bar'
}
var MODEL_ROOT = '/api/PendingMemberships';
var pending = {};

describe('/PendingMembers', function() {
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
            LUser.login(LOGGED_IN_PENDING, function(err3, token3) {
              if (err3) {
                done(err3);
              } else {
                LOGGED_IN_PENDING.loggedInAccessToken = token3;
                done();
              }
            });
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
        if (err2) return done(err2);
        LOGGED_IN_MEMBER.loggedInAccessToken = undefined;
        LUser.logout(LOGGED_IN_PENDING.loggedInAccessToken.id, function(err3) {
          if (err3) return done(err3);
          LOGGED_IN_PENDING.loggedInAccessToken = undefined;
          done();
        });
      });
    });
  });

  describe('As Anonymous it: ', function() {
    it('Must not be allowed to list PendingMemberships', function(done) {
      jsonapi('get', MODEL_ROOT)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to access a PendingMembership', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to create a PendingMembership', function() {
      var membershipRequest = {};
      membershipRequest.data = {};
      membershipRequest.data.type = 'PendingMembership';
      membershipRequest.data.attributes = {};
      membershipRequest.data.attributes.id = common.generateUUID();
      return jsonapi('post', MODEL_ROOT)
      .send(membershipRequest)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be allowed to update a PendingMembership', function() {
      var membershipRequest = {};
      membershipRequest.data = {};
      membershipRequest.data.type = 'PendingMembership';
      membershipRequest.data.attributes = {};
      membershipRequest.data.attributes.id = common.ids.PENDING_MEMBERSHIP;
      return jsonapi('put', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP)
      .send(membershipRequest)
      .expect(responseCodes.UNAUTHORIZED);
    });
    it('Must not be allowed to delete a PendingMembership', function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP)
      .expect(responseCodes.UNAUTHORIZED);
    });
  });

  describe('As Authenticated User it: ', function() {
    it('Must not be allowed to list PendingMemberships', function(done) {
      jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to access a PendingMembership', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must be allowed to create a PendingMembership in an accessible group', function() {
      var membershipRequest = { data: {attributes: {}}};
      membershipRequest.data.id = common.generateUUID();
      membershipRequest.data.attributes.from = LOGGED_IN_USER.id;
      membershipRequest.data.attributes.to = common.ids.LETS_HAMME;
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .send(membershipRequest)
      .expect(responseCodes.OK)
      .then(response => pending = response.body);      
    });
    it('Must not be allowed to create a PendingMembership in a private group');
  });

  describe('As a pending group member it: ', function() {
    it('Must not be allowed to list PendingMemberships', function(done){
      jsonapi('get', MODEL_ROOT, LOGGED_IN_PENDING.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must be allowed to access own PendingMembership', function(done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP, LOGGED_IN_PENDING.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must not be allowed to update ones PendingMembership', function() {
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP, LOGGED_IN_PENDING.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(function(res) {
        var update = {};
        var selfURL = '';
        update.data = res.body.data
        selfURL = update.data.links.self;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.status = 'approved';
        return jsonapi('put', stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.UNAUTHORIZED);
      });
    });
    it('Must be allowed to delete ones PendingMembership', function(done) {
      jsonapi('delete', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP, LOGGED_IN_PENDING.loggedInAccessToken.id, false)
      .expect(responseCodes.NO_CONTENT, done);
    });
    it('Must not be allowed to access not owned PendingMembership', function() {
      return jsonapi('get', MODEL_ROOT + '/' + pending.data.id, LOGGED_IN_PENDING.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED);      
    });
    it('Must not be allowed to create a PendingMembership for the same group', function () {
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP, LOGGED_IN_PENDING.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var membershipRequest = response.body;
        membershipRequest.data.id = common.generateUUID();
        membershipRequest.data.attributes.from = membershipRequest.data.relationships.member.data.id;
        membershipRequest.data.attributes.to = membershipRequest.data.relationships.group.data.id;
        delete membershipRequest.data.relationships;
        delete membershipRequest.data.links;
        return jsonapi('post', MODEL_ROOT, LOGGED_IN_PENDING.loggedInAccessToken.id)
        .send(membershipRequest)
        .expect(responseCodes.CONFLICT);
      });
    });
  });

  describe('As a member it: ', function() {
    it('Must not be allowed to list PendingMemberships', function (done) {
      jsonapi('get', MODEL_ROOT, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to access a PendingMembership', function (done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must not be allowed to create a PendingMembership for a member group', function() {
      var membershipRequest = {data:{ attributes:{}}};
      membershipRequest.data.id = common.generateUUID();
      membershipRequest.data.attributes.from = LOGGED_IN_MEMBER.id;
      membershipRequest.data.attributes.to = common.ids.LETS_LEBBEKE;
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .send(membershipRequest)
      .expect(responseCodes.BAD_REQUEST);
    });
  });

  describe('As a group admin it: ', function() {
    it('Must not be allowed to list PendingMemberships', function (done) {
      jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.UNAUTHORIZED, done);
    });
    it('Must be allowed to access PendingMembership for group', function (done) {
      jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to update PendingMembership for group', function () {
      //TODO: MUST not allow update of keys
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var update = response.body;
        update.data.attributes.to = common.ids.LETS_DENDERMONDE;
        update.data.attributes.deletedAt = new Date();
        update.data.attributes.isDeleted = true;
        var selfURL = update.links.self;
        delete update.links;
        delete update.data.relationships;
        return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.OK)
      })
    });
    it('Must be allowed to approve PendingMembership for group', function () {
      //TODO: MUST not allow update of keys
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var update = response.body;
        update.data.attributes.status = 'approved';
        var selfURL = update.links.self;
        delete update.links;
        delete update.data.relationships;
        return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.OK)
      })
    });
    it('Must be allowed to reject PendingMembership for group', function () {
      //TODO: MUST not allow update of keys
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var update = response.body;
        update.data.attributes.status = 'rejected';
        var selfURL = update.links.self;
        delete update.links;
        delete update.data.relationships;
        return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.OK)
        .expect(res => { debug(res.body);if(res.body.status !='rejected'){throw new Error('Status not changed to "rejected":' + res.body.status)}});
      })
    });
    it('Must not be allowed to set unsupported state for PendingMembership for group', function () {
      //TODO: MUST not allow update of keys
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var update = response.body;
        update.data.attributes.status = "MY STATE";
        var selfURL = update.links.self;
        delete update.links;
        delete update.data.relationships;
        return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.BAD_REQUEST);
      })
    });
    it('Must not be allowed to undelete PendingMembership for group', function () {
      //TODO: MUST not allow update of keys
      return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK)
      .then(response => {
        var update = response.body;
        update.data.attributes.to = common.ids.LETS_DENDERMONDE;
        update.data.attributes.deletedAt = new Date();
        update.data.attributes.isDeleted = true;
        var selfURL = update.links.self;
        delete update.links;
        delete update.data.relationships;
        return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(responseCodes.OK)
      });
    });
    it('Must be allowed to delete PendingMembership for group' , function() {
      return jsonapi('delete', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id, false)
      .expect(responseCodes.NO_CONTENT)
      .then(response => {
        return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
        .expect(responseCodes.NOT_FOUND);
      })
    });
  });

  describe('As a system admin it: ', function() {
    //TODO: use proper system admin account!!
    it('Must be allowed to list PendingMembership', function(){
    	jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.OK, done);
    });
    it('Must be allowed to create PendingMembership for self', function() {
		  var membershipRequest = { data: {attributes: {}}};
		  membershipRequest.data.id = common.generateUUID();
		  membershipRequest.data.attributes.from = LOGGED_IN_USER.id;
		  membershipRequest.data.attributes.to = common.ids.LETS_HAMME;
		  return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
		  .send(membershipRequest)
		  .expect(responseCodes.OK)
		  .then(response => pending = response.body);    
    });
    it('Must be allowed to create PendingMembership for someone else', function() {
    	var membershipRequest = { data: {attributes: {}}};
	    membershipRequest.data.id = common.generateUUID();
	    membershipRequest.data.attributes.from = LOGGED_IN_MEMBER.id;
	    membershipRequest.data.attributes.to = common.ids.LETS_HAMME;
	    return jsonapi('post', MODEL_ROOT, LOGGED_IN_MEMBER.loggedInAccessToken.id)
	    .send(membershipRequest)
	    .expect(responseCodes.OK)
	    .then(response => pending = response.body);    
    });
    it('Must be allowed to update PendingMembership', function() {
		 return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
		 .expect(responseCodes.OK)
		 .then(response => {
		   var update = response.body;
		   update.data.attributes.to = common.ids.LETS_DENDERMONDE;
		   update.data.attributes.deletedAt = new Date();
		   update.data.attributes.isDeleted = true;
		   var selfURL = update.links.self;
		   delete update.links;
		   delete update.data.relationships;
		   return jsonapi('put', common.stripServerPath(selfURL), LOGGED_IN_USER.loggedInAccessToken.id)
		   .send(update)
		   .expect(responseCodes.OK)
		 })
    });
    it('Must be allowed to delete PendingMembership', function() {
        return jsonapi('delete', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id, false)
        .expect(responseCodes.NO_CONTENT)
        .then(response => {
          return jsonapi('get', MODEL_ROOT + '/' + common.ids.PENDING_MEMBERSHIP_LEBBEKE, LOGGED_IN_USER.loggedInAccessToken.id)
          .expect(responseCodes.NOT_FOUND);
        })
      });
    });
});
