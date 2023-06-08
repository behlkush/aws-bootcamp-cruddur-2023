# Week 8 — Serverless Image Processing

# Video 71: FREE AWS Cloud Project Bootcamp (Week 8) - Serverless Image Processing

- Focus this week is on severless avatar image processing
  - The purpose is to process avatar images
    **Summary**
  - s3 bucket with an image
  - Lambda that processes that image (so basically when something goes into the s3 event notification will
    fire the lambda)
- Using AWS CDK - Typescript is the language of choice

## Install dependencies for CDK

```sh
 npm install aws-cdk -g
```

**Output**

```
added 2 packages in 2s
a6110829@TR-C02FQ34DMD6R thumbing-serverless-cdk %
```

## Initialize a new project

```sh
cdk init app --language typescript
```

**Output**

```
Executing npm install...
✅ All done!
```

## Add an S3 bucket

- Added the following code to thumbing-serverless-cdk-stack.ts

```ts
import * as s3 from "aws-cdk-lib/aws-s3";

const bucketName: string = process.env.THUMBING_BUCKET_NAME as string;
const bucket = new s3.Bucket(this, "ThumbingBucket", {
  bucketName: bucketName,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

**Important note: the CDK functions that start with cfn are level 1 functions - avoid them if possible**

## Get CDK created yaml using: cdk synth

```sh
cdk synth
```

- Json equivalent of the same can be found under: cdk.out folder in file: ThumbingServerlessCdkStack.template.json

## Bootstrap the cdk

```sh
cdk bootstrap "aws://342196396576/ca-central-1"
```

**Output**

```sh
 ⏳  Bootstrapping environment aws://342196396576/ca-central-1...
Trusted accounts for deployment: (none)
Trusted accounts for lookup: (none)
Using default execution policy of 'arn:aws:iam::aws:policy/AdministratorAccess'. Pass '--cloudformation-execution-policies' to customize.
CDKToolkit: creating CloudFormation changeset...
 ✅  Environment aws://342196396576/ca-central-1 bootstrapped.
```

\*\*Note: Bootstrapping needs to be done for each account and each region - in case CDK needs to be used in all accounts
and all regions

## Deploy my first cdk resource

```sh
cdk deploy
```

**Output**

```sh

 ✅  ThumbingServerlessCdkStack

✨  Deployment time: 35.3s

Stack ARN:
arn:aws:cloudformation:ca-central-1:342196396576:stack/ThumbingServerlessCdkStack/9bacf460-e2b3-11ed-9e3a-02832f4353cc

✨  Total time: 41.73s

```

## Difference between SAM and CDK

- SAM is a specialized version of Cloudformation which is more concise that allows you to deploy
  serverless resources
- CDK on the other hand, lets you use, the programming language of your choice to deploy resources
  https://aws.amazon.com/blogs/compute/better-together-aws-sam-and-aws-cdk/

\*\*Note: Do a cdk synth before ckd deploy

## Lambda function

- The lambda function will use the code written in JavaScript

  - It is because the image processing library we will be using in JavaScript is lightweight

- Getting Error on cdk synth after adding lambda function call in cdk stack typescript file

```sh
  code: 'MODULE_NOT_FOUND',
