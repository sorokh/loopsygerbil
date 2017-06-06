'use strict';

var should = require('chai').should();
var request = require('supertest-as-promised');
var expect = require('chai').expect;
var app = require('../server/server');
var debug = require('debug')('loopsy:test:Message');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
const stripServerPath = common.stripServerPath;
const responseCodes = common.responses;

var LUser, Message, Person, Group;
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
var MODEL_ROOT = '/api/Messages';

describe.only('/Messages', function() {
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
    it('Must not be allowed to list all messages.', function() {
      jsonapi('get', MODEL_ROOT)
      .expect(401);
    });
  });

  describe('As Authenticated user it:', function() {
    it('Must only list messages that you own are in the audience of.', function() {
     return  jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(200)
      .expect(function(res) {
        var Errors = [];
        res.body.data.forEach(function(element, index) {
          if (!element.relationships.owner.data.id === LOGGED_IN_USER.loggedInAccessToken.id) {
            Errors.push(new Error('Not owned Message Found #' + element.id));
          }
        });
        if (Errors.length > 0) throw new Error(Errors);
      });
    });
    it('Must be possible to access your own message', function() {
    	return jsonapi('get', MODEL_ROOT+'/'+ common.ids.MESSAGE_ANNA_WINDOWS, LOGGED_IN_USER.loggedInAccessToken.id)
		.expect(responseCodes.OK);
	});
    it.only('Must be possible to create a message.', function() {
    	var message = common.testData('Message');
    	message.data.attributes.partyId = LOGGED_IN_USER.id;
    	return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
    	.send(message)
    	.expect(responseCodes.CREATED);
    });
    it('Must not be possible to create a message in the name of someone else.');
    it('Must be possible to reply to a message.');
    it('Must be not possible to create a group message.');
    it('Must be possible to update your own message.');
    it('Must not be possible to update replies to your own messages');
    it('Must not be possible to update not owned visible message.');
    it('Must be possible to delete your own message.');
    it('Must delete replies to your message if you delete it.');
  });
  
  describe('As pending member it', function() {
	it('Must not be possible to create a message for groups you have a pending membership.');
  });

  describe('As authenticated member it:', function() {
	it('Must only list messages that you own are in the audience of.', function() {
	});
	it('Must be possible to create a group message.');
	it('Must not be possible to create a group message for a non-accessible group.');
	it('Must not be possible to create a group message for an accessible non member group');
	it('Must be possbile to reply to messages in an accessible non member group.');
  });
  describe('As system admin it:', function() {
    it('Must be allowed to list all messages');
  });
});
