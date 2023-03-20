# Week 4 — Postgres and RDS

### Create database instance in AWS from CLI

```
aws rds create-db-instance \
  --db-instance-identifier cruddur-db-instance \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version  14.6 \
  --master-username cruddurroot \
  --master-user-password MY_DB_PASSWORD \
  --allocated-storage 20 \
  --availability-zone ca-central-1a \
  --backup-retention-period 0 \
  --port 5432 \
  --no-multi-az \
  --db-name cruddur \
  --storage-type gp2 \
  --publicly-accessible \
  --storage-encrypted \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --no-deletion-protection
```
Then stopped the instance for now.


## PostGres on gitpod 

Come back and start docker on gitpod and that should run the PostGres container as well.

### Create a database
```
CREATE database cruddur;
postgres=# CREATE database cruddur;
CREATE DATABASE
postgres=# \l
                                 List of databases
   Name    |  Owner   | Encoding |  Collate   |   Ctype    |   Access privileges   
-----------+----------+----------+------------+------------+-----------------------
 cruddur   | postgres | UTF8     | en_US.utf8 | en_US.utf8 | 
 postgres  | postgres | UTF8     | en_US.utf8 | en_US.utf8 | 
 template0 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.utf8 | en_US.utf8 | =c/postgres          +
           |          |          |            |            | postgres=CTc/postgres
(4 rows)
```

Confirm that the new db is created.

### Set up schema
Next up we need to set up some tables in this database.



### UUID Generation
We need a UUID extension to generate unique random user Ids.

```
CREATE EXTENSION "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```
Use second one because the script might be run again and again

Now to import this schema.sql into your psql - quit the prompt and then run :
```
psql cruddur < db/schema.sql -h localhost -U postgres
```

Ran the command
```
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ psql cruddur < db/schema.sql -h localhost -U postgres
bash: db/schema.sql: No such file or directory
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ cd backend-flask/
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ psql cruddur < db/schema.sql -h localhost -U postgres
Password for user postgres: 
CREATE EXTENSION
```

#### Connection URL

```
export CONNECTION_URL="postgresql://postgres:password@localhost:5432/cruddur"
```
And then login:

```
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ psql $CONNECTION_URL
psql (13.10 (Ubuntu 13.10-1.pgdg20.04+1))
Type "help" for help.

cruddur=# \q
```

Now set the env to persist:
```
gp env CONNECTION_URL="postgresql://postgres:password@localhost:5432/cruddur"
```

Now set up AWS RDS instances environment variable so that you don't forget it.
```
export PROD_CONNECTION_URL="postgresql://postgres:DBPWD@cruddur-db-instance.ctdwflxvg5gi.ca-central-1.rds.amazonaws.com:5432/cruddur"
gp env PROD_CONNECTION_URL="postgresql://postgres:DBPWD@cruddur-db-instance.ctdwflxvg5gi.ca-central-1.rds.amazonaws.com:5432/cruddur"
```

### Create bash scripts

Created 3 bash scripts and changed permissions of them to be able to execute them.

```
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ chmod -R u+x bin/db*
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ ls -lrt bin/
total 12
-rwxr--r-- 1 gitpod gitpod 17 Mar 14 21:33 db-schema-load
-rwxr--r-- 1 gitpod gitpod 17 Mar 14 21:33 db-create
-rwxr--r-- 1 gitpod gitpod 66 Mar 14 21:37 db-drop
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-fl
```

Tried to drop the cruddur DB but got error:
```
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ ./bin/db-drop 
ERROR:  cannot drop the currently open database
```
Finally after editing using sed, it started working:
```
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ ./bin/db-drop 
DROP DATABASE
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ 
```

My Drop sql was still not working because i had spaces in between like this below:
```
NO_DB_CONNECTION_URL = $(sed 's/\/cruddur//g' <<<"$CONNECTION_URL")
```


#### Create database using bash:
```
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ ./bin/db-create 
db-create
psql: error: connection to server at "localhost" (::1), port 5432 failed: FATAL:  database "cruddur" does not exist
gitpod /workspace/aws-bootcamp-cruddur-2023/backend-flask (main) $ ./bin/db-create 
db-create
CREATE DATABASE
```

### Load Schema

In db-schema-load script i added (backend-flask) below to make it work 
```
schema_path=$(realpath .)/backend-flask/db/schema.sql
```

And then ran the script from base path:

```
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ backend-flask/bin/db-schema-load 
db-schema-load
backend-flask/bin/db-schema-load: line 6: /workspace/aws-bootcamp-cruddur-2023/db/schema.sql: No such file or directory
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ cat /workspace/aws-bootcamp-cruddur-2023/db/schema.sql
cat: /workspace/aws-bootcamp-cruddur-2023/db/schema.sql: No such file or directory
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ backend-flask/bin/db-schema-load 
db-schema-load
CREATE EXTENSION
```

### Next updated the db-schema-load script to use environment variabled to determing prod and also set colours in echo 

```
CYAN='\033[1;36m'
NO_COLOR='\033[0m'
LABEL="db-schema-load"
printf "${CYAN}== ${LABEL}${NO_COLOR}\n"
```