```

- This requires dotenv package to be installed

```sh
npm i dotenv
```

# Issue 1:

- Even after install above package, my cdk synth attempts kept failing as i am running everything local
  - Updated the env variables to below to fix the issues:
  ```sh
  THUMBING_BUCKET_NAME='thumbing-bucket'
  THUMBING_FUNCTION_PATH='../aws/lambdas/process-images/'
  ```

# Video 72: Week 8 - Serverless Image Process CDK

- Need to install cdk by default for each run, as i am running locally, i will modify devcontainer.json
- my new postAttackCommand in devcontainer.json

```json
"postAttachCommand": "sudo npm install aws-cdk -g && cd ./thumbing-serverless-cdk && npm i && cd .. &&  sh ./bin/rds/update-sg-rule && cd ./frontend-react-js && npm install && cd ../backend-flask && pip install -r requirements.txt && sh bin/ecs/install-sm"
```

\*\*Note: I had to use a sudo npm install because it needs sudo to be able to install globally

## All env vars together:

```sh
const bucketName: string = process.env.THUMBING_BUCKET_NAME as string;
const folderInput: string = process.env.THUMBING_S3_FOLDER_INPUT as string;
const folderOutput: string = process.env.THUMBING_S3_FOLDER_OUTPUT as string;
const webhookUrl: string = process.env.THUMBING_WEBHOOK_URL as string;
const topicName: string = process.env.THUMBING_TOPIC_NAME as string;
const functionPath: string = process.env.THUMBING_FUNCTION_PATH as string;
console.log('bucketName',bucketName)
console.log('folderInput',folderInput)
console.log('folderOutput',folderOutput)
console.log('webhookUrl',webhookUrl)
console.log('topicName',topicName)
console.log('functionPath',functionPath)
```

**Note: Because i have a local env, i am not using env example as that issue will come only**
**if i were using gitpod. I can keep .env in ignore and still be able to make cdk work**

## Create the lambda folder for processing images: aws/lambda/process-images

- Created all the required files from omenking repo into my repo

  - index.js
  - package-lock.json
  - s3-image-processing.js
  - test.js
  - example.json

- Next run from: aws/lambdas/process-images directory:

```sh
npm init -y
```

- This creates an empty package.json
- Next we are using sharpjs to process image, so install that using:

```sh
npm i sharp
```

- Next install aws client-s3

```sh
npm i @aws-sdk/client-s3
```

- Do a cdk deploy
- Next we need to take care of the lambda as it needs the sharp library to be packaged with it, to work

```sh
npm install
rm -rf node_modules/sharp
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --arch=x64 --platform=linux --libc=glibc sharp
```

Source: https://sharp.pixelplumbing.com/install

# Create S3 Event notification to lambda

```ts
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
this.createS3NotifyToLambda(folderInput,lambda,bucket)

createS3NotifyToLambda(prefix: string, lambda: lambda.IFunction, bucket: s3.IBucket): void {
  const destination = new s3n.LambdaDestination(lambda);
  bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT,
destination,
{prefix: prefix} // Folder to contiain original image
  )
}
```

# Issue 2: Andrew faced an issue related to the old bucket name

- It was due to it being set in his gitpod env. I didn't face that because i am local and also because that variable
  only existed in my .env file

# Multiple Stacks

- Andrew talks about how he keeps two cloud formation templates, one for infra and one for the s3 bucket that he doesn't want to be
  teared down along with the rest of the stack.

# S3 bucket creation seperation from CDK

- Created the bucket manually and added a jpg image under original folder.
- Uploaded an avatar image under avatars/original folder in s3

- The event notification is not triggering the lambda, reason being we did not give permission
  to the lambda to put an object in s3.

# Create a bucket access policy for lambda

```ts
import * as iam from 'aws-cdk-lib/aws-iam';
const s3ReadWritePolicy = this.createPolicyBucketAccess(bucket.bucketArn);
lambda.addToRolePolicy(s3ReadWritePolicy);
createPolicyBucketAccess(bucketArn: string) {
  const s3ReadWritePolicy = new iam.PolicyStatement({
    actions: [
    's3:GetObject',
    's3:PutObject',
    ],
    resources: [
      `${bucketArn}/*`,
    ]
  });
  return s3ReadWritePolicy;
}
```

# Issue faced:

- The lambda was not getting triggered no matter what i did.
  - Final solution, i looked at .ts cloud stack file and saw that while pressing ctrl z accidently - i had reverted back to
    using a POST instead of a PUT and thats why the issue.
  - Once i replaced it with PUT, the lambda was triggered and the jpg file got processed.

# Next issue: Processed image has extension jpg.

\*\*File needing modification: index.js and s3-image-processing.js

- We basically need to remove jpg extension while generating the processed image and replace it with jpeg

```js
// File: index.js
// Logic to remove the extension jpg from the processed image
const filename = path.parse(srcKey).name;
const dstKey = `${folderOutput}/${filename}.jpeg`;

//File s3-image-processing.js
.jpeg()
ContentType: "image/jpeg";
```

- Next do a cdk deploy
- verified that the processed forlder now has the new image file with jpeg extension

# Create SNS Topic

- Add below code to the cdk task file:

```ts
import * as sns from 'aws-cdk-lib/aws-sns';

