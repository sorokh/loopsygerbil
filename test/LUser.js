'use strict';

var should = require('chai').should();
var supertest = require('supertest');
var request = supertest('http://127.0.0.1:3000');
var app = require('../server/server');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
var LUser;
var responseCodes = common.responses;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};
var debug = require('debug')('loopsy:test:LUser');
var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
/*
TODO: add destroy method to prototype!
*/

describe('access control - integration', function() {
  before(function(done) {
    LUser = app.models.LUser;
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
        done();
      }
    });
  });

  afterEach(function(done) {
    LUser.logout(LOGGED_IN_USER.loggedInAccessToken.id, function(err) {
      if (err) return done(err);
      LOGGED_IN_USER.loggedInAccessToken = undefined;
      done();
    });
  });

  describe('/Users', function() {
    describe('As Anonymous it:', function() {
      it('Must not be possible to list Users', function(done) {
        jsonapi('get', '/api/Users')
        .expect(404, done);
      });

      it('Must not be allowed to access a User', function(done) {
        jsonapi('get', '/api/Users/' + USER.id)
        .expect(401, done);
      });

      it('Must not be allowed to access /me as an Anonymous', function(done) {
        jsonapi('get', '/api/Users/me')
        .expect(401, done);
      });
      it('Must be allowed to subscribe with local credentials');
      it('Must be allowed to subscribe with Facebook credentials');
      it('Must be allowed to subscribe with Google credentials');
    });

    describe('As Authenticated User it:', function() {
      it('Must not be allowed to access a User that is not self', function(done) {
        jsonapi('get', '/api/Users/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
        .expect(401, done);
      });

      it('Must be allowed to access ones self', function(done) {
        jsonapi('get', '/api/Users/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
        .expect(200, done);
      });

      it('Must be allowed to access /me as an Authenticated User',
        function(done) {
          jsonapi('get', '/api/Users/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
          .expect(function(res) {
            if (res.body.data.id != LOGGED_IN_USER.id) {
              throw new Error('wrong User fetched');
            }
          })
          .expect(200, done);
        });
      it('Must not be allowed to unsubscribe if you still have active subscriptions?');
      it('Must be allowed to unsubscribe if you have no active subscriptions.');
    });
/*
	    lt.it.shouldNotBeFoundWhenCalledAnonymously('GET', '/api/Users');
	    lt.it.shouldBeDeniedWhenCalledUnauthenticated('GET', '/api/Users');
	    lt.it.shouldBeDeniedWhenCalledByUser(CURRENT_USER, 'GET', '/api/Users');

	    lt.it.shouldBeDeniedWhenCalledAnonymously('GET', urlForUser);
	    lt.it.shouldBeDeniedWhenCalledUnauthenticated('GET', urlForUser);
	    lt.it.shouldBeDeniedWhenCalledByUser(CURRENT_USER, 'GET', urlForUser);

	    function urlForUser() {
	      return '/api/users/' + this.randomUser.id;
	    }
	    var userCounter;
	    function newUserData() {
	      	userCounter = userCounter ? ++userCounter : 1;

	      	return {
	        	email: 'new-' + userCounter + '@test.test',
	        	password: 'test',
      		};
    	}*/
  	});
});
