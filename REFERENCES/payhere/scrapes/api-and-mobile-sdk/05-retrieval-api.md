# Retrieval API

# Retrieval API

PayHere Retrieval API lets you retrieve the details of the Successful payments processed through your PayHere account. The details include the Payment status (Received/Refunded/Chargebacked), Customer information, Amount details including exchange rate & fees, Payment method (Visa/Mastercard/Amex/etc) & masked card number of your payee. 

Retrieval API is a RESTful API where you can send a HTTP GET Request to an API end point & retrieve the payment details as the response. The API is secured with OAuth authentication & you need first generate a pair of App ID & App Secret from your PayHere account, derive an Authorization code from them & retrieve an Access Token from the Authorization code in order to consume the Retrieval API.

Please follow the below steps.

  


### 1\. Create an API Key

  1. Sign in to your PayHere account & go to Settings > API Keys section
  2. Click 'Create API Key' button & enter an app name & comma seperated domains to whilelist
  3. Tick the permission 'Automated Charging API'
  4. Click 'Save API Key' button to create the app
  5. Once the app is created click 'View Credentials' button in front of the created record
  6. Copy the 'App ID' & 'App Secret' values

  


### 2\. Generate an Authorization code

  1. Go to a Base64 encoding site such as <https://www.base64encode.net/>
  2. Paste the App ID & App Secret you copied from Step 1 above, separated by a colon (:) mark. eg. `4OVx33RVOPg4DzdZUzq4A94D2:8n4VCj25MXp4JLDFyvsE9h4a8qgbPaZUI4JEWK4FCvop`
  3. Click 'Encode' button & copy the base64 encoded value. This is your Authorization code.

  


### 3\. Retrieve an Access Token

If you don't already have a valid Access Token, you can retrieve one by consuming following API end point. 

(Please note that in Live environment, this API can be consumed only from the allowed domains you white-listed when creating the Business App in Step 1. If you want to consume this from a Mobile App, write an intermediate API on your domain to initiate the charging request & integrate it with your Mobile App instead of integrating directly with the Retrieval API.

To enhance security in the live environment, PayHere enforces an IP-based API key whitelisting mechanism for Merchant APIs. This ensures that API requests are accepted only from pre-approved server IP addresses.

To enable access to the live Merchant APIs, please send an email to [support@payhere.lk](mailto:support@payhere.lk) including the IP address of the server from which API requests will originate.

Once the IP address is received and verified, PayHere will whitelist it, allowing your system to successfully access the live Merchant APIs.)

##### Request URL



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/oauth/token
Live    - https://www.payhere.lk/merchant/v1/oauth/token
```

 

##### Header



```
Authorization: Basic <Authorization_code>
Content-Type: application/x-www-form-urlencoded
```

 

eg. `Authorization: Basic NE9WeDMzUlZPUGc0RHpkWlV6cTRBOTREMjo4bjRWQ2oyNU1YcDRKTERGeXZzRTloNGE4cWdiUGFaVUk0SkVXSzRGQ3ZvcA==`

##### Body



```
grant_type: client_credentials
```

 

The response for the above request will looks like following.

##### Response



```
{
    "access_token": "cb5c47fd-741c-489a-b69e-fd73155ca34e",
    "token_type": "bearer",
    "expires_in": 599,
    "scope": "SANDBOX"
}
```

 

Retrieve the `access_token` from the above response.

  


##### API Rate Limiting

PayHere Merchant API endpoints under `/merchant/v1/` are rate limited to a maximum of 20 requests within a 10-second period. If your application exceeds this limit, further API requests may be temporarily blocked or rejected.

  


### 4\. Retrieve Payment details

Consume the Retrieval API with a valid `access_token` to retrieve details of a particular payment. Use the `order_id` you passed to the [Checkout API](https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout) or [Charging API](https://support.payhere.lk/api-&-mobile-sdk/payhere-charging).

(Please note that in Live environment, this API can be consumed only from the allowed domains you white-listed when creating the Business App in Step 1. If you want to consume this from a Mobile App, write an intermediate API on your domain to initiate the retrieval request & integrate it with your Mobile App instead of integrating directly with the Retrieval API.)

##### Request URL



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/payment/search?order_id=LP8006126139
Live    - https://www.payhere.lk/merchant/v1/payment/search?order_id=LP8006126139
```

 

