const crypto = require('crypto');
var fs = require('fs');

// Request hook to set header on every request
module.exports.requestHooks = [
  context => {
    const tenancyId = context.request.getEnvironmentVariable('tenancyId');
    const authUserId = context.request.getEnvironmentVariable('authUserId');
    const keyFingerprint = context.request.getEnvironmentVariable('keyFingerprint');
    const privateKeyPath = context.request.getEnvironmentVariable('privateKeyPath');

    var privateKey = fs.readFileSync(privateKeyPath, 'ascii');

    var signAlgorithm = "RSA-SHA256";
    var sigVersion = "1";
    var now = new Date().toUTCString();
    var host = getHost(context.request.getUrl());
    var target = getTarget(context.request.getUrl(), context.request.getParameters());
    var method = context.request.getMethod();
    var keyId = tenancyId + "/" + authUserId + "/" + keyFingerprint;

    var headers = "(request-target) date host";
    var request_target="(request-target): " + method.toLowerCase() + " "  + target;
    var date_header = "date: " + now;
    var host_header = "host: " + host;

    var signing_string = request_target + "\n" + date_header + "\n" + host_header;

    var methodsThatRequireExtraHeaders = ["POST", "PUT"];

    if(methodsThatRequireExtraHeaders.indexOf(method.toUpperCase()) !== -1) {
      var body = context.request.getBodyText();

      const signatureSign = crypto.createHash("SHA256");
      var content_sha256 =signatureSign.update(body).digest('base64');
      var content_type = "application/json";
      var content_length = body.length;

      headers = headers + " x-content-sha256 content-type content-length";
      var content_sha256_header = "x-content-sha256: " + content_sha256;
      var content_type_header = "content-type: " + content_type;
      var content_length_header = "content-length: " + content_length;

      signing_string = signing_string + "\n" + content_sha256_header + "\n" + content_type_header + "\n" + content_length_header;

      context.request.setHeader('Content-Type', 'application/json');      
      context.request.setHeader('Content-Length', content_length);
      context.request.setHeader('x-content-sha256', content_sha256);
    }    

    const signatureSign = crypto.createSign(signAlgorithm);
    const signedSignature = signatureSign.update(signing_string).sign(privateKey, 'base64');   

    const authorization = `Signature version="${sigVersion}", keyId="${keyId}", algorithm="${signAlgorithm.toLowerCase()}", headers="${headers}", signature="${signedSignature}"`;

    context.request.setHeader('date', now);    
    context.request.setHeader('Authorization', authorization);
  }
];


function getHost(url) {
  // https://identity.us-ashburn-1.oraclecloud.com/20160918/users/
  var n1 = url.indexOf("//");
  var n2 = url.indexOf("/", n1 + 2);

  var start = n1 + 2;
  var length = n2 - start;

  var host = url.substr(start, length);

  return host;
}

function getTarget(url, parameters) {
  // https://identity.us-ashburn-1.oraclecloud.com/20160918/users/
  var n1 = url.indexOf("//");
  var n2 = url.indexOf("/", n1 + 2);

  var start = n1 + 2;
  var length = n2 - start;

  var target = url.substr(start + length);

  for (var i in parameters) {
    if (i === '0')
      target += "?";
    else
      target += "&";
    target += parameters[i].name + "=" + parameters[i].value;
  }

  return target;
}