'use strict';

var should = require('chai').should();
var request = require('supertest-as-promised');
var expect = require('chai').expect;
var app = require('../server/server');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
var LUser, Transaction, Person;
var responseCodes = common.responses;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};
var debug = require('debug')('loopsy:test:Transactions');
var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
var TEST_ROOT = 'http://127.0.0.1:3000';

describe('/Transactions', function() {
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
  });

  afterEach(function(done) {
    LUser.logout(LOGGED_IN_USER.loggedInAccessToken.id, function(err) {
      if (err) return done(err);
      LOGGED_IN_USER.loggedInAccessToken = undefined;
      done();
    });
  });

  describe('As Anonymous it: ', function() {
    it('Must not be allowed to list Transactions.', function() {
      jsonapi('get', '/api/Transactions')
      .expect(401);
    });
  });

  describe('As Authenticated User it: ', function() {
    it('Must not be allowed to list Transactions', function() {
      jsonapi('get', '/api/Transactions')
			.set('authorization', LOGGED_IN_USER.loggedInAccessToken.id)
			.expect(401);
    });
    xit('Must be allowed to create transaction from self to allowed person.', function() {
      jsonapi('put', '/api/Transactions')
    });
		it('Must not be allowed to create transaction with negative value.');
		it('Must not be allowed to create transaction from someone else.');
	});
	describe('As Owner it: ', function(){
		it('Must not be allowed to update a transaction.');
		it('Must not be allowed to update a transaction');
		it('Must not be allowed to delete a transaction.');
	});
	describe('As Group Admin it: ', function(){
		it('Must be allowed to create transactions for others');
		it('Must not be allowed to update a transaction');
		it('Must not be allowed to delete a transaction.');
	});
	describe('As System admin it: ', function(){
		it('Must be allowed to create transactions for others');
		it('Must not be allowed to update a transaction');
		it('Must not be allowed to delete a transaction.');
	});
});