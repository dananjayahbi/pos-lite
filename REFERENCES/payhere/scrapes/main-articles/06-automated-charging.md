# Automated Charging (Tokenization)

# Automated Charging (Tokenization)

##### What is Automated Charging?

  * Automated Charging is a payment technology that allows you to automatically charge your pre-approved customers any amount at anytime programatically, just like Uber charges the passenger's card at the end of each hire.
  * Your customer has to manually enter their card credentials only once & pre-approve your business to automatically charge their card on future payments. You will receive an encrypted token for their card upon pre-approval, which you can store in your database securely.
  * After pre-approval, you can charge that customer anytime any amount on demand using that encrypted token.



##### For what I can use Automated Charging?

  * Automated Charging can be used in any scenario where you have known or registered customers, so that you can charge them on demand programatically without asking them to manually enter their card credentials every time you need to charge them.
  * It can be a Mobile App where you have multiple in-app purchases or services on-demand, a SaaS platform where you charge the customers on their monthly usage or simply an eCommerce website where you have frequently returning buyers.



##### How can I use Automated Charging?

  * Automated Charging can be accomplished through following steps.
    1. Get your customer's Pre-approval for Automated Charging
    2. Store the encrypted token returned for customer after pre-approval
    3. Charge the customer programatically using the encrypted token


  1. **Getting Customer Pre-approvals**

     * Pre-approval means, you get the customer's concent to automatically charge customer's card for future payments.
     * Your customer has to enter their card credentials once & pre-approve automated payments from your business. Rs.1 will be charged from the card when this is done & that Rs.1 will be instantly refunded back to the card.
     * You can use [PayHere Preapproval API](https://support.payhere.lk/api-&-mobile-sdk/preapproval-api) to get your customer pre-approved for automated payments.
  2. **Storing Encrypted Token**

     * A Token is an encrypted secure code that only you can use to charge your customer's card.
     * A unique token is returned for each customer's card, upon a successful pre-approval. It's returned on the Payment Notification callback directly from PayHere server to your server.
     * You can store it in your database securely along with your customer details.
  3. **Automated Charging using Tokens**

     * Automated Charging means you can charge your customer's card programatically in code-level.
     * You can pass the stored encrypted token to [PayHere Charging API](https://support.payhere.lk/api-&-mobile-sdk/charging-api) & programatically charge your customer on-demand.



##### Is Automated Charging available for all payment methods?

  * No. At the moment Automated Charging is only available on Visa & MasterCard Payment methods.



##### How can I cancel a Preapproval?

  * Sign in to your PayHere Account & go to 'Payments' tab > 'Preapprovals' section Search the Preapproval by approved date or customer details & select the Preapproval
  * Click 'Cancel Preapproval' button & confirm. (Please note that preapproval cancellation cannot be undone)



##### Can my customer cancel his/her Preapproval?

  * Preapprovals can be cancelled only by the Merchant, which is you. If your customer needs to cancel his/her Preapproval, he/she should request you to cancel & you need to cancel it from your PayHere account.

Automated Charging (Tokenization) - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 22nd Dec 2025
