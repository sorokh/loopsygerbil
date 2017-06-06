'use strict';

const uuid = require('uuid');
const chai = require('chai');
const expect = chai.expect;
const request = require('supertest-as-promised');
var app = require('../server/server');

exports = module.exports = {

  testData: function(type) {
    var jsonapi = {'data':{'attributes': {}}};
    switch (type) {
      case 'ContactInfo':
      case 'ContactInfo:address':
        jsonapi.data.type = 'ContactInfo';
        jsonapi.data.attributes.id = exports.generateUUID();
        jsonapi.data.attributes.label = 'testaddress';
        jsonapi.data.attributes.public = true;
        jsonapi.data.attributes.street = exports.randomString(50);
        jsonapi.data.attributes.streetnumber = 1;
        jsonapi.data.attributes.zipcode = 'B3130';
        jsonapi.data.attributes.city = exports.randomString(25);
        jsonapi.data.attributes.type = 'address';
        break;
      case 'ContactInfo:email':
        break;
      case 'Message':
    	  jsonapi.data.type = 'Message';
    	  jsonapi.data.attributes.id = exports.generateUUID();
    	  jsonapi.data.attributes.title = exports.randomString(25);
    	  jsonapi.data.attributes.description = exports.randomString(50);
    	break;
      default:
        // statements_def
        break;
    }
    return jsonapi;
  },

  stripServerPath: function(url) {
    var link = url || '';
    link = link.substring(link.indexOf(':') + 1);
    link = link.substring(link.indexOf(':') + 1);
    link = link.substring(link.indexOf('/'));
    return link;
  },

  json: function(verb, url, accesstoken) {
    if (accesstoken) {
      return request(app)[verb](url)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .set('authorization', accesstoken)
      .expect('Content-Type', /json/);
    } else {
      return request(app)[verb](url)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/);
    }
  },

  jsonapi: function(verb, url, accesstoken, validateContentType) {
    var result;
    var contentValidation = validateContentType;
    if(validateContentType == undefined || validateContentType == null) {
      contentValidation = true;
    }
    if (accesstoken) {
      result = request(app)[verb](url)
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json')
      .set('authorization', accesstoken)
      /*.then(function(res) {
        console.log(res);
        return this;
      })*/  ;
    } else {
      result = request(app)[verb](url)
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json');
    }
    if (contentValidation) {
      return result.expect('Content-Type', /json/);
    } else {
      /*result = result.then(function(res){
        console.log(res);
        return this;
      });*/
      return result;
    }
  },

  cl: function(x) {
    console.log(x); // eslint-disable-line
  },

  generateUUID: function() {
    return uuid.v4();
  },

  randomString: function(strLength, charSet) {
    let result = [];

    strLength = strLength || 5;
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789éèçàùëäüï$!?-&@';

    while (--strLength) {
      result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
    }

    return result.join('');
  },

  accounts: {
    ANNA: {
      login: 'annadv',
      password: 'bar'},
    STEVEN: {
      login: 'stevenb',
      password: 'test'},
    EDDY: {
      login: 'eddym',
      password: 'test'},
    EMMANUELLA: {
      login: 'emmanuella',
      password: 'test'},
    WALTER: {
      login: 'waltervh',
      password: 'test'},
    RUDY: {
      login: 'rudir',
      password: 'test'},
    LEEN: {
      login: 'leendb',
      password: 'test'},
    DUMMY: {
      login: 'fake',
      passwork: ''}},

  ids: {
    ANNA: '5df52f9f-e51f-4942-a810-1496c51e64db',
    STEVEN: 'fa17e7f5-ade9-49d4-abf3-dc3722711504',
    RUDI: 'eb6e3ad7-066f-4357-a582-dfb31e173606',
    EDDY: '437d9b64-a3b4-467c-9abe-e9410332c1e5',
    LEEN: 'abcb3c6e-721e-4f7c-ae4a-935e1980f15e',
    GLORIA: 'ca17e7f5-ade9-49d4-abf3-ab3722711504',
    LETS_LEBBEKE: 'aca5e15d-9f4c-4c79-b906-f7e868b3abc5',
    LETS_DENDERMONDE: '8bf649b4-c50a-4ee9-9b02-877aa0a71849',
    LETS_HAMME: '0a98e68d-1fb9-4a31-a4e2-9289ee2dd301',
    CONTACTDETAIL_ADDRESS_LETSDENDERMONDE: '96de9531-d777-4dca-9997-7a774d2d7595',
    CONTACTDETAIL_ADDRESS_LETSLEBBEKE: '3362d325-cf19-4730-8490-583da50e114e',
    PENDING_MEMBERSHIP: 'f4746282-b23f-49c3-9147-b86500169f43',
    PENDING_MEMBERSHIP_LEBBEKE: '489fad80-805c-41d5-b830-a541ef3f114c',
    MESSAGE_ANNA_WINDOWS: 'a998ff05-1291-4399-8604-16001015e147',
  },

  hrefs: {
    PARTIES: '/parties',
    BATCH: '/batch',
    PARTYRELATIONS: '/partyrelations',

    PARTY_LETSDENDERMONDE: '/parties/8bf649b4-c50a-4ee9-9b02-877aa0a71849',
    PARTY_LETSLEBBEKE: '/parties/aca5e15d-9f4c-4c79-b906-f7e868b3abc5',
    PARTY_LETSHAMME: '/parties/0a98e68d-1fb9-4a31-a4e2-9289ee2dd301',

    PARTY_ANNA: '/parties/5df52f9f-e51f-4942-a810-1496c51e64db',
    PARTY_STEVEN: '/parties/fa17e7f5-ade9-49d4-abf3-dc3722711504',
    PARTY_RUDI: '/parties/eb6e3ad7-066f-4357-a582-dfb31e173606',
    PARTY_EDDY: '/parties/437d9b64-a3b4-467c-9abe-e9410332c1e5',
    PARTY_LEEN: '/parties/abcb3c6e-721e-4f7c-ae4a-935e1980f15e',
    PARTY_EMMANUELLA: '/parties/508f9ec9-df73-4a55-ad42-32839abd1760',
    PARTY_DUMMY: '/parties/00000000-0000-0000-0000-000000000000',
    PARTY_WALTER: '/parties/80af7e3f-b549-4774-832d-6d6243ff348f',

    PLUGIN_MAIL: '/plugins/7bd68a4b-138e-4228-9826-a002468222de',

    CONTACTDETAILS: '/contactdetails',
    CONTACTDETAIL_ADDRESS_ANNA: '/contactdetails/843437b3-29dd-4704-afa8-6b06824b2e92',
    CONTACTDETAIL_EMAIL_ANNA: '/contactdetails/b059ef61-340c-45d8-be4f-02436bcc03d9',
    CONTACTDETAIL_ADDRESS_STEVEN: '/contactdetails/3266043e-c70d-4bb4-b0ee-6ff0ae42ce44',
    CONTACTDETAIL_EMAIL_STEVEN: '/contactdetails/77818c02-b15c-4304-9ac1-776dbb376770',
    CONTACTDETAIL_EMAIL_RUDI: '/contactdetails/351cbc67-fb30-4e2e-afd8-f02243148c26',
    CONTACTDETAIL_ADDRESS_LETSDENDERMONDE: '/contactdetails/96de9531-d777-4dca-9997-7a774d2d7595',
    CONTACTDETAIL_ADDRESS_MESSAGE: '/contactdetails/3362d325-cf19-4730-8490-583da50e114e',

    MESSAGES: '/messages',
    // LETS Dendermonde
    MESSAGE_RUDI_WEBSITE: '/messages/11f2229f-1dea-4c5a-8abe-2980b2812cc4',
    // LETS Lebbeke
    MESSAGE_ANNA_WINDOWS: '/messages/a998ff05-1291-4399-8604-16001015e147',
    MESSAGE_ANNA_CHUTNEY: '/messages/b7c41d85-687d-4f9e-a4ef-0c67515cbb63',
    MESSAGE_ANNA_VEGGIE_KOOKLES: '/messages/1f2e1d34-c3b7-42e8-9478-45cdc0839427',
    MESSAGE_ANNA_ASPERGES: '/messages/0cc3d15f-47ef-450a-a0ac-518202d7a67b',
    MESSAGE_STEVEN_INDISCH: '/messages/642f3d85-a21e-44d0-b6b3-969746feee9b',
    MESSAGE_STEVEN_SWITCH: '/messages/d1c23a0c-4420-4bd3-9fa0-d542b0155a15',
    MESSAGE_STEVEN_REPLY_TO_ASPERGES: '/messages/e8a73a40-bfcd-4f5a-9f8a-9355cc956af0',
    // LETS Hamme
    MESSAGE_LEEN_PLANTS: '/messages/e24528a5-b12f-417a-a489-913d5879b895',

    MESSAGE_RELATIONS: '/messagerelations',
    MESSAGE_RELATION_ASPERGES: '/messagerelations/cc03a9d4-1aef-4c8f-9b05-7b39be514a67',

    TRANSACTION_ANNA_STEVEN_20: '/transactions/e068c284-26f1-4d11-acf3-8942610b26e7',
    TRANSACTION_LEEN_EMMANUELLA_20: '/transactions/1ffc9267-b51f-4970-91a2-ae20f4487f78'},

  responses: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    GONE: 410}};
