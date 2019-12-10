/***
 *  WSDLGen generates service request and response stubs from a given WSDL file.
 *  Author: Raj Bandi <raj.bandi@hotmail.com>
 */
const soap = require("soap");
const fs = require("fs");
const format = require("xml-formatter");

const TARGET_NAMESPACE = "targetNamespace";
const NAMESPACE_ALIAS = "targetNSAlias";

class WsdlStub {
  _options = {};
  constructor(options) {
    if (!options) {
      options = {
        format: true,
        fillEmpty: true
      };
    }
    this._options = options;
  }

  /**
   * Generates stub and saves
   * @param {} url
   * @param {*} options
   */
  async generate(url, options) {
    if (!options) {
      options = this._options;
    }

    let optionNames = Object.getOwnPropertyNames(options);
    if(optionNames.indexOf("format")<0)
    {
      options['format'] = true;
    }
    if(optionNames.indexOf("fillEmpty")<0)
    {
      options["fillEmpty"] = true;
    }
    
    let serviceStub = await this._generateStub(url, options);
  
   
    try {
      if (options.generateXml) {

        let saveLocation = options.saveLocation;
        if (saveLocation) {

          console.info("Saving service xml to "+saveLocation);
          if (!fs.existsSync(saveLocation)) {
            fs.mkdirSync(saveLocation);
          }
          let serviceDirName = serviceStub.name;
          if(options.serviceName)
          {
            serviceDirName = options.serviceName;
          }
          let svcLocation = saveLocation+"/"+serviceDirName+"/";
            if(!fs.existsSync(svcLocation))
              fs.mkdirSync(svcLocation);
            
          let svcCount = serviceStub.bindings.length;
          for(let svc of serviceStub.bindings)
          {
            let svcName = svcCount>1?svc.name:serviceStub.name;
            if(options.serviceName)
            {
              svcName = options.serviceName;
            }   
            for (let m of svc.methods) {

              let filePath = svcLocation + svcName + "_" + m.name;

              fs.writeFileSync(filePath + "_Request.xml", m.request.xml);
              fs.writeFileSync(filePath + "_Response.xml", m.response.xml);

              let faultIndex = 0;
              for(let fault of m.faults)
              {
                let faultStr = faultIndex>0?faultIndex:"";
                fs.writeFileSync(filePath + "_Fault"+faultStr+".xml", fault.xml);
                faultIndex++;
              }
            }
          }
          
        }
      }
    } catch (e) {
      console.error("An error occurred while saving ", e);
    }
    return serviceStub;
  }

