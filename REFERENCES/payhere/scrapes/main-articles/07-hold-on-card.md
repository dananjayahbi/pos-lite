# Hold on Card (Auth & Capture)

# Hold on Card (Auth & Capture)

##### What is Hold on Card?

  * Hold on Card (or Authorization hold) is a payment technology that allows you to place a temporary hold for a certain amount on your customer's card now & capture the exact or lesser amount later within 7 days.
  * It's a smart & easy way to avoid unnecessary hasseles like processing partial or full refunds, in cases where the final amount to be charged from the customer varies from the authorized initial amount.



##### For what I can use Hold on Card?

  * Hold on Card can be used in any scenario where you need to reserve funds now, but capture them only after fulfillment.
  * For example, a food delivery app may authorize the full amount when customer places the order, then capture only for the available items when the order is fulfilled. A hotel may capture full amount prior to guest arrival & then capture only when the guest checkouts or cancels the booking.



##### How can I avoid refund hassels via Hold on Card?

  * You usually need to go through the hassle of refunds when you're not able to fulfill an order / complete a service, or when you're only able to fulfill or complete partially due to the unavailability of some.
  * Making a refund is a hassle not only for you, but also for your customers, as sometimes refunds take so many days to reach the customer's cards which results in customer dissatisfaction on your service.
  * By using Hold on Card, you can just hold the initial amount from customer's card when placing the order instead of charging, and capture the final amount at fulfillment instead of issuing partial refunds. Even if you need to cancel the order, you can just avoid the capture instead of issuing a full refund.



##### How can I use Hold on Card?

  * Hold on Card is a two step process.
    1. Get your customer's authorization for the initial amount & save the authorization token of the payment for later use.
    2. Capture the final amount later, using the saved authorization token.


  1. **Get Customer Authorization**

     * As in a regular payment, your customer has to enter their card credentials & complete the payment for the initial amount.
     * However, you need to use [PayHere Authorize API](https://support.payhere.lk/api-&-mobile-sdk/authorize-api) instead of the Checkout API in order to place a Hold on Card. This API returns an additional parameter as `authorization_token` for the particular payment, which you need to save in your database for later use.
  2. **Capture the Payment using Authorization Token**

     * Then you can capture the final amount, which is equal or lesser to the initial amount within 7 days after the authorization.
     * You can pass the saved `authorization_token` of the particular payment to [PayHere Capture API](https://support.payhere.lk/api-&-mobile-sdk/capture-api) & programatically capture the final amount.



##### What happens when I get the customer authorization for a Hold on Card?

  * Getting customer authorization places a temporary hold of funds for the authorized amount & it ensures that the customer has sufficient funds to process the payment when it'll be captured later.



##### When a Hold on Card payment settles to my bank account?

  * An authorized payment will not be settled to your bank account until you capture the payment via [PayHere Capture API](https://support.payhere.lk/api-&-mobile-sdk/capture-api)
  * Once you capture the payment, it will then be settled to your bank account 2 days after capturing.



##### What happens if I do not capture a Hold on Card within 7 days?

  * Since Hold on Card is a temporary hold of funds, failing to capture the payment by this time cancels the authorization & releases the funds.



##### I placed a Hold on Card, but I don't need to capture it now. What I should do?

  * Nothing. If you do not capture it, the hold on card will automatically be released after 7 days. So you don't need to do anything about it.



##### I placed a Hold on Card for a certain amount, but I need to capture a lesser amount now. How can I do?

  * Simple. When you capture the amount through [PayHere Capture API](https://support.payhere.lk/api-&-mobile-sdk/capture-api), pass the lesser amount that you need to capture. Only that amount will be captured then from the card & the rest will be automatically released after 7 days.



##### Is Hold on Card available for all payment methods?

  * No. Hold on Card is only available on Visa & MasterCard Payment methods (Credit cards only).

Hold on Card (Auth & Capture) - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 22nd Dec 2025
