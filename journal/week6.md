# Week 6 — Deploying Containers

### Summary of workd done for Week 6
- Create ECS cluster
- Create Task definitions, register tasks, create backend and frontend ECS services
- Register custom domain
- Set up Route 53 to point custom domain to application load balancer
- Set up load balancer listeners to point to backend and frontend respectively
- Update Route 53 records to create aliases for gsdcanadacorp.info and api.gsdcanadacorp.info



## Restructured bin directory in backend-flask - Created shell scripts below

#### File name and path: backend-flask/bin/db/test
**Purpose**: Test RDS Connection to prod.

#### File name and path: backend-flask/bin/flask/health-check
**Purpose**: Check health of backend and frontend containers
Note that we could have just gone ahead and used CURL for this but that would require
our continer to have CURL / WGET install. Remember to keep the container minimal.
Don't packet network utils in your containers.



#### Next implement a healthcheck for the flask app
Add the following to the app.py in flask backend:

```
@app.route('/api/health-check')
def health_check():
  return {'success': True}, 200
```


## Create CloudWatch Log Group

- Create a cloudwatch log group called cruddur-fargate-cluster with a retention period set to 1 day

```
aws logs create-log-group --log-group-name /cruddur-fargate-cluster
aws logs put-retention-policy --log-group-name /cruddur-fargate-cluster --retention-in-days 1
```

- Log in to AWS Console and open cloud watch to verify group is created

## Create ECS Cluster

```
aws ecs create-cluster \
--cluster-name cruddur \
--service-connect-defaults namespace=cruddur
```

# Issue 1: Error while creating cluster
- Got An error occurred (ServerException) when calling the CreateCluster operation (reached max retries: 2): Service Unavailable. Please try again later.
- On second try it ran successfully with result below:


## Create our docker containers now - We can store the images in ECR
#### Create my first repository through CLI: This is for Python image
```
aws ecr create-repository \
  --repository-name cruddur-python \
  --image-tag-mutability MUTABLE
```
#### Next log in to ECR
```
aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username \
AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"
```
- Output -- Login Succeeded
- Now that we are logged in - we can push the containers in our ECR

#### Set URL -- This requires us to pass the base URI of our ECR
```
export ECR_PYTHON_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/cruddur-python"
echo $ECR_PYTHON_URL
```

- 342196396576.dkr.ecr.ca-central-1.amazonaws.com/cruddur-python -- Matches my URI for ECR

#### Pull the docker image for python
- So what we are looking to do is, instead of pulling in the python image everytime from docker hub,
  instead we are pulling it once and then we will push it into our ECR which is our private repo.
- Going forward we won't be then dependent on Dockerhub anymore for python image

```
docker pull python:3.10-slim-buster
```

- output - Status: Downloaded newer image for python:3.10-slim-buster
  docker.io/library/python:3.10-slim-buster

#### Tag image
```
docker tag python:3.10-slim-buster $ECR_PYTHON_URL:3.10-slim-buster
```

#### Push image
```
docker push $ECR_PYTHON_URL:3.10-slim-buster
```

- Output:
```
128cd062b35d: Pushed
44ae7921fd10: Pushed
075372db15c2: Pushed
d1a969d0e2e5: Pushed
c9182c130984: Pushed
3.10-slim-buster: digest: sha256:31827b60ef2becea7b6b017f309c57062f7b3f37ad309eb57e9ed20411690c01 size: 1370
```

#### Update backend Dockerfile to use the ECR image instead of utilizing docker hub
```
FROM 342196396576.dkr.ecr.ca-central-1.amazonaws.com/cruddur-python:3.10-slim-buster
```

#### Check if the image gets pulled
```
docker compose up backend-flask db
```

Then check the API URL: http://localhost:4567/api/health-check
```
{
  "success": true
}
```

- So our health check is returning true

### Turn on debugging in FLASK through Dockerfile
```
ENV FLASK_DEBUG=1
```

# Next push the FLASK image to ECR
#### Create a new repo for backend-flask

```
aws ecr create-repository \
  --repository-name backend-flask \
  --image-tag-mutability MUTABLE
```

- Next set the URL

```
export ECR_BACKEND_FLASK_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/backend-flask"
echo $ECR_BACKEND_FLASK_URL
```

#### Build the flask image
```
docker build -t backend-flask .
```

#### Tag it to latest
```
docker tag backend-flask:latest $ECR_BACKEND_FLASK_URL:latest
```

#### Push image
```
docker push $ECR_BACKEND_FLASK_URL:latest
```

