# Trans Express API

## Overview

The Trans Express API simplifies your shipping operations by seamlessly integrating Trans Express services into your existing systems. Whether it's your website, order entry, or warehouse management, our API streamlines your processes for a more efficient operation.

### Key Features

- **Shipment**: Create and manage shipments.
- **Tracking**: Monitor shipment status.

### Benefits

- Optimize and expand your business.
- Easily integrate Trans Express features into your existing system.
- Maintain your team's familiarity with the user interface.

### Developer-Friendly

- Single API based on industry standards.
- Designed for fast-paced warehousing and time-sensitive e-commerce.
- Dedicated API environment for testing.

### Environments

| Environment | Base URL | Description |
| --- | --- | --- |
| Staging | `https://dev-transexpress.parallaxtec.com/api` | Staging — for testing purposes |
| Production | `https://portal.transexpress.lk/api` | Production — for live account access |

### Responses

Each API endpoint provides both success and error responses. Each endpoint section features an example of both success and error responses, giving users a clear understanding of what to expect when interacting with the API.

### Testing Shipments

You can verify the functionality of the Trans Express API by adding orders via the API to our staging servers and checking the status. Follow these steps:

- **Add Orders:** Utilize the API to create sample orders and submit them to our staging servers. Make sure to use the API endpoints designed for testing purposes.
- **Login:** Access the following link to log in to our staging servers and verify if the orders have been successfully added: [https://dev-transexpress.parallaxtec.com/](https://dev-transexpress.parallaxtec.com/).
- **Check Status:** Once logged in, navigate to the shipment status section. Here, you can review the status of the orders you added via the API.

Testing your shipments on our staging servers allows you to ensure that everything is functioning as expected before implementing the API in a live environment.

---

## Client Login (POST)

**URL:** `https://portal.transexpress.lk/api/login/client`

**Description:** Trans Express API uses a simple login system based on **email and password** in order to access the client portal after successful sign-ins. It performs authentication and authorization checks to ensure that only authorized clients can access the client portal of the system.

The login response returns a `token` that is used as a **Bearer Token** in the `Authorization` header for the other endpoints. For production use, obtain your API key from **Client Portal → My Profile → Update Account → API Key** and send it as a Bearer Token.

### Request Payload

**`login_data`** — _required : Object_ — General order details

- **E-mail** — _required : String_ — Email address provided by the client during registration. Provide a valid email address.
- **Password** — _required : String_ — Password provided by the client.

### Request Body

```json
{
    "email": "apex@gmail.com",
    "password": "12345678"
}
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/login/client' \
--header 'Accept: application/json' \
--data-raw '{
    "email": "iphonestore8@gmail.com",
    "password": "12345678"
}'
```

### Example Response (200 OK)

```json
{
  "token": "oGEIPQgrUrIzHZP9OZevE9YKc0M1oWx7ZZXA2QjTNwN8ShwFXrHz5hPwdvY9sansrMc0jKtuZR3QK06Y",
  "status": "success"
}
```

---

## All Provinces (GET)

**URL:** `https://portal.transexpress.lk/api/provinces`

**Description:** Displays all the provinces situated in Sri Lanka.

### Example Request (curl)

```curl
curl --location 'https://portal.transexpress.lk/api/provinces' \
--header 'Accept: application/json'
```

No response body — this request doesn't return any response body.

---

## All Districts (GET)

**URL:** `https://portal.transexpress.lk/api/districts?province_id=1`

**Description:** Displays the districts upon each province by selecting a province.

### Query Parameters

- **province_id** — The province for which districts should be returned (e.g. `1`).

### Example Request (curl)

```curl
curl --location 'https://portal.transexpress.lk/api/districts?province_id=1' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json'
```

### Example Response (200 OK)

```json
[
  {
    "id": 11,
    "text": "Kandy"
  },
  {
    "id": 16,
    "text": "Matale"
  },
  {
    "id": 20,
    "text": "NuwaraEliya"
  }
]
```

---

## All Cities (GET)

**URL:** `https://portal.transexpress.lk/api/cities`

**Description:** Depicts all the cities available on each respective district.

### Query Parameters

- **district_id** — The district for which cities should be returned (e.g. `8`).

### Example Request (curl)

```curl
curl --location 'https://portal.transexpress.lk/api/cities?district_id=8' \
--header 'Accept: application/json'
```

### Example Response (200 OK)

The response is an array of `{ id, text }` objects listing the cities for the selected district. Representative sample:

```json
[
  {
    "id": 519,
    "text": "Ambalantota"
  },
  {
    "id": 520,
    "text": "Angunakolapelessa"
  },
  {
    "id": 521,
    "text": "Bandagiriya Colony"
  },
  {
    "id": 522,
    "text": "Barawakumbuka"
  },
  {
    "id": 523,
    "text": "Beliatta"
  },
  {
    "id": 524,
    "text": "Beragama"
  },
  {
    "id": 525,
    "text": "Beralihela"
  },
  {
    "id": 526,
    "text": "Bowalagama"
  },
  {
    "id": 527,
    "text": "Bundala"
  },
  {
    "id": 528,
    "text": "Ellagala"
  },
  {
    "id": 529,
    "text": "Gangulandeniya"
  },
  {
    "id": 530,
    "text": "Getamanna"
  },
  {
    "id": 531,
    "text": "Goda Koggalla"
  },
  {
    "id": 532,
    "text": "Gonagamuwa Uduwila"
  },
  {
    "id": 533,
    "text": "Gonnoruwa"
  },
  {
    "id": 534,
    "text": "Hakuruwela"
  },
  {
    "id": 535,
    "text": "Hambantota"
  },
  {
    "id": 536,
    "text": "Horewelagoda"
  },
  {
    "id": 537,
    "text": "Hungama"
  },
  {
    "id": 538,
    "text": "Ihala Beligalla"
  },
  {
    "id": 539,
    "text": "Iththademaliya"
  },
  {
    "id": 540,
    "text": "Julampitiya"
  },
  {
    "id": 541,
    "text": "Kahandamodara"
  },
  {
    "id": 542,
    "text": "Kariyamaditta"
  },
  {
    "id": 543,
    "text": "Katuwana"
  },
  {
    "id": 544,
    "text": "Kirama"
  },
  {
    "id": 545,
    "text": "Kirinda"
  },
  {
    "id": 546,
    "text": "Lunama"
  },
  {
    "id": 547,
    "text": "Lunugamwehera"
  },
  {
    "id": 548,
    "text": "Magama"
  },
  {
    "id": 549,
    "text": "Mahagalwewa"
  },
  {
    "id": 550,
    "text": "Mamadala"
  },
  {
    "id": 551,
    "text": "Medamulana"
  },
  {
    "id": 552,
    "text": "Middeniya"
  },
  {
    "id": 553,
    "text": "Migahajandura"
  },
  {
    "id": 554,
    "text": "Modarawana"
  },
  {
    "id": 555,
    "text": "Mulkirigala"
  },
  {
    "id": 556,
    "text": "Nakulugamuwa"
  },
  {
    "id": 557,
    "text": "Netolpitiya"
  },
  {
    "id": 558,
    "text": "Nihiluwa"
  },
  {
    "id": 559,
    "text": "Padawkema"
  },
  {
    "id": 560,
    "text": "Pahala Andarawewa"
  },
  {
    "id": 561,
    "text": "Pallekanda"
  },
  {
    "id": 562,
    "text": "Rammalawarapitiya"
  },
  {
    "id": 563,
    "text": "Ranakeliya"
  },
  {
    "id": 564,
    "text": "Ranmuduwewa"
  },
  {
    "id": 565,
    "text": "Ranna"
  },
  {
    "id": 566,
    "text": "Ratmalwala"
  },
  {
    "id": 567,
    "text": "Ru/ridiyagama"
  },
  {
    "id": 568,
    "text": "Sooriyawewa Town"
  },
  {
    "id": 569,
    "text": "Tangalla"
  },
  {
    "id": 570,
    "text": "Tissamaharama"
  },
  {
    "id": 571,
    "text": "Uda Gomadiya"
  },
  {
    "id": 572,
    "text": "Udamattala"
  },
  {
    "id": 573,
    "text": "Uswewa"
  },
  {
    "id": 574,
    "text": "Vitharandeniya"
  },
  {
    "id": 575,
    "text": "Walasmulla"
  },
  {
    "id": 576,
    "text": "Weeraketiya"
  },
  {
    "id": 577,
    "text": "Weerawila Newtown"
  },
  {
    "id": 578,
    "text": "Weerawila"
  },
  {
    "id": 579,
    "text": "Wekandawela"
  },
  {
    "id": 580,
    "text": "Weligatta"
  },
  {
    "id": 581,
    "text": "Yatigala"
  },
  {
    "id": 2168,
    "text": "mirijjawila"
  },
  {
    "id": 2224,
    "text": "hambantota town"
  },
  {
    "id": 2226,
    "text": "Alokapura"
  },
  {
    "id": 2227,
    "text": "udamalala"
  },
  {
    "id": 2228,
    "text": "Mayurapura"
  },
  {
    "id": 2229,
    "text": "Siribopura"
  },
  {
    "id": 2304,
    "text": "A/ TOTA"
  },
  {
    "id": 2831,
    "text": "Ranawarunawa"
  },
  {
    "id": 2832,
    "text": "pannegamuwa"
  },
  {
    "id": 2833,
    "text": "debarawewa"
  },
  {
    "id": 2834,
    "text": "beraligala"
  },
  {
    "id": 2835,
    "text": "yodhakanndiya"
  },
  {
    "id": 2836,
    "text": "nedigamvila"
  },
  {
    "id": 2837,
    "text": "ikkapallama"
  },
  {
    "id": 2838,
    "text": "Uduvila (Hambantota)"
  },
  {
    "id": 2839,
    "text": "mahasenpura (Hambantota)"
  },
  {
    "id": 2840,
    "text": "julpallama"
  },
  {
    "id": 2841,
    "text": "ranminitenna"
  },
  {
    "id": 2842,
    "text": "kawantissapura"
  },
  {
    "id": 2844,
    "text": "situlpawwa"
  }
]
```

---

## Add Single Order - Manual waybill (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/single-manual`

**Description:** The following request can be used to **add orders by manually** providing a **waybill ID** for the package.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **waybill_id** — _required : String_ — Waybill number of the order (min count = 8, max = 8)
- **order_no** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **phone_no** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **phone_no2** — _optional : String_ — Another contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **cod** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city_id** — _required : Integer_ — Respective city the package should be delivered to
- **note** — _optional : String_ — Mention any particular note regarding the order package

### Request Body

```json
{
    "waybill_id": "A0000201",
    "order_no": 55555555,
    "customer_name": "customer name 1",
    "address": "address 1",
    "description": "test order_description",
    "phone_no": "0777777777",
    "phone_no2": "0777777777",
    "cod": 1500,
    "city_id": "Kegalle",
    "note": "sample note 1"
}
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/single-manual' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
        "waybill_id" : "42718291",
        "order_no" : 55555555,
        "customer_name" : "customer name 1",
        "address" : "address 1",
        "description" : "test order_description" ,
        "phone_no" : "0777777777",
        "phone_no2" : "0767777777",
        "cod" : 1500,
        "district_id" : 5,
        "city_id" : 864,
        "note" : "sample note 1"
}'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "order": {
    "waybill_id": "42718291",
    "order_no": 55555555,
    "customer_name": "customer name 1",
    "address": "address 1",
    "description": "test order_description",
    "phone_no": "0777777777",
    "phone_no2": "0767777777",
    "cod": "1500",
    "district_id": 5,
    "city_id": 864,
    "note": "sample note 1",
    "updated_at": "2023-10-06 17:02:55",
    "created_at": "2023-10-06 17:02:55",
    "id": 1947052,
    "client_id": 4205,
    "status_id": 14998774
  }
}
```

---

## Add Single Order - Auto waybill (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/single-auto`

**Description:** The following request can be made to add **orders automatically** into our system.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **waybill_id** — _required : String_ — Waybill number of the order (min count = 8, max = 8)
- **order_no** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **phone_no** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **phone_no2** — _optional : String_ — Another contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **cod** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city_id** — _required : Integer_ — Respective city the package should be delivered to
- **note** — _optional : String_ — Mention any particular note regarding the order package

### Request Body

```json
{
        "order_no" : 44444444,
        "customer_name" : "customer name 1",
        "address" : "address 1",
        "description" : "test order_description" ,
        "phone_no" : "0777777777",
        "phone_no2" : "0677777777",
        "cod" : 1500,
        "city_id" : 864,
        "note" : "sample note 1"
}
```

### Example Request (curl)

```curl
curl --location 'https://portal.transexpress.lk/api/orders/upload/single-auto' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
        
        "order_no" : 44444444,
        "customer_name" : "customer name 1",
        "address" : "address 1",
        "description" : "test order_description" ,
        "phone_no" : "0777777777",
        "phone_no2" : "0677777777",
        "cod" : 1500,
        "city_id" : 864,
        "note" : "sample note 1"
}'
```

No response body — this request doesn't return any response body.

---

## Add Single Order - Auto waybill without city (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/single-auto-without-city`

**Description:** The following request can be used to add orders where the waybill ID will be suggested automatically for an order.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **order_no** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **phone_no** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 10, max = 10 digits)
- **phone_no2** — _optional : String_ — Another contact number of the customer to which the order should be delivered (min = 10, max = 10 digits)
- **cod** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _String_ — Respective city the package should be delivered to
- **note** — _optional : String_ — Mention any particular note regarding the order package

