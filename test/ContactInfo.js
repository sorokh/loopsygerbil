'use strict';

var should = require('chai').should();
var request = require('supertest-as-promised');
var expect = require('chai').expect;
var app = require('../server/server');
var assert = require('assert');
var loopback = require('loopback');
var common = require('./common.js');
const jsonapi = common.jsonapi;
const stripServerPath = common.stripServerPath;
const responseCodes = common.responses;
var LUser, Message, Person;
var USER = {name: 'test', email: 'test@test.test', password: 'test'};
var CURRENT_USER = {name: 'test', email: 'current@test.test', password: 'test'};
var debug = require('debug')('loopsy:test:ContactInfo');
var LOGGED_IN_USER = {
  id: '5df52f9f-e51f-4942-a810-1496c51e64db',
  username: 'annadv',
  password: 'bar'};
var LOGGED_IN_MEMBER = {
  id: 'fa17e7f5-ade9-49d4-abf3-dc3722711504',
  username: 'stevenb',
  password: 'bar'};
var TEST_ROOT = 'http://127.0.0.1:3000';
var MODEL_ROOT = '/api/ContactInfos';

describe('/ContactInfo', function() {
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
    it('Must not be allowed to list ContactInfo.', function() {
      jsonapi('get', MODEL_ROOT)
      .expect(responseCodes.FORBIDDEN);
    });
  });

  describe('As Authenticated user it:', function() {
    it('Must not be allowed to list ContactInfo', function() {
      jsonapi('get', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .expect(responseCodes.FORBIDDEN);
    });
    it('Must be possible to create a ContactInfo for self.', function() {
      var contact = common.testData('ContactInfo');
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .send(contact)
      .expect(responseCodes.OK);
    });
    it('Must not be possible to create a ContactInfo for a group.', function() {
      var contact = common.testData('ContactInfo');
      contact.data.attributes.partyId = common.ids.LETS_DENDERMONDE;
      contact.data.attributes.partytype = 'Group';
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .send(contact)
      .expect(responseCodes.FORBIDDEN);
    });
    it('Must not be possible to create a ContactInfo for not self', function() {
      var contact = common.testData('ContactInfo');
      contact.data.attributes.partyId = common.ids.LEEN;
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .send(contact)
      .expect(responseCodes.FORBIDDEN);
    });
    it('Must be possible to delete own contact');
  });

  describe('As authenticated member it:', function() {
    it('Must not be possible to create a ContactInfo for a member group', function() {
      var contact = common.testData('ContactInfo');
      contact.data.attributes.partyId = common.ids.LETS_LEBBEKE;
      contact.data.attributes.partytype = 'Group';
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_MEMBER.loggedInAccessToken.id)
      .send(contact)
      .expect(responseCodes.FORBIDDEN);
    });
  });

  describe('As authenticated admin it:', function() {
    it('Must be possible to create a ContactInfo for the group you are admin of.', function() {
      var contact = common.testData('ContactInfo');
      contact.data.attributes.partyId = common.ids.LETS_LEBBEKE;
      contact.data.attributes.partytype = 'Group';
      return jsonapi('post', MODEL_ROOT, LOGGED_IN_USER.loggedInAccessToken.id)
      .send(contact)
      .expect(responseCodes.OK);
    });
  });

  describe('As system admin it:', function() {
    it('Must be allowed to list all messages');
  });
});