const snsTopic = this.createSnsTopic(topicName)

createSnsTopic(topicName: string): sns.ITopic{
  const logicalName = "Topic";
  const snsTopic = new sns.Topic(this, logicalName, {
    topicName: topicName
  });
  return snsTopic;
}
```

# Create an SNS Subscription

```ts
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

this.createSnsSubscription(snsTopic,webhookUrl)

createSnsSubscription(snsTopic: sns.ITopic, webhookUrl: string): sns.Subscription {
  const snsSubscription = snsTopic.addSubscription(
    new subscriptions.UrlSubscription(webhookUrl)
  )
  return snsSubscription;
}
```

# Create S3 Event Notification to SNS

```ts
this.createS3NotifyToSns(folderOutput,snsTopic,bucket)

createS3NotifyToSns(prefix: string, snsTopic: sns.ITopic, bucket: s3.IBucket): void {
  const destination = new s3n.SnsDestination(snsTopic)
  bucket.addEventNotification(
    s3.EventType.OBJECT_CREATED_PUT,
    destination,
    {prefix: prefix}
  );
}
```

# Create S3 Event Notification to Lambda

```ts
this.createS3NotifyToLambda(folderInput,laombda,bucket)

createS3NotifyToLambda(prefix: string, lambda: lambda.IFunction, bucket: s3.IBucket): void {
  const destination = new s3n.LambdaDestination(lambda);
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT,
    destination,
    {prefix: prefix}
  )
}
```

# Create Policy for Bucket Access

```ts
const s3ReadWritePolicy = this.createPolicyBucketAccess(bucket.bucketArn);
```

# Attach the Policies to the Lambda Role

```ts
lambda.addToRolePolicy(s3ReadWritePolicy);
```

- Note that currently the code for SNS publish is commmented out.
- Verified that the processed image SNS topic is mentioned in event notifications for the bucket

# End of video 71

# Video 72: Week 8 - Serving Avatars via CloudFront

## Goal is to serve image over assets via CloudFront

- distribute images using CDN instead of serving them from app backend everytime

# Set up Cloud Front manually for now

- Fill in the details like
  - Origin domain - select your assets.cruddur.gsdcanadacorp.info.s3.ca-central1.amazonaws.com bucket
  - Name - Same as above
  - Alternate Domain name (CNAME) - assets.gsdcanadacorp.info
  - Needs to create an ACM in us-east 1 - so manually creating it.
    - certificate wass validated fast and issued immediately. Select it from the drop-down

# Update route 53 to point assets.gsdcanadacorp.info to CDN distribution

- Create a CNAME record in route 53 and point it to CDN distribution that we just created.

# Create bucket policy for CloudFront Distribution to access s3 bucket

```json
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::assets.gsdcanadacorp.info/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::342196396576:distribution/E3G1Y8UTDZ6Q1K"
        }
      }
    }
  ]
}
```

# Test your work

- Access: https://assets.gsdcanadacorp.info/avatars/processed/cyber_defender_cruddur.jpeg and it loads up
  my avatar image successfully.

# S3 buckets rethinking - redesign - re-architect -- on the go

- It is often the case that while actually implementing we realize that some things need to change
- We have a new though process and want to separate out original avatar assets in a different bucket than the processed avatars.
- Made the changes in .env and cdk ts accordingly.

```sh
UPLOADS_BUCKET_NAME='cruddur-uploaded-avatars-ASECRET'
ASSETS_BUCKET_NAME='assets.cruddur.ASECRET'
```

and

```ts
const uploadsBucket = this.createBucket(uploadsBucketName);
const assetsBucket = this.importBucket(assetsBucketName);
```

# Video 74: Week 8 - Implement Users Profile Page

- Lets begin by running everything locally and running docker-compose up
- Remember we need to do ECR log in before we can get everything up

# BIG ISSUE CAME IN - My Macbook crashed

- Got a new replacement and setting everything up from scratch as I work local
- Docker build was taking forever for frontend
  - Researched and reasearched and researched some more to finally find that running below command can help:

```sh
docker system prune
```

- And that did help in doing docker-compose up and building the frontend.

# Backend and frontend throwing errors

```
aws-bootcamp-cruddur-2023-backend-flask-1      |     __import__(module_name)
aws-bootcamp-cruddur-2023-backend-flask-1      |   File "/backend-flask/app.py", line 112, in <module>
aws-bootcamp-cruddur-2023-backend-flask-1      |     @app.before_first_request
aws-bootcamp-cruddur-2023-backend-flask-1      | AttributeError: 'Flask' object has no attribute 'before_first_request'. Did you mean: '_got_first_request'
```

## Fixed using Discord suggestion

```
#@app.before_first_request
with app.app_context():
    def init_rollbar():
