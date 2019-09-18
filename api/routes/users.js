// simeplcode-api/api/routes/users.js

// Include JSON Web Token
const jwt = require("jsonwebtoken");

// Include express
const express = require("express");

// Include express router middleware
const router = express.Router();

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const database = require("../../database");

// Send email utility
const sendEmail = require("../../utilities/sendEmail");

// Validation
const checkRegistrationFields = require("../../validation/register");

// Resend email validaiton
const checkResendField = require("../../validation/resend");

// Secret key
const key = require("../../utilities/keys")

// Login validation
const validateLoginInput = require("../../validation/login");

// Forgot password validation
const validateResetInput = require("../../validation/checkEmail");

// Validate new passwords
const validatePasswordChange = require("../../validation/newPassword");


// Add a 'get' method to express router for our test route
router.get("/", function(req, res) {
  res.send({ msg: "Hello World" });
});

// Register route
router.post("/register", (req, res) => {

    // Ensures that all entries by the user are valid
    const { errors, isValid } = checkRegistrationFields(req.body);
  
    // If any of the entries made by the user are invalid, a status 400 is returned with the error
    if (!isValid) {
      return res.status(400).json(errors);
    }

    // In production you might want to use something more secure like an RSA key pair
    let token;
    crypto.randomBytes(48, (err, buf) => {
      if (err) throw err;
      token = buf
        .toString("base64")
        .replace(/\//g, "") // Because '/' and '+' aren't valid in URLs
        .replace(/\+/g, "-");
      return token;
    });

    bcrypt.genSalt(12, (err, salt) => {
        if (err) throw err;    
        bcrypt.hash(req.body.password1, salt, (err, hash) => {    
          if (err) throw err;    
          database("users")    
            .returning(["id", "email", "registered", "token"])    
            .insert({   
              email: req.body.email,    
              password: hash,   
              registered: Date.now(),    
              token: token,    
              createdtime: Date.now(),    
              emailverified: "f",    
              tokenusedbefore: "f"    
            })    
            .then(user => {   
                // console.log("created user:" + user); 
                // res.json("Success!");

                let to = [user[0].email]; // Email address must be an array
                // When you set up your front-end you can create a working verification link here
                let link = "https://yourWebsite/v1/users/verify/" + user[0].token;
                // Subject of your email
                let sub = "Confirm Registration";
                // In this email we are sending HTML
                let content =
                  "<body><p>Please verify your email.</p> <a href=" +
                  link +
                  ">Verify email</a></body>";
                // Use the Email function of our send email utility
                sendEmail.Email(to, sub, content);
                res.json("Success!");    
            })
            .catch(err => {
               console.log(err);
               errors.account = "Email already registered";
               res.status(400).json(errors);
            });
        });
      });
});

router.post("/verify/:token", (req, res) => {
    const { token } = req.params;
    const errors = {};

    database
      .returning(["email", "emailverified", "tokenusedbefore"])
      .from("users")
      .where({ token: token, tokenusedbefore: "f" })
      .update({ emailverified: "t", tokenusedbefore: "t" })
      .then(data => {
          if (data.length > 0) {
              res.json(
                "Email verified! Please login to access your account"
              );
          } else {
              errors.email_invalid =
              "Email invalid. Please check if you have registered with the " +  
              "correct email address or re-send the verification link to your email.";
              res.status(400).json(errors);
          }
      })
      .catch(err => {
          errors.db = "Bad request";
          res.status(400).json(errors);
      });
});

router.post("/resend_email", (req, res) => {

  const { errors, isValid } = checkResendField(req.body);

  if (!isValid) {
    return res.status(400).json(errors);
  }

  // In production you might want to use something more secure like an RSA key pair
  let resendToken;
  crypto.randomBytes(48, (err, buf) => {
    if (err) throw err;
    resendToken = buf
      .toString("base64")
      .replace(/\//g, "")
      .replace(/\+/g, "-");
    return resendToken;
  });
  
  database
  .table("users")
  .select("*")
  .where({ email: req.body.email })
  .then(data => {
    if (data.length == 0) {
      errors.invalid = "Invalid email address. Please register again!";
      res.status(400).json(errors);
    } else {
      database
        .table("users")
        .returning(["email", "token"])
        .where({ email: data[0].email, emailverified: "false" })
        .update({ token: resendToken, createdtime: Date.now() })
        .then(result => {
          if (result.length) {
            let to = [result[0].email];

            let link =
              "https://yourWebsite/v1/users/verify/" + result[0].token;

            let sub = "Confirm Registration";

            let content =
              "<body><p>Please verify your email.</p> <a href=" +
              link +
              ">Verify email</a></body>";
            sendEmail.Email(to, sub, content);

            res.json("Email re-sent!");
          } else {
            errors.alreadyVerified =
              "Email address has already been verified, please login.";
            res.status(400).json(errors);
          }
        })
        .catch(err => {
          errors.db = "Bad request";
          res.status(400).json(errors);
        });
    }
  })
  .catch(err => {
    errors.db = "Bad request";
    res.status(400).json(errors);
  });
});

// Login route
router.post("/login", (req, res) => {
  // Ensures that all entries by the user are valid
    const { errors, isValid } = validateLoginInput(req.body);
  
    if (!isValid) {
      return res.status(400).json(errors);
    } else {
      database
      .select("id", "email", "password")
      .where("email", "=", req.body.email)
      .andWhere("emailverified", true)
      .from("users")
      .then(data => {
        bcrypt.compare(req.body.password, data[0].password).then(isMatch => {
          if (isMatch) {
            const payload = { id: data[0].id, email: data[0].email };
            jwt.sign(
              payload,
              key.secretOrKey,
              { expiresIn: 3600 },
              (err, token) => {
                  res.status(200).json({"Bearer": token});
              }
            )
          } else {
            res.status(400).json("Bad request")
          }
        })
      })
      .catch(err => {
        res.status(400).json("Bad request")
      })
    }
});

router.post("/forgot", function(req, res) {
  const {errors, isValid } = validateResetInput(req.body);

  if (!isValid) {
    return res.status(400).json(errors);
  }
  
  // In production you might want to use something more secure like an RSA key pair
  let resetToken;
  crypto.randomBytes(48, (err, buf) => {
    if (err) throw err;
    resetToken = buf.toString("hex");
    return resetToken;
  });

  // Check the users table and evaluate if the email sent by the user exists
  database
  .table("users")
  .select("*")
  .where("email", req.body.email)
  .then(emailData => {
    if (emailData.length == 0) {
      res.status(400).json("Invalid email address");
    } else {
      database
      .table("users")
      .where("email", emailData[0].email)
      .update({
        reset_password_token: resetToken,
        reset_password_expires: Date.now(),
        reset_password_token_used: false
      })
      .then(done => {
        let to = [req.body.email];
        let link = "https://yourWebsite/v1/users/reset_password/" + resetToken;
        let sub = "Reset Password";
        let content =
          "<body><p>Please reset your password.</p> <a href=" +
          link +
          ">Reset Password</a></body>";
        //Passing the details of the email to a function allows us to generalize the email sending function
        sendEmail.Email(to, sub, content);
        res.status(200).json("Please check your email for the reset password link");
      })
      .catch(err => {
        res.status(400).json("Bad Request");
      });
    }
  })
  .catch(err => {
    res.status(400).json("Bad Request");
  });
});

router.post("/reset_password/:token", function(req, res) {
  const { token } = req.params;
  database
    .select(["id", "email"])
    .from("users")
    .where({ reset_password_token: token, reset_password_token_used: false })
    .then(data => {
      if (data.length > 0) {
        const { errors, isValid } = validatePasswordChange(req.body);

        if (!isValid) {
          return res.status(400).json(errors);
        }

        bcrypt.genSalt(12, (err, salt) => {
          if (err) throw err;
          bcrypt.hash(req.body.password1, salt, (err, hash) => {
            if (err) throw err;
            database("users")
              .returning("email")
              .where({ id: data[0].id, email: data[0].email })
              .update({ password: hash, reset_password_token_used: true })
              .then(user => {
                //let to = [req.body.email];
                let to = [user[0]];
                const subject = "Password change for your account.";
                const txt = `The password for your account registered under ${
                  user[0]
                } has been successfully changed.`;
                
                res.json("Password successfully changed for " + user[0] + "!");

                sendEmail.Email(to, subject, txt);
              })
              .catch(err => {
                res.status(400).json(errors);
              });
          });
        });
      } else {
        res.status(400).json("Password reset error!");
      }
    })
    .catch(err => res.status(400).json("Bad request"));
});

// Exports the router object
module.exports = router;