### Request Body

```json
{
    "order_no": 44444444,
    "customer_name": "customer name 1",
    "address": "address 1",
    "description": "test order_description",
    "phone_no": "0777777777",
    "phone_no2": "0677777777",
    "cod": 1500,
    "note": "sample note 1",
    "city": "Kegalle"
}
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/single-auto' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
        
        "order_no" : 44444444,
        "customer_name" : "customer name 1",
        "address" : "address 1",
        "description" : "test order_description" ,
        "phone_no" : "0777777777",
        "phone_no2" : "0677777777",
        "cod" : 1500,
        "district_id" : 5,
        "city_id" : 864,
        "note" : "sample note 1"
}'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "order": {
    "waybill_id": "AT399773",
    "order_no": 44444444,
    "address": "address 1",
    "customer_name": "customer name 1",
    "phone_no": [
      "0777777777",
      "0677777777"
    ],
    "description": "test order_description",
    "district_id": 5,
    "city_id": 864,
    "cod": "1500",
    "note": "sample note 1",
    "third_party_service": null,
    "updated_at": "2023-10-06 15:18:33",
    "created_at": "2023-10-06 15:18:33",
    "id": 1947047,
    "client_id": 4205,
    "status_id": 14998769
  }
}
```

---

## Add Single Order - Manual waybill without city (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/single-manual-without-city`