  /**
   * Generates WSDL stub
   * @param {*} url
   */
  _generateStub(url, options) {
    var that = this;
    return new Promise(function(resolve, reject) {
      try {
        soap.createClient(url, function(err, client) {
          try {
            if (err) {
              reject(err);
              return;
            }

            let xmlServices = [];

            let wsdl = client.wsdl;
            
            let describe = client.describe();
         
            let wsdlTopElements = [];
            let wsdlMethods = [];

            let services = wsdl.definitions.services;
            let serviceNames = Object.getOwnPropertyNames(services);
            for (let serviceName of serviceNames) {
              let service = services[serviceName];
              let ports = service.ports;
              let portNames = Object.getOwnPropertyNames(ports);

              
              for (let portName of portNames) {
                let port = ports[portName];
             
                wsdlMethods = port.binding.methods;
                wsdlTopElements = port.binding.topElements;
                let wsdlMethodNames = Object.getOwnPropertyNames(wsdlMethods);
                let wsdlTopElementNames = Object.getOwnPropertyNames(
                  wsdlTopElements
                );
              }
            }

            let serviceRootNames = Object.getOwnPropertyNames(describe);
            for (let serviceRootName of serviceRootNames) {
              let serviceRoot = describe[serviceRootName];

              let serviceNames = Object.getOwnPropertyNames(serviceRoot);
              
              for (let serviceName of serviceNames) {
                let service = serviceRoot[serviceName];

                if (!service) {
                  break;
                }

                let xmlService = {};

                xmlService["name"] = serviceName;
                xmlService["methods"] = [];

                let methodNames = Object.getOwnPropertyNames(service);
                for (let methodName of methodNames) {
                  let method = service[methodName];
                  if (!method) {
                    break;
                  }

                  let input = method.input;
                  let output = method.output;
                  let wsdlMethod = wsdlMethods[methodName];
                  let wsdlTopElement = wsdlTopElements[methodName];
                  
                  let inputNamespace = wsdlMethod.input[TARGET_NAMESPACE];
                  let inputAlias = wsdlMethod.input[NAMESPACE_ALIAS];
                  let inputNames = Object.getOwnPropertyNames(input);
                  let inputName =
                    inputNames[0] == wsdlTopElement["methodName"]
                      ? ""
                      : wsdlTopElement["methodName"];

                  let inputDetails={
                        root:true,
                        obj:input,
                        parentName:inputName,
                        parentNSAlias: inputAlias,
                        parentNS:inputNamespace
                      }   
                  let inputResult = that.parseType(
                    options,
                    inputDetails
                  );

                  let outputNamespace = wsdlMethod.output[TARGET_NAMESPACE];
                  let outputAlias = wsdlMethod.output[NAMESPACE_ALIAS];
                  let outputNames = Object.getOwnPropertyNames(output);
                  let outputName =
                    outputNames[0] == wsdlTopElement["outputName"]
                      ? ""
                      : wsdlTopElement["outputName"];
                  let outputDetails={
                    root:true,
                    obj:output,
                    parentName:outputName,
                    parentNSAlias: outputAlias,
                    parentNS:outputNamespace
                  }   
                  let outputResult = that.parseType(
                    options,
                    outputDetails
                  );
                  let xmlMethod = {};
                  xmlMethod["name"] = methodName;
                  xmlMethod["request"] = inputResult;
                  xmlMethod["response"] = outputResult;

                  let faults = that.parseFault(wsdl, wsdlMethod, options);
                  //console.log(faults);
                  xmlMethod["faults"] = faults;

                  xmlService.methods.push(xmlMethod);
                }

                xmlServices.push(xmlService);
              }
            }
         
            
            let describeNames = Object.getOwnPropertyNames(describe);
            resolve({
              name: describeNames[0],
              bindings: xmlServices
            });
          } catch (innerEx) {
            reject(innerEx);
          }
        }); //end of createClient
      } catch (ex) {
        reject(ex);
      }
    }); //end of promise
  }

