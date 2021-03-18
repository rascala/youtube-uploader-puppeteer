// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'us-west-2'});


const RESIZER_QUEUE_URL = ""
const MOVIEPY_QUEUE_URL = ""

// Create an SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});


async function send_message(queue_url, home_id) {
  var params = {
     // Remove DelaySeconds parameter and value for FIFO queues
    DelaySeconds: 10,
    MessageAttributes: {
      "home_id": {
        DataType: "String",
        StringValue: home_id
      },
    },
    MessageBody: `sending message to ${queue_url}, home_id = ${home_id}`,
    QueueUrl: queue_url
  };
 
  const ret_val = await new Promise((resolve, reject) => { 
    sqs.sendMessage(params, function(err, data) {
      if (err) {
        resolve('error')
      } else {
        resolve('done')
      }
    });
  })
  return ret_val
}

async function recv_message(queue_url) {

  var params = {
   AttributeNames: [
      "SentTimestamp"
   ],
   MaxNumberOfMessages: 1,
   MessageAttributeNames: [
      "All"
   ],
   QueueUrl: queue_url,
   VisibilityTimeout: 20,
   WaitTimeSeconds: 0
  };
  
  const ret_val = new Promise((resolve, reject) => {
    sqs.receiveMessage(params, function(err, data) {
      if (err) {
        reject("Receive Error" + err);
      } else if (data.Messages) {
        var deleteParams = {
          QueueUrl: queue_url,
          ReceiptHandle: data.Messages[0].ReceiptHandle
        };
        sqs.deleteMessage(deleteParams, function(err, data) {
          if (err) {
            reject("Delete Error" + err);
          } else {
            resolve(data.Messages[0]);
          }
        });
      }
    });
  }
}

