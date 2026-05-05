import cron from "node-cron";
import User from "../models/user.model.js";
import sendMail from "../utils/sendMail.js";
import { tokenExpiredTemplate } from "../email/email_templates.js";

/**
 * Cleanup Job: Remove refresh tokens older than 7 days
 * Runs daily at 2 AM
 */
const cleanupExpiredTokens = () => {
  // Schedule the job to run at 2 AM every day
  const job = cron.schedule("0 2 * * *", async () => {
    try {
      console.log("🗑️  Starting cleanup job for expired refresh tokens...");

      // Calculate 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Find users with refresh tokens created more than 7 days ago
      const expiredTokenUsers = await User.find({
        refresh_token: { $exists: true, $ne: null },
        refresh_token_created_at: {
          $exists: true,
          $ne: null,
          $lt: sevenDaysAgo,
        },
      }).select("_id email username refresh_token");

      if (expiredTokenUsers.length === 0) {
        console.log("✅ No expired tokens to clean up");
        return;
      }

      console.log(
        `🔍 Found ${expiredTokenUsers.length} users with expired tokens`,
      );

      // Bulk update to remove refresh tokens
      const result = await User.updateMany(
        {
          refresh_token: { $exists: true, $ne: null },
          refresh_token_created_at: {
            $exists: true,
            $ne: null,
            $lt: sevenDaysAgo,
          },
        },
        {
          $set: {
            refresh_token: null,
            refresh_token_created_at: null,
          },
        },
      );

      console.log(`✨ Successfully cleaned up ${result.modifiedCount} users`);

      // Send notification emails to affected users (optional)
      for (const user of expiredTokenUsers) {
        try {
          await sendMail({
            to: user.email,
            subject: "Your Session Has Expired",
            html: tokenExpiredTemplate({
              username: user.username,
              email: user.email,
            }),
          });
        } catch (emailError) {
          console.error(
            `Failed to send email to ${user.email}:`,
            emailError.message,
          );
        }
      }

      console.log("🔐 Token cleanup job completed successfully");
    } catch (error) {
      console.error("❌ Error in token cleanup job:", error.message || error);
    }
  });

  return job;
};

export default cleanupExpiredTokens;
