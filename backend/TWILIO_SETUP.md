# Twilio Setup Guide for SafeRoute

This guide walks you through setting up Twilio for sending emergency alerts and notifications in the SafeRoute application.

## 1. Create a Twilio Account

1. Visit [Twilio's website](https://www.twilio.com/) and click "Sign Up"
2. Fill in your details and create an account
3. Verify your email address and phone number
4. Complete the verification process

## 2. Get Your Twilio Credentials

Once your account is set up:

1. Log in to your [Twilio Console](https://www.twilio.com/console)
2. On the dashboard, you'll find your **Account SID** and **Auth Token**
   - The Account SID is visible on the dashboard
   - Click on "Show" to reveal your Auth Token

## 3. Get a Twilio Phone Number

1. In the Twilio Console, navigate to "Phone Numbers" → "Manage" → "Buy a Number"
2. Select a phone number that supports SMS capabilities
   - Ensure the number has SMS capabilities by checking the features column
3. Complete the purchase process

## 4. Configure SafeRoute Backend

1. Update your `.env` file in the backend directory with your Twilio credentials:

```
# Twilio credentials
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here  # Format: +1XXXXXXXXXX
```

2. The backend is already configured to use these environment variables for sending alerts.

## 5. Phone Number Formatting Requirements

Twilio requires phone numbers in E.164 format:

- Include the country code (e.g., +1 for US)
- No spaces, parentheses, or hyphens
- Example: +14155552671

## 6. Testing Your Setup

1. Start the backend server:
```
cd backend
npm start
```

2. Test the SMS functionality with the following API request:

```
POST /api/alerts

{
  "id": "test-alert-123",
  "tripId": "trip-123",
  "userId": "user-123",
  "type": "SOS",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "description": "Test emergency alert"
}
```

3. Check that the SMS is received on the circle member's phone number

## 7. Twilio Free Trial Limitations

If using a Twilio trial account:

1. You can only send messages to verified phone numbers
2. To verify a phone number:
   - Go to "Phone Numbers" → "Verified Caller IDs"
   - Add and verify each phone number you want to send messages to
3. Trial accounts have "TRIAL ACCOUNT" prefixed to all messages
4. To remove these limitations, upgrade to a paid account

## 8. Troubleshooting

If SMS messages aren't being sent:

1. Check the server console for error messages
2. Verify that phone numbers are in E.164 format
3. Confirm that your Twilio account has sufficient funds
4. Ensure recipient numbers are verified (if using a trial account)
5. Check that your `.env` file has the correct credentials

## 9. Production Considerations

For production deployments:

1. Set up proper error handling and retry mechanisms
2. Consider implementing a queue for SMS messages in case of Twilio service disruptions
3. Monitor your Twilio usage and set up alerts for low balance
4. Implement rate limiting to prevent accidental excessive SMS sending
5. Consider using Twilio's messaging services for better deliverability

## Support

If you encounter any issues with the Twilio integration:

- Check the Twilio documentation: https://www.twilio.com/docs
- View your message logs in the Twilio Console
- Contact Twilio support for account-specific issues 