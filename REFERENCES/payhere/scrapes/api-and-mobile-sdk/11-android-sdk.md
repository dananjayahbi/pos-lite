# Android SDK

# Android SDK

Integrating PayHere with your Android Mobile App is super easy with our native PayHere Android SDK. You just have to include that in your Android app project & call its methods to initiate a payment & fetch the payment status just after the payment. The beauty is, this Android SDK allows you to accept a payment within your app, without redirecting your app user to the web browser.

Please refer the below steps to integrate PayHere Android SDK to your Android App.

  


### 1\. Include PayHere Mobile SDK to your App

  
For Android Gradle Plugin (AGP) version 7.1 & above  
Add maven URL to settings.gradle file.   
  


```
maven {
    url "https://jitpack.io"
}
```

 

Example settings.gradle after adding the line.



```
dependencyResolutionManagement {
   repositories {
       google()
       mavenCentral()
       maven {
           url  "https://jitpack.io"
       }
   }
}
```

   
Older Android Gradle Plugin Versions (Below version 7.1)   
Add maven URL to main build.gradle file.   
  


```
maven {
    url "https://jitpack.io"
}
```

 

Example build.gradle after adding the line.



```
allprojects {
    repositories {
        google()
        jcenter()
        maven {
            url  "https://jitpack.io"
        }
    }
}
```

   


### 2\. Add SDK dependency

Add PayHere Mobile SDK dependency to the necessary module with appcompat and gson libraries. In most cases .\app\build.gradle file.



```
implementation 'com.github.PayHereDevs:payhere-android-sdk:v3.0.18'
implementation 'androidx.appcompat:appcompat:1.6.0' // ignore if you have already added
implementation 'com.google.code.gson:gson:2.8.0' // ignore if you have already added
```

 

Example build.gradle after adding the line.



```
dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    implementation 'androidx.appcompat:appcompat:1.6.0'
    implementation 'com.github.PayHereDevs:payhere-android-sdk:v3.0.18'// payhere payment sdk
    implementation 'com.google.code.gson:gson:2.8.0'
    implementation 'com.android.support.constraint:constraint-layout:2.0.0'
    testImplementation 'junit:junit:4.12'
    androidTestImplementation 'com.android.support.test:runner:1.0.1'
    androidTestImplementation 'com.android.support.test.espresso:espresso-core:3.0.1'
}
```

   


### 3\. Add Internet Permission to AndroidManifest.xml



```
<uses-permission android:name="android.permission.INTERNET" />
```

   


### 4\. Initiate a Payment Request to PayHere Payment Gateway

##### a. One-time Payment Request



```
InitRequest req = new InitRequest();
req.setMerchantId("1210XXX");       // Merchant ID
req.setCurrency("LKR");             // Currency code LKR/USD/GBP/EUR/AUD
req.setAmount(1000.00);             // Final Amount to be charged
req.setOrderId("230000123");        // Unique Reference ID
req.setItemsDescription("Door bell wireless");  // Item description title 
req.setCustom1("This is the custom message 1");
req.setCustom2("This is the custom message 2");
req.getCustomer().setFirstName("Saman");
req.getCustomer().setLastName("Perera");
req.getCustomer().setEmail("samanp@gmail.com");
req.getCustomer().setPhone("+94771234567");
req.getCustomer().getAddress().setAddress("No.1, Galle Road");
req.getCustomer().getAddress().setCity("Colombo");
req.getCustomer().getAddress().setCountry("Sri Lanka");

//Optional Params
req.setNotifyUrl(“xxxx”);           // Notifiy Url
req.getCustomer().getDeliveryAddress().setAddress("No.2, Kandy Road");
req.getCustomer().getDeliveryAddress().setCity("Kadawatha");
req.getCustomer().getDeliveryAddress().setCountry("Sri Lanka");
req.getItems().add(new Item(null, "Door bell wireless", 1, 1000.0));

Intent intent = new Intent(this, PHMainActivity.class);
intent.putExtra(PHConstants.INTENT_EXTRA_DATA, req);
PHConfigs.setBaseUrl(PHConfigs.SANDBOX_URL);
startActivityForResult(intent, PAYHERE_REQUEST); //unique request ID e.g. "11001"
```

 

##### b. Recurring Payment Request



