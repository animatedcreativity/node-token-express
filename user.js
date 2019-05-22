exports = module.exports = function(email, app, config) {
  var mod = {
    data: undefined,
    save: function() {
      return app.pouch.save(mod.data, config.database.name);
    }
  };
  return new Promise(async function(resolve, reject) {
    email = email.toLowerCase();
    var {error, user} = await app.wrapper("user", app.pouch.record({email: email}, config.database.name));
    if (typeof user !== "undefined") {
      mod.data = user;
      resolve(mod);
    } else {
      var {error, user} = await app.wrapper("user", app.pouch.get(email, config.database.name)); // to support previous versions
      if (typeof user !== "undefined") {
        mod.data = user;
        resolve(mod);
      } else {
        reject(error);
      }
    }
  });
};