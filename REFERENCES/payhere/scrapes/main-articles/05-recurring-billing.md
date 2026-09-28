# Recurring Billing (Subscriptions)

# Recurring Billing (Subscriptions)

##### What is Recurring Billing?

  * Recurring Billing is a payment technology that allows you to automatically charge your customers a fixed amount at predefined intervals such as weekly, monthly or yearly.
  * Your customer has to enter their card credentials and authorize the subscription only once. After the subscription is successfully created, PayHere automatically processes future recurring payments according to the configured billing schedule.
  * You will receive payment and subscription status updates through the Payment Notification callback to your configured `notify_url`.



##### For what I can use Recurring Billing?

  * Recurring Billing can be used in any scenario where you need to collect a fixed payment from your customers repeatedly according to a predefined schedule.
  * It can be a SaaS platform charging a monthly subscription fee, a membership service collecting recurring fees, a hosting service, an educational platform, an insurance or maintenance service, or any other subscription-based business.



##### How can I use Recurring Billing?

Recurring Billing can be accomplished through following steps.

  1. **Creating a Customer Subscription**

     * Your customer has to enter their card credentials and authorize the recurring subscription.
     * You can use the [PayHere Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api) to create the subscription by defining the recurring amount, billing interval and duration.
     * Once successfully authorized, PayHere automatically handles future payments according to the configured recurring schedule.
     * Refer to the [PayHere Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api) documentation for request parameters, hash generation, payment notifications and other integration details.
  2. **Storing the Subscription ID**

     * A unique `subscription_id` is returned for each successfully created subscription.
     * You should store this Subscription ID securely in your database together with the relevant customer or subscription details.
     * The Subscription ID can later be used to identify and manage the subscription.
  3. **Receiving Recurring Payments**

     * After the subscription is successfully created, PayHere automatically processes recurring installments according to the configured billing schedule.
     * The customer does not need to enter their card credentials again for each recurring payment.
     * PayHere sends the result of each recurring payment to your configured `notify_url`.
     * Recurring payments may succeed or fail depending on the status of the customer's card and the response received from the cardholder's issuing bank.
     * Failed recurring payments may be retried according to the subscription configuration.
     * Refer to the [PayHere Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api) documentation for notification types, status codes, retry configuration, payment recovery and other recurring payment options.
  4. **Managing Subscriptions**

     * You can manage your recurring subscriptions programmatically using the [PayHere Subscription Manager API](https://support.payhere.lk/api-&-mobile-sdk/subscription-manager-api).
     * It can be used to view subscriptions, retrieve subscription payment history, retry eligible failed subscriptions and cancel subscriptions.
     * Refer to the [PayHere Subscription Manager API](https://support.payhere.lk/api-&-mobile-sdk/subscription-manager-api) documentation for authentication, endpoints, request parameters and response details.



##### How can I cancel a Subscription?

  * Sign in to your PayHere Account and locate the relevant subscription under the subscription management section.
  * Select the subscription and use the available cancellation option to stop it.
  * Once cancelled, PayHere will no longer process future recurring payments for that subscription.
  * You can also cancel subscriptions programmatically using the [PayHere Subscription Manager API](https://support.payhere.lk/api-&-mobile-sdk/subscription-manager-api).



##### Can my customer cancel his/her Subscription?

  * Subscriptions can be cancelled by the Merchant, which is you.
  * If your customer needs to cancel his/her subscription, he/she should request you to cancel it.
  * You can cancel the subscription through your PayHere Account or programmatically using the [Subscription Manager API](https://support.payhere.lk/api-&-mobile-sdk/subscription-manager-api).



##### What happens if a Recurring Payment fails?

  * A recurring payment can fail due to reasons such as insufficient funds, an expired or cancelled card, or a decline from the cardholder's issuing bank.
  * PayHere can retry failed recurring payments according to the subscription configuration.
  * Retry limits, automatic cancellation and recovery of missed payments can also be configured where supported.
  * Refer to the [PayHere Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api) documentation for the latest retry behaviour, available configuration options and environment limitations.



##### When does a Subscription end?

  * A subscription with a fixed duration will complete once its configured recurring period has ended.
  * A subscription configured to continue indefinitely will remain active until it is cancelled or otherwise stopped.
  * Once a subscription is completed or cancelled, PayHere will no longer process future recurring payments.

Recurring Billing (Subscriptions) - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 4th Sep 2026
