# Week 5 — DynamoDB and Serverless Caching

## Starting DDB week - First I have gone through the initial video on data model design of our DDB tables.

A few key points to note:

- Dynamo DB Important questions before using

  - What data do I need to store
  - When do I need it
  - And how quickly do I need it

- What are my access patterns

  - For our use case, we want to be able to show the most recent message groups and the name of the person whom the conversation is going on
  - And we want it sorted in descending time to show most recent
  - How often I am doing it

- In NoSQL DBs we are modeling our data as per

  - How my application will be using it
  - How my users will be using it
  - What kind of reporting we will be doing
  - What are my access patterns
  - How are you going to interact with your data

In Relational DBs we are modeling tables as Database wants it.

**Data Model Design**
![Data Model Design](assets/week5/data_model.png)

# DynamoDB Begins

- First of all I enabled Dynamo DB portion in docker-compose.yml

```
  dynamodb-local:
  #   # https://stackoverflow.com/questions/67533058/persist-local-dynamodb-data-in-volumes-lack-permission-unable-to-open-databa
  #   # We needed to add user:root to get this working.
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
