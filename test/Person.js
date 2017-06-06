'use strict';

var chai = require('chai');
chai.use(require('chai-datetime'));
var should = chai.should;
var request = require('supertest-as-promised');
var expect = chai.expect;
var app = require('../server/server');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
const stripServerPath = common.stripServerPath;
const responseCodes = common.responses;
var LUser, Person;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};
var debug = require('debug')('loopsy:test:Person');
var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
var LOGGED_IN_MEMBER = {
  id: 'fa17e7f5-ade9-49d4-abf3-dc3722711504',
  username: 'stevenb',
  password: 'bar'};
var TEST_ROOT = 'http://127.0.0.1:3000';
var testPerson = {id: '', data: {}};

/**
* Unit Tests
*
*/
describe('/People', function() {
  before(function(done) {
    LUser = app.models.LUser;
    Person = app.models.Person;
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
    testPerson.id = common.generateUUID();
    testPerson.data.name = common.randomString(30);
    testPerson.data.alias = common.randomString(10);
    testPerson.data.dataofbirth = Date.now();
  });

  afterEach(function(done) {
    LUser.logout(LOGGED_IN_USER.loggedInAccessToken.id, function(err) {
      if (err) return done(err);
      LOGGED_IN_USER.loggedInAccessToken = undefined;
      done();
    });
  });

  describe('As Anonymous it: ', function() {
    it('Must not be allowed to list People.', function() {
      jsonapi('get', '/api/People')
      .expect(401);
    });

    it('Must not be allowed to access a Person.', function() {
      jsonapi('get', '/api/People/' + LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(401);
    });

    it('Must not be allowed to create a Person', function() {
      jsonapi('post', '/api/People')
      .send(testPerson.toString())
      .expect(401);
    });

    it('Must not be allowed to update a Person.', function() {
      jsonapi('put', '/api/People/' + LOGGED_IN_USER.loggedInAccessToken.id)
      .send({alias: 'Tester'})
      .expect(401);
    });

    it('Must not be allowed to patch a Person.', function() {
      jsonapi('patch', '/api/People/' + LOGGED_IN_USER.loggedInAccessToken.id)
      .send({alias: 'Tester'})
      .expect(401);
    });

    it('Must not be allowed to delete a Person.', function() {
      jsonapi('delete', '/api/People/' + LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(401);
    });
  });

  describe('As Authenticated User it: ', function() {
    it('Must be allowed to list People.', function(done) {
      jsonapi('get', '/api/People', LOGGED_IN_USER.loggedInAccessToken.id)
				.expect(200, done);
    });

    it('Must be allowed to access a Person.', function(done) {
      jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
				.expect(200, done);
    });

    it('Must have correct references in Person respons.', function(done) {
      jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
			.expect(
        function(res) {
          var Errors = [];
          if (!res.body.data.relationships.subscriptions) Errors.push(new Error('Missing subscriptions'));
          if (!res.body.data.relationships.subscribedTo) Errors.push(new Error('Missing subscribed groups'));
          if (!res.body.data.relationships.contactdetails) Errors.push(new Error('Missing contactdetails'));
          if (!res.body.data.relationships.accessibleMembers) Errors.push(new Error('Missing accessible members'));
          if (!res.body.data.relationships.accessibleGroups) Errors.push(new Error('Missing accessible groups'));
          if (res.body.data.relationships.user) Errors.push(new Error('Must not contain user relationship'));
          if (Errors.lenght > 0) throw new Error(Errors);
        })
			.expect(200, done);
    });

    it('Must not be allowed to create a Person', function() {
      jsonapi('post', '/api/People', LOGGED_IN_USER.loggedInAccessToken.id)
      .send(testPerson.toString())
      .expect(401);
    });

    it('Must not be allowed to access subscriptions of someone else', function() {
      var token = LOGGED_IN_USER.loggedInAccessToken.id;
      jsonapi('get', '/api/People/' + USER.id, token)
      .then(function(res) {
        return jsonapi('get', stripServerPath(res.body.data.relationships.subscriptions.links.related),
          token)
        .expect(401);
      });
    });

    it('Must be allowed to access subscribed public/protected groups of someone else', function() {
      var token = LOGGED_IN_USER.loggedInAccessToken.id;
      return jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
			.then(
        function(res) {
          return jsonapi('get', stripServerPath(res.body.data.relationships.subscriptions.links.related),
            LOGGED_IN_USER.loggedInAccessToken.id)
          .expect(function(resp) {              
            for (var i = resp.body.data.length - 1; i >= 0; i--) {
              if (resp.body.data[i].attributes.visibility != 'public') {
                throw new Error('Found non public group!');
              }
            }
          })
					.expect(200);
        });
    });

    it('Must not be allowed to access subscribed private groups of someone else', function() {
      return jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .then(
        function(res) {
          return jsonapi('get', stripServerPath(res.body.data.relationships.subscribedTo.links.related),
            LOGGED_IN_USER.loggedInAccessToken.id)
          .expect(function(res) {
            for (var i = res.body.data.length - 1; i >= 0; i--) {
              if (res.body.data[i].attributes.visibility == 'private') {
                throw new Error('Found private group!');
              }
            }
          })
          .expect(200);
        });
    });

    it('Must have correct references to contactdetails in Person respons.');

    it('Must not be allowed to patch someone else.', function() {
      return jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        update.data = res.body.data;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.dateofbirth = '1973-12-01';
        update.data.attributes.alias = 'Tester';
        return jsonapi('patch', '/api/People/' +  USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(401);
      });
    });

    it('Must not be allowed to update someone else.', function() {
      return jsonapi('get', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        var update = {};
        update.data = res.body.data;
        delete update.data.relationships;
        delete update.data.links;
        update.data.attributes.dateofbirth = '1973-12-01';
        update.data.attributes.alias = 'Tester';
        return jsonapi('put', '/api/People/' +  USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
        .send(update)
        .expect(401);
      });
    });

    it('Must not be allowed to delete someone else', function() {
      return jsonapi('delete', '/api/People/' + USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(404);
    });
  });

  describe('As Owner it: ', function() {
    it('Must be allowed to access accessible Members', function() {
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id + '/accessibleMembers', LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(200);
    });

    it('Must be allowed to access subscriptions.', function() {
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .then(
        function(res) {
          return jsonapi('get', stripServerPath(res.body.data.relationships.subscriptions.links.related),
            LOGGED_IN_USER.loggedInAccessToken.id)
          .expect(200);
        });
    });

    it('Must be allowed to access subscribed groups.', function() {
      return jsonapi('get', '/api/People/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .then(function(res) {
        return jsonapi('get', stripServerPath(res.body.data.relationships.subscribedTo.links.related),
          LOGGED_IN_USER.loggedInAccessToken.id)
        .expect(200);
      });
    });

    it('Must have correct links available when accessing Person as Allowed user', function(done) {
      jsonapi('get', '/api/People/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
				.expect(
          function(res) {
            var Errors = [];
            if (!res.body.data.relationships.subscriptions) Errors.push(new Error('Missing subscriptions'));
            if (!res.body.data.relationships.subscribedTo) Errors.push(new Error('Missing subscribed groups'));
            if (!res.body.data.relationships.contactdetails) Errors.push(new Error('Missing contactdetails'));
            if (!res.body.data.relationships.accessibleMembers) Errors.push(new Error('Missing accessible members'));
            if (!res.body.data.relationships.accessibleGroups) Errors.push(new Error('Missing accessible groups'));
            if (res.body.data.relationships.user) Errors.push(new Error('Must not contain user relationship'));
            if (Errors.lenght > 0) throw new Error(Errors);
          })
				.expect(200, done);
    });

    it('Must be allowed to update self.', function() {
      var now = new Date();
      return jsonapi('put', '/api/People/' +  LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
      .send({
        data: {
          id: LOGGED_IN_USER.id,
          type: 'People',
          attributes: {
            alias: 'Tester'}}})
      .expect(200)
      .then(
        function() {
          return jsonapi('get', '/api/People/' +  LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
          .then(
            function(res) {
              expect(new Date(res.body.data.attributes.lastmodified)).to.be.afterTime(now);
              return expect(res.body.data.attributes.alias).to.equal('Tester');
            });
        }
      );
    });

    it('Must not be allowed to delete self', function() {
      jsonapi('delete', '/api/People/' + LOGGED_IN_USER.id, LOGGED_IN_USER.loggedInAccessToken.id)
    		.expect(404);
    });
  });
  describe('As System admin it: ', function() {
  });
});
