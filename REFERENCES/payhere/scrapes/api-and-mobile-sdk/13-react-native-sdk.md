# React Native SDK

# React Native SDK

Integrating PayHere with your React Native App is super easy with our PayHere React Native SDK. You just have to include the package in your project dependencies, call its methods to initiate a payment and fetch the payment status just after the payment. The beauty is, this SDK allows you to accept a payment within your app, without redirecting your app user to the web browser.

Please refer the below steps to integrate PayHere React Native SDK to your Mobile App.   
  


### 1\. Include PayHere Mobile SDK in your App

Open your React Native project's `package.json` file and add the PayHere React Native SDK dependency.



```
{
  "dependencies": {
    "@payhere/payhere-mobilesdk-reactnative": "4.0.14"
  }
}
```

 

Then run the following commands in your React Native project directory.



```
npm install
react-native link @payhere/payhere-mobilesdk-reactnative
```

   


### 2\. Set Android Pre-requisites

##### a. Add the PayHere Android SDK's Maven repository

Open up the (outermost) build.gradle file in your Android project and add the repository.



```
allprojects {
    repositories {
        mavenLocal()
        maven {
            url 'https://jitpack.io'
        }
    }
}
```

 

##### b. Allow Manifest attribute merge

Open up the AndroidManifest.xml file in your Anrdoid project and make the following changes.

i. Declare the Android tools namespace in the element.



```
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.domain.name"
    xmlns:tools="http://schemas.android.com/tools">
```

 

ii. Add the `replace` merge rule for the `android:allowBackup`.



```
<application tools:replace="android:allowBackup">
```

   


### 3\. Set iOS Pre-requisites

Open up the Podfile file in your iOS project and make the following changes.

##### a. Increase the platform version to iOS 11.



```
platform :ios, '11.0'
```

 

##### b. Add the PayHere React Native SDK podspec



```
# Add this is if something similar doesn't already exist
use_react_native!(:path => config["reactNativePath"])

# Add these TWO lines just below 'use_react_native!'
pod 'payHereSDK', :git => 'https://github.com/PayHereDevs/payhere-mobilesdk-ios-rb.git'
pod 'payhere-mobilesdk-reactnative', :path => '../node_modules/@payhere/payhere-mobilesdk-reactnative'
```

 

##### c. Run the following command inside the 'ios' folder.



```
pod install
```

   


### 4\. Whitelist Mobile App Package Name

a. Login to your PayHere Merchant Account and navigate to Settings > Domains and Credentials.

b. Click the 'Add Domain/App' button.

c. Select 'App' from the first dropdown.

d. Add your React Native App package name (e.g. lk.bhasha.helakuru).

e. Take note of the hash value in the last field. This is your Merchant Secret for this specific mobile App.

f. Click 'Request to Approve'. 

(If you are using a PayHere Live Merchant Account, your App Package Name must be manually reviewed & approved. Please allow upto one business day for this review process to complete.)

  


### 5\. Initiate a Payment Request to PayHere Payment Gateway

#### a. One-time Payment Request

