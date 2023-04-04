# Week 6 — Deploying Containers

# Test RDS Connection 

```
#!/usr/bin/env python3

import psycopg
import os
import sys

connection_url = os.getenv("CONNECTION_URL")

conn = None
try:
  print('attempting connection')
  conn = psycopg.connect(connection_url)
  print("Connection successful!")
except psycopg.Error as e:
  print("Unable to connect to the database:", e)
finally:
  conn.close()
```

# Next implement a healthcheck for the flask app
Add the following to the app.py in flask backend:
```
@app.route('/api/health-check')
def health_check():
  return {'success': True}, 200
```

- Next we create a new bash script bin/flask/health-check
```
#!/usr/bin/env python3

import urllib.request

try:
  response = urllib.request.urlopen('http://localhost:4567/api/health-check')
  if response.getcode() == 200:
    print("[OK] Flask server is running")
    exit(0) # success
  else:
    print("[BAD] Flask server is not running")
    exit(1) # false
# This for some reason is not capturing the error....
#except ConnectionRefusedError as e:
# so we'll just catch on all even though this is a bad practice
except Exception as e:
  print(e)
  exit(1) # false
```
Note that we could have just gone ahead and used CURL for this but that would require
our continer to have CURL / WGET install. Remember to keep the container minimal.
Don't packet network utils in your containers.

# Create CloudWatch Log Group
- Create a cloudwatch log group called cruddur-fargate-cluster with a retention period set to 1 day
```
aws logs create-log-group --log-group-name /cruddur-fargate-cluster
aws logs put-retention-policy --log-group-name /cruddur-fargate-cluster --retention-in-days 1
```
- Log in to AWS Console and open cloud watch to verify group is created

# Create ECS Cluster
```
aws ecs create-cluster \
--cluster-name cruddur \
--service-connect-defaults namespace=cruddur
```

- Got An error occurred (ServerException) when calling the CreateCluster operation (reached max retries: 2): Service Unavailable. Please try again later.
- On second try it ran successfully with result below:
```
{
    "cluster": {
        "clusterArn": "arn:aws:ecs:ca-central-1:342196396576:cluster/cruddur",
        "clusterName": "cruddur",
        "status": "PROVISIONING",
        "registeredContainerInstancesCount": 0,
        "runningTasksCount": 0,
        "pendingTasksCount": 0,
        "activeServicesCount": 0,
        "statistics": [],
        "tags": [],
        "settings": [
            {
                "name": "containerInsights",
                "value": "disabled"
            }
        ],
        "capacityProviders": [],
        "defaultCapacityProviderStrategy": [],
        "attachments": [
            {
                "id": "85f38e1e-6c0e-4125-a692-f56cf5740ba1",
                "type": "sc",
                "status": "ATTACHING",
                "details": []
            }
        ],
        "attachmentsStatus": "UPDATE_IN_PROGRESS",
        "serviceConnectDefaults": {
            "namespace": "arn:aws:servicediscovery:ca-central-1:342196396576:namespace/ns-kwubodruqx5xhe35"
        }
    }
```

## Create our docker containers now - We can store the images in ECR

#### Create my first repository through CLI
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

#### Update backend Dockerfile to use the ECR image
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

#### Create a new repo for flask
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
```
An error occurred (MalformedPolicyDocument) when calling the CreateRole operation: Has prohibited field Resource
```

- We need to create parameters in parameter source because the resource mentioned in policy json doesn't exist yet.

### Parameters creation in Parameter store
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

# We are ready now to create the task role: Create TaskRole

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

#### Attache the role to policy

```
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess --role-name CruddurTaskRole
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess --role-name CruddurTaskRole
```

