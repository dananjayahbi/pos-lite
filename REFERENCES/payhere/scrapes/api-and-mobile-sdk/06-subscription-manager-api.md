# Subscription Manager API

# Subscription Manager API

PayHere Subscription Manager API lets you view, retry & cancel your subscription customers programmatically you subscribed from [Recurring API](https://support.payhere.lk/api-&-mobile-sdk/recurring-api). If you're new to Recurring API, please refer [Recurring Billing](https://support.payhere.lk/recurring-billing) introduction first.

Subscription Manager API is a RESTful API where you can directly send a HTTP Request with GET/POST parameters to an API end point. You will get the results directly in the HTTP Response for the requests. This API is secured with OAuth authentication & therefore you need first generate a pair of App ID & App Secret from your PayHere account, derive an Authorization code from them & finally retrieve an Access Token from the Authorization code in order to consume the Subscription API.

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




or if you are using OAuth library, you may use `BASIC` authorization technique by passing App ID & App Secret directly.

  


### 3\. Retrieve an Access Token

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

  


### 4\. Consume API Endpoints

Consume the following Subscription API endpoints with a valid `access_token` to manage the subscriptions programmatically on demand.

(Please note that in Live environment, this API can be consumed only from the allowed domains you white-listed when creating the Business App in Step 1. If you want to consume this from a Mobile App, write an intermediate API on your domain to initiate the charging request & integrate it with your Mobile App instead of integrating directly with the Subscription Manager API.

To enhance security in the live environment, PayHere enforces an IP-based API key whitelisting mechanism for Merchant APIs. This ensures that API requests are accepted only from pre-approved server IP addresses.

To enable access to the live Merchant APIs, please send an email to [support@payhere.lk](mailto:support@payhere.lk) including the IP address of the server from which API requests will originate.

Once the IP address is received and verified, PayHere will whitelist it, allowing your system to successfully access the live Merchant APIs.)

_Attention:_ Please note that in Live environment, this API can be consumed only from the allowed domains you white-listed when creating the Business App in Step 1.   
  


#### a. View all subscriptions

##### Request URL (GET)



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/subscription
Live    - https://www.payhere.lk/merchant/v1/subscription
```

 

##### Header



```
Authorization: Bearer <access_token>
Content-Type: application/json
```

 

eg. `Authorization: Bearer cb5c47fd-741c-489a-b69e-fd73155ca34e`

The response for the above request will looks like following.

##### Response



```
{
    "status": 1,
    "msg": "Found 1 subscriptions",
    "data": [
        {
            "subscription_id": 420075032251,
            "order_id": "Order0003",
            "date": "2018-10-04 20:24:52",
            "description": "Book reading Subscription",
            "recurring": "Charged every month for 3 years",
            "status": "ACTIVE",
            "amount": 100,
            "currency": "LKR",
            "customer": {
                "fist_name": "Saman",
                "last_name": "Kumara",
                "email": "saman@gmail.com",
                "phone": "+94712345678",
                "delivery_details": {
                    "address": "1, Galle Road",
                    "city": "Colombo",
                    "country": ""
                }
            },
            "amount_detail": {
                "currency": "LKR",
                "gross": 200,
                "fee": 36.6,
                "net": 163.4,
                "exchange_rate": 1,
                "exchange_from": "LKR",
                "exchange_to": "LKR"
            },
            "payment_method": {
                "method": "VISA",
                "card_customer_name": "Saman Kumara",
                "card_no": "************4564"
            },
            "items": [
                {
                    "name": "Book reading Subscription",
                    "quantity": 1,
                    "currency": "LKR",
                    "unit_price": 100,
                    "total_price": 100
                },
                {
                    "name": "Startup Fee",
                    "quantity": 1,
                    "currency": "LKR",
                    "unit_price": 100,
                    "total_price": 100
                }
            ]
        }
    ]
}
```

 

The top level `status` is used in every call to identify whether the operation is success or not.

  * `1` \- success
  * `-1` \- failed. Refer `msg` element for more details



You will get a list of subscriptions under `data` element. Every subscription is identified using the unique ID which is the value of `data[i].subscription_id`. In above example `subscription_id` is `420075032251`

Subscription status codes (`data[i].status`)

  * `ACTIVE` \- Subscription is active and will charge in future.
  * `COMPLETED` \- Subscription is completed. No future charging will be happen.
  * `FAILED` \- Subscription was continuously failed and will not try further by PayHere  
  




#### b. View payments of a subscription

You need `subscription_id` retrieved from above call to access the payments.

##### Request URL (GET)



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/subscription/{subscription_id}/payments
Live    - https://www.payhere.lk/merchant/v1/subscription/{subscription_id}/payments
```

 

eg: <https://sandbox.payhere.lk/merchant/v1/subscription/420075032251/payments>

##### Header



```
Authorization: Bearer <access_token>
Content-Type: application/json
```

 

eg. `Authorization: Bearer cb5c47fd-741c-489a-b69e-fd73155ca34e`

The response for the above request will looks like following.

##### Response



```
{
    "status": 1,
    "msg": "Found 2 payments",
    "data": [
        {
            "payment_id": 320025023469,
            "order_id": "Order0003",
            "date": "2018-10-04 20:24:52",
            "description": "Book reading Subscription",
            "status": "RECEIVED",
            "currency": "LKR",
            "amount": 200,
            "customer": {
                "fist_name": "Saman",
                "last_name": "Kumara",
                "email": "saman@gmail.com",
                "phone": "+94712345678",
                "delivery_details": {
                    "address": "1, Galle Road",
                    "city": "Colombo",
                    "country": ""
                }
            },
            "amount_detail": {
                "currency": "LKR",
                "gross": 200,
                "fee": 36.6,
                "net": 163.4,
                "exchange_rate": 1,
                "exchange_from": "LKR",
                "exchange_to": "LKR"
            },
            "payment_method": {
                "method": "VISA",
                "card_customer_name": "Saman Kumara",
                "card_no": "************4564"
            },
            "items": [
                {
                    "name": "Book reading Subscription",
                    "quantity": 1,
                    "currency": "LKR",
                    "unit_price": 100,
                    "total_price": 100
                },
                {
                    "name": "Startup Fee",
                    "quantity": 1,
                    "currency": "LKR",
                    "unit_price": 100,
                    "total_price": 100
                }
            ]
        },
        {
            "payment_id": 320025023470,
            "order_id": "Order0003",
            "date": "2018-10-04 20:25:52",
            "description": "Book reading Subscription",
            "status": "RECEIVED",
            "currency": "LKR",
            "amount": 100,
            "customer": {
                "fist_name": "Saman",
                "last_name": "Kumara",
                "email": "saman@gmail.com",
                "phone": "+94712345678",
                "delivery_details": {
                    "address": "1, Galle Road",
                    "city": "Colombo",
                    "country": ""
                }
            },
            "amount_detail": {
                "currency": "LKR",
                "gross": 100,
                "fee": 34.3,
                "net": 65.7,
                "exchange_rate": 1,
                "exchange_from": "LKR",
                "exchange_to": "LKR"
            },
            "payment_method": {
                "method": "VISA",
                "card_customer_name": "Saman Kumara",
                "card_no": "************4564"
            },
            "items": [
                {
                    "name": "Book reading Subscription",
                    "quantity": 1,
                    "currency": "LKR",
                    "unit_price": 100,
                    "total_price": 100
                }
            ]
        }
    ]
}
```

   
  


#### c. View a Single Subscription

You need the `subscription_id` of the subscription you want to retrieve.

##### Request URL (GET)



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/subscription/{subscription_id}
Live    - https://www.payhere.lk/merchant/v1/subscription/{subscription_id}
```

 

eg: <https://sandbox.payhere.lk/merchant/v1/subscription/420000032251>

##### Header



```
Authorization: Bearer <access_token>
Content-Type: application/json
```

 

eg. `Authorization: Bearer cb5c47fd-741c-489a-b69e-fd73155ca34e`

The response for the above request will looks like following.

##### Response



```
{
    "status": 1,
    "msg": "Found subscription",
    "data": {
        "subscription_id": 420000032251,
        "order_id": "RECURRIN-20260819093622-293",
        "date": "2024-04-19 15:10:29",
        "description": "PayHere Portal Test Item",
        "recurring": "Charged every month for 1 year",
        "status": "ACTIVE",
        "amount": 20,
        "currency": "LKR",
        "customer": {
            "fist_name": "Saman",
            "last_name": "Kumara",
            "email": "saman@gmail.com",
            "phone": "0771234567",
            "delivery_details": {
                "address": "no.1, galle road",
                "city": "colombo",
                "country": "sri lanka"
            }
        },
        "amount_detail": {
            "currency": "LKR",
            "gross": 20,
            "fee": 0.53,
            "net": 19.47,
            "exchange_rate": 1,
            "exchange_from": "LKR",
            "exchange_to": "LKR"
        },
        "payment_method": {
            "method": "VISA",
            "card_customer_name": "Saman Kumara",
            "card_no": "************4564"
        },
        "items": [
            {
                "name": "PayHere Test Item",
                "quantity": 1,
                "currency": "LKR",
                "unit_price": 20,
                "total_price": 20
            }
        ]
    }
}
```

   


#### d. Retry subscription

If you need to retry a failed subscription this method can be used. You need `subscription_id` to acess the subscription which need to be retried

##### Request URL (POST)



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/subscription/retry
Live    - https://www.payhere.lk/merchant/v1/subscription/retry
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
  "subscription_id" : 420075032251
}
```

 

The response for the above request will looks like following.

##### Success Response



```
{
    "status": 1,
    "msg": "Recurring payment charged successfully",
    "data": null
}
```

 

##### Error response



```
{
    "status": -1,
    "msg": "Subscription is not eligible for retrying",
    "data": null
}
```

 

Possible reasons for this error are

  * Subscriptions has not failed previously
  * Subscription is already cancelled.  
  




#### e. Cancel subscription

If you need to cancel a subscription this method can be used. You need `subscription_id` to acess the subscription which need to be cancelled.

##### Request URL (POST)



```
Sandbox - https://sandbox.payhere.lk/merchant/v1/subscription/cancel
Live    - https://www.payhere.lk/merchant/v1/subscription/cancel
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
  "subscription_id" : 420075032251
}
```

 

The response for the above request will looks like following.

##### Success Response



```
{
    "status": 1,
    "msg": "Successfully cancelled the subscription",
    "data": null
}
```

 

##### Error responses



```
{
    "status": -1,
    "msg": "Subscription is already cancelled.",
    "data": null
}
```

 

Subscription is already cancelled and cannot be cancelled again   


  


```
{
    "status": -1,
    "msg": "Subscription is already completed.",
    "data": null
}
```

 

A completed subscription cannot be cancelled as the subscription has finished charging all of its recurring payments.

  


_Attention:_

  * You need to follow Steps 1 & 2 only one time to generate an Authorization code for your app
  * You need to follow Step 3 & retrieve a new Access Token only if your current Access Token is expired
  * If you already have a valid Access Token, you can directly make the request using the same Access Token

  


### 5\. Error Handling

Error messages may returned for above APIs end points due to the following reasons. You need to identify them & handle them properly in your application.

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

Subscription API - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 4th Sep 2026
