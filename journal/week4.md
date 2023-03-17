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
```






# Issues
psql command not found even when psql container is loaded and running. Seems to be a path issue.  - It was not a path issue. I checked .gitpod.yml and it had the psql entry to install and configure psql.

I hardcoded the CONNECTION_URL value in docker-compose.yml and that fixed the issue.