  parseFault(wsdl, wsdlMethod, options) {
    let faults = [];
    try {
      //let type = wsdlMethod.description(wsdlMethod, wsdl.xmlns);

      let wsdlMessages = wsdl.definitions["messages"];

      for (let child of wsdlMethod.children || []) {
        if (child["name"] == "fault") {
          let faultName = child["$name"];

          if (wsdlMessages) {
            let faultMessage = wsdlMessages[faultName];
            if (faultMessage) {
              faultMessage.postProcess(wsdl.definitions);
              let desc = faultMessage.description(wsdl.definitions);

              let faultEl = faultMessage["element"] || {};
              let faultElNs = faultEl[TARGET_NAMESPACE] || "";
              let faultElNsAlias = faultEl[NAMESPACE_ALIAS] || "";
              desc[TARGET_NAMESPACE] = faultElNs;
              desc[NAMESPACE_ALIAS] = faultElNsAlias;
              let faultDetails={
                root:true,
                obj:desc,
                parentName: faultName,
                isFault : true

              }   
              let faultType = this.parseType(options, faultDetails);

              faults.push(faultType);
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return faults;
  }

  /**
   * Parses a WSDL type recursevely  and generates XML
   * @param {} root
   * @param {*} obj
   * @param {*} parentName
   * @param {*} parentNSAlias
   * @param {*} parentNS
   */
  parseType(options, typeDetails) {

    let root = typeDetails.root;
    let obj = typeDetails.obj;
    let parentName = typeDetails.parentName;
    let parentNSAlias = typeDetails.parentNSAlias;
    let parentNS = typeDetails.parentNS;
    let isFault = typeDetails.isFault;
    let ns = [];

    let ret = "";
    let xml = "";
    let objType = typeof obj;

    if (objType == "object") {
      ret = {};

      let objNames = Object.getOwnPropertyNames(obj);
      let objNSAlias = obj[NAMESPACE_ALIAS] || parentNSAlias || "";
      let objNS = obj[TARGET_NAMESPACE] || parentNS;
      if (objNS) {
        let nsAlias = "";
        if (objNSAlias) {
          nsAlias = "xmlns:";
        }
        let alias = nsAlias + objNSAlias;
        if (root) {
          parentNSAlias = alias;
          parentNS = objNS;
        }
        if (alias) {
          alias += "=";
        }

        alias = alias + '"' + objNS + '"';
        ns.push(alias);
      }

      for (let objName of objNames) {
        let objProp = obj[objName];
        let objNameOther = objName;
        if (objName.indexOf("[]") >= 0) {
          objNameOther = objName.replace("[]", "");
          xml += "<!-- repetitions -->";
        }
        if (objProp) {
          if (typeof objProp == "object") {
            let tDetails={
              root:false,
              obj:objProp,
              parentName:objName,
              parentNSAlias: objNSAlias,
              parentNS:objNS
            }
            let childObj = this.parseType(
              options,
             tDetails
            );

            ret[objName] = childObj.obj;
            let childXml = childObj.xml;
            if (childXml) {
              if (objName != TARGET_NAMESPACE && objName != NAMESPACE_ALIAS) {
                xml += "<" + objNSAlias + ":" + objNameOther + ">";
                xml += childXml;
                xml += "</" + objNSAlias + ":" + objNameOther + ">";
              }
            }
            let childNs = childObj.ns;
            if (childNs) {
              let newNs = new Set(ns.concat(childNs));
              ns = [...newNs];
            }
          } else {
            ret[objName] = objProp;
            if (objName != TARGET_NAMESPACE && objName != NAMESPACE_ALIAS) {
              xml += "<" + objNSAlias + ":" + objNameOther + ">";
              if (options.fillEmpty) xml += "?";
              xml += "</" + objNSAlias + ":" + objNameOther + ">";
            }
          }
        }
      }
    } else {
      ret = obj;
      if (objName != TARGET_NAMESPACE && objName != NAMESPACE_ALIAS) {
        xml += "<" + objNSAlias + ":" + objName + ">";

        xml += "</" + objNSAlias + ":" + objName + ">";
      }
    }

    if (root) {
      let nsDet = "";
      if (parentNSAlias) {
        nsDet = parentNSAlias + ":";
        nsDet = nsDet.replace("xmlns:", "");
      }
      let name = parentName;
      if(name)
      {
      if (name.indexOf(":") < 0) {
        name = nsDet + parentName;
      }
      xml = "<" + name + ">" + xml + "</" + name + ">";
      }

      if(isFault)
      {
        
        xml = this.getSoapFaultXml(ns, xml);
      }
      else
      {
        xml = this.getSoapXml(ns, xml);
      }

      if (options.format) {
        let formatXml = format(xml);
        if (formatXml.length > xml.length) {
          xml = formatXml;
        }
      }
    }

    return {
      obj: ret,
      xml: xml,
      ns: ns
    };
  }

  getSoapFaultXml(namespaces, body, version) {
    let faultBody='';
    if(version=="12")
    {
      faultBody = "<soap:Fault>";
      faultBody += "<soap:Code>soap:Client</soap:Code>";
      faultBody += "<soap:Reason>An error occurred while processing</soap:Reason>";
      faultBody += "<soap:Detail>"+body+"</soap:Detail>";
       faultBody += "</soap:Fault>";
    
    }
    else
    {
      faultBody = "<soap:Fault>";
      faultBody += "<soap:faultCode>soap:Client</soap:faultCode>";
      faultBody += "<soap:faultString>An error occurred while processing</soap:faultString>";
      faultBody += "<soap:faultActor></soap:faultActor>";
      faultBody += "<soap:detail>"+body+"</soap:detail>";
       faultBody += "</soap:Fault>";
    }
    let envelope = this.getSoapXml(namespaces, faultBody,version);
    return envelope;
  }

  getSoapXml(namespaces, body, version) {
    let ns = namespaces.join(" ");
    let envelope='';
    if(version=="12")
    {
      let soapNs = 'xmlns:soap="http://www.w3.org/2003/05/soap-envelope"';
      let nspaces = soapNs + " " + ns;
      envelope = "<soap:Envelope " + nspaces + ">";
      envelope += "<soap:Header />";
      envelope += "<soap:Body>";
      envelope += body;
      envelope += "</soap:Body>";
      envelope += "</soap:Envelope>";
  
    }
    else
    {
      let soapNs = 'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"';
      let nspaces = soapNs + " " + ns;
      envelope = "<soap:Envelope " + nspaces + ">";
      envelope += "<soap:Header />";
      envelope += "<soap:Body>";
      envelope += body;
      envelope += "</soap:Body>";
      envelope += "</soap:Envelope>";
  
    }
    return envelope;
  }
}
module.exports = WsdlStub;
