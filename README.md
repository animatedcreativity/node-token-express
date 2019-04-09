# node-token-express

Simplest user login system using PIN or Token. Can also store user data. Implements sessions by itself.

----------------------------------------------

**Usage:**

```
var tokenExpress = require("node-token-express");
var app = new tokenExpress(config, express);
```

- express: Exiting `express` instance, creates a new one if not provided. Its provided at `app.express`.
- config: It supports a lot of config options. It also contains default config.js file with default options. All config values are optional.

```
/*** config ***/
{
  endpoint: "user", // API endpoint for express pages like login, logout & code generation
  expressPort: 3000, // express port
  session: { // express session options to facilitate user login sessions based on tokens/pins.
    secret: "ZkmemBozCBHaHNvbVXD3"
    resave: false,
    saveUninitialized: false
  },
  database: {
    folder: "users/", // database parent folder, leave blank to use root folder
    name: "user", // database for storing users with data that you change
    code: "code" // database for storing temporarily generated tokens/pins
  },
  redirect: { // API endpoints return success/error objects if redirects are not used
    login: "", // redirect after successful login
    logout: "" // redirect after successful logout
  },
  mail: { // for sending tokens/pins
    host: "smtp.gmail.com", // mail server
    username: "<gmail_username>",
    password: "<gmaiL_password>",
    port: 465,
    secure: true,
    from: { // send mail as
      name: "From Name",
      email: "<from_email>"
    },
    copy: "<copy_email>", // send a copy of mails to this address too, leave blank if not needed
    template: { // mail template
      subject: "Your <short-code-method-upper /> to our services",
      body: `
        Hello <short-code-name /> (<short-code-email />)!
        <br/><br/>
        Thank you for showing your interest in our services.<br/>
        Please check your <span style="text-transform: uppercase;"><short-code-method /></span> below:<br/>

        <table style="width:100%;">
          <td style="text-align: left;">
            <h1><b><short-code-code /></b></h1>
          </td>
        </table>
        <br/>          

        The <span style="text-transform: uppercase;"><short-code-method /></span> will expire in <short-code-time />.
        <br/><br/>
        Thanks<br/>
        Team
      `
    }
  },
  method: "token", // token/pin
  pin: {
    expire: 15, // in minutes
    length: 6,
    split: 2 // for better PIN display for memorizing
  },
  token: {
    expire: 60, // in minutes
    length: 10
  }
}
```

-------------------------------------------------

**Endpoints:**

*/(endpoint)/code*
  
- Generates a new token/pin code for an email address and stores it for a set time to allow login for user. Can store multiple codes too and expiry will work accordingly.

- Required form values:

```
{
  email: "<email>"
}
```

- Returns useful success/error messages.

---------------------------------------------

*/(endpoint)/login*

- Checks the provided email and code and matches it with expiry time and stores user in session as successful login. You can make changes to the data of session's user object and call provided `.save()` method.

- Required form values:

```
{
  email: "<email>",
  code: "<token/pin_code>" // as sent via email
}
```

- If `redirect.login` is not set in config, it returns useful success/error messages.

---------------------------------------------

*/(endpoint)/key*

- Checks the provided email and code and matches it with expiry time, generates a new API key and saves it with user at `user.apiKey`.

- Required form values:

```
{
  email: "<email>",
  code: "<token/pin_code>" // as sent via email
}
```

-----------------------------------------------

*/(endpoint)/logout*

- Removes user from session as successful logout.

- No form values needed.

- If `redirect.logout` is not set in config, it returns useful success/error messages.

-----------------------------------------------

**session.user:**

After successful login, user data is fetched from database and stored in `session.user` object. Session user can be found in `request` of every `express` endpoint. You can read/write data from/to user and call `.save()` method if needed.

Example:

```
var tokenExpress = require("node-token-express");
var app = new tokenExpress(config, express);

app.express.get("/", function(request, response) {
  if (typeof request.session.user !== "undefined") { // if user is logged in
    console.log(request.session.user);
    request.session.user.data.name = "John Doe";
    request.session.user.data.address = "Somewhere";
    request.session.user.save(); // saves your changes into database, returns promise
  } else {
    // show login page with code generation macahnism? using (endpoint)/code API endpoint
  }
});
```

-------------------------------------------

**The `tokenExpress` app:**

The app has some more goodies instead of just `express`.

```
var tokenExpress = require("node-token-express");
var app = new tokenExpress(config, express);
```

*`app.express`*

- Returns express instance to work with endpoints.

*`new app.user(email, app)`*

- Creates new user instance if you want to work with a user's data and save it back. Check *session.user* section above.

*`var randomToken = app.random.generate(32);`*

- Generates a random token

*`app.pouch`*

- Very useful `node-pouch` instance to work with multiple databases. No need to develope separate database machanism for your App. Please check more here: https://www.npmjs.com/package/node-pouch

*`app.wrapper`*  
*`var {error, result} = await app.wrapper("result", promise)`*

- Wraps promises, more here: https://www.npmjs.com/package/node-promise-wrapper

*`app.sanitize`*  
*`app.sanitize.options(options, { ... default options ... })`*

- Options sanitizer, more here: https://www.npmjs.com/package/node-sanitize-options

*`app.email`*  
*`app.email.validate(email)`*

- Email validator, more here: https://www.npmjs.com/package/email-validator

*`app.mailer`*

- Fully ready nodemailer transport based on the mail settings that you provide in config. So, no need to create your own email machanism. More here: https://www.npmjs.com/package/nodemailer

*`app.mail(emails, subject, text, html, from)`*

- Sends mail
- `emails`: array of emails to send mails to
- `subject`: email subject
- `text`: email body as text
- `html`: email body as html
- `from`: default `from` provided config is used if you do not provide this. `{name: "From Name", email: "<from_email>"}`

*`app.error(response, status, error)`*

- Returns error object as a reponse from the endpoint
- `response`: `express`'s response object
- `status`: any reponse code number
- `error`: error text

*`app.message(response, status, message)`*

- Returns message object as a reponse from the endpoint
- `response`: `express`'s response object
- `status`: any reponse code number
- `message`: message text

*`app.pin.new(length)`*

- Generates a new pin number
- `length`: optional and default is taken from the provided config.

*`app.pin.split(pin)`*

- Splits a pin into multiple parts using spaces, settings are used from the provided config.
- `pin`: the pin number to split

*`app.shortCodes(layout, options)`*

- Replaces short codes in a `layout` text based on the provided `options`
- `options`: an object of all short codes

*`app.time(milliseconds)`*

- Converts milliseconds into a readable time format

*`app.apiKey.new()`*

- Generates a new API key based on the config.