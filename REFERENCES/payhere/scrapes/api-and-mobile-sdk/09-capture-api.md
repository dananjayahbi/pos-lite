# Capture API

# Capture API

PayHere Capture API lets you capture your authorized [Hold on Card](https://support.payhere.lk/hold-on-card) payments programmatically on demand using the authorization tokens you retrieved from [Payment Authorize API](https://support.payhere.lk/api-&-mobile-sdk/authorize-api). If you're new to Capture API, please refer [Hold on Card](https://support.payhere.lk/hold-on-card) introduction first.

Capture API is a RESTful API where you can directly send a HTTP Request with POST JSON body to an API end point & capture the payment. You will get the payment status parameters also directly in the HTTP Response for the above request. This API is secured with OAuth authentication & therefore you need first generate a pair of App ID & App Secret from your PayHere account, derive an Authorization code from them & finally retrieve an Access Token from the Authorization code in order to consume the Capture API.

Please follow the below steps.

  


#### 1\. Create a Business App

  1. Sign in to your PayHere account & go to Settings > Business Apps section
  2. Click 'Create App' button & enter an app name & comma seperated domains to whilelist
  3. Tick the permission 'Payment Capture API'
  4. Click 'Add Business App' button to create the app
  5. Once the app is created click 'View Credential' button in front of the created app
  6. Copy the 'App ID' & 'App Secret' values

  


#### 2\. Generate an Authorization code

  1. Go to a Base64 encoding site such as <https://www.base64encode.net/>
  2. Paste the App ID & App Secret you copied from Step 1 above, separated by a colon (:) mark. eg. `4OVx33RVOPg4DzdZUzq4A94D2:8n4VCj25MXp4JLDFyvsE9h4a8qgbPaZUI4JEWK4FCvop`
  3. Click 'Encode' button & copy the base64 encoded value. This is your Authorization code.

  


#### 3\. Retrieve an Access Token

If you don't already have a valid Access Token, you can retrieve one by consuming following API end point. 

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

  


#### 4\. Capture your payment

Consume the Capture API with a valid `access_token` to capture the order programmatically on demand. Use the `authorization_token` of your order, you retrieved from the [Payment Authorize API](https://support.payhere.lk/api-&-mobile-sdk/authorize-api) in the body.

(Please note that in Live environment, this API can be consumed only from the allowed domains you white-listed when creating the Business App in Step 1. If you want to consume this from a Mobile App, write an intermediate API on your domain to initiate the charging request & integrate it with your Mobile App instead of integrating directly with the Capture API.

To enhance security in the live environment, PayHere enforces an IP-based API key whitelisting mechanism for Merchant APIs. This ensures that API requests are accepted only from pre-approved server IP addresses.

To enable access to the live Merchant APIs, please send an email to [support@payhere.lk](mailto:support@payhere.lk) including the IP address of the server from which API requests will originate.

Once the IP address is received and verified, PayHere will whitelist it, allowing your system to successfully access the live Merchant APIs.)

##### Request URL



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/payment/capture
Live    - https://www.payhere.lk/merchant/v1/payment/capture
```

 

##### Header



```
Authorization: Bearer <access_token>
Content-Type: application/json
```

 

eg. `Authorization: Bearer cb5c47fd-741c-489a-b69e-fd73155ca34e`

##### Body



```
{
  "authorization_token" : "e34f3059-7b7d-4b62-a57c-784beaa169f4",
  "amount" : 80.00,
  "deduction_details" : "Item1 is out of stock"
}
```

 

The response for the above request will looks like following.

##### Response



```
{
    "status": 1,
    "msg": "Successfully captured payment",
    "data": {
        "status_code": 2,
        "status_message": "Successfully received the VISA payment",
        "payment_id": 320025527952,
        "currency": "LKR",
        "amount": 100.00,
        "captured_amount": 80.00,
        "items": "Toy Car",        
        "order_id": "Order12345",
        "md5sig": "27EE69A66E761D20429984A0CB0AFC27",
        "custom_1": "ABCD",
        "custom_2": null
    }
}
```

 

You can retrieve the `status_code` (2, 0, -2) value from the response to check whether the payment has been failed or success.

Payment Status Codes

  * `2` \- success
  * `0` \- unknown
  * `-2` \- failed

  


Please note that;

  * You need to follow Steps 1 & 2 only one time to generate an Authorization code for your app
  * You need to follow Step 3 & retrieve a new Access Token only if your current Access Token is expired
  * If you already have a valid Access Token, you can directly make multiple requests by following just the Step 4

  


#### 5\. Error Handling

Error messages may return for above two API end points due to the following reasons. You need to identify them & handle them properly in your application.

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

 

Invalid payment authorization Token or token not provided



```
{
    "status": -1,
    "msg": "Invalid token",
    "data": null
}
```

 

Capture amount must be same or less than the authorized amount.



```
{
    "status": -1,
    "msg": "Capture amount must be less than or equal to the authorized amount",
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

 

Trying to use an authorization token which was captured



```
{
    "status": -2,
    "msg": "Authorization is already CAPTURED",
    "data": null
}
```

 

Trying to use an authorization token which was refunded



```
{
    "status": -2,
    "msg": "Authorization is already REFUNDED",
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

Capture API - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 4th Sep 2026