- Do some debugging to make sure the container image is usable

# Before created a Task definition in ECS, we first need to create roles
- Create Task and Exection Roles for Task Defintion

#### Create ExecutionRole
```
aws iam create-role \
    --role-name CruddurServiceExecutionRole \
    --assume-role-policy-document file://aws/policies/service-execution-policy.json
```

- This is of course failing and giving error:

# Issue 2 
```
An error occurred (MalformedPolicyDocument) when calling the CreateRole operation: Has prohibited field Resource
```

- We needed to create parameters in parameter source because the resource mentioned in policy json doesn't exist yet.

#### Parameters creation in Parameter store
- Passing Senstive Data to Task Defintion
  Reference links:
  https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html
  https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html

```
aws ssm put-parameter --type "SecureString" --name "/cruddur/backend-flask/AWS_ACCESS_KEY_ID" --value $AWS_ACCESS_KEY_ID
aws ssm put-parameter --type "SecureString" --name "/cruddur/backend-flask/AWS_SECRET_ACCESS_KEY" --value $AWS_SECRET_ACCESS_KEY
aws ssm put-parameter --type "SecureString" --name "/cruddur/backend-flask/CONNECTION_URL" --value $PROD_CONNECTION_URL
aws ssm put-parameter --type "SecureString" --name "/cruddur/backend-flask/ROLLBAR_ACCESS_TOKEN" --value $ROLLBAR_ACCESS_TOKEN
aws ssm put-parameter --type "SecureString" --name "/cruddur/backend-flask/OTEL_EXPORTER_OTLP_HEADERS" --value "x-honeycomb-team=$HONEYCOMB_API_KEY"
```

- The issue was that the policies need to be separated into execution and assume role policies.

```
aws iam create-role \
--role-name CruddurServiceExecutionRole \
--assume-role-policy-document file://aws/policies/service-assume-role-execution-policy.json
```

- policy created now attach the permissions

```
aws iam put-role-policy \
  --policy-name CruddurServiceExecutionPolicy \
  --role-name CruddurServiceExecutionRole \
  --policy-document file://aws/policies/service-execution-policy.json
```

- Note that to make it work i had to rename the role name to: CruddurServiceExecutionRole

## We are ready now to create the task role: Create TaskRole
```
aws iam create-role \
    --role-name CruddurTaskRole \
    --assume-role-policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{
    \"Action\":[\"sts:AssumeRole\"],
    \"Effect\":\"Allow\",
    \"Principal\":{
      \"Service\":[\"ecs-tasks.amazonaws.com\"]
    }
  }]
}"
```

##### Now put role policy

```
aws iam put-role-policy \
  --policy-name SSMAccessPolicy \
  --role-name CruddurTaskRole \
  --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{
    \"Action\":[
      \"ssmmessages:CreateControlChannel\",
      \"ssmmessages:CreateDataChannel\",
      \"ssmmessages:OpenControlChannel\",
      \"ssmmessages:OpenDataChannel\"
    ],
    \"Effect\":\"Allow\",
    \"Resource\":\"*\"
  }]
}
"
```

- Note that the trailing double quotes are required

#### Attach the role to policy
```
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess --role-name CruddurTaskRole
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess --role-name CruddurTaskRole
```

### Now we can come back and create the task definition for our ECS cluster
**File name / path**: aws/task-definitions/backend-flask.json
- Created a json file with all parameters required to create the task definition under: aws/task-definitions/backend-flask.json


## Register Task Defintion
```
aws ecs register-task-definition --cli-input-json file://aws/task-definitions/backend-flask.json
```

#### Set Default VPC
```
export DEFAULT_VPC_ID=$(aws ec2 describe-vpcs \
--filters "Name=isDefault, Values=true" \
--query "Vpcs[0].VpcId" \
--output text)
```

#### Set ECS task security group -- Create Security Group
```
export CRUD_SERVICE_SG=$(aws ec2 create-security-group \
  --group-name "crud-srv-sg" \
  --description "Security group for Cruddur services on ECS" \
  --vpc-id $DEFAULT_VPC_ID \
  --query "GroupId" --output text)
echo $CRUD_SERVICE_SG
```

#### Authorize security group to allow traffic inbound
```
aws ec2 authorize-security-group-ingress \
  --group-id $CRUD_SERVICE_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0
```

#### Add new role to the policy: CruddurServiceExecutionPolicy
- Once we tried to launch a task it errorred out for a role that is required
- GetAuthorizationToken - added to the policy
- next i added cloudwatchfullaccess policy also added