##### Header



```
Authorization: Bearer <access_token>
Content-Type: application/json
```

 

eg. `Authorization: Bearer cb5c47fd-741c-489a-b69e-fd73155ca34e`

##### GET Parameters

`order_id` \- The order_id you passed to the Checkout API when processing the payment

  


##### Response

The response for the above request will look like following.



```
{
    "status": 1,
    "msg": "Payments with order_id:LP8006126139_2019-12-06",
    "data": [
        {
            "payment_id": 320025071278,
            "order_id": "LP8006126139",
            "date": "2020-01-16 16:21:02",
            "description": "Policy No. LP8006126139 - Outstanding Payment",
            "status": "RECEIVED",
            "currency": "LKR",
            "amount": 50,
            "customer": {
                "fist_name": "Saman",
                "last_name": "Perera",
                "email": "samanperera@gmail.com",
                "phone": "+94771234567",
                "delivery_details": {
                    "address": "N0.1, Galle Road",
                    "city": "Colombo",
                    "country": "Sri Lanka"
                }
            },
            "amount_detail": {
                "currency": "LKR",
                "gross": 500,
                "fee": 14.50,
                "net": 485.50,
                "exchange_rate": 1,
                "exchange_from": "LKR",
                "exchange_to": "LKR"
            },
            "payment_method": {
                "method": "VISA",
                "card_customer_name": "S Perera",
                "card_no": "************1234"
            },
            "items": null
        }
    ]
}
```

 

The `status` of the above response reflects whether the request processed without errors or not.

Payment status codes:

  * `0` \- Payment pending
  * `1` \- Payment successful
  * `-1` \- No records found
  * `-2` \- Payment declined



PayHere does not validate the uniqueness of the Order ID set by the merchant. In that case, there might be one or more successful payments that will return from the API. The payment status under `data[*].status` will have the following codes

  * `RECEIVED` \- Payment successfully received
  * `REFUND REQUESTED` \- A refund request was received for the payment and waiting for the amount to be transferred from the merchant account
  * `REFUND PROCESSING` \- Refund amount successfully transferred from the merchant and waiting for PayHere to process the refund
  * `REFUNDED` \- Refund completed
  * `CHARGEBACKED` \- Payment chargebacked

  


_Attention:_

  * You need to follow Steps 1 & 2 only one time to generate an Authorization code for your app
  * You need to follow Step 3 & retrieve a new Access Token only if your current Access Token is expired
  * If you already have a valid Access Token, you can retieve payment details using the same Access Token by following just the Step 4

  


### 5\. Error Handling

Error messages may returned for above API end point due to the following reasons. You need to identify & handle them properly in your application.

Invalid Access Token



```
{
    "error": "invalid_token",
    "error_description": "Invalid access token: e291493a-99a5-4177-9c8b-e8cd18ee9f85"
}
```

 

Access Token Expired



```
{
    "error": "invalid_token",
    "error_description": "Access token expired: cb5c47fd-741c-489a-b69e-fd73155ca34e"
}
```

 

Invalid Order ID or Order ID which does not have successful payment(s)



```
{
    "status": -1,
    "msg": "No payments found",
    "data": null
}
```

 

Invalid API Authorization (eg. Consuming through a not allowed domain, ect.)



```
{
    "status": -2,
    "msg": "Authentication error",
    "data": null
}
```

   


##### Access Denied for the Domain

You may receive the following error with an HTTP 401 Unauthorized status when accessing a PayHere Merchant API endpoint.



```
{
    "status": -1,
    "msg": "Access denied for the domain",
    "data": null
}
```

 

This error may occur when PayHere is unable to correctly resolve or validate the domain configured for your API Key.

  * Sandbox Environment

    * For the Sandbox environment, configure the allowed domain of your API Key as **`*`**
    * Using `*` allows the Sandbox API Key to accept requests and can be used to continue Sandbox testing when a domain resolution issue occurs.
  * Live Environment

    * If you encounter the `Access denied for the domain` error in the Live environment, please contact [support@payhere.lk](mailto:support@payhere.lk) for assistance with the domain or API access configuration.

Retrieval API - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 4th Sep 2026
