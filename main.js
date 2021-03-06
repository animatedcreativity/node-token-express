exports = module.exports = function(config, express) {
  var wrapper = require("node-promise-wrapper");
  var sanitize = require("node-sanitize-options");
  var fs = require("fs");
  var fileConfig = require("node-file-config")("node-token-express");
  config = fileConfig.get(config);
  var provided = {express: false};
  if (config.expressPort > 0) {
    var _express = require('express');
    if (typeof express === "undefined") {
      express = _express();
    } else {
      provided.express = true;
    }
    var formParser = require("express-formidable");
    var session = require("express-session");
    var fileStore = require('session-file-store')(session);
    var nodePouch = require("node-pouch");
    config.session.store = new fileStore({
      path: config.sessionPath
    });
    express.use(session(config.session));
    express.use(formParser());
  }
  var nodemailer = require("nodemailer");
  var dbpouch = require("dbpouch");
  var app = {
    status: require("./status.js")(),
    user: require("./user.js"),
    random: require("randomstring"),
    pouch: config.database.remote.use !== true ? new nodePouch(config.database.name, config.database.folder) : new dbpouch(config.database.remote),
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
      return response.json(result);
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
    apiKey: {
      new: function() {
        var key = "";
        for (var i=0; i<=config.apiKey.parts-1; i++) {
          if (key !== "") key += "-";
          key += app.random.generate(config.apiKey.length);
        }
        return key;
      }
    },
    endpoints: {
      user: {
        helper: {
          checkEmail: function(request, response, next) {
            var email;
            if (typeof request.fields.email !== "undefined") email = request.fields.email.toLowerCase().trim();
            if (typeof email === "undefined" || app.email.validate(email) === false) {
              app.error(response, app.status.emailError, "Email error.");
              return false;
            }
            next();
          },
          checkCode: async function(request, response, next) {
            if (typeof request.session.user !== "undefined") {
              app.message(response, app.status.successError, "Already logged in.");
              return false;
            }
            var email = request.fields.email.toLowerCase().trim();
            var code;
            if (typeof request.fields.code !== "undefined") code = request.fields.code.split(" ").join("");
            if (typeof code === "undefined" || code.trim() === "") {
              app.error(response, app.status.codeError, "Code error.");
              return false;
            }
            // TODO: Clean expired tokens from DB here, to save on database space.
            var {error, codeObject} = await app.wrapper("codeObject", app.pouch.record({email: email, code: code}, config.database.code));
            if (typeof codeObject === "undefined") {
              app.error(response, app.status.codeError, "Code error.");
              return false;
            }
            if (Date.now() >= codeObject.time && Date.now() <= codeObject.valid) {
              next();
            } else {
              app.error(response, app.status.codeError, "Code error.");
              return false;
            }
          }
        },
        logout: async function(request, response) {
          if (typeof request.user !== "undefined") {
            delete request.user;
            if (typeof config.redirect.logout !== "undefined" && config.redirect.logout.trim()) {
              response.redirect(config.redirect.logout);
            } else {
              app.message(response, app.status.success, "Logged out.");
            }
          } else {
            if (typeof config.redirect.logout !== "undefined" && config.redirect.logout.trim()) {
              response.redirect(config.redirect.logout);
            } else {
              app.message(response, app.status.success, "Not logged in.");
            }
          }
        },
        login: async function(request, response) {
          var email = request.fields.email.toLowerCase().trim();
          var {error, user} = await app.wrapper("user", app.user(email, app));
          if (typeof user !== "undefined") {
            request.session.user = user;
            if (typeof config.redirect.login !== "undefined" && config.redirect.login.trim()) {
              response.redirect(config.redirect.login);
            } else {
              app.message(response, app.status.success, "Logged in.");
            }
          } else {
            app.error(response, app.status.userError, "User error.");
            return false;
          }
        },
        key: async function(request, response) {
          var reset;
          if (typeof request.fields.reset !== "undefined") reset = request.fields.reset;
          var email = request.fields.email.toLowerCase().trim();
          var {error, user} = await app.wrapper("user", app.user(email, app));
          if (typeof user !== "undefined") {
            if (typeof reset !== "undefined" || typeof user.data.apiKey === "undefined") {
              user.data.apiKey = app.apiKey.new();
              var {result} = await app.wrapper("result", user.save());
            } else {
              var result = {};
            }
            if (typeof result !== "undefined") {
              app.message(response, app.status.success, {apiKey: user.data.apiKey});
            } else {
              app.error(response, app.status.updateError, "Update error.");
              return false;
            }
          } else {
            app.error(response, app.status.userError, "User error.");
            return false;
          }
        },
        code: async function(request, response) {
          var email = request.fields.email.toLowerCase().trim();
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
            app.error(response, app.status.methodError, "Method error.");
            return false;
          }
          var {existingUser} = await app.wrapper("existingUser", app.pouch.record({email: email}, config.database.name));
          var {error, result} = await app.wrapper("result", app.pouch.save({_id: typeof existingUser !== "undefined" ? existingUser._id : undefined, email: email}, config.database.name));
          if (typeof result !== "undefined") {
            var {error, user} = await app.wrapper("user", app.pouch.record({email: email}, config.database.name));
            if (typeof user === "undefined") {
              app.error(response, app.status.userError, "User error.");
              return false;
            }
          } else {
            app.error(response, app.status.userError, "User error.");
            return false;
          }
          var {error, result} = await app.wrapper("result", app.pouch.save({
            email: email,
            code: code,
            time: Date.now(),
            valid: Date.now() + time
          }, config.database.code));
          if (typeof result === "undefined") {
            app.error(response, app.status[config.method + "Error"], config.method + " error.");
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
            app.message(response, app.status.success, config.method + " sent.");
          } else {
            app.error(response, app.status[config.method + "Error"], config.method + " error.");
          }
        }
      }
    },
    start: function() {
      if (config.expressPort > 0) {
        express.post("/" + config.endpoint + "/logout", app.endpoints.user.logout);
        express.post("/" + config.endpoint + "/login", [app.endpoints.user.helper.checkEmail, app.endpoints.user.helper.checkCode], app.endpoints.user.login);
        express.post("/" + config.endpoint + "/key", [app.endpoints.user.helper.checkEmail, app.endpoints.user.helper.checkCode], app.endpoints.user.key);
        express.post("/" + config.endpoint + "/code", app.endpoints.user.helper.checkEmail, app.endpoints.user.code);
      }
    },
    listen: function() {
      var listener = app.express.listen(config.expressPort, function() {
        console.log("Your app is listening on port " + listener.address().port);
      });
    }
  };
  app.start();
  if (provided.express === false && config.expressPort > 0) app.listen();
  return app;
};