require 'aws-sdk-s3'
require 'json'
require 'jwt'

def handler(event:, context:)
  puts event
  origin = event["headers"]["origin"]
  puts("origin", origin)
  dev_url = "https:\/\/3000-behlkush-awsbootcampcru-(.+)\.gitpod\.io"
  if /#{dev_url}/.match(origin).nil? # if no match return the prod domain
    origin = "https://gsdcanadacorp.info"
  end
  # Return CORS headers for pre-flight check
  if event['routeKey'] == "OPTIONS /{proxy+}"
    puts({step: 'preflight', message: 'preflight CORS check'}.to_json)
    { 
      headers: {
        "Access-Control-Allow-Headers": "*, Authorization",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
      },
      statusCode: 200
    }
  else 
    token = event['headers']['authorization'].split(' ')[1]
    puts({step: 'presignedurl', access_token: token}.to_json)

    body_hash = JSON.parse(event["body"])
    extension = body_hash["extension"]

    decoded_token = JWT.decode token, nil, false
    cognito_user_uuid = decoded_token[0]['sub']

    s3 = Aws::S3::Resource.new
    bucket_name = ENV["UPLOADS_BUCKET_NAME"]
    object_key = "#{cognito_user_uuid}.#{extension}"
  
    obj = s3.bucket(bucket_name).object(object_key)
    url = obj.presigned_url(:put, expires_in: 30000)
  
    body = {url: url}.to_json
    { 
      headers: {
          "Access-Control-Allow-Headers": "*, Authorization",
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "OPTIONS, GET, POST"
      },
      statusCode: 200, 
      body: body 
    }
  end # if 
end # def handler