### Create tables

https://www.postgresql.org/docs/current/sql-createtable.html


Make sure that create table always passes:
```
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.activities;
```

```
CREATE TABLE public.users (
  uuid UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  display_name text,
  handle text,
  cognito_user_id text,
  created_at TIMESTAMP default current_timestamp NOT NULL
);
```

```
CREATE TABLE public.activities (
  uuid UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message text NOT NULL,
  replies_count integer DEFAULT 0,
  reposts_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  reply_to_activity_uuid integer,
  expires_at TIMESTAMP,
  created_at TIMESTAMP default current_timestamp NOT NULL
);
```

Create script to connect and then check if the tables created above exist

```
gitpod /workspace/aws-bootcamp-cruddur-2023 (main) $ ./backend-flask/bin/db-connect
== db-connect
psql (13.10 (Ubuntu 13.10-1.pgdg20.04+1))
Type "help" for help.

cruddur=# \dl
      Large objects
 ID | Owner | Description 
----+-------+-------------
(0 rows)

cruddur=# \dt
           List of relations
 Schema |    Name    | Type  |  Owner   
--------+------------+-------+----------
 public | activities | table | postgres
 public | users      | table | postgres
(2 rows)
```

Add data to tables usind seed bash script and add the below in seed.sql
```
-- this file was manually created
INSERT INTO public.users (display_name, handle, cognito_user_id)
VALUES
  ('Andrew Brown', 'andrewbrown' ,'MOCK'),
  ('Owen Sound', 'owensound' ,'MOCK'),
  ('Andrew Bayko', 'bayko' ,'MOCK');

INSERT INTO public.activities (user_uuid, message, expires_at)
VALUES
  (
    (SELECT uuid from public.users WHERE users.handle = 'owensound' LIMIT 1),
    'This was imported as seed data!',
    current_timestamp + interval '10 day'
  )
```

Updates schema.sql to include: this is to fix the error we are getting related to uuid
```
user_uuid UUID NOT NULL,
```


Check the table contents by connecting to DB using the connect bash script
```
cruddur=# SELECT * FROM activities;
cruddur=# \x ON
Expanded display is on.
cruddur=# SELECT * FROM activities;
-[ RECORD 1 ]----------+-------------------------------------
uuid                   | d5baf2e3-3ad4-446e-ab36-a6f12ee59958
user_uuid              | 97a771f3-98eb-452d-83e5-7388a1c76729
message                | This was imported as seed data!
replies_count          | 0
reposts_count          | 0
likes_count            | 0
reply_to_activity_uuid | 
expires_at             | 2023-03-25 17:28:48.076099
created_at             | 2023-03-15 17:28:48.076099
```

you can use \x auto as well to display the table contents in readable format.


### Easy database set up using db-setup script
```
#! /usr/bin/bash
-e # stop if it fails at any point

CYAN='\033[1;36m'
NO_COLOR='\033[0m'
LABEL="db-setup"
printf "${CYAN}==== ${LABEL}${NO_COLOR}\n"

bin_path=$(realpath .)/backend-flask/bin


source "$bin_path/db-drop"
source "$bin_path/db-create"
source "$bin_path/db-schema-load"
source "$bin_path/db-seed"
```


### Install postgres driver

Drivers are needed to make it work with the underlying hardware. We are only using software here but we need to make postgres work with python.
So we are looking to install python driver for postgres

```
psycopg[binary]
psycopg[pool]
```
The library documentation can be found here: https://www.psycopg.org/psycopg3/

Next run
```
pip install -r requirements.txt
```

We will be using connection pooling because we are working with multiple DB connections. And there is a certain number of DB connections a DB can handle.
That's where connection pools come in handy. Idea is to re-use connections as users are coming and hitting your database.

## DB Object and connection pool

Create db.py in lib dir in backend app:

```
from psycopg_pool import ConnectionPool
import os

def query_wrap_object(template):
  sql = '''
  (SELECT COALESCE(row_to_json(object_row),'{}'::json) FROM (
  {template}
  ) object_row);
  '''

def query_wrap_array(template):
  sql = '''
  (SELECT COALESCE(array_to_json(array_agg(row_to_json(array_row))),'[]'::json) FROM (
  {template}
  ) array_row);
  '''

connection_url = os.getenv("CONNECTION_URL")
pool = ConnectionPool(connection_url)
```

Update docker compose to include
```
CONNECTION_URL: ${CONNECTION_URL}
```


# Update HomeActivities.py to use psql instead of hardcoding the return values
```
SELECT
        activities.uuid,
        users.display_name,
        users.handle,
        activities.message,
        activities.replies_count,
        activities.reposts_count,
        activities.likes_count,
        activities.reply_to_activity_uuid,
        activities.expires_at,
        activities.created_at
      FROM public.activities
      LEFT JOIN public.users ON users.uuid = activities.user_uuid
      ORDER BY activities.created_at DESC
```

Also updated db.py to fix the traps.