To capture the payment details from your server, [read our docs](https://support.payhere.lk/api-&-mobile-sdk/checkout-api#2-listening-to-payment-notification).



```
import { Alert } from 'react-native';
import PayHere from '@payhere/payhere-mobilesdk-reactnative';

const paymentObject = {
    "sandbox": true,                 // true if using Sandbox Merchant ID
    "merchant_id": "1211149",        // Replace your Merchant ID
    "notify_url": "http://sample.com/notify",
    "order_id": "ItemNo12345",
    "items": "Hello from React Native!",
    "amount": "50.00",
    "currency": "LKR",
    "first_name": "Saman",
    "last_name": "Perera",
    "email": "samanp@gmail.com",
    "phone": "0771234567",
    "address": "No.1, Galle Road",
    "city": "Colombo",
    "country": "Sri Lanka",
    "delivery_address": "No. 46, Galle road, Kalutara South",
    "delivery_city": "Kalutara",
    "delivery_country": "Sri Lanka",
    "custom_1": "",
    "custom_2": ""
};

PayHere.startPayment(
    paymentObject, 
    (paymentId) => {
        console.log("Payment Completed", paymentId);
    },
    (errorData) => {
        Alert.alert("PayHere Error", errorData);
    },
    () => {
        console.log("Payment Dismissed");
    }
);
```

   


#### b. Recurring Payment Request

To capture the payment details from your server, [read our docs](https://support.payhere.lk/api-&-mobile-sdk/recurring-api#2-listening-to-payment-notification).

Read more about Recurring Payments [in our docs](https://support.payhere.lk/recurring-billing).



```
import { Alert } from 'react-native';
import PayHere from '@payhere/payhere-mobilesdk-reactnative';

const paymentObject = {
    "sandbox": true,                 // true if using Sandbox Merchant ID
    "merchant_id": "1211149",        // Replace your Merchant ID
    "notify_url": "http://sample.com/notify",
    "order_id": "ItemNo12345",
    "items": "Hello from React Native!",
    "amount": "50.00",               // Recurring amount
    "recurrence": "1 Month",         // Recurring payment frequency
    "duration": "1 Year",            // Recurring payment duration
    "startup_fee": "10.00",          // Extra amount for first payment
    "currency": "LKR",
    "first_name": "Saman",
    "last_name": "Perera",
    "email": "samanp@gmail.com",
    "phone": "0771234567",
    "address": "No.1, Galle Road",
    "city": "Colombo",
    "country": "Sri Lanka",
    "delivery_address": "No. 46, Galle road, Kalutara South",
    "delivery_city": "Kalutara",
    "delivery_country": "Sri Lanka",
    "custom_1": "",
    "custom_2": ""
};

PayHere.startPayment(
    paymentObject, 
    (paymentId) => {
        console.log("Payment Completed", paymentId);
    },
    (errorData) => {
        Alert.alert("PayHere Error", errorData);
    },
    () => {
        console.log("Payment Dismissed");
    }
);
```

   


#### c. Preapproval Request

To capture the payment details from your server, [read our docs](https://support.payhere.lk/api-&-mobile-sdk/preapproval-api#2-listening-to-preapproval-notification).

Read more about Automated Charging [in our docs](https://support.payhere.lk/automated-charging).



```
import { Alert } from 'react-native';
import PayHere from '@payhere/payhere-mobilesdk-reactnative';

const paymentObject = {
    "sandbox": true,                 // true if using Sandbox Merchant ID
    "preapprove": true,              // Required
    "merchant_id": "1211149",        // Replace your Merchant ID
    "notify_url": "http://sample.com/notify",
    "order_id": "ItemNo12345",
    "items": "Hello from React Native!",
    "amount": "50.00",
    "currency": "LKR",
    "first_name": "Saman",
    "last_name": "Perera",
    "email": "samanp@gmail.com",
    "phone": "0771234567",
    "address": "No.1, Galle Road",
    "city": "Colombo",
    "country": "Sri Lanka",
};

PayHere.startPayment(
    paymentObject, 
    (paymentId) => {
        console.log("Payment Completed", paymentId);
    },
    (errorData) => {
        Alert.alert("PayHere Error", errorData);
    },
    () => {
        console.log("Payment Dismissed");
    }
);
```

   


#### d. Hold-on-Card Request

To capture the payment hold details from your server, [read out docs](https://support.payhere.lk/api-&-mobile-sdk/authorize-api#2-listening-to-authorization-notification).

Read more about Hold-on-card [in our docs](https://support.payhere.lk/hold-on-card).



```
import { Alert } from 'react-native';
import PayHere from '@payhere/payhere-mobilesdk-reactnative';

const paymentObject = {
    "sandbox": true,                // true if using Sandbox Merchant ID
    "authorize": true,              // Required
    "merchant_id": "1211149",       // Replace your Merchant ID
    "notify_url": "https://ent13zfovoz7d.x.pipedream.net/",
    "order_id": "ItemNo12345",
    "items": "Hello from React Native!",
    "currency": "LKR",
    "amount": "50.00",
    "first_name": "Saman",
    "last_name": "Perera",
    "email": "samanp@gmail.com",
    "phone": "0771234567",
    "address": "No.1, Galle Road",
    "city": "Colombo",
    "country": "Sri Lanka",
};

PayHere.startPayment(
    paymentObject, 
    (paymentId) => {
        console.log("Payment Authorized!");
    },
    (errorData) => {
        Alert.alert("PayHere Error", errorData);
    },
    () => {
        console.log("Payment Dismissed");
    }
);
```

   


### 6\. Optionally, pass Item-wise Details

Each item has four parameters. Their parameter names must be followed by the index of that item. For example:



```
"item_number_1": "ITM001",
  "item_name_1": "PayHere Sticker",
  "quantity_1": "2",
  "amount_1": "25.0",
```

 

An example Onetime payment request with 2 items is shown below.



```
import { Alert } from 'react-native';
import PayHere from '@payhere/payhere-mobilesdk-reactnative';

const paymentObject = {
    "sandbox": true,                 // true if using Sandbox Merchant ID
    "merchant_id": "1211149",        // Replace your Merchant ID
    "notify_url": "http://sample.com/notify",
    "order_id": "ItemNo12345",
    "items": "Hello from React Native!",

    "item_number_1": "001",          // ** Item 1 **
    "item_name_1": "Test Item #1",
    "amount_1": "15.00",
    "quantity_1": "2",
    "item_number_2": "002",          // ** Item 2 **
    "item_name_2": "Test Item #2",
    "amount_2": "20.00",
    "quantity_2": "1",
    
    "amount": 50.00,
    "currency": "LKR",
    "first_name": "Saman",
    "last_name": "Perera",
    "email": "samanp@gmail.com",
    "phone": "0771234567",
    "address": "No.1, Galle Road",
    "city": "Colombo",
    "country": "Sri Lanka",
    "delivery_address": "No. 46, Galle road, Kalutara South",
    "delivery_city": "Kalutara",
    "delivery_country": "Sri Lanka",
    "custom_1": "",
    "custom_2": ""
};

PayHere.startPayment(
    paymentObject, 
    (paymentId) => {
        console.log("Payment Completed", paymentId);
    },
    (errorData) => {
        Alert.alert("PayHere Error", errorData);
    },
    () => {
        console.log("Payment Dismissed");
    }
);
```

   


### FAQ

##### What versions of React Native are supported?

React Native versions above `0.60.0` are supported.

##### What versions of iOS are supported?

The iOS component for this SDK supports iOS Versions above 11.0.

##### What versions of Android are supported?

The Android component for this SDK supports Android Versions above API Level 17.

##### What are the parameters for the `PayHere.startPayment` method?



```
PayHere.startPayment(
    paymentObject, 
    onCompletedHandler,
    onErrorHandler,
    onDismissedHandler
);
```

 

  * `paymentObject` \- _Object_ \- The payment parameters as a Javascript Object.

  * `onCompletedHandler` \- _Function_ \- Called with the PayHere Payment ID (_String_) as a parameter, for succesful payments.

  * `onErrorHandler` \- _Function_ \- Called with the Error (_String_) as a parameter, when an error occurs.

  * `onDismissedHandler` \- _Function_ \- Called with no parameters, when the payment popup is closed before payments are processed.




##### I have a different question. Where should I raise my issues?

You can raise issues directly at the Issues section for the SDK's [GitHub page](https://github.com/PayHereLK/payhere-mobilesdk-reactnative) or contact a PayHere Developer for technical support by mailing your issue and relevant code/screenshots to [support@payhere.lk](mailto:support@payhere.lk).

##### Related Links:

  * [GitHub Repo](https://github.com/PayHereLK/payhere-mobilesdk-reactnative)
  * [NPM Package](https://www.npmjs.com/package/@payhere/payhere-mobilesdk-reactnative)

  
React Native SDK - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 15th Aug 2024