**Description:** The following request can be used to **add orders by manually** providing a **waybill ID** for the package.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **waybill_id** — _required : String_ — Waybill number of the order (min count = 8, max = 8)
- **order_no** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **phone_no** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **phone_no2** — _optional : String_ — Another contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **cod** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _String_ — Respective city the package should be delivered to
- **note** — _optional : String_ — Mention any particular note regarding the order package

### Request Body

```json
{
    "waybill_id": "A0000002",
    "order_no": 240083,
    "customer_name": "Mazeezasraf",
    "address": "Mainsreet. Kalpitiya",
    "description": "Frog Super Viscous Oily Glue",
    "phone_no": "0772431525",
    "phone_no2": "0788844040",
    "cod": 1350,
    "note": "",
    "city": "Kegalle"
}
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/single-manual' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '{
        "waybill_id" : "42718291",
        "order_no" : 55555555,
        "customer_name" : "customer name 1",
        "address" : "address 1",
        "description" : "test order_description" ,
        "phone_no" : "0777777777",
        "phone_no2" : "0767777777",
        "cod" : 1500,
        "district_id" : 5,
        "city_id" : 864,
        "note" : "sample note 1"
}'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "order": {
    "waybill_id": "42718291",
    "order_no": 55555555,
    "customer_name": "customer name 1",
    "address": "address 1",
    "description": "test order_description",
    "phone_no": "0777777777",
    "phone_no2": "0767777777",
    "cod": "1500",
    "district_id": 5,
    "city_id": 864,
    "note": "sample note 1",
    "updated_at": "2023-10-06 17:02:55",
    "created_at": "2023-10-06 17:02:55",
    "id": 1947052,
    "client_id": 4205,
    "status_id": 14998774
  }
}
```