```

- Before_first request is no longer supported and is replaced by app_context

- Still got errors related to docker image being built for linux amd instead of my m1 mac- arm/64/v8
- Researched a bit more and found that i can use platform tag in docker-compose.yml file

```yaml
platform: linux/arm64/v8
```

# After this that error went away, then i got error for frontend

```sh
sh: 1: react-scripts: not found
```

- This requires a npm install so doing that.
- Finally after npm install it wokred .

# AWS CLI Version issue

- I had to install AWS CLI again using the correct install for M1 chip

```sh
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

## Added npm install for front end in .devcontainer.json file so that it is executed everytime containers are launched

# Work on setting up EditProfileButton functionality

- New js and css files called EditProfileButton
- This button should only show up if you are logged in.

- Next add this to the user feed page so that the option is shown to edit profile

## activity_feed related changes in UserFeedPage, NotificationsFeedPage and HomeFeedChange.js

- Moved below js code away from ActivityFeed.js

```js
    <div className='activity_feed'>
      <div className='activity_feed_heading'>
        <div className='title'>{props.title}</div>
      </div>
```

- Into the UserFeedPage, NotificationsFeedPage and HomeFeedChange.js files
- UserFeedPage.js file changes:

```js
<div className="activity_feed">
  <div className="activity_feed_heading">
    <div className="title">{title}</div>
  </div>
  <ActivityFeed activities={activities} />
</div>
```

- HomeFeedChange.js changes:

```js
        <div className='activity_feed'>
          <div className='activity_feed_heading'>
            <div className='title'>Home</div>
          </div>
```

- Similar change in NotificationsFeedPage.js

# Make changes to profile page

- We observed that there are not all conditionals(options) present on the profile page
- Adding them now
- Added this by adding checkAuth updates into UserFeedPage.js

```js
      await getAccessToken()
     const access_token = localStorage.getItem("access_token")
     const res = await fetch(backend_url, {
       headers: {
         Authorization: `Bearer ${access_token}`
       },

           checkAuth(setUser);
```

- Also added access token functionality as shown above

## Next up, add a count of cruds on the profile page.

- That requires modifying show.sql in the backend -- added cruds count on public activities

```sql
      (
       SELECT
        count(true)
       FROM public.activities
       WHERE
        activities.user_uuid = users.uuid
       ) as cruds_count
```

**Note** - This is a temporary solution until we put caching in place.

# Add a profile image and a banner

- Profile image was alerady uploaded in s3 previously and is available via CloudFront Distro
- Uploaded a banner image as well and next created ProfileHeading.js and ProfileHading.css pages

```js
import "./ProfileHeading.css";
import EditProfileButton from "../components/EditProfileButton";

export default function ProfileHeading(props) {
  const backgroundImage =
    'url("https://assets.gsdcanadacorp.info/banners/banner.jpeg")';
  const styles = {
    backgroundImage: backgroundImage,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  return (
    <div className="activity_feed_heading profile_heading">
      <div className="title">{props.profile.display_name}</div>
      <div className="cruds_count">{props.profile.cruds_count} Cruds</div>
      <div class="banner" style={styles}>
        <div className="avatar">
          <img src="https://assets.gsdcanadacorp.info/avatars/cyber_defender_cruddur.jpeg"></img>
        </div>
      </div>
      <div class="info">
        <div class="id">
          <div className="display_name">{props.profile.display_name}</div>
          <div className="handle">@{props.profile.handle}</div>
        </div>
        <EditProfileButton setPopped={props.setPopped} />
      </div>
    </div>
  );
}
```

