
module.exports = function enableAuthentication(server) {
  // enable authentication
  server.enableAuth();
  //TODO: foresee user caching  via a key value cache?. First this can be simple in memory. Future could be Redis?
};