---

## Add bulk orders auto (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/auto`

**Description:** The following request can be made to add **multiple orders automatically** into our system.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **order_id** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **order_description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **customer_phone** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **customer_phone2** — _optional : String_ — Other contact number of the customer to which the order should be delivered
- **cod_amount** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _required : Integer_ — Respective city the package should be delivered to
- **remark** — _optional : String_ — Any remarks regarding the order

### Request Body

```javascript
[
    {
        "order_id" : 50060110,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 1"
    },
    {
        "order_id" : 50060111,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 2"
    },
    {
        "order_id" : 50060112,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 3"
    }
]
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/auto' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '[
    {
        "order_id" : 88888888,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 1"
    },
    {
        "order_id" : 77777777,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 2"
    },
    {
        "order_id" : 66666666,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : 864,
        "remarks" : "remark 3"
    }
]'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "orders": [
    {
      "id": 1947053,
      "waybill_id": "AT399774",
      "client_id": 4205,
      "order_no": "88888888",
      "customer_name": "Customer Name 1",
      "address": "Address 1",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 1",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998775,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947054,
      "waybill_id": "AT399775",
      "client_id": 4205,
      "order_no": "77777777",
      "customer_name": "Customer Name 2",
      "address": "Address 2",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 2",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998776,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947055,
      "waybill_id": "AT399776",
      "client_id": 4205,
      "order_no": "66666666",
      "customer_name": "Customer Name 3",
      "address": "Address 3",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 3",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998777,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    }
  ]
}
```

