
var app = require('../../server/server');
const serialize = require('loopback-jsonapi-model-serializer');
var utils = require('./utils.js');

//TODO: use loopback-jsonapi-model-serialzer to do the more generic model serialization instead of setting up serialization manually!!

module.exports = function(Audience) {
  Audience.jsonApiSerialize = function(options, cb) {
    var Person = app.models.Person;
    var Group = app.models.Group;
    var serialized = {};
    var baseUrl = utils.findBaseUrl(options.topLevelLinks.self, 'Messages');
    serialized.links = options.topLevelLinks;
    var result = [];
    if (Array.isArray(options.results)) {
      for (var j = options.results.length - 1; j >= 0; j--) {
        for (var i = options.results[j].groups.length - 1; i >= 0; i--) {
          result.push(Group.toJSONApi(options.results[j].groups[i], baseUrl));
        };
        for (var i = options.results[j].people.length - 1; i >= 0; i--) {
          result.push(Person.toJSONApi(options.results[j].people[i],
            baseUrl));
        };
      };
    } else {
      for (var i = options.results.groups.length - 1; i >= 0; i--) {
        result.push(Group.toJSONApi(options.results.groups[i], baseUrl));
      };
      for (var i = options.results.people.length - 1; i >= 0; i--) {
        result.push(Person.toJSONApi(options.results.people[i], baseUrl));
      };
    }
    serialized.data = result;
    serialized.included = [];
    options.results = serialized;
    cb(null, options);
  };
};
