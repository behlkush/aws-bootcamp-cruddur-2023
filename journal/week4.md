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