---

## Add bulk orders manual (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/manual`

**Description:** The following request can be made to add **multiple orders manually** into our system by including the waybill ID.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **waybill_id** — _required : String_ — Waybill number of the order (min = 8, max = 8 characters)
- **order_id** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **order_description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **customer_phone** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **cod_amount** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _required : Integer_ — Respective city the package should be delivered to
- **remark** — _optional : String_ — Any remarks regarding the order

### Request Body

```json
[
    {
        "way_bill": "A0000007",
        "order_id" : 88888888,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kandy",
        "remarks" : "remark 1"
    },
    {
        "way_bill": "A0000008",
        "order_id" : 77777777,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kendagolla",
        "remarks" : "remark 2"
    },
    {
        "way_bill": "A0000009",
        "order_id" : 66666666,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kegalle",
        "remarks" : "remark 3"
    }
]
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/manual' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '[
    {
        "way_bill": 67201919,
        "order_id" : 88888888,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kandy",
        "remarks" : "remark 1"
    },
    {
        "way_bill": 77201291,
        "order_id" : 77777777,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kendagolla",
        "remarks" : "remark 2"
    },
    {
        "way_bill": 66801182,
        "order_id" : 66666666,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city" : "Kegalle",
        "remarks" : "remark 3"
    }
]'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "orders": [
    {
      "id": 1947049,
      "waybill_id": "67283919",
      "client_id": 4205,
      "order_no": "88888888",
      "customer_name": "Customer Name 1",
      "address": "Address 1",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 1",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 16:54:46",
      "updated_at": "2023-10-06 16:54:46",
      "status_id": 14998771,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947050,
      "waybill_id": "77288291",
      "client_id": 4205,
      "order_no": "77777777",
      "customer_name": "Customer Name 2",
      "address": "Address 2",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 2",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 16:54:46",
      "updated_at": "2023-10-06 16:54:46",
      "status_id": 14998772,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947051,
      "waybill_id": "66829182",
      "client_id": 4205,
      "order_no": "66666666",
      "customer_name": "Customer Name 3",
      "address": "Address 3",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 3",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 16:54:46",
      "updated_at": "2023-10-06 16:54:46",
      "status_id": 14998773,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    }
  ]
}
```

