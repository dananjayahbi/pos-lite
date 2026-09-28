# iOS SDK

# iOS SDK

Integrating PayHere with your iOS Mobile App is super easy with our PayHere iOS SDK. You just have to include that in your Xcode project & call its methods to initiate a payment & fetch the payment status just after the payment. The beauty is, this iOS SDK allows you to accept a payment within your app, without redirecting your app user to the web browser.

Please refer the below steps to integrate PayHere iOS SDK to your iOS App.

  


### 1\. Install CocoaPods for PayHere

Install CocoaPods dependency manager.



```
$ gem install cocoapods
```

 

Specify PayHere in your Podfile.



```
source 'https://github.com/CocoaPods/Specs.git'
platform :ios, '11.0'
use_frameworks!

target '<Your Target Name>' do
    pod 'payHereSDK'
end
```

 

Then run following command.



```
$ pod install
```

   


### 2\. Import PayHere Mobile SDK

Import PayHere Mobile SDK into your UIViewController.



```
import payHereSDK
```

   


### 3\. Initiate a Payment Request to PayHere Payment Gateway

##### a. One-time Payment Request



```
let merchantID = ""
let item = Item(id: "item_1", name: "Item 1", quantity: 1, amount: 50.0)
let initRequest = PHInitialRequest(
    merchantID: merchantID, 
    notifyURL: "", 
    firstName: "Pay", 
    lastName: "Here", 
    email: "test@test.com", 
    phone: "+9477123456", 
    address: "Colombo", 
    city: "Colombo", 
    country: "Sri Lanka", 
    orderID: "001", 
    itemsDescription: "PayHere SDK Sample", 
    itemsMap: [item], 
    currency: .LKR, 
    amount: 50.00,
    deliveryAddress: "", 
    deliveryCity: "", 
    deliveryCountry: "", 
    custom1: "custom 01", 
    custom2: "custom 02"
)

PHPrecentController.precent(from: self, withInitRequest: initRequest, delegate: self)
```

 

##### b. Recurring Payment Request



```
let merchantID = ""
let item = Item(id: "item_1", name: "Item 1", quantity: 1, amount: 50.0)
let initRequest = PHInitialRequest(
    merchantID: merchantID, 
    notifyURL: "", 
    firstName: "", 
    lastName: "", 
    email: "", 
    phone: "", 
    address: "", 
    city: "", 
    country: "", 
    orderID: "002", 
    itemsDescription: "", 
    itemsMap: [item1], 
    currency: .LKR, 
    amount: 60.50, 
    deliveryAddress: "", 
    deliveryCity: "", 
    deliveryCountry: "", 
    custom1: "", 
    custom2: "", 
    startupFee: 0.0, 
    recurrence: .Month(duration: 2), 
    duration: .Forver
)

PHPrecentController.precent(from: self, withInitRequest: initRequest, delegate: self)
```

 

##### c. Pre-approval Request



```
let merchantID = ""
let item = Item(id: "item_1", name: "Item 1", quantity: 1, amount: 50.0)
let initRequest = PHInitialRequest(
    merchantID: merchantID, 
    notifyURL: "", 
    firstName: "", 
    lastName: "", 
    email: "", 
    phone: "", 
    address: "", 
    city: "", 
    country: "", 
    orderID: "001", 
    itemsDescription: "", 
    itemsMap: [item1], 
    currency: .LKR, 
    custom1: "", 
    custom2: ""
)

PHPrecentController.precent(from: self, withInitRequest: initRequest, delegate: self)
```

 

##### d. Hold-on-card Request



```
let merchantID = ""
let item = Item(id: "item_1", name: "Item 1", quantity: 1, amount: 50.0)
let initRequest = PHInitialRequest(
    merchantID: merchandID,
    notifyURL: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    orderID: "",
    itemsDescription: "",
    itemsMap: [item1,item2],
    currency: .LKR,
    amount: 0.0,
    deliveryAddress: "",
    deliveryCity: "",
    deliveryCountry: "",
    custom1: "",
    custom2: "",
    isHoldOnCardEnabled: true 
)

PHPrecentController.precent(from: self, withInitRequest: initRequest, delegate: self)
```

   


### 4\. Fetch the Payment Status

Example code shown below.



```
extension ViewController : PHViewControllerDelegate{
    func onErrorReceived(error: Error) {
        print("✋ Error",error)
    }
    
    func onResponseReceived(response: PHResponse<Any>?) {
        guard let response = response else {
            print("Could not receive payment response")
            return
        }
        if(response.isSuccess()){
            
            guard let resp = response.getData() as? payHereSDK.StatusResponse else{
                return
            }
            
            print("Payment Success")
            print("Payment Status", resp.status ?? -1)
            print("Message", resp.message ?? "Unknown Message")
            print("Payment No", resp.paymentNo ?? -1.0)
            print("Payment Amount", resp.price ?? -1.0)
            
        }
        else{
            print("Payment Error", response.getMessage() ?? "Unknown Message")
        }
    }
}
```

   
iOS SDK - PayHere Knowledge Base

Still need help? [Get in touch!](mailto:http://m.me/PayHereLK)

Last updated on 5th May 2022
