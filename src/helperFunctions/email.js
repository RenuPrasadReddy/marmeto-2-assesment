var nodemailer = require('nodemailer');

async function sendEmail(email, voucherDetails){
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          // user: 'youremail@gmail.com',
          // pass: 'yourpassword'
          user: process.env.HOSTEMAIL,
          pass: process.env.HOSTPASSWORD
        }
      });

      var mailOptions = {
        from: process.env.HOSTEMAIL,
        to: email,
        subject: 'Holaaaa, Voucher details',
        html: `hello, please find voucher details voucher = ${voucherDetails.voucher}, PIN = ${voucherDetails.pin}`

      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
          return info.response;
        }
      });
    // console.log("email sent");
    // return true;
}

module.exports ={ sendEmail}