---

## Add bulk orders auto without city (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/auto-without-city`

**Description:** The following request can be made to add **multiple orders automatically** into our system.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **order_id** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **order_description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **customer_phone** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **customer_phone2** — _optional : String_ — Other contact number of the customer to which the order should be delivered
- **cod_amount** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _String_ — Respective city the package should be delivered to
- **remark** — _optional : String_ — Any remarks regarding the order

### Request Body

The example request body is an array of order objects. Representative sample (the full example in the source contains a large list of sample orders):

```javascript
[
    {
        "order_id": 240083,
        "customer_name": "Mazeezasraf ",
        "address": "Mainsreet. Kalpitiya",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 772431525,
        "customer_phone2": 788844040,
        "cod_amount": 1350.0,
        "city": "Puttalam Town",
        "remarks": ""
    },
    {
        "order_id": 240416,
        "customer_name": "S abdul asis ",
        "address": "53/3/a dehianga muruthalawq",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 763236018,
        "customer_phone2": 763236018,
        "cod_amount": 1300.0,
        "city": "Kandy City",
        "remarks": ""
    },
    {
        "order_id": 240423,
        "customer_name": "S T Pallewatta ",
        "address": "no 98 Amunugama gunnapana",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 715347372,
        "customer_phone2": 715347372,
        "cod_amount": 1300.0,
        "city": "Kandy Town",
        "remarks": ""
    }
]
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/auto' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '[
    {
        "order_id" : 88888888,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city": "Puttalam Town",
        "remarks" : "remark 1"
    },
    {
        "order_id" : 77777777,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city": "Puttalam Town",
        "remarks" : "remark 2"
    },
    {
        "order_id" : 66666666,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "city": "Puttalam Town",
        "remarks" : "remark 3"
    }
]'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "orders": [
    {
      "id": 1947053,
      "waybill_id": "AT399774",
      "client_id": 4205,
      "order_no": "88888888",
      "customer_name": "Customer Name 1",
      "address": "Address 1",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 1",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998775,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947054,
      "waybill_id": "AT399775",
      "client_id": 4205,
      "order_no": "77777777",
      "customer_name": "Customer Name 2",
      "address": "Address 2",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 2",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998776,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947055,
      "waybill_id": "AT399776",
      "client_id": 4205,
      "order_no": "66666666",
      "customer_name": "Customer Name 3",
      "address": "Address 3",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 3",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998777,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    }
  ]
}
```

---

## Add bulk orders manual without city (POST)

**URL:** `https://portal.transexpress.lk/api/orders/upload/auto-without-city`

**Description:** The following request can be made to add **multiple orders automatically** into our system.

> Note: The original documentation lists this endpoint under the title "Add bulk orders manual without city", but the documented URL (`/orders/upload/auto-without-city`) and description match the auto-without-city endpoint — likely a copy/paste discrepancy in the source.

### Request Payload

**`order_data`** — _required : Object_ — Order specific details for a batch of orders

- **order_id** — _optional : String_ — Order number of the order
- **customer_name** — _required : String_ — Name of the customer to which the order should be delivered
- **address** — _required : String_ — Address of the customer to which the order should be delivered
- **order_description** — _optional : String_ — A short description about the order (min = 0, max = 500 characters)
- **customer_phone** — _required : String_ — Contact number of the customer to which the order should be delivered (min = 9, max = 10 digits)
- **customer_phone2** — _optional : String_ — Other contact number of the customer to which the order should be delivered
- **cod_amount** — _required : Double_ — Amount which should be collected on delivery of the package to said customer
- **city** — _String_ — Respective city the package should be delivered to
- **remark** — _optional : String_ — Any remarks regarding the order