### Now we can come back and create the task definition for our ECS cluster
- Created a json file with all parameters required to create the task definition under: aws/task-definitions/backend-flask.json
```
{
  "family": "backend-flask",
  "executionRoleArn": "arn:aws:iam::342196396576:role/CruddurServiceExecutionRole",
  "taskRoleArn": "arn:aws:iam::342196396576:role/CruddurTaskRole",
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "requiresCompatibilities": [
    "FARGATE"
  ],
  "containerDefinitions": [
    {
      "name": "backend-flask",
      "image": "342196396576.dkr.ecr.ca-central-1.amazonaws.com/backend-flask",
      "essential": true,
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "python /backend-flask/bin/flask/health-check"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "portMappings": [
        {
          "name": "backend-flask",
          "containerPort": 4567,
          "protocol": "tcp",
          "appProtocol": "http"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "cruddur",
          "awslogs-region": "ca-central-1",
          "awslogs-stream-prefix": "backend-flask"
        }
      },
      "environment": [
        {
          "name": "OTEL_SERVICE_NAME",
          "value": "backend-flask"
        },
        {
          "name": "OTEL_EXPORTER_OTLP_ENDPOINT",
          "value": "https://api.honeycomb.io"
        },
        {
          "name": "AWS_COGNITO_USER_POOL_ID",
          "value": "ca-central-1_Sn1lgzw8T"
        },
        {
          "name": "AWS_COGNITO_USER_POOL_CLIENT_ID",
          "value": "34fjuf4h7vmu9fc2s5niu5uo11"
        },
        {
          "name": "FRONTEND_URL",
          "value": "*"
        },
        {
          "name": "BACKEND_URL",
          "value": "*"
        },
        {
          "name": "AWS_DEFAULT_REGION",
          "value": "ca-central-1"
        }
      ],
      "secrets": [
        {
          "name": "AWS_ACCESS_KEY_ID",
          "valueFrom": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/AWS_ACCESS_KEY_ID"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "valueFrom": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/AWS_SECRET_ACCESS_KEY"
        },
        {
          "name": "CONNECTION_URL",
          "valueFrom": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/CONNECTION_URL"
        },
        {
          "name": "ROLLBAR_ACCESS_TOKEN",
          "valueFrom": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/ROLLBAR_ACCESS_TOKEN"
        },
        {
          "name": "OTEL_EXPORTER_OTLP_HEADERS",
          "valueFrom": "arn:aws:ssm:ca-central-1:342196396576:parameter/cruddur/backend-flask/OTEL_EXPORTER_OTLP_HEADERS"
        }
      ]
    }
  ]
}
```

# Register Task Defintion
```
aws ecs register-task-definition --cli-input-json file://aws/task-definitions/backend-flask.json
```

### Set Default VPC
```
export DEFAULT_VPC_ID=$(aws ec2 describe-vpcs \
--filters "Name=isDefault, Values=true" \
--query "Vpcs[0].VpcId" \
--output text)
```

# Set ECS task security group -- Create Security Group
```
export CRUD_SERVICE_SG=$(aws ec2 create-security-group \
  --group-name "crud-srv-sg" \
  --description "Security group for Cruddur services on ECS" \
  --vpc-id $DEFAULT_VPC_ID \
  --query "GroupId" --output text)
echo $CRUD_SERVICE_SG
```

# Authorize security group to allow traffic inbound
```
aws ec2 authorize-security-group-ingress \
  --group-id $CRUD_SERVICE_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0
```

# Add new role to the policy: CruddurServiceExecutionPolicy
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

# Get default subnet IDs
```
export DEFAULT_SUBNET_IDS=$(aws ec2 describe-subnets  \
 --filters Name=vpc-id,Values=$DEFAULT_VPC_ID \
 --query 'Subnets[*].SubnetId' \
 --output json | jq -r 'join(",")')
echo $DEFAULT_SUBNET_IDS
```

- Returns back: subnet-04ab9732898672d8e,subnet-0f2be29ffefe70df5,subnet-0eb17d2423d58d9ae