##### The SQL query is finally working and home activities is now showing data by fetching it from the psql database


## Connect to AWS RDS instance.

Update the security group IDs because they will be needed everytime gitpod restarts. Gitpod will have a new public IP so SG needs to be updated everytime.

Get public IP of gitpod:
```
GITPOD_IP=$(curl ifconfig.me)
```

```
export DB_SG_ID="sg-0b725ebab7e25635e"
gp env DB_SG_ID="sg-0b725ebab7e25635e"
export DB_SG_RULE_ID="sgr-02fdf9dac5ce5c837"
gp env DB_SG_RULE_ID="sgr-02fdf9dac5ce5c837"
```

Add the new rule:
```
aws ec2 modify-security-group-rules \
    --group-id $DB_SG_ID \
    --security-group-rules "SecurityGroupRuleId=$DB_SG_RULE_ID,SecurityGroupRule={Description=GITPOD,IpProtocol=tcp,FromPort=5432,ToPort=5432,CidrIpv4=$GITPOD_IP/32}"
```

Add above code in a script: rds-sg-rule-update and then make it run everytime by adding the commands below in .gitpod.yml file

```
    command: |
      export GITPOD_IP=$(curl ifconfig.me)
      source "$THEIA_WORKSPACE_ROOT/backend-flask/bin/rds-update-sg-rule"
```
Note: I have added the bin to correct path already.


# Lambda Post Confirmaton

- Created a Lambda function with python 3.8 and called it cruddur-post-confirmation
Code for function
```
import json
import psycopg2

def lambda_handler(event, context):
    user = event['request']['userAttributes']
    user_display_name = user['name']
    user_email = user['email']
    user_handle = user['preferred_username']
    user_cognito_id = user['sub']
    try:
        #conn = psycopg2.connect(
#             host=(os.getenv('PG_HOSTNAME')),
#             database=(os.getenv('PG_DATABASE')),
#             user=(os.getenv('PG_USERNAME')),
#             password=(os.getenv('PG_SECRET'))
#         )
        conn = psycopg2.connect(os.getenv('CONNECTION_URL'))
        cur = conn.cursor()

        sql = f"""
        INSERT INTO users (
        display_name, 
        email,
        handle, 
        cognito_user_id) 
        VALUES(
        {user_display_name}, 
        {user_email}, 
        {user_handle},
        {user_cognito_id})
        """
        cur.execute(sql)
        conn.commit() 

    except (Exception, psycopg2.DatabaseError) as error:
        print(error)
        
    finally:
        if conn is not None:
            cur.close()
            conn.close()
            print('Database connection closed.')

    return event
```
Add CONNECTION_URL environment variable under configuration.

Next added a layer:
```
arn:aws:lambda:ca-central-1:898466741470:layer:psycopg2-py38:1

```

Added lambda permission to execute VPC by creating a policy and attaching it to the lambda
AWSLambdaVPCAccessExecutionRole

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeNetworkInterfaces",
                "ec2:CreateNetworkInterface",
                "ec2:AttachNetworkInterface"
            ],
            "Resource": "*"
        }
    ]
}
```

# Taste of Success
cruddur=> select * from users;
-[ RECORD 1 ]---+-------------------------------------
uuid            | ecf4bf20-ab98-4bc5-8ddd-e356322bffd1
display_name    | kush behl
email           | kushbehl@gmail.com
handle          | kushbehl
cognito_user_id | 42cac012-4ec3-4001-b857-b44ddfb8cd54
created_at      | 2023-03-17 20:34:48.925093
-[ RECORD 2 ]---+-------------------------------------
uuid            | 8e73a490-1b69-4564-bd9f-9c187a8a9057
display_name    | kiaan behl
email           | behlkiaan@gmail.com
handle          | owensound
cognito_user_id | 4b0b8699-4a3c-460a-9fb7-7546d2287064
created_at      | 2023-03-17 20:39:32.308119


# Create activity changes
- Modularized DB.py
- Added SQL / Activities folder and added mulitple SQL query files there
- Updated home activities and create activity service to use this templatized version of DB with the psycopg library

# Issues
1. psql command not found even when psql container is loaded and running. Seems to be a path issue.  - It was not a path issue. I checked .gitpod.yml and it had the psql entry to install and configure psql.

I hardcoded the CONNECTION_URL value in docker-compose.yml and that fixed the issue.


2. Another issue i faced is while trying to execute permissions on SG rule for AWS RDS. My code was not executing correctly and GITPOD_IP was not getting exported. It was because of an identation issue. On fixing the identation in .gitpod.yml file it worked.

3. Another issue i faced is that the PROD_CONNECTION_URL was not set to have the correct username. I fixed that and it started connecting to AWS RDS.

4. Spent hours fixing this one. I was not able to see users in the actual cruddur AWS RDS instance even after fixing all errors in the post confirmation lamda. However, was able to fix it after persisting and matching the display name setting and adding email in the db schema and loading it.
i had double quotes instead of single quotes below:
```
VALUES('{user_display_name}', '{user_email}', '{user_handle}', '{user_cognito_id}')
```