```
InitRequest req = new InitRequest();

req.setMerchantId("1210XXX");       // Merchant ID  
req.setCurrency("LKR");             // Currency code LKR/USD/GBP/EUR/AUD
req.setAmount(250.00);              // Final Amount to be charged
req.setRecurrence("1 Month");       // Recurrence of the Subscription
req.setDuration("Forever");         // Duration of the Subscription
req.setOrderId("230000124");        // Unique Reference ID
req.setCustom1("This is the custom message 1");
req.setCustom2("This is the custom message 2");
req.getCustomer().setFirstName("Saman");
req.getCustomer().setLastName("Perera");
req.getCustomer().setEmail("sampanp@gmail.com");
req.getCustomer().setPhone("+947771234567");
req.getCustomer().getAddress().setAddress("No.1, Galle Road");
req.getCustomer().getAddress().setCity("Colombo");
req.getCustomer().getAddress().setCountry("Sri Lanka");
req.setItemsDescription("PRO Plan Subscription");

// Optional Param
req.setStartupFee(0);               // +/- Adjustment to the fist charge 
req.setNotifyUrl(“xxxx”);           // Notifiy Url

Intent intent = new Intent(this, PHMainActivity.class);
intent.putExtra(PHConstants.INTENT_EXTRA_DATA, req);
PHConfigs.setBaseUrl(PHConfigs.SANDBOX_URL);
startActivityForResult(intent, PAYHERE_REQUEST); //unique request ID e.g. "11010";
```

 

##### c. Preapproval Request



```
InitPreapprovalRequest req = new InitPreapprovalRequest();

req.setMerchantId("1210XXX");       // Merchant ID 
req.setOrderId("230000125");        // Unique Reference ID
req.setCurrency("LKR");             // Currency code of future payments
req.setItemsDescription("1 Greeting Card");
req.setCustom1("This is the custom 1 message");
req.setCustom2("This is the custom 2 message");
req.getCustomer().setFirstName("Saman");
req.getCustomer().setLastName("Perera");
req.getCustomer().setEmail("samanp@email.com");
req.getCustomer().setPhone("+947771234567");
req.getCustomer().getAddress().setAddress("No.01, Galle Road,");
req.getCustomer().getAddress().setCity("Colombo");
req.getCustomer().getAddress().setCountry("Sri Lanka");

// Optional Param
req.setNotifyUrl(“xxxx”);           // Notifiy Url

Intent intent = new Intent(this, PHMainActivity.class);
intent.putExtra(PHConstants.INTENT_EXTRA_DATA, req);
PHConfigs.setBaseUrl(PHConfigs.SANDBOX_URL);
startActivityForResult(intent, PAYHERE_REQUEST); //unique request ID e.g. "11010";
```

   


##### d. Hold-on-card Request



```
InitRequest req = new InitRequest();
req.setMerchantId("1210XXX");       // Merchant ID
req.setCurrency("LKR");             // Currency code LKR/USD/GBP/EUR/AUD
req.setAmount(1000.00);             // Final Amount to be charged
req.setOrderId("230000123");        // Unique Reference ID
req.setItemsDescription("Door bell wireless");  // Item description title 
req.setCustom1("This is the custom message 1");
req.setCustom2("This is the custom message 2");
req.getCustomer().setFirstName("Saman");
req.getCustomer().setLastName("Perera");
req.getCustomer().setEmail("samanp@gmail.com");
req.getCustomer().setPhone("+94771234567");
req.getCustomer().getAddress().setAddress("No.1, Galle Road");
req.getCustomer().getAddress().setCity("Colombo");
req.getCustomer().getAddress().setCountry("Sri Lanka");

//Optional Params
req.setNotifyUrl(“xxxx”);           // Notifiy Url
req.getCustomer().getDeliveryAddress().setAddress("No.2, Kandy Road");
req.getCustomer().getDeliveryAddress().setCity("Kadawatha");
req.getCustomer().getDeliveryAddress().setCountry("Sri Lanka");
req.getItems().add(new Item(null, "Door bell wireless", 1, 1000.0));


// Enable Hold-on-card 
req.setHoldOnCardEnabled(true);

Intent intent = new Intent(this, PHMainActivity.class);
intent.putExtra(PHConstants.INTENT_EXTRA_DATA, req);
PHConfigs.setBaseUrl(PHConfigs.SANDBOX_URL);
startActivityForResult(intent, PAYHERE_REQUEST); //unique request ID e.g. "11001"
```

   


### 5\. Fetch the Payment Status

Example code show below.



```
@Override
protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == PAYHERE_REQUEST && data != null && data.hasExtra(PHConstants.INTENT_EXTRA_RESULT)) {
        PHResponse<StatusResponse> response = (PHResponse<StatusResponse>) data.getSerializableExtra(PHConstants.INTENT_EXTRA_RESULT);
        if (resultCode == Activity.RESULT_OK) {
            String msg;
            if (response != null)
                if (response.isSuccess())
                    msg = "Activity result:" + response.getData().toString();
                else
                    msg = "Result:" + response.toString();
            else
                msg = "Result: no response";
            Log.d(TAG, msg);
            textView.setText(msg);
        } else if (resultCode == Activity.RESULT_CANCELED) {
            if (response != null)
                textView.setText(response.toString());
            else
                textView.setText("User canceled the request");
        }
    }
}
```

 Android SDK - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 17th Dec 2025
