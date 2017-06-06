'use strict';

var app = require('../../server/server');
var links = [{'name': 'self'}];

module.exports = function(Model, options) {
	/*Model.defineProperty("_links",{
      type: Object,
      required : true,
      description: "links",
     });*/
  function generateSelfLink(ctx) {
    var Link = new app.models.Link();
    if (ctx.instance) {
      Link =  createLink('/api/' + ctx.Model.pluralModelName +
       '/' + ctx.instance.id);
    }
    return Link;
  }

  function createLink(href) {
    var Link = new app.models.Link();
    Link.href = href;
    return Link;
  }

  function replacetokens(instance, value) {
    var res = value;
    var re = /\$\{(.*)\}/g;
    var resultArray;
    while ((resultArray = re.exec(value)) !== null) {
      console.log('Matched ', resultArray[0], resultArray[1],
        instance[resultArray]);
      res.replace(resultArray[0], instance[resultArray[1]]);
    }
    return res;
  }

  function addLink(ctx, instance, linkconfig) {
    if (instance && linkconfig && linkconfig.name) {
      if (!instance._links) {
        instance._links = {};
      }
      if (linkconfig.name === 'self') {
        instance._links[linkconfig.name] = generateSelfLink(ctx);
      } else {
        if (linkconfig.href) {
          instance._links[linkconfig.name] = createLink(linkconfig.href);
        }
        if (linkconfig.thref) {
          instance._links[linkconfig.name] = createLink(replacetokens(instance,
            linkconfig.thref));
        }
      }
    }
  }

  if (options.links) {
    var linkconfig = options.links;
    if (Array.isArray(linkconfig)) {
      for (var i = 0, len = linkconfig.length; i < len; i++) {
        links.push(linkconfig[i]);
      }
    } else {}
  }

  Model.observe('loaded', function(ctx, next) {
    //console.log('Loaded %s',ctx.Model.modelName);
    /*for (var i = 0, len = links.length; i < len; i++) {
      addLink(ctx,ctx.instance, links[i]);
    }*/
    //console.log('L', ctx.instance, ctx.res);
    var Link = new app.models.Link();
    if (ctx.instance) {
      //console.log('D',ctx.instance);
      if (!ctx.instance._links) {
        ctx.instance._links = {};
      }
      Link.href =  '/api/' + ctx.Model.pluralModelName + '/' + ctx.instance.id;
      ctx.instance._links.self = Link;
    }
    next();
  });
};
