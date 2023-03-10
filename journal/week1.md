# Week 1 — App Containerization

## Initial set up - Docker
- challenge encountered - whale icon of docker was not visible - as the docker extension was not installed by default on my gitpod.
- went ahead and installed it and its showing now - screenshot below:
![docker extension](assets/docker_extension_install.png)


## Added Dockerfile

```
FROM python:3.10-slim-buster

WORKDIR /backend-flask

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY . .

ENV FLASK_ENV=development

EXPOSE ${PORT}
CMD [ "python3", "-m" , "flask", "run", "--host=0.0.0.0", "--port=4567"]

```

In the above docker file: CMD is what is running the flask module of python
-m -> stands for module
flask -> is the module name
run on local host - 0.0.0.0
on port 4567


### Difference between CMD and RUN:
RUN -- makes it the part of the image
CMD -- is that container will run this


## Build container
```
docker build -t  backend-flask ./backend-flask
```

## Run Container
```
docker container run --rm -p 4567:4567 -d backend-flask
```

### --rm option will make the docker to delete all artifacts related to container and clean it



## Containerize Frontend

### Run NPM install
```
cd frontend-react-js
npm i
```

### Create docker file:

```
FROM node:16.18

ENV PORT=3000

COPY . /frontend-react-js
WORKDIR /frontend-react-js
RUN npm install
EXPOSE ${PORT}
CMD ["npm", "start"]
```

Docker file is basically to automate what we are doing above by running npm i -- see RUN npm install statement in docker file.
It means include the install of frontend-js while initializing docker container.


### Build container
```
docker build -t frontend-react-js ./frontend-react-js
```

### Run Container
```
docker run -p 3000:3000 -d frontend-react-js
```


Both containters are build and run. This is fine for 2 containers but to manage the start and run and shutdown of these containers there is a better way coming up below.


## Multiple Containers
Calls for Docker Compose

Docker Compose -- Run multiple containers using yml instead of using multiple containers to manually launch the docker container run commands

```
version: "3.8"
services:
  backend-flask:
    environment:
      FRONTEND_URL: "https://3000-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
      BACKEND_URL: "https://4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
    build: ./backend-flask
    ports:
      - "4567:4567"
    volumes:
      - ./backend-flask:/backend-flask
  frontend-react-js:
    environment:
      REACT_APP_BACKEND_URL: "https://4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
    build: ./frontend-react-js
    ports:
      - "3000:3000"
    volumes:
      - ./frontend-react-js:/frontend-react-js

# the name flag is a hack to change the default prepend folder
# name when outputting the image names
networks: 
  internal-network:
    driver: bridge
    name: cruddur
  ```

## Adding dynamodb and postgress packages

### Dynamo DB

Edit the docker-compose.yml to include below statements:

```
services:
  dynamodb-local:
    # https://stackoverflow.com/questions/67533058/persist-local-dynamodb-data-in-volumes-lack-permission-unable-to-open-databa
    # We needed to add user:root to get this working.
    user: root
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath ./data"
    image: "amazon/dynamodb-local:latest"
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    volumes:
      - "./docker/dynamodb:/home/dynamodblocal/data"
    working_dir: /home/dynamodblocal
```


### Postgres 
```
services:
  db:
    image: postgres:13-alpine
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - '5432:5432'
    volumes: 
      - db:/var/lib/postgresql/data
volumes:
  db:
    driver: local

```

#### Install postgres client

```
  - name: postgres
    init: |
      curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc|sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
      echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" |sudo tee  /etc/apt/sources.list.d/pgdg.list
      sudo apt update
      sudo apt install -y postgresql-client-13 libpq-dev
  ```

## Here is a working screenshot of notifications tab
![Notifications page working!](assets/notifications.png)

# Issues faced

1. Unable to connect to postgres using Postgres client
  
I faced an issue here while installing the postgres extension in gitpod. I am getting connection timeout error while trying to connect to postgres after starting it up and adding it as a part of docker-compose.yml.
It is working from the CLI. I have verified that the port is opened from the lock sign
![Port open](assets/postgres_port_open.png)

After a bit of debugging i found out that i was selecting the MySQL tab which is the default selected tab in database explorer. once i selected correct tab the DB was connected. Below is the screenshot:
![Finally it is working](assets/postgres_working_client.png)


  No other challenge was faced.
  
# Homework challenge

### Push a new image to Docker Hub

#### Issues faced during homework challenge
1. Unable to find where is docker image stored -- Finally after research found that docker images are available with docker command and did docker image ls
2. While trying to push the image I got an error: "denied: requested access to the resource is denied" - read mutliple articles and found that to be able to push to docker hub i need to tag the image properly first.

Finally tagged the image using docker tag image_name MYDOCKERHUBUSERNAME/image_name and was able to push the image to docker hub



```
data % docker image ls
REPOSITORY                                                  TAG           IMAGE ID       CREATED       SIZE
aws-bootcamp-cruddur-2023-week-1-spurin-frontend-react-js   latest        b6ad666fe0cc   2 hours ago   1.19GB
aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask       latest        5bffe647b1c9   2 hours ago   130MB
owensound_first_image                                       first_image   5bffe647b1c9   2 hours ago   130MB
postgres                                                    13-alpine     55f14697b527   2 weeks ago   238MB
amazon/dynamodb-local                                       latest        904626f640dc   3 weeks ago   499MB
data % docker tag aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask behlkush/aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask 
data % docker image ls
REPOSITORY                                                       TAG           IMAGE ID       CREATED       SIZE
aws-bootcamp-cruddur-2023-week-1-spurin-frontend-react-js        latest        b6ad666fe0cc   2 hours ago   1.19GB
behlkush/aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask   latest        5bffe647b1c9   2 hours ago   130MB
aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask            latest        5bffe647b1c9   2 hours ago   130MB
owensound_first_image                                            first_image   5bffe647b1c9   2 hours ago   130MB
postgres                                                         13-alpine     55f14697b527   2 weeks ago   238MB
amazon/dynamodb-local                                            latest        904626f640dc   3 weeks ago   499MB
data % docker push behlkush/aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask
Using default tag: latest
The push refers to repository [docker.io/behlkush/aws-bootcamp-cruddur-2023-week-1-spurin-backend-flask]
2ce63b6cdc08: Pushed 
07773dd7871d: Pushed 
54bc6ff7e5e7: Pushed 
d9b5bdda2cb0: Pushed 
4358fe544125: Pushed 
53b2529dfca9: Pushed 
5be8f6899d42: Pushed 
8d60832b730a: Pushed 
63b3cf45ece8: Pushed 
latest: digest: sha256:39ac4e67f0a0544e7029ee698e452af222f86d00bbcd0991d489383c1dcc5142 size: 2203
data % 
```

Here is the image on my docker hub account:
![Docker hub image](assets/docker_hub_image.png)


# Code changes

## Notifications page changes

### Backend
1. Added notifications entry into openapi.yml
2. app.py updated to include a route/api  to notifications page
3. New service created with notifications_activities.py

### Frontend
1. App.js --> Updated to include Notification page
2. NotificationFeedPage java script and css pages added to show the frontend notifications page