# Create service-backend-flask.json
```
{
  "cluster": "cruddur",
  "launchType": "FARGATE",
  "desiredCount": 1,
  "enableECSManagedTags": true,
  "enableExecuteCommand": true,
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "assignPublicIp": "ENABLED",
      "securityGroups": [
        "sg-0358926389218cfd3"
      ],
      "subnets": [
        "subnet-04ab9732898672d8e",
        "subnet-0f2be29ffefe70df5",
        "subnet-0eb17d2423d58d9ae"
      ]
    }
  },
  "propagateTags": "SERVICE",
  "serviceName": "backend-flask",
  "taskDefinition": "backend-flask",
  "serviceConnectConfiguration": {
    "enabled": true,
    "namespace": "cruddur",
    "services": [
      {
        "portName": "backend-flask",
        "discoveryName": "backend-flask",
        "clientAliases": [
          {
            "port": 4567
          }
        ]
      }
    ]
  }
}
```

# Create the service from CLI
#### Backend service
```
aws ecs create-service --cli-input-json file://aws/json/service-backend-flask.json
```

# Connect to instances via sessions manager
https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-linux https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-verify

Install for Ubuntu
```
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
sudo dpkg -i session-manager-plugin.deb
```

#### Verify session manager is working
```
session-manager-plugin
```


# Connect to the container
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


# ECS Service and task launched successfully - now open it
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

# Connect Container to RDS
- We try to visit /api/acitivites/home but it didn't work.
- this is because backend contianer doesn't have access to RDS via security group. So RDS's SG needs to be updated to allow that 
in bound connection

- RDS SG is the default one so edit that
- Once i added SG of ECS to RDS Group, api/activities/home is now reachable
```
[
  {
    "created_at": "2023-03-30T12:56:46.327245",
    "display_name": "kiaan Behl",
    "expires_at": "2023-04-06T12:56:46.194684",
    "handle": "behlkiaan",
    "likes_count": 0,
    "message": "is it still working in prod",
    "replies_count": 0,
    "reply_to_activity_uuid": null,
    "reposts_count": 0,
    "uuid": "9d20901f-04ca-4479-8aed-ca77ae30f27e"
  },
  {
    "created_at": "2023-03-27T19:16:40.026277",
    "display_name": "owen sound",
    "expires_at": "2023-04-03T19:16:39.887401",
    "handle": "owensound",
    "likes_count": 0,
    "message": "RS from my side too son!",
    "replies_count": 0,
    "reply_to_activity_uuid": null,
    "reposts_count": 0,
    "uuid": "27f78bd7-329d-46e2-8e6f-d8b22797e9e2"
  },
  {
    "created_at": "2023-03-27T19:14:50.673832",
    "display_name": "******",
    "expires_at": "2023-04-03T19:14:50.53431",
    "handle": "************",
    "likes_count": 0,
    "message": "this is my first ever crud... happy RS",
    "replies_count": 0,
    "reply_to_activity_uuid": null,
    "reposts_count": 0,
    "uuid": "92a9b748-2540-47a1-ada5-b21af017623f"
  }
]
```

# Set up a load balancer via AWS Console

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

# Create the ECS service using ALB
- To generate a skeleton:
```
aws ecs create-service --generate-cli-skeleton
```
-  Update the service-backend-flask.json with ALB details
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


# Frontend ECS service
- Createa json: frontent-react-js.json for creating frontend service:
```
{
  "family": "frontend-react-js",
  "executionRoleArn": "arn:aws:iam::387543059434:role/CruddurServiceExecutionRole",
  "taskRoleArn": "arn:aws:iam::387543059434:role/CruddurTaskRole",
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "requiresCompatibilities": [ 
    "FARGATE" 
  ],
  "containerDefinitions": [
    {
      "name": "frontend-react-js",
      "image": "387543059434.dkr.ecr.ca-central-1.amazonaws.com/frontend-react-js",
      "essential": true,
      "portMappings": [
        {
          "name": "frontend-react-js",
          "containerPort": 3000,
          "protocol": "tcp", 
          "appProtocol": "http"
        }
      ],

      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
            "awslogs-group": "cruddur",
            "awslogs-region": "ca-central-1",
            "awslogs-stream-prefix": "frontend-react-js"
        }
      }
    }
  ]
}
```




# Create Docker image for the frontend react application to be pushed to ECR
```
aws ecr create-repository \
  --repository-name frontend-react-js \
  --image-tag-mutability MUTABLE
```


- Ran successfully and i can see a repo on ECR in AWS