### Request Body

```javascript
[
    {
        "way_bill": 67201919,
        "order_id": 240083,
        "customer_name": "Mazeezasraf ",
        "address": "Mainsreet. Kalpitiya",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 772431525,
        "customer_phone2": 788844040,
        "cod_amount": 1350.0,
        "city": "Puttalam Town",
        "remarks": ""
    },
    {
        "way_bill": 67201920,
        "order_id": 240416,
        "customer_name": "S abdul asis ",
        "address": "53/3/a dehianga muruthalawq",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 763236018,
        "customer_phone2": 763236018,
        "cod_amount": 1300.0,
        "city": "Kandy City",
        "remarks": ""
    },
    {
        "way_bill": 67201921,
        "order_id": 240423,
        "customer_name": "S T Pallewatta ",
        "address": "no 98 Amunugama gunnapana",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 715347372,
        "customer_phone2": 715347372,
        "cod_amount": 1300.0,
        "city": "Kandy Town",
        "remarks": ""
    },
    {
        "way_bill": 67201922,
        "order_id": 240480,
        "customer_name": "sandika.suranjan ",
        "address": "ViLlyagma.Lhiruyagama,DANKOTUWA ,PUTHTHALAMA",
        "order_description": "Hearing Amplifier Ear Whisperer",
        "customer_phone": 777483411,
        "customer_phone2": 777693411,
        "cod_amount": 2000.0,
        "city": "Puttalam Town",
        "remarks": ""
    },
    {
        "way_bill": 67201923,
        "order_id": 240545,
        "customer_name": "Tharaka ",
        "address": "No 30 Papliyana rode nadimala",
        "order_description": "REFRIGERATOR  LOCK",
        "customer_phone": 758010072,
        "customer_phone2": 758010072,
        "cod_amount": 1800.0,
        "city": "Nedimala",
        "remarks": ""
    },
    {
        "way_bill": 67201925,
        "order_id": 240566,
        "customer_name": "shihan ",
        "address": "146/62A, Aramya Road, Dematagoda, Colombo 9",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 777113955,
        "customer_phone2": 757113919,
        "cod_amount": 1450.0,
        "city": "Colombo 8 - Borella",
        "remarks": ""
    },
    {
        "way_bill": 67201926,
        "order_id": 240583,
        "customer_name": "m.g indika ",
        "address": "gammaddegoda ,Rathgama",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 776090224,
        "customer_phone2": 776090224,
        "cod_amount": 1450.0,
        "city": "Galle Town",
        "remarks": ""
    },
    {
        "way_bill": 67201927,
        "order_id": 240589,
        "customer_name": "Asma sappideen ",
        "address": "9 new ferry lane colombo 2",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 778537096,
        "customer_phone2": 778537096,
        "cod_amount": 1450.0,
        "city": "Colombo 02 - Slave Island & Union Place",
        "remarks": ""
    },
    {
        "way_bill": 67201928,
        "order_id": 240601,
        "customer_name": "Rinos ",
        "address": "248B Vappayadi Road. Sainthamaruthu 13",
        "order_description": "Frog Super Viscous Oily Glue",
        "customer_phone": 757572372,
        "customer_phone2": 757572372,
        "cod_amount": 1450.0,
        "city": "Ampara Town",
        "remarks": ""
    },
    {
        "way_bill": 67201929,
        "order_id": 240624,
        "customer_name": "Dulanga Madara ",
        "address": "3 Alfredo place Colombo",
        "order_description": "Airpods Pro ( AAA Grade )",
        "customer_phone": 776779200,
        "customer_phone2": 771295155,
        "cod_amount": 2350.0,
        "city": "Colombo 3 - Kollupitiya",
        "remarks": ""
    }
]
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/orders/upload/auto' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data '[
    {
        "order_id" : 88888888,
        "customer_name" : "Customer Name 1",
        "address" : "Address 1",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "district" : 5,
        "city" : 864,
        "remarks" : "remark 1"
    },
    {
        "order_id" : 77777777,
        "customer_name" : "Customer Name 2",
        "address" : "Address 2",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "district" : 5,
        "city" : 864,
        "remarks" : "remark 2"
    },
    {
        "order_id" : 66666666,
        "customer_name" : "Customer Name 3",
        "address" : "Address 3",
        "order_description" : "test order_description" ,
        "customer_phone" : "0777777777",
        "customer_phone2" : "0777777777",
        "cod_amount" : 1500,
        "district" : 5,
        "city" : 864,
        "remarks" : "remark 3"
    }
]'
```

### Example Response (200 OK)

```json
{
  "success": "Record successfully added",
  "orders": [
    {
      "id": 1947053,
      "waybill_id": "AT399774",
      "client_id": 4205,
      "order_no": "88888888",
      "customer_name": "Customer Name 1",
      "address": "Address 1",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 1",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998775,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947054,
      "waybill_id": "AT399775",
      "client_id": 4205,
      "order_no": "77777777",
      "customer_name": "Customer Name 2",
      "address": "Address 2",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 2",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998776,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    },
    {
      "id": 1947055,
      "waybill_id": "AT399776",
      "client_id": 4205,
      "order_no": "66666666",
      "customer_name": "Customer Name 3",
      "address": "Address 3",
      "phone_no": "",
      "description": "test order_description",
      "district_id": 5,
      "city_id": 864,
      "suggested_city": "",
      "branch_id": null,
      "new_branch_id": null,
      "cod": 1500,
      "collected_cod": null,
      "delivery_charge": null,
      "wight": null,
      "note": "remark 3",
      "first_kg": null,
      "after_kg": null,
      "inv_id": null,
      "deposit_id": null,
      "created_at": "2023-10-06 17:04:35",
      "updated_at": "2023-10-06 17:04:35",
      "status_id": 14998777,
      "delivery_attempts": null,
      "third_party_service": null,
      "current_rider_id": null,
      "latest_rider_assign_id": null,
      "branch_order_id": null
    }
  ]
}
```

---

## Single Order Tracking (POST)

**URL:** `https://portal.transexpress.lk/api/tracking`

**Description:** Can be used to track a particular order by providing the respective waybill ID from the system and get the order details. The following details are displayed in the response:

- **waybill_id** — _String_ — Waybill number of the order (min count = 8, max = 8)
- **order_no** — _String_ — Order number of the order
- **customer_name** — _String_ — Name of the customer to which the order should be delivered
- **customer_address** — _String_ — Address of the customer to which the order should be delivered
- **customer_district** — _String_ — Name of the District
- **customer_city** — _String_ — Name of the City
- **customer_phone_no** — _int_ — Phone number of the customer
- **weight** — _int_ — Weight of the package
- **placed_date** — _Date_ — Order created date
- **completed_date** — _Date_ — Last status updated date of the order
- **Status History** — _Array_ — The history of the order status updates

### Request Body

```json
{
    "waybill_id" : "31005083"
}
```

### Example Request (curl)

```curl
curl --location -g '{{base_url}}/tracking' \
--data '{
    "waybill_id" : "55555555"
}'
```

### Example Response (201 Created)

```json
{
  "data": {
    "waybill_id": "55555555",
    "order_no": "55555555",
    "customer_name": "Customer 726528",
    "customer_address": "Customer Address 726528",
    "customer_district": "Colombo",
    "customer_city": "Colombo 01",
    "customer_phone_no": "0112555555",
    "weight": null,
    "placed_date": "2021-09-27T11:26:25.000000Z",
    "completed date": null,
    "current_status": "Canceled",
    "status_history": [
      {
        "name": "Canceled",
        "remarks": "Request by Client",
        "added_date": "2021-09-30T05:55:34.000000Z"
      },
      {
        "name": "Processing",
        "remarks": "Enter by U DROP INTERNATIONAL (PVT) LTD",
        "added_date": "2021-09-27T11:26:25.000000Z"
      }
    ]
  }
}
```
