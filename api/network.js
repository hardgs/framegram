const https = require("https");
const http = require("http");
const {URL} = require("url");
const fs = require("fs");

async function request(method,url, options = {},timeout=30000)
{
  return new Promise((resolve, reject) => {
    const { headers = {}} = options;
    const requestOptions = {
      method:method,
      headers: {
        'User-Agent': 'LightweightNodeJS/Request',
        ...headers
      },
      ...options
    };
    if(options.body!=undefined)
      requestOptions.headers["Content-Length"] = Buffer.byteLength(options.body, 'utf8');
    
    const reqAgent = url.startsWith("http://") ? http : https;
    
    const req = reqAgent.request(url, requestOptions, (res) => {
      let data = [];
      res.on("data", (chunk) => data.push(chunk));
      res.on("end", () => {
        try {
          const response = Buffer.concat(data).toString('utf8');
          resolve({
            "status":res.statusCode,
            "message":res.statusMessage,
            "headers":res.headers,
            "response":response});
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Request timed out after ${timeout}ms`));
    });

    if (options.body) {
      req.write(options.body, 'utf8');
    }

    req.end();
  });
}

async function download(method,url,opath,options={},timeout = 60000)
{
  return new Promise((resolve, reject) => {

    const { headers = {}} = options;
    const requestOptions = {
      method:method,
      headers: {
        'User-Agent': 'LightweightNodeJS/Request',
        ...headers
      },
      ...options
    };

    const fileWritePipe = fs.createWriteStream(opath,{flags:"a"});
    fileWritePipe.on('error', (err) => reject(err));

    if(options.body!=undefined)
      requestOptions.headers["Content-Length"] = Buffer.byteLength(options.body, 'utf8');
    
    const reqAgent = url.startsWith("http://") ? http : https;
    
    const req = reqAgent.request(url, requestOptions, (res) => {
      res.pipe(fileWritePipe,{end:false});
      res.on("end", () => {
        try {
          resolve({
            "status":res.statusCode,
            "message":res.statusMessage,
            "headers":res.headers
          });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => {
      req.destroy(new Error(`Request timed out after ${timeout}ms`));
    });

    if (options.body) {
      req.write(options.body, 'utf8');
    }

    req.end();
  });
}

async function post(url, data, options = {}, timeout = 60000)
{
  const postData = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...options.headers
  };
  return request("POST",url,{
    body: postData,
    headers
  }, timeout);
}

async function get(url, options = {}, timeout = 60000)
{
  return request("GET",url,options, timeout);
}

const setupListener = (path,requestCallback=()=>{},port=8080,host="0.0.0.0") =>
{
  const server = http.createServer(async (req,res)=>{
    if(!req.url == path)
      res.end()
    let data = "";
    req.on("data",(chunk)=>{
      data = data + chunk;
    })
    req.on("error",async (error)=>{
      console.log(error);
    });
    req.on("end",async ()=>{
      /* First Close Connection, For Processing And Performance */
      res.end();
      if(data=="")
        return;
      requestCallback(
        JSON.parse(data)
      );
    })
  });

  server.on("error",(e)=>{
    console.log("ERROR");
  })
  server.listen(port,host);
}

/* Need Many Work */
const  uploadFile = async (url, params = {})=>
{
  const { chat_id, caption,reply_to_message_id, document, filename = 'file', timeout = 60000, headers = {} } = params;

  if (!url) throw new Error('url is required');
  if (!document || typeof document.pipe !== 'function') throw new Error('document (readable stream) is required');

  return new Promise((resolve, reject) => {
    const boundary = '----duck' + Math.random().toString(16).slice(2);
    const urlObj = new URL(url);
    const requestOptions = {
      method: 'POST',
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + (urlObj.search || ''),
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        ...headers
      }
    };

    const reqAgent = url.startsWith("https://")? https : http;
    const req = reqAgent.request(requestOptions, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else {
          const err = new Error(`Upload failed with status ${res.statusCode}`);
          err.statusCode = res.statusCode;
          err.body = body;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error(`Request timed out after ${timeout}ms`)));
    const write = (s) => req.write(Buffer.from(s, 'utf8'));
    write(`--${boundary}\r\n`);
    write(`Content-Disposition: form-data; name="chat_id"\r\n\r\n`);
    write(String(chat_id));
    write(`\r\n`);
    if (caption !== undefined) {
      write(`--${boundary}\r\n`);
      write(`Content-Disposition: form-data; name="caption"\r\n\r\n`);
      write(String(caption));
      write(`\r\n`);
    }
    if (reply_to_message_id !== undefined) {
      write(`--${boundary}\r\n`);
      write(`Content-Disposition: form-data; name="reply_to_message_id"\r\n\r\n`);
      write(String(reply_to_message_id));
      write(`\r\n`);
    }
    // file part header
    write(`--${boundary}\r\n`);
    write(`Content-Disposition: form-data; name="document"; filename="${filename}"\r\n`);
    write(`Content-Type: application/octet-stream\r\n\r\n`);
    // stream the file
    document.on('error', (err) => {
      req.destroy(err);
      reject(err);
    });

    document.on('end', () => {
      write(`\r\n--${boundary}--\r\n`);
      req.end();
    });

    document.pipe(req, { end: false });
  });
}

module.exports = { request, get, post, setupListener,uploadFile,download };