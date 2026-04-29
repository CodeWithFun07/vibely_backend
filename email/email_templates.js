const BRAND = {
  name: "Vibely",
  logo: "https://res.cloudinary.com/dspqyughj/image/upload/v1776863891/vibely_logo_rswu8m.png",
  primaryColor: "#4f46e5",
  secondaryColor: "#f4f6f8",
  textColor: "#333333",
};

const verifySignupEmailTemplate = (username, otp, email) => {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email?otp=${encodeURIComponent(
    otp,
  )}&email=${encodeURIComponent(email)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${BRAND.name} - Verify Email</title>
</head>

<body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
  
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">

        <table width="500" cellpadding="0" cellspacing="0" 
          style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
              <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                   style="display:block; margin:0 auto 10px;" />
              <h1 style="color:#ffffff; margin:0; font-size:20px;">
                ${BRAND.name}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px; color:${BRAND.textColor};">

              <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

              <p style="font-size:14px; color:#555; line-height:1.6;">
                Welcome to ${BRAND.name}! Please verify your email address to get started.
              </p>

              <!-- Button -->
              <div style="text-align:center; margin:30px 0;">
                <a href="${verifyLink}"
                   style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                  Verify Email
                </a>
              </div>

              <!-- OTP -->
              <p style="text-align:center; font-size:13px; color:#777;">
                Or use this verification code:
              </p>

              <h2 style="text-align:center; letter-spacing:5px;">
                ${otp}
              </h2>

              <p style="text-align:center; font-size:12px; color:#999;">
                This code expires in 10 minutes.
              </p>

              <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

              <p style="font-size:12px; color:#999; text-align:center;">
                If you didn’t create an account, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:15px; text-align:center;">
              <p style="font-size:12px; color:#aaa; margin:0;">
                © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};

const accountVerifiedTemplate = ({ username, fullName, email }) => {
  const dashboardLink = `${process.env.FRONTEND_URL}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Account Verified</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">
                  Hi <strong>${fullName || username}</strong>,
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  🎉 Your email has been successfully verified!
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  Your account is now fully activated. You can start exploring ${BRAND.name}, connect with others, and enjoy all features.
                </p>

                <!-- CTA Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${dashboardLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Go to Dashboard
                  </a>
                </div>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#999; text-align:center;">
                  If this wasn’t you, please contact our support team immediately.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const resendOtpEmailTemplate = ({ username, fullName, email, otp }) => {
  const verifyLink = `${process.env.FRONTEND_URL}/verify-email?otp=${encodeURIComponent(
    otp,
  )}&email=${encodeURIComponent(email)}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Resend OTP</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">
                  Hi <strong>${fullName || username}</strong>,
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  You requested a new verification code. Here is your latest OTP:
                </p>

                <!-- OTP -->
                <h2 style="text-align:center; letter-spacing:6px; margin:25px 0; color:${BRAND.primaryColor};">
                  ${otp}
                </h2>

                <p style="text-align:center; font-size:12px; color:#999;">
                  This code will expire in 10 minutes.
                </p>

                <!-- Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${verifyLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Verify Now
                  </a>
                </div>

                <p style="font-size:12px; color:#777; text-align:center;">
                  If you didn’t request this code, you can safely ignore this email.
                </p>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#aaa; text-align:center;">
                  For security reasons, do not share this code with anyone.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const resetPasswordOtpTemplate = ({ username, email, otp }) => {
  const verifyLink = `${process.env.FRONTEND_URL}/reset-password?otp=${encodeURIComponent(
    otp,
  )}&email=${encodeURIComponent(email)}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Reset Password</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  We received a request to reset your password. Use the code below to proceed:
                </p>

                <!-- OTP -->
                <h2 style="text-align:center; letter-spacing:6px; margin:25px 0; color:${BRAND.primaryColor};">
                  ${otp}
                </h2>

                <p style="text-align:center; font-size:12px; color:#999;">
                  This code will expire in 2 minutes.
                </p>

                <!-- Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${verifyLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Reset Password
                  </a>
                </div>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#777; text-align:center;">
                  If you didn't request a password reset, please ignore this email or contact support immediately.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const passwordResetConfirmationTemplate = ({ username, email }) => {
  const dashboardLink = `${process.env.FRONTEND_URL}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Password Reset Successful</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  ✅ Your password has been successfully reset!
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  You can now log in to your account with your new password.
                </p>

                <!-- CTA Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${dashboardLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Go to Login
                  </a>
                </div>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#999; text-align:center;">
                  If this wasn't you, please secure your account immediately by contacting support.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const accountDeactivatedTemplate = ({ username, email }) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Account Deactivated</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:#f87171; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  Your account has been deactivated. You will not be able to log in or access any services associated with ${BRAND.name}.
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  If this was done by mistake, you can reactivate your account by contacting our support team or visiting your account settings.
                </p>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#999; text-align:center;">
                  If you need assistance, please contact our support team.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const accountReactivationOtpTemplate = ({ username, email, otp }) => {
  const reactivateLink = `${process.env.FRONTEND_URL}/reactivate-account?otp=${encodeURIComponent(
    otp,
  )}&email=${encodeURIComponent(email)}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Reactivate Account</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  We received a request to reactivate your account. Use the code below to proceed:
                </p>

                <!-- OTP -->
                <h2 style="text-align:center; letter-spacing:6px; margin:25px 0; color:${BRAND.primaryColor};">
                  ${otp}
                </h2>

                <p style="text-align:center; font-size:12px; color:#999;">
                  This code will expire in 2 minutes.
                </p>

                <!-- Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${reactivateLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Reactivate Account
                  </a>
                </div>

                <p style="font-size:12px; color:#777; text-align:center;">
                  If you didn't request account reactivation, you can safely ignore this email.
                </p>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

const accountReactivatedTemplate = ({ username, email }) => {
  const dashboardLink = `${process.env.FRONTEND_URL}`;

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>${BRAND.name} - Account Reactivated</title>
  </head>

  <body style="margin:0; padding:0; background:${BRAND.secondaryColor}; font-family:Arial, sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
      <tr>
        <td align="center">

          <!-- Container -->
          <table width="500" cellpadding="0" cellspacing="0" 
            style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 6px 15px rgba(0,0,0,0.06);">

            <!-- Header -->
            <tr>
              <td style="background:${BRAND.primaryColor}; padding:25px; text-align:center;">
                <img src="${BRAND.logo}" alt="${BRAND.name}" width="100" 
                     style="display:block; margin:0 auto 10px;" />
                <h1 style="color:#ffffff; margin:0; font-size:20px;">
                  ${BRAND.name}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:30px; color:${BRAND.textColor};">

                <p style="font-size:16px;">Hi <strong>${username}</strong>,</p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  🎉 Your account has been successfully reactivated!
                </p>

                <p style="font-size:14px; color:#555; line-height:1.6;">
                  Welcome back to ${BRAND.name}! You can now log in and access all features.
                </p>

                <!-- CTA Button -->
                <div style="text-align:center; margin:30px 0;">
                  <a href="${dashboardLink}"
                     style="background:${BRAND.primaryColor}; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:6px; font-size:14px; display:inline-block;">
                    Go to Dashboard
                  </a>
                </div>

                <hr style="border:none; border-top:1px solid #eee; margin:25px 0;" />

                <p style="font-size:12px; color:#999; text-align:center;">
                  If you have any questions, feel free to contact our support team.
                </p>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb; padding:15px; text-align:center;">
                <p style="font-size:12px; color:#aaa; margin:0;">
                  © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>

  </body>
  </html>
  `;
};

export {
  verifySignupEmailTemplate,
  accountVerifiedTemplate,
  resendOtpEmailTemplate,
  resetPasswordOtpTemplate,
  passwordResetConfirmationTemplate,
  accountDeactivatedTemplate,
  accountReactivationOtpTemplate,
  accountReactivatedTemplate,
};
