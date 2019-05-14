exports = module.exports = function() {
  return {
    endpoint: "user",
    expressPort: 3000,
    session: {
      secret: "ZkmemBozCBHaHNvbVXD3",
      resave: false,
      saveUninitialized: false
    },
    sessionPath: ".session-store",
    database: {
      folder: "users/",
      name: "user",
      code: "code"
    },
    redirect: {
      login: "",
      logout: ""
    },
    mail: {
      host: "smtp.gmail.com",
      username: "<gmail_username>",
      password: "<gmaiL_password>",
      port: 465,
      secure: true,
      from: {
        name: "From Name",
        email: "<from_email>"
      },
      copy: "<copy_email>",
      template: {
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
    apiKey: {
      parts: 4,
      length: 10
    },
    method: "token",
    pin: {
      expire: 15, // in minutes
      length: 6,
      split: 2
    },
    token: {
      expire: 60, // in minutes
      length: 10
    }
  }
};