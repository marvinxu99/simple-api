// simple-api/utilities/sendEmail.js

const aws = require("aws-sdk");

// use AWS global variables
aws.config.accessKeyId = 'xxx'; 
aws.config.secretAccessKey = 'xxxx';
aws.config.region = "us-west-2";   // US West (Oregon)

// Create a registerEmail function
function Email(to, sub, content) {
  let ses = new aws.SES();

  let from = "marvinxu99@hotmail.com"; // The email address added here must be verified in Amazon SES
  //Amazon SES email format
  ses.sendEmail(
    {
      Source: from,
      Destination: { ToAddresses: to },
      Message: {
        Subject: {
          Data: sub
        },
        Body: {
          Html: {
            Data: content
          }
        }
      }
    },
    function(err, data) {
      if (err) {
        console.log(err);
      } else {
        console.log("Email sent:");
        console.log(data);
      }
    }
  );
}
// Export the registerEmail function
module.exports = {
  Email
};