and ProfileHeading.css

```css
.profile_heading {
  padding-bottom: 0px;
}

.profile_heading .avatar {
  position: absolute;
  bottom: -74px;
  left: 16px;
}

.profile_heading .avatar img {
  width: 148px;
  height: 148px;
  border-radius: 999px;
  border: solid 8px var(--fg);
}

.profile_heading .banner {
  position: relative;
  height: 200px;
}

.profile_heading .info {
  display: flex;
  flex-direction: row;
  align-items: start;
  padding: 16px;
}

.profile_heading .info .id {
  padding-top: 70px;
  flex-grow: 1;
}

.profile_heading .info .id .display_name {
  font-size: 24px;
  font-weight: bold;
  color: rgb(255, 255, 255);
}

.profile_heading .info .id .handle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
}

.profile_heading .cruds_count {
  color: rgba(255, 255, 255, 0.7);
}
```

- And called them from UserFeedPage.js

```js
<ProfileHeading setPopped={setPoppedProfile} profile={profile} />
```

# App after banner and profile image

![Cruddur at work](assets/week8/cruddur_app_week8.png)

# End of Video 74: Week 8 - Implement Users Profile Page

# Video 75: Week 8 - Implement Migrations Backend Endpoint and Profile Form

## Work on Edit Profile form popup

- I am not making changes to bootstrap because my generate env and ecr log in is happening via devcontainer.json:

```json
  "postAttachCommand": "sudo npm install aws-cdk -g && cd ./thumbing-serverless-cdk && npm i && cd .. &&  sh ./bin/rds/update-sg-rule && ./bin/ecr/login-ecr && ./bin/backend/generate-env && ./bin/frontend/generate-env && cd ./frontend-react-js && npm install && cd ../backend-flask && pip install -r requirements.txt && sh bin/ecs/install-sm"
```

- **Note** the use of generate-env and login-ecr scripts in the devcontianer postAttachCommand statement.

# Ease the src inclusion in frontend using jsonconfig.json

```js
{
  "compilerOptions": {
    "baseUrl": "src"
  },
  "include": ["src"]
}
```

## Edit profile button is rendered from UserFeedPage.js

- To show the edit button pop-up we need a form page - created ProfileForm.js
- Now refer to ProfileForm from UserFeedPage
- Also moved the popup css related stanzas from ReplyForm.css to its own file: Popup.css

```css
.popup_form_wrap {
  z-index: 100;
  position: fixed;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding-top: 48px;
  background: rgba(255, 255, 255, 0.1);
}

.popup_form {
  background: #000;
  box-shadow: 0px 0px 6px rgba(190, 9, 190, 0.6);
  border-radius: 16px;
  width: 600px;
}

.popup_form .popup_heading {
  display: flex;
  flex-direction: row;
  border-bottom: solid 1px rgba(255, 255, 255, 0.4);
  padding: 16px;
}

.popup_form .popup_heading .popup_title {
  flex-grow: 1;
  color: rgb(255, 255, 255);
  font-size: 18px;
}
```

- Added this css reference into App.js

```js
import "./components/Popup.css";
```

# Create the backend module for Profile update page

- Modify app.py to create a new endpoint that is being reached from ProfileForm.js

```py
@app.route("/api/profile/update", methods=['POST','OPTIONS'])
@cross_origin()
def data_update_profile():
  bio          = request.json.get('bio',None)
  display_name = request.json.get('display_name',None)
  access_token = extract_access_token(request.headers)
  try:
    claims = cognito_jwt_token.verify(access_token)
    cognito_user_id = claims['sub']
    model = UpdateProfile.run(
      cognito_user_id=cognito_user_id,
      bio=bio,
      display_name=display_name
    )
    if model['errors'] is not None:
      return model['errors'], 422
    else:
      return model['data'], 200
  except TokenVerifyError as e:
    # unauthenicatied request
    app.logger.debug(e)
    return {}, 401
```

- A sql script was written to update the profile - update.sql

```sql
UPDATE public.users
SET
  bio = %(bio)s,
  display_name= %(display_name)s
WHERE
  users.cognito_user_id = %(cognito_user_id)s
RETURNING handle;
```