#### Added more actions to: CruddurServiceExecutionPolicy

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameters",
                "ssm:GetParameter"
            ],
            "Resource": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/*"
        }
    ]
}
```

#### Get default subnet IDs
```
export DEFAULT_SUBNET_IDS=$(aws ec2 describe-subnets  \
 --filters Name=vpc-id,Values=$DEFAULT_VPC_ID \
 --query 'Subnets[*].SubnetId' \
 --output json | jq -r 'join(",")')
echo $DEFAULT_SUBNET_IDS
```

- Returns back: subnet-04ab9732898672d8e,subnet-0f2be29ffefe70df5,subnet-0eb17d2423d58d9ae

## Create backend service - using an input json file
**File Name / Path**: aws/json/service-backend-flask.json
**Purpose**: To be passed as an input to CLI from creating service

#### Backend service
```
aws ecs create-service --cli-input-json file://aws/json/service-backend-flask.json
```

#### Connect to instances via sessions manager
https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-linux https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-verify

#### Install for Ubuntu
```
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
sudo dpkg -i session-manager-plugin.deb
```

#### Verify session manager is working
```
session-manager-plugin
```

#### Connect to the container
```
aws ecs execute-command  \
--region $AWS_DEFAULT_REGION \
--cluster cruddur \
--task 56345d4a03f041d890ab489be9f288e5 \
--container backend-flask \
--command "/bin/bash" \
--interactive
```

- **Connected successfully**
```
The Session Manager plugin was installed successfully. Use the AWS CLI to start a session.

Starting session with SessionId: ecs-execute-command-0ee49300851f91762
root@ip-172-31-1-131:/backend-flask#
```

#### ECS Service and task launched successfully - now open it

# Issue 3:
not opening using http://35.183.118.156:4567/

**Can be a security group issue**
- Updated SG inbound rule to accept TCP on 4567

Visit: http://35.183.118.156:4567/api/health-check
And it returned success
```
{
  "success": true
}
```

## Connect Container to RDS
- We try to visit /api/acitivites/home but it didn't work.
- this is because backend contianer doesn't have access to RDS via security group. So RDS's SG needs to be updated to allow that
  in bound connection

- RDS SG is the default one so edit that
- Once i added SG of ECS to RDS Group, api/activities/home is now reachable


## Set up a load balancer via AWS Console
- To create an ALB - we created an internet facing security group- sg-07e9133df7d8c3f4b
- Add this as security group of ALB while creating the ALB
- Before that first allow the ECS hosted backend to be accessible only via ALB SG

- Back on the ALB creation screen, select the SG newly created for ALB
- Next step is to create a target group -- we wont be adding any resources to the target groups yet
- Select IP Addresses as target group

  - Entered other values for health check and port as 4567
  - cruddur-backend-flask-tg created

- Next create another target group for frontend-react-js - cruddur-frontend-react-js

  - this one listens on 3000 port

- cruddur-alb -- successfully created

#### Create the ECS service using ALB
- To generate a skeleton:
```
aws ecs create-service --generate-cli-skeleton
```

#### Update the service-backend-flask.json with ALB details
```
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:ca-central-1:342196396576:targetgroup/cruddur-backend-flask-tg/be7fc744b81610e0",
      "containerName": "backend-flask",
      "containerPort": 4567
    }
  ],
```

- Create the service again with ALB settings in place

```
aws ecs create-service --cli-input-json file://aws/json/service-backend-flask.json
```

#### Update ALB security group : sg-07e9133df7d8c3f4b - cruddur-alb-sg
- Add inbound traffic for port 4567
- Add inbound traffic for port 3000

- Next visit: http://cruddur-alb-1705497311.ca-central-1.elb.amazonaws.com:4567/api/activities/home and it worked

#### Turn on ALB Logging
- Go into the attributes section and first create a new s3 bucket: cruddur-alb-access-logs-owen
  - Note that the bucket currently has public access
- Select the bucket location to store access logs back in ALB attributes.

- We need to attach a bucket policy so that the ALB can access S3 bucket
  https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::985666609251:root"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::cruddur-alb-access-logs-owen/AWSLogs/342196396576/*"
    }
  ]
}
```

- The attribute changes were saved after adding above bucket policy

## Frontend ECS service
**File Name / Path**: aws/task-definitions/frontent-react-js.json 
**Purpose**: For creating frontend service

**Gitignore file updated to exclude the build folder**


# Issue 4:
- Next i ran npm run build to build the front end contianer but it errored out giving:

```
[eslint] package.json » eslint-config-react-app/jest#overrides[0]:
        Environment key "jest/globals" is unknown
```

- I removed the entry for jest from extends array

```
  "eslintConfig": {
    "extends": [
      "react-app"
    ]
```

- It compiled successfully after that

## Create docker build for frontend
```
docker build \
--build-arg REACT_APP_BACKEND_URL="http://localhost:4567" \
--build-arg REACT_APP_AWS_PROJECT_REGION="$AWS_DEFAULT_REGION" \
--build-arg REACT_APP_AWS_COGNITO_REGION="$AWS_DEFAULT_REGION" \
--build-arg REACT_APP_AWS_USER_POOLS_ID="ca-central-1_Sn1lgzw8T" \
--build-arg REACT_APP_CLIENT_ID="34fjuf4h7vmu9fc2s5niu5uo11" \
-t frontend-react-js \
-f Dockerfile.prod \
.
```

**Create Docker image for the frontend react application to be pushed to ECR
```
aws ecr create-repository \
  --repository-name frontend-react-js \
  --image-tag-mutability MUTABLE
```
- Ran successfully and i can see a repo on ECR in AWS

**URL
```
export ECR_FRONTEND_REACT_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/frontend-react-js"
echo $ECR_FRONTEND_REACT_URL
```

**Tag image
```
docker tag frontend-react-js:latest $ECR_FRONTEND_REACT_URL:latest
```

**Push Image
```
docker push $ECR_FRONTEND_REACT_URL:latest
```

# Issue 5:
- Getting error
```
denied: Your authorization token has expired. Reauthenticate and try again.
bootcamp@e7dca389ea0e:/workspaces/aws-bootcamp-cruddur-2023/frontend-react-js$ docker push $ECR_FRONTEND_REACT_URL:latest
The push refers to repository [342196396576.dkr.ecr.ca-central-1.amazonaws.com/frontend-react-js]
1379588a0ba0: Preparing
f4ee27124ebd: Preparing
042cd3f87f43: Preparing
f1bee861c2ba: Preparing
c4d67a5827ca: Preparing
152a948bab3b: Waiting
5e59460a18a3: Waiting
d8a5a02a8c2d: Waiting
7cd52847ad77: Waiting
denied: Your authorization token has expired. Reauthenticate and try again.
```
#### Session token had expired so log in to ECR again using:
```
aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username \
AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"
```

**Login Succeeded**

# Push Frontend image to ECR
```
docker push $ECR_FRONTEND_REACT_URL:latest
```

#### Run and test
```
docker run --rm -p 3000:3000 -it frontend-react-js
```

# Update the docker image creation with correct backend url
```
cruddur-alb-1705497311.ca-central-1.elb.amazonaws.com
```

**[Build Image again using](#Create docker build for frontend)

# Create task definition
**File name / path**: aws/task-defintions/frontend-react-js.json


**Next we need to register the task definition
```
aws ecs register-task-definition --cli-input-json file://aws/task-definitions/frontend-react-js.json
```

**Now create frontend service
```
aws ecs create-service --cli-input-json file://aws/json/service-frontend-react-js.json
```

**Update the security group: sg-0358926389218cfd3 - crud-srv-sg
- added an inbound rule for port 3000 from ALB security group in to the ECS security group
- The SG for my ALB had the port mentioned as 300 instead of 3000.
- I fixed that to be able to successfully access the frontend using ALB:3000

**Now start with Custom Domain set up
 - Under route53 i created a new hosted zone
 - Updated the name servers on my GoDaddy hosted domain
 - Next we need a SSL certificate 
  - Head to Certificate manager and create one
  - added domains: kushbehl.ca	 and *.kushbehl.ca
  - Requested the creation
  - Then Added the records in route 53


**Modified task defintion for backend to update FRONTEND and BACKEND URLs
```
        {
          "name": "FRONTEND_URL",
          "value": "gsdcanadacorp.info"
        },
        {
          "name": "BACKEND_URL",
          "value": "api.gsdcanadacorp.info"
        },
```

**Register task definition again for backend**

```
aws ecs register-task-definition --cli-input-json file://aws/task-definitions/backend-flask.json
```


# Next do the same for front end but frontend is different. We need to rebuild the image
#### Log in to ECR again
```
aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"
```

### Next Set URL

```
export ECR_FRONTEND_REACT_URL="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/frontend-react-js"
echo $ECR_FRONTEND_REACT_URL
```

**[Build image again using the correct FRONTEND_URL with custom domain using steps](#Create docker build for frontend)
