# Week 7 — Solving CORS with a Load Balancer and Custom Domain

## Video: Week 7 - Fargate - Configuring for Container Insights

# Enable Container Insights on backend - Enable XRAY

- Update backend-flask.json task definition to put xray details
- Creating register shell script for frontend and backend apps

#### Log in to ECR

```sh
./bin/ecr/login-ecr
```

- Register the new task defintion after xray changes

```sh
./bin/backend/register
```

- Next deploy the image

```sh
./bin/backend/deploy
```

**Task definition in my case registered successfully in first case and XRay was up and running**

- Healthcheck for xray is coming up as unknown

# Introducing Ruby Scripts to our solution

- Ruby scripts will be used to handing the environment variables.

#### Script 1: generate-env backend

- This will read the backend env erb file -- which is also created newly
- backend-flask.env.erb - the templatized file that ruby script reads
  - My .erb file is customized to suit my local environment

#### Script 2: generate-env frontend

- frontend-react-js.env - read by frontend generate env ruby script

  - customized to suit my local env

- Next run the ruby scripts to generate env files for backend and frontend

```sh
./bin/backend/generate-env
./bin/frontend/generate-env
```

- This generates two files, backend-flas.env and frontend-react-js.env under the top project directory aws-bootcamp-cruddur-2023

- These env files are generated only for containers and should not be checked in so added an entry in .gitignore

```
*.env
```

- Updated docker-compose.yml and used the environment variables from env files instead of hardcoding those

```
  backend-flask:
    env_file:
      - backend-flask.env
  frontend-react-js:
    env_file:
      - frontend-react-js.env
```

## Verify env variables are available to backend and frontend containers

- Do a docker compuse up and attach shell to both frontend and backend
# Issue: Backend is failing to start
- On debugging i found that the env variable: AWS_COGNITO_USER_POOL_ID was not being set
- I ran generate-env for backend again and then verified that it is present in backend-flask.env file
- It is now present as shown in backend logs too:
```
CognitoJWTToekn Parameters ca-central-1_Sn1lgzw8T
CognitoJWTToekn Parameters2 34fjuf4h7vmu9fc2s5niu5uo11
CognitoJWTToekn Parameters3 ca-central-1
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
```

## Env on backend: Verified that environment variables are set properly

```
FRONTEND_URL=http://localhost:3000
PYTHONUNBUFFERED=1
.... and others
```

## Env on frontend: Verified as well
```
REACT_APP_BACKEND_URL=http://localhost:4567
.... and others that have private information
```

## Set up Network in docker-compose
- Added below statement to create a local network to which all containers belong now
```
networks:
  cruddur-net:
    driver: bridge
    name: cruddur-net
```
- Also made sure to add this network to each of the container mentioned in docker-compose file
- this is done by adding networks stanza to each container: for example: Update for XRAY is shown below:
```
  xray-daemon:
    image: "amazon/aws-xray-daemon"
    environment:
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
      AWS_REGION: "ca-central-1"
    command:
      - "xray -o -b xray-daemon:2000"
    ports:
      - 2000:2000/udp
    networks:
      - cruddur-net
```

## Verify that the network is created as cruddur-net
- Before docker compose up:
Command> docker network list
```
NETWORK ID     NAME      DRIVER    SCOPE
2423b7b4fd20   bridge    bridge    local
5b95db5798d2   host      host      local
0ef71d26d834   none      null      local
```
- After:
```
NETWORK ID     NAME          DRIVER    SCOPE
2423b7b4fd20   bridge        bridge    local
577a71164b0f   cruddur-net   bridge    local
5b95db5798d2   host          host      local
0ef71d26d834   none          null      local
```

## Inspect Docker Containers network
Command> docker network inspect cruddur-net
- This shows Network details for each container. Example: backend contiainer details shown below:
```
            "3e18b93bd59c532f08bcc60257019434c7668d833dbeb8c609a70b8a9e78c497": {
                "Name": "aws-bootcamp-cruddur-2023-backend-flask-1",
                "EndpointID": "452d84e768593a1ccb8c74c0571e6a3d55c6ee4c6ea977e5fb94a25db5e3cf5d",
                "MacAddress": "02:42:ac:14:00:03",
                "IPv4Address": "172.20.0.3/16",
                "IPv6Address": ""
            },
```

## Error Connecting Xray
- So for me the docker compose up is working fine but for Omenking it is not and is giving xray daemon error
#### Busy box mode
- So run docker in busy box to detect issues
- New shhell script added: busybox
- Connected to xray from busybox - it was a success
**Command>./bin/busybox**
/ # telnet xray-daemon 2000
```
Connected to xray-daemon
```

## Issue was of quotes around the env files, I didn't have those quotes and it worked for me right in a single go.


# Going back to XRAY work
- Also note that my XRAY returned a positive health check in a single go.
- This was also because i didn't move my healthcheck for backend to out bin folder on the top of project directory.