- **Note** that if run right now, this would fail as bio field doesn't exist in the users table.

- Ran this:

```sh
./bin/generate/migration add_bio_column
```

- And got a file generated under backend-flask/db/migrations/TIMESTAMP_add_bio_column.py

## Migrate files and migrations->timestamp_add_bio_column.py files are not making sense to my

## head at this time and i will try and will try and understand it more later.

- What i do understand is that we are trying to alter an existing table to add bio column in it

# Migration new overview

- so now that i understand that we are trying to add a bio column into an existing table,
  i understand migrations better
- Migrate and rollback scripts are there to initiate and rollback a transaction on the DB table schema_information
- So if we want to add a new column calling bio into the existing users table, then we run **migrate** script
- If we want to undo the transaction, we run **rollback** script.
  **Thus we have successfully implemented migrations**

## Issues that cropped up because I am running local

- Migrate script would repeatedly give errors that pool-1 connection could not be found
  - Note that i was running a full docker compose up and that was my problem
  - when i ran only ddb and psql containers and then ran migrate script it worked as it picked the correct
    value of my CONNECTION_URL that has localhost instead of db in it.

## Add the edit profile functionality to add bio.

- updated ProfileHeading.js to include the newly created bio and show it in the profile

```js
<div class="bio">{props.profile.bio}</div>
```

- Add corresponding css settings:

```css
.profile_heading .bio {
  padding: 16px;
  color: rgba(255, 255, 255, 0.7);
}
```

# Issue

- As i had changed my dev laptop, code check in to git gave me error about index.lock file existing already
- Fixed it:

```sh
rm -f ./.git/index.lock
```

# End of video 75

# Video 76: Week 8 - Implement Avatar Uploading (Part 1)

- File: ProfileForm.js - we will use AWS client sdk to talk to s3 from within JS
- Instead of the SDK approach , we are going to follow the pre-signed URL approach

- Create a lambda authorizer - for the s3 interaction
  - We are going the ruby route when generating the pre-singed url using lambda
  - For that A new function.rb file is created under aws/lambdas/cruddur-upload-avatar folder.
  - When i am running bundle init in dev containers, its not being able to find it. Seems i need to install it.

```sh
sudo gem install bundler
```

- Installed bundle for ruby
- Next did

```sh
bundle init
```

- This created a Gemfile

```sh
bundle install
```

- Install the dependencies

```sh
bundle exec ruby function.rb
```

- I was getting errors so installed a new ruby version instead of using the default one that comes with MAC.
- then did bundle install and it succeeded.

```sh
https://cruddur-uploaded-avatars-owensound.s3.ca-central-1.amazonaws.com/mock.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAU7LD6UIQMVNMEZVN%2F20230529%2Fca-central-1%2Fs3%2Faws4_request&X-Amz-Date=20230529T191043Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=dce720c7ac08ca344fc5bcdea89d2ba0d93968a0c10ca50a024100d8a82d0a48
```

- Got the above presigned url after running the ruby script.
- I installed postman extension for VS Code (as i am local), and uploaded a file succesfully to the s3 bucket.

**Note**: We need to create a lifecycle rule for our bucket files. For that we need to create sub folders because lifecycle rules work on prefixes.

## New policy to allow the Lambda to write into the bucket and add it to the lambda role.

**Policy name**: PresignedUrlAvatarUploadPolicy

- The lambda was tested successfully and ready to be used with API Gateway - what we are looking to do is to use the jwt lambda authorizer: https://github.com/awslabs/aws-jwt-verify

- So after copying the authorizer and creating an index.js out of it, now this needs to be installed in package.json
- So we need to create a package.json or install this.

```sh
cd aws/lambdas/lambda-authorizer
npm install aws-jwt-verify --save
```

## Issue:

- I created the avatar upload lambda in a wrong region, so i ended up exporting and creating a new lambda in ca-central which is my region

## Upload the lambda for jwt verification as a zip and create a new lambda in AWS

## Next create API gateway and attach the lambda function to get presigned url

- Also attach the custom lambda authorizer function
- Tried calling the Gateway: https://84w6wezal0.execute-api.ca-central-1.amazonaws.com/avatars/key_upload which returns

