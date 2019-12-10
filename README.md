# wsdlstubgen
WSDL request and response xml generator. It uses node-soap module for wsdl processing. 

To generate request and response xmls from a wsdl file.

Usage
------

```
const WsdlStub = require('wsdlstubgen')

const wsdlStub = new WsdlStub(options);

let wsdl1 = wsdlStub.generate(wsdlPath, options);
let wsdl2 = wsdlStub.generate(wsdlPath, options);
```

* Options provided in constructor are global and can be applied to .
* Options provided in generate method overrides global options. This is useful when a particular wsdl requires different options than global.

Options
-------------

* **saveLocation**: saves request and response xmls in the saveLocation path.
* **generateXml**: generates xml. To save xmls, generateXml = true and a valid path in saveLocation.
* **fillEmpty**: default is true. fills ? as default value.
* **format**: default is true. formats output xml.
* **serviceName**: service name to use in output xml filenames.

Wsdlstub generates xml outputs if only generatXml is true and a valid path provided in saveLocation. 

Output fileNames
-----------------

* **Request**: ServiceName_MethodName_Request.xml
* **Response**: ServiceName_MethodName_Response.xml
* **Fault**: ServiceName_MethodName_Fault.xml

ServiceName provided in options is used first. If no servicename provided, wsdl service name is used. 

Example
--------------

```
const WsdlStub = require('wsdlstubgen');

const wsdlStub = new WsdlStub();

const wsdl = wsdlStub.generate("./example.wsdl",{ 
        saveLocation: "./xmls/",
        generateXml: true,
        format: true, 
        fillEmpty: true
});

//To get name of the wsdl service
console.log(wsdl.name);

//To getting bindings
console.log(wsdl.bindings);

//To get methods in each binding
for(let binding of wsdl.bindings)
{
  console.log(binding.name);
  for(let method of binding.methods)
  {
    console.log(method.name);
    
    //to get request xml
    //
    console.log(method.request);
    
    //to get response xml
    //
    console.log(method.response);
    
    //to get faults if any 
    console.log(method.faults);
  }
}
```



