exports = module.exports = function(config, express) {
  var wrapper = require("node-promise-wrapper");
  var sanitize = require("node-sanitize-options");
  var fs = require("fs");
  if (fs.existsSync("./config.js") === true) config = sanitize.options(config, require("./config.js")());
  config = sanitize.options(config, {});
  if (config.database.folder !== "undefined" && config.database.folder.trim()) {
    if (fs.existsSync(config.database.folder) === false) fs.mkdirSync(config.database.folder);
  }
  var _express = require('express');
  var provided = {express: false}
  if (typeof express === "undefined") {
    express = _express();
  } else {
    provided.express = true;
  }
  var formParser = require("express-formidable");
  var session = require("express-session");
  var nodemailer = require("nodemailer");
  var nodePouch = require("node-pouch");
  express.use(session(config.session));
  express.use(formParser());
  var app = {
    user: require("./user.js"),
    random: require("randomstring"),
    pouch: new nodePouch(config.database.name, config.database.folder),
    wrapper: wrapper,
    email: require("email-validator"),
    fs: fs,
    sanitize: sanitize,
    express: express,
    mailer: nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: {
        user: config.mail.username,
        pass: config.mail.password
      }
    }),
    mail: function(emails, subject, text, html, from) {
      if (typeof emails === "string") emails = [emails];
      from = app.sanitize.options(from, config.mail.from);
      return new Promise(async function(resolve, reject) {
        var options = {
          from: '"' + from.name + '" ' + from.email,
          to: emails.join(", "),
          subject: subject,
          text: text,
          html: html
        };
        var {error, info} = await app.wrapper("info", app.mailer.sendMail(options));
        if (typeof info !== "undefined" && typeof info.accepted !== "undefined") {
          var accepted = {};
          for (var i=0; i<=info.accepted.length-1; i++) {
            accepted[info.accepted[i]] = true;
          }
          resolve(accepted);
        } else {
          reject(error);
        }
      });
    },
    json: function(response, status, error, message) {
      var result = {status: status};
      if (typeof error !== "undefined") result.error = error;
      if (typeof message !== "undefined") result.message = message;
      return response.send(JSON.stringify(result));
    },
    error: function(response, status, error) {
      return app.json(response, status, error);
    },
    message: function(response, status, message) {
      return app.json(response, status, undefined, message);
    },
    pin: {
      lib: require("secure-pin"),
      new: function(length) {
        if (typeof length === "undefined") length = config.pin.length;
        return app.pin.lib.generatePinSync(length);
      },
      split: function(pin) {
        var num = 0;
        var parts = [];
        for (var i=0; i<=config.pin.split-1; i++) {
          var count = Math.ceil(pin.length / config.pin.split);
          parts.push(pin.substr(num, count));
          num += count;
        }
        return parts;
      }
    },
    shortCodes: function(layout, options) {
      for (var key in options) {
        layout = layout.split("<short-code-" + key + " />").join(options[key]);
      }
      return layout;
    },
    time: function(milliseconds) {
      function end(number) { return (number > 1) ? "s" : ""; }
      var temp = Math.floor(milliseconds / 1000);
      var years = Math.floor(temp / 31536000);
      if (years) return years + " year" + end(years);
      var days = Math.floor((temp %= 31536000) / 86400);
      if (days) return days + " day" + end(days);
      var hours = Math.floor((temp %= 86400) / 3600);
      if (hours) return hours + " hour" + end(hours);
      var minutes = Math.floor((temp %= 3600) / 60);
      if (minutes) return minutes + " minute" + end(minutes);
      var seconds = temp % 60;
      if (seconds) return seconds + " second" + end(seconds);
      return "";
    },
    start: function() {
      express.post("/" + config.endpoint + "/logout", async function(request, response) {
        if (typeof request.user !== "undefined") {
          delete request.user;
          if (typeof config.redirect.logout !== "undefined" && config.redirect.logout.trim()) {
            response.redirect(config.redirect.logout);
          } else {
            app.message(response, 100, "Logged out.");
          }
        } else {
          if (typeof config.redirect.logout !== "undefined" && config.redirect.logout.trim()) {
            response.redirect(config.redirect.logout);
          } else {
            app.message(response, 100, "Not logged in.");
          }
        }
      });
      express.post("/" + config.endpoint + "/login", async function(request, response) {
        if (typeof request.session.user !== "undefined") {
          app.message(response, 100, "Already logged in.");
          return false;
        }
        var email;
        if (typeof request.fields.email !== "undefined") email = request.fields.email.toLowerCase();
        if (typeof email === "undefined") {
          app.error(response, 103, "Email error.");
          return false;
        }
        if (app.email.validate(email) === false) {
          app.error(response, 103, "Email error.");
          return false;
        }
        var code;
        if (typeof request.fields.code !== "undefined") code = request.fields.code;
        if (typeof code === "undefined") {
          app.error(response, 106, "Code error.");
          return false;
        }
        // TODO: Clean expired tokens from DB here, to save on database space.
        var {error, codeObject} = await app.wrapper("codeObject", app.pouch.record({email: email, code: code}, config.database.code));
        if (typeof codeObject === "undefined") {
          app.error(response, 106, "Code error.");
          return false;
        }
        if (Date.now() >= codeObject.time && Date.now() <= codeObject.valid) {
          var {error, user} = await app.wrapper("user", app.user(email, app));
          if (typeof user !== "undefined") {
            request.session.user = user;
            if (typeof config.redirect.login !== "undefined" && config.redirect.login.trim()) {
              response.redirect(config.redirect.login);
            } else {
              app.message(response, 100, "Logged in.");
            }
          } else {
            app.error(response, 107, "User error.");
            return false;
          }
        } else {
          app.error(response, 106, "Code error.");
          return false;
        }
      });
      express.post("/" + config.endpoint + "/code", async function(request, response) {
        var email;
        if (typeof request.fields.email !== "undefined") email = request.fields.email.toLowerCase();
        if (typeof email === "undefined") {
          app.error(response, 103, "Email error.");
          return false;
        }
        if (app.email.validate(email) === false) {
          app.error(response, 103, "Email error.");
          return false;
        }
        var code, time;
        if (config.method === "token") {
          code = app.random.generate(config.token.length);
          time = config.token.expire * 60 * 1000;
        }
        if (config.method === "pin") {
          code = app.pin.new();
          time = config.pin.expire * 60 * 1000;
        }
        if (typeof code === "undefined") {
          app.error(response, 105, "Method error.");
          return false;
        }
        var {error, result} = await app.wrapper("result", app.pouch.save({
          _id: app.random.generate(16),
          email: email,
          code: code,
          time: Date.now(),
          valid: Date.now() + time
        }, config.database.code));
        if (typeof result === "undefined") {
          app.error(response, 104, config.method + " error.");
          return false;
        }
        var options = {
          name: email.split("@")[0],
          code: config.method === "token" ? code : app.pin.split(code).join(" "),
          email: email,
          time: app.time(time),
          method: config.method,
          "method-upper": config.method.toUpperCase()
        };
        var body = app.shortCodes(config.mail.template.body, options);
        var subject = app.shortCodes(config.mail.template.subject, options);
        var {error, sent} = await app.wrapper("sent", app.mail([email, config.mail.copy], subject, "", body));
        if (typeof sent !== "undefined") {
          app.message(response, 100, config.method + " sent.");
        } else {
          app.error(response, 104, config.method + " error.");
        }
      });
    },
    listen: function() {
      var listener = app.express.listen(config.expressPort, function() {
        console.log("Your app is listening on port " + listener.address().port);
      });
    }
  };
  app.start();
  if (provided.express === false) app.listen();
  return app;
};