```json
{ "message": "Unauthorized" }
```

- Above result is expected

# Add avatar upload integration to frontend

- Modify ProfileForm.js to create popup function for avatar upload

```js
const s3upload = async (event) => {
```

- API gateway CORS permissions needs to be set to allow this functionality
  ![API Gateway - CORS settings](assets/week8/cors_settings_api_gateway.png)

## CORS Issue still exists but checking in the code till now

# End of video 76

# Video 77: Week 8 - Fix CORS for API Gateway

- First part of the video deals in fixing the gitpod issues. i updated the gitpod yml accordingly
- Updated profile form.js with what Andrew Suggested, we still have CORS issue. Moving on to the next video

# End of video 77: Week 8 - Fix CORS for API Gateway

# Video 78: Week 8 - Week 8 - Fix CORS Final AWS Lambda Layers

- Wasnt able to fix

# End of video 78 - Week 8 - Fix CORS Final AWS Lambda Layers

# Video 79

- Created a new CORS policy

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["https://*.gitpod.io"],
    "ExposeHeaders": [
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

#API Gateway routes
![API Gateway - POST Route](assets/week8/api_gateway_route_post.png)

![API Gateway - OPTIONS Route](assets/week8/api_gateway_route_options.png)

#Lambda Logs -- Authorizer and CruddurUpload
![JWT Authorizer logs](assets/week8/jwtauthorizer.png)

![Cruddur Upload Lambda Logs](assets/week8/lambdaCruddurUpload.png)

# Issues: Faced CORS issues continuously. What saved me is a thread on Discord and the below authorizer code

```js
"use strict";
const { CognitoJwtVerifier } = require("aws-jwt-verify");
console.log("Inside Authorizer lambda", process.env.USER_POOL_ID);
console.log("Inside Authorizer lambda2", process.env.CLIENT_ID);
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.CLIENT_ID, //,
  //customJwtCheck: ({ payload }) => {
  //  assertStringEquals("e-mail", payload["email"], process.env.USER_EMAIL);
  //},
});

exports.handler = async (event) => {
  // console.log("request:", JSON.stringify(event, undefined, 2));

  const jwt = event.headers.authorization.split(" ")[1];
  let isAuthorized = false;
  try {
    const payload = await jwtVerifier.verify(jwt);
    console.log("Access allowed. JWT payload:", payload);
    isAuthorized = true;
  } catch (err) {
    console.error("Access forbidden:", err);
  } finally {
    const response = {
      isAuthorized: isAuthorized,
    };
    console.log("response", response);
    return response;
  }
};
```

# Lambda Layers

**Definition:**- A Lambda layer is a . zip file archive that can contain additional code or other content. A layer can contain libraries, a custom runtime, data, or configuration files.

```rb
#! /usr/bin/bash

gem i jwt -Ni /tmp/lambda-layers/ruby-jwt/ruby/gems/2.7.0
cd /tmp/lambda-layers/ruby-jwt

zip -r lambda-layers . -x ".*" -x "*/.*"
zipinfo -t lambda-layers

aws lambda publish-layer-version \
  --layer-name jwt \
  --description "Lambda Layer for JWT" \
  --license-info "MIT" \
  --zip-file fileb://lambda-layers.zip \
  --compatible-runtimes ruby2.7
```

- Also updated Lambda gem file to include jwt

![Lambda Layer](assets/week8/lambda_layer.png)

Summary of Week 8:

- Andrew mentions - bonus points if you can figure out how to set env vars correctly.
- In my local environment i have been able to achieve that using .devcontainer.json file
  and option: postAttachCommand - I load all my variables and do all npm installs here in postAttachCommand and the env vars get set automatically and correctly.

"postAttachCommand": "sudo npm install aws-cdk -g && cd ./thumbing-serverless-cdk && npm i && cd .. && sh ./bin/rds/update-sg-rule && ./bin/ecr/login-ecr && ./bin/backend/generate-env && ./bin/frontend/generate-env && cd ./frontend-react-js && npm install && cd ../backend-flask && pip install -r requirements.txt && sh bin/ecs/install-sm"
