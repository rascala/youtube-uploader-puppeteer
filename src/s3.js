const fs = require('fs')
const AWS = require('aws-sdk')

const BUCKET_NAME = 'zdvideo'
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

async function isFileOnS3 (uploadedfileName) {
  console.log(`-- INFO - [S3]: checking for file: ${uploadedfileName}`)
  try {
    const params = {
      Bucket: BUCKET_NAME, Key: uploadedfileName
    }
    await s3.headObject(params).promise()
    return true
  } catch (err) {
    return false
  }
}

async function downloadFile (downloadFilePath, targetFilePath) {
  // Download the file
  console.log(`-- INFO - [S3]: Starting file download. ${downloadFilePath}`);
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: downloadFilePath,
    };
    const { Body } = await s3.getObject(params).promise()
    fs.writeFileSync(targetFilePath, Body)
    return 'done'
  } catch (err) {
    console.log(err)
    throw err
  }
}

async function uploadFile (fullFileName, uploadFilePath) {
  // Read content from the file
  const fileContent = fs.readFileSync(fullFileName);
  console.log(`-- INFO - [S3]: Starting file upload. ${uploadFilePath}`);
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: uploadFilePath,
      Body: fileContent
    };
    const uploadStatus = await s3.putObject(params).promise()
    console.log(`-- INFO - [S3]: File uploaded successfully. ${uploadStatus}`);
  } catch (err) {
    console.log(err)
    throw err
  }
}

async function uploadData (data, uploadFilePath) {
  // Read content from the file
  console.log(`-- INFO - [S3]: Starting data upload. ${uploadFilePath}`);
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: uploadFilePath,
      Body: JSON.stringify(data),
      ContentType: 'application/json; charset=utf-8',
      ACL: 'public-read',
      CacheControl: 'max-age=60'
    };
    const uploadStatus = await s3.putObject(params).promise()
    console.log(`-- INFO - [S3]: File uploaded successfully. ${uploadStatus}`);
  } catch (err) {
    console.log(err)
    throw err
  }
}

async function deleteFile (filePath) {
  // Read content from the file
  console.log(`-- INFO - [S3]: Deleting file. ${filePath}`);
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: filePath,
    };
    const uploadStatus = await s3.deleteObject(params).promise()
    console.log(`-- INFO - [S3]: File deleted successfully. ${uploadStatus}`);
  } catch (err) {
    console.log(err)
    throw err
  }
}

module.exports = { 
  isFileOnS3,
  uploadData,
  uploadFile,
  downloadFile,
  deleteFile,
}
