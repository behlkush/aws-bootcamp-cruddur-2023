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

# Environment changes required at my end because I am running everything locally

### DynamoDB Begins

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

### Next I set up the psql related changes to my .devcontainer.json file

```
    },
    "5432": {
      "label": "postgres",
      "onAutoForward": "notify"
    },
    "8000": {
      "label": "DynamoDB",
      "onAutoForward": "notify"
    }
  },
```

Added above 2 ports in the list

#### Work on restructuring and modifying existing db bash scripts and new ddb bash scripts

- Existing scripts moved to a new folder db and there realpath modified to pick up all scripts correctly --> Example below

```
schema_path=$(realpath ../../)/db/schema.sql
```

- Also modified the local psql with the new seed data and for that modified the seed.sql to:

```
-- this file was manually created
INSERT INTO public.users (display_name, email, handle, cognito_user_id)
VALUES
  ('Kiaan Behl', 'behlkiaan@gmail.com', 'behlkiaan' ,'MOCK'),
  ('Owen Sound', 'kushbehl@gmail.com', 'owensound' ,'MOCK');

INSERT INTO public.activities (user_uuid, message, expires_at)
VALUES
  (
    (SELECT uuid from public.users WHERE users.handle = 'owensound' LIMIT 1),
    'This was imported as seed data!',
    current_timestamp + interval '10 day'
  )
```

Note that above command was failing without email entry (as we had modified the schema to have NOT NULL)

- Next moved on to create ddb scripts.
  **seed script**:

  - Did a bit of clean code approach and created a conversations.txt and reading conversation from that instead of directly having it
    hardcoded in the python bash script. I do it using the below code:

    ```
    with open("conversation.txt", "r") as file:
    lines = file.readlines()
    ```

    - I also have a smart logic to detect prod in the passed argument in seed script

    ```
          # unset endpoint url for use with production database
          if "prod" in sys.argv:
            attrs = {}
    ```

- Made all the updates in the seed and got it working.
- Andrew's key point about batch updates: it can result in cost savings when we seed data into production (only if we intended to
  do a seed in prod). Dynamo DB can be a costly affair if we do RCUs and WCUs inefficiently.

#### Starting work on ddb.py

- Before this i have gone ahead and updated drop shell script with:

```
psql $NO_DB_CONNECTION_URL -c "drop database IF EXISTS cruddur;"
```

Then created ddb.py under lib:

```


import boto3
import sys
from datetime import datetime, timedelta, timezone
import uuid
import os

class Ddb:
  def client():
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    if endpoint_url:
      attrs = { 'endpoint_url': endpoint_url }
    else:
      attrs = {}
    dynamodb = boto3.client('dynamodb',**attrs)
    return dynamodb
```

- Next I added the list message groups to the class:

```
def list_message_groups(client,my_user_uuid):
    table_name = 'cruddur-messages'
    query_params = {
      'TableName': table_name,
      'KeyConditionExpression': 'pk = :pkey',
      'ScanIndexForward': False,
      'Limit': 20,
      'ExpressionAttributeValues': {
        ':pkey': {'S': f"GRP#{my_user_uuid}"}
      }
    }
    print('query-params')
    print(query_params)
    print('client')
    print(client)

    # query the table
    response = client.query(**query_params)
    items = response['Items']

    results = []
    for item in items:
      last_sent_at = item['sk']['S']
      results.append({
        'uuid': item['message_group_uuid']['S'],
        'display_name': item['user_display_name']['S'],
        'handle': item['user_handle']['S'],
        'message': item['message']['S'],
        'created_at': last_sent_at
      })
    return results
```

#### Get list of cognito users

- created a new file called list-users under a new folder bin/cognito
- this script fetches the users list from cognito user pool

```
#!/usr/bin/env python3

import boto3
import os
import json

userpool_id = os.getenv("AWS_COGNITO_USER_POOL_ID")
client = boto3.client('cognito-idp')
params = {
  'UserPoolId': userpool_id,
  'AttributesToGet': [
      'preferred_username',
      'sub'
  ]
}
response = client.list_users(**params)
users = response['Users']

print(json.dumps(users, sort_keys=True, indent=2, default=str))

dict_users = {}
for user in users:
  attrs = user['Attributes']
  sub    = next((a for a in attrs if a["Name"] == 'sub'), None)
  handle = next((a for a in attrs if a["Name"] == 'preferred_username'), None)
  dict_users[handle['Value']] = sub['Value']

print(json.dumps(dict_users, sort_keys=True, indent=2, default=str))
```

- Also need to do chmod u+x on it.


#### New script update_cognito_user_ids -- I created it under cognito folder because i feel it is cognito related

```
#!/usr/bin/env python3

import boto3
import os
import sys

print("== db-update-cognito-user-ids")

current_path = os.path.dirname(os.path.abspath(__file__))
parent_path = os.path.abspath(os.path.join(current_path, '..', '..'))
sys.path.append(parent_path)
from lib.db import db

def update_users_with_cognito_user_id(handle,sub):
  sql = """
    UPDATE public.users
    SET cognito_user_id = %(sub)s
    WHERE
      users.handle = %(handle)s;
  """
  db.query_commit(sql,{
    'handle' : handle,
    'sub' : sub
  })

def get_cognito_user_ids():
  userpool_id = os.getenv("AWS_COGNITO_USER_POOL_ID")
  client = boto3.client('cognito-idp')
  params = {
    'UserPoolId': userpool_id,
    'AttributesToGet': [
        'preferred_username',
        'sub'
    ]
  }
  response = client.list_users(**params)
  users = response['Users']
  dict_users = {}
  for user in users:
    attrs = user['Attributes']
    sub    = next((a for a in attrs if a["Name"] == 'sub'), None)
    handle = next((a for a in attrs if a["Name"] == 'preferred_username'), None)
    dict_users[handle['Value']] = sub['Value']
  return dict_users


users = get_cognito_user_ids()

for handle, sub in users.items():
  print('----',handle,sub)
  update_users_with_cognito_user_id(
    handle=handle,
    sub=sub
  )
```

- This script will update the user-ids for my local psql database. My RDS is already updated with correct cognito user IDs
```
bootcamp@2e2d5a67ee35:/workspaces/aws-bootcamp-cruddur-2023$ backend-flask/bin/cognito/update_cognito_user_ids 
== db-update-cognito-user-ids
Connection URL is: postgresql://postgres:password@localhost:5432/cruddur
---- owensound 5cf80e10-104e-4c75-af80-aa88d5811dc9
 SQL STATEMENT-[commit with returning]------

    UPDATE public.users
    SET cognito_user_id = %(sub)s
    WHERE
      users.handle = %(handle)s;
   {'handle': 'owensound', 'sub': '5cf80e10-104e-4c75-af80-aa88d5811dc9'}
---- behlkiaan e49b8604-1b9d-483d-92f1-742f8d96de73
 SQL STATEMENT-[commit with returning]------

    UPDATE public.users
    SET cognito_user_id = %(sub)s
    WHERE
      users.handle = %(handle)s;
   {'handle': 'behlkiaan', 'sub': 'e49b8604-1b9d-483d-92f1-742f8d96de73'}
```

- As shown above the script executed successfully and I can see the updated cognito user ids in my local psql db table users
```
                 uuid                 | display_name |        email        |  handle   |           cognito_user_id            |         created_at         
--------------------------------------+--------------+---------------------+-----------+--------------------------------------+----------------------------
 382146bb-429a-45a1-801d-e75a1a16fc9d | Owen Sound   | kushbehl@gmail.com  | owensound | 5cf80e10-104e-4c75-af80-aa88d5811dc9 | 2023-03-27 21:17:04.093389
 ec3c00e4-1216-4840-813d-c6cf2d8514e8 | Kiaan Behl   | behlkiaan@gmail.com | behlkiaan | e49b8604-1b9d-483d-92f1-742f8d96de73 | 2023-03-27 21:17:04.093389
(2 rows)
```

### Update app.py to use hanlde by fetching it from the cognito user id.


- Next updated message_groups.py
```
from datetime import datetime, timedelta, timezone

from lib.ddb import Ddb
from lib.db import db

class MessageGroups:
  def run(cognito_user_id):
    model = {
      'errors': None,
      'data': None
    }

    sql = db.template('users','uuid_from_cognito_user_id')
    my_user_uuid = db.query_value(sql,{
      'cognito_user_id': cognito_user_id
    })

    print(f"UUID: {my_user_uuid}")

    ddb = Ddb.client()
    data = Ddb.list_message_groups(ddb, my_user_uuid)
    print("list_message_groups:",data)

    model['data'] = data
    return model
```

- Above script was updated so that the value for message groups UUIDs are not hardcoded

- To make this db.template above work, created a new script: uuid_from_cognito_user_id.sql under db/sql/activities/users
```
Run SQL
SELECT
  users.uuid
FROM public.users
WHERE 
  users.cognito_user_id = %(cognito_user_id)s
LIMIT 1
```

### Front end Updates
- The above changes mean that the front end needs to be modified as well, now that Message Group and Messages Group pages
have bearer tokens.
Files updated: HomeFeedPage.js, MessageGroupPage.js, MessageGroupsPage.js
Content added:
```
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
```

- Now that we are not using cookies, so separate out the checkAuth logic from HomeFeedPage.js into its own file
Created a new file CheckAuth.js under frontend-react-js/src/lib

```
// Amplify code -----
import { Auth } from 'aws-amplify';

// check if we are authenicated
const checkAuth = async (setUser) => {
  Auth.currentAuthenticatedUser({
    // Optional, By default is false. 
    // If set to true, this call will send a 
    // request to Cognito to get the latest user data
    bypassCache: false
  })
    .then((user) => {
      console.log('user', user);
      return Auth.currentAuthenticatedUser()
    }).then((cognito_user) => {
      setUser({
        display_name: cognito_user.attributes.name,
        handle: cognito_user.attributes.preferred_username
      })
    })
    .catch((err) => console.log(err));
};

export default checkAuth;
```

- Back in HomeFeedPage.js, MessageGroupsPage.js and MessageGroupPage.js deleted the checkAuth function definition and instead called it as shown below
```
import checkAuth from '../lib/CheckAuth';
// And then updated the call to checkAuth and passed setUser along
    checkAuth(setUser);
```

## Backend udpate in ddb.py
```
current_year = datetime.now().year
'KeyConditionExpression': 'pk = :pk AND begins_with(sk,:year)',
      'ExpressionAttributeValues': {
        ':year': {'S': str(current_year)},
```

## Frontend update in messageGroupItem.js
```
if (params.message_group_uuid == props.message_group.uuid) {
<Link className={classes()} to={`/messages/@` + props.message_group.uuid}>
```

## Backend change app.py to handle message group showing
- Updated all of data_create_message method
```
@app.route("/api/messages", methods=['POST', 'OPTIONS'])
@cross_origin()
def data_create_message():
    message = request.json['message']
    # We have None as default here because these params are optional and 
    # might not be present in the request
    message_group_uuid   = request.json.get('message_group_uuid', None)
    user_receiver_handle = request.json.get('handle', None)
    access_token = extract_access_token(request.headers)
    try:
        claims = cognito_jwt_token.verify(access_token)
        # authenicatied request
        app.logger.debug("authenicated")
        app.logger.debug(claims)
        cognito_user_id = claims['sub']
        if message_group_uuid == None:
            # Create for the first time
            model = CreateMessage.run(
            mode="create",
            message=message,
            cognito_user_id=cognito_user_id,
            user_receiver_handle=user_receiver_handle
            )
        else:
            # Push onto existing Message Group
            model = CreateMessage.run(
            mode="update",
            message=message,
            message_group_uuid=message_group_uuid,
            cognito_user_id=cognito_user_id
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

## New mock user added in local psql DB
```
INSERT INTO public.users (display_name, email, handle, cognito_user_id)
VALUES  ('Londo Mollari', 'lmollari@centari.com', 'londo' ,'MOCK');
```


## Back into app.py to create a new api endpoint for short
```
from services.users_short import *
@app.route("/api/users/@<string:handle>/short", methods=['GET'])
def data_users_short(handle):
  data = UsersShort.run(handle)
  return data, 200
```

- Also created a new endpoint python file users_short.py
```
from lib.db import db

class UsersShort:
  def run(handle):
    sql = db.template('users','short')
    results = db.query_object_json(sql,{
      'handle': handle
    })
    return results
```

### new sql file created short.sql
```
SELECT
  users.uuid,
  users.handle,
  users.display_name
FROM public.users
WHERE 
  users.handle = %(handle)s
```


# Update Frontend to cater to this new endpoint
- MessageGroupFeed.js
```
import './MessageGroupFeed.css';
import MessageGroupItem from './MessageGroupItem';
import MessageGroupNewItem from './MessageGroupNewItem';

export default function MessageGroupFeed(props) {
  let message_group_new_item;
  if (props.otherUser) {
    message_group_new_item = <MessageGroupNewItem user={props.otherUser} />
  }

  return (
    <div className='message_group_feed'>
      <div className='message_group_feed_heading'>
        <div className='title'>Messages</div>
      </div>
      <div className='message_group_feed_collection'>
        {message_group_new_item}
        {props.message_groups.map(message_group => {
          return <MessageGroupItem key={message_group.uuid} message_group={message_group} />
        })}
      </div>
    </div>
  );
}
```

- Another new Js script created called MessageGroupNewPage.js
```
import './MessageGroupPage.css';
import React from "react";
import { useParams } from 'react-router-dom';

import DesktopNavigation from '../components/DesktopNavigation';
import MessageGroupFeed from '../components/MessageGroupFeed';
import MessagesFeed from '../components/MessageFeed';
import MessagesForm from '../components/MessageForm';
import checkAuth from '../lib/CheckAuth';

export default function MessageGroupPage() {
  const [otherUser, setOtherUser] = React.useState([]);
  const [messageGroups, setMessageGroups] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [popped, setPopped] = React.useState([]);
  const [user, setUser] = React.useState(null);
  const dataFetchedRef = React.useRef(false);
  const params = useParams();

  const loadUserShortData = async () => {
    try {
      const backend_url = `${process.env.REACT_APP_BACKEND_URL}/api/users/@${params.handle}/short`
      const res = await fetch(backend_url, {
        method: "GET"
      });
      let resJson = await res.json();
      if (res.status === 200) {
        console.log('other user:', resJson)
        setOtherUser(resJson)
      } else {
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  };

  const loadMessageGroupsData = async () => {
    try {
      const backend_url = `${process.env.REACT_APP_BACKEND_URL}/api/message_groups`
      const res = await fetch(backend_url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        method: "GET"
      });
      let resJson = await res.json();
      if (res.status === 200) {
        setMessageGroups(resJson)
      } else {
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  };

  React.useEffect(() => {
    //prevents double call
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    loadMessageGroupsData();
    loadUserShortData();
    checkAuth(setUser);
  }, [])
  return (
    <article>
      <DesktopNavigation user={user} active={'home'} setPopped={setPopped} />
      <section className='message_groups'>
        <MessageGroupFeed otherUser={otherUser} message_groups={messageGroups} />
      </section>
      <div className='content messages'>
        <MessagesFeed messages={messages} />
        <MessagesForm setMessages={setMessages} />
      </div>
    </article>
  );
}
```

- And back in App.js make changes:
```
import MessageGroupNewPage from './pages/MessageGroupNewPage';
  {
    path: "/messages/new/:handle",
    element: <MessageGroupNewPage />
  },
```

- Created new trimmed down version of MessageGroupItem js file called MessageGroupNewItem.js
```
import './MessageGroupItem.css';
import { Link } from "react-router-dom";

export default function MessageGroupNewItem(props) {
  return (

    <Link className='message_group_item active' to={`/messages/new/` + props.user.handle}>
      <div className='message_group_avatar'></div>
      <div className='message_content'>
        <div className='message_group_meta'>
          <div className='message_group_identity'>
            <div className='display_name'>{props.user.display_name}</div>
            <div className="handle">@{props.user.handle}</div>
          </div>{/* activity_identity */}
        </div>{/* message_meta */}
      </div>{/* message_content */}
    </Link>
  );
}
```

- Updated MessageForm.js
```
import './MessageForm.css';
import React from "react";
import process from 'process';
import { json, useParams } from 'react-router-dom';

export default function ActivityForm(props) {
  const [count, setCount] = React.useState(0);
  const [message, setMessage] = React.useState('');
  const params = useParams();

  const classes = []
  classes.push('count')
  if (1024 - count < 0) {
    classes.push('err')
  }

  const onsubmit = async (event) => {
    event.preventDefault();
    try {
      const backend_url = `${process.env.REACT_APP_BACKEND_URL}/api/messages`
      console.log('onsubmit payload', message)
      let json = { 'message': message }
      if (params.handle) {
        json.handle = params.handle
      } else {
        json.message_group_uuid = params.message_group_uuid
      }

      const res = await fetch(backend_url, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)
      });
      let data = await res.json();
      if (res.status === 200) {
        console.log('data:', data)
        if (data.message_group_uuid) {
          console.log('redirect to message group')
          window.location.href = `/messages/${data.message_group_uuid}`
        } else {
          props.setMessages(current => [...current, data]);
        }
      } else {
        console.log(res)
      }
    } catch (err) {
      console.log(err);
    }
  }

  const textarea_onchange = (event) => {
    setCount(event.target.value.length);
    setMessage(event.target.value);
  }

  return (
    <form
      className='message_form'
      onSubmit={onsubmit}
    >
      <textarea
        type="text"
        placeholder="send a direct message..."
        value={message}
        onChange={textarea_onchange}
      />
      <div className='submit'>
        <div className={classes.join(' ')}>{1024 - count}</div>
        <button type='submit'>Message</button>
      </div>
    </form>
  );
}
```

# Implementing DDB Streams

#### Create table in prod Dynamo db
```
bootcamp@e7dca389ea0e:/workspaces/aws-bootcamp-cruddur-2023/backend-flask/bin/ddb$ ./schema-load prod
{'TableDescription': {'AttributeDefinitions': [{'AttributeName': 'pk', 'AttributeType': 'S'}, {'AttributeName': 'sk', 'AttributeType': 'S'}], 'TableName': 'cruddur-messages', 'KeySchema': [{'AttributeName': 'pk', 'KeyType': 'HASH'}, {'AttributeName': 'sk', 'KeyType': 'RANGE'}], 'TableStatus': 'CREATING', 'CreationDateTime': datetime.datetime(2023, 3, 30, 20, 42, 47, 638000, tzinfo=tzlocal()), 'ProvisionedThroughput': {'NumberOfDecreasesToday': 0, 'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}, 'TableSizeBytes': 0, 'ItemCount': 0, 'TableArn': 'arn:aws:dynamodb:ca-central-1:342196396576:table/cruddur-messages', 'TableId': '02edc70a-85b0-486b-9bf6-4ae63b9694d8', 'DeletionProtectionEnabled': False}, 'ResponseMetadata': {'RequestId': '4DNPF5MM37MV82OUVF9IK5K6KRVV4KQNSO5AEMVJF66Q9ASUAAJG', 'HTTPStatusCode': 200, 'HTTPHeaders': {'server': 'Server', 'date': 'Thu, 30 Mar 2023 20:42:47 GMT', 'content-type': 'application/x-amz-json-1.0', 'content-length': '613', 'connection': 'keep-alive', 'x-amzn-requestid': '4DNPF5MM37MV82OUVF9IK5K6KRVV4KQNSO5AEMVJF66Q9ASUAAJG', 'x-amz-crc32': '949097083'}, 'RetryAttempts': 0}}
bootcamp@e7dca389ea0e:/workspaces/aws-bootcamp-cruddur-2023/backend-flask/bin/ddb$ 
```

# The Boundaries of DynamoDB
- When you write a query you have provide a Primary Key (equality) eg. pk = 'andrew'
- Are you allowed to "update" the Hash and Range?
  - No, whenever you change a key (simple or composite) eg. pk or sk you have to create a new item.
    you have to delete the old one
- Key condition expressions for query only for RANGE, HASH is only equality
- Don't create UUID for entity if you don't have an access pattern for it


# DynamoDB Stream trigger to update message groups

#### Create Lambda function with below code:
```
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource(
 'dynamodb',
 region_name='ca-central-1',
 endpoint_url="http://dynamodb.ca-central-1.amazonaws.com"
)

def lambda_handler(event, context):
  pk = event['Records'][0]['dynamodb']['Keys']['pk']['S']
  sk = event['Records'][0]['dynamodb']['Keys']['sk']['S']
  if pk.startswith('MSG#'):
    group_uuid = pk.replace("MSG#","")
    message = event['Records'][0]['dynamodb']['NewImage']['message']['S']
    print("GRUP ===>",group_uuid,message)
    
    table_name = 'cruddur-messages'
    index_name = 'message-group-sk-index'
    table = dynamodb.Table(table_name)
    data = table.query(
      IndexName=index_name,
      KeyConditionExpression=Key('message_group_uuid').eq(group_uuid)
    )
    print("RESP ===>",data['Items'])
    
    # recreate the message group rows with new SK value
    for i in data['Items']:
      delete_item = table.delete_item(Key={'pk': i['pk'], 'sk': i['sk']})
      print("DELETE ===>",delete_item)
      
      response = table.put_item(
        Item={
          'pk': i['pk'],
          'sk': sk,
          'message_group_uuid':i['message_group_uuid'],
          'message':message,
          'user_display_name': i['user_display_name'],
          'user_handle': i['user_handle'],
          'user_uuid': i['user_uuid']
        }
      )
      print("CREATE ===>",response)
```
- Need to give this lambda permission to invoke dynamo db streams: AWSLambdaInvocation-DynamoDB

- Next add the lambda as trigger on the stream

#### Create a global secondary index - GSI
Updated schema-load to create GSI and re created Prod DDB
```
#!/usr/bin/env python3

import boto3
import sys

attrs = {
  'endpoint_url': 'http://localhost:8000'
}

if len(sys.argv) == 2:
  if "prod" in sys.argv[1]:
    attrs = {}

ddb = boto3.client('dynamodb',**attrs)

table_name = 'cruddur-messages'


response = ddb.create_table(
  TableName=table_name,
  AttributeDefinitions=[
    {
      'AttributeName': 'message_group_uuid',
      'AttributeType': 'S'
    },
    {
      'AttributeName': 'pk',
      'AttributeType': 'S'
    },
    {
      'AttributeName': 'sk',
      'AttributeType': 'S'
    },
  ],
  KeySchema=[
    {
      'AttributeName': 'pk',
      'KeyType': 'HASH'
    },
    {
      'AttributeName': 'sk',
      'KeyType': 'RANGE'
    },
  ],
  GlobalSecondaryIndexes= [{
    'IndexName':'message-group-sk-index',
    'KeySchema':[{
      'AttributeName': 'message_group_uuid',
      'KeyType': 'HASH'
    },{
      'AttributeName': 'sk',
      'KeyType': 'RANGE'
    }],
    'Projection': {
      'ProjectionType': 'ALL'
    },
    'ProvisionedThroughput': {
      'ReadCapacityUnits': 5,
      'WriteCapacityUnits': 5
    },
  }],
  BillingMode='PROVISIONED',
  ProvisionedThroughput={
      'ReadCapacityUnits': 5,
      'WriteCapacityUnits': 5
  }
)

print(response)
```

### Start making use of the new DDB streams and Lambda trigger
- Comment out AWS_ENDPOINT_URL in docker-compose.yml
- Created a new message by going to URL: http://localhost:3000/messages/new/behlkiaan
- Message posted successfully  
- Back on the cruddur-messaging-stream lambda invocation, clicked CloudWatch logs and encountered below error:
```
[ERROR] ClientError: An error occurred (AccessDeniedException) when calling the Query operation: User: arn:aws:sts::342196396576:assumed-role/cruddur-messaging-stream-role-gge0anso/cruddur-messaging-stream is not authorized to perform: dynamodb:Query on resource: arn:aws:dynamodb:ca-central-1:342196396576:table/cruddur-messages/index/message-group-sk-index because no identity-based policy allows the dynamodb:Query action
Traceback (most recent call last):
  File "/var/task/lambda_function.py", line 22, in lambda_handler
    data = table.query(
  File "/var/runtime/boto3/resources/factory.py", line 520, in do_action
    response = action(self, *args, **kwargs)
  File "/var/runtime/boto3/resources/action.py", line 83, in __call__
    response = getattr(parent.meta.client, operation_name)(*args, **params)
  File "/var/runtime/botocore/client.py", line 391, in _api_call
    return self._make_api_call(operation_name, kwargs)
  File "/var/runtime/botocore/client.py", line 719, in _make_api_call
    raise error_class(parsed_response, operation_name)
```

- to fix above error we added below policy to lambda role (AWS managed policy)
```
AmazonDynamoDBFullAccess
```
- That did not fix lambda errors so we created an inline policy to that lambda role:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query"
            ],
            "Resource": [
                "arn:aws:dynamodb:ca-central-1:342196396576:table/cruddur-messages/index/message-group-sk-index",
                "arn:aws:dynamodb:ca-central-1:342196396576:table/cruddur-messages"
            ]
        }
    ]
}
```
- After fixing this another issue started coming for REMOVE event type on the lambda
- The issue was coming because of something called a REMOVE event that was throwing exception as it didn't have a key
called NewImage in the events:
```
message = event['Records'][0]['dynamodb']['NewImage']['message']['S']
```
- To fix this we updated the lambda with
```
  eventName = event['Records'][0]['eventName']
  if (eventName == 'REMOVE'):
    print("skip REMOVE event")
    return
```


# Issues faced:
- Backend flask app started giving error all of a sudden when it wouldn't connect to the psql local db
  - Found out that i had CONNECTION_URL set as localhost:5432 - it used to work like that but then i changed it to db:5432 so that backend cound connect
    to the local db successfully
  
- Message groups tab wouldn't load up, no matter what i did, i was getting exception. 
  - After tons of debugging and effort I found out that it was due the the environment variable: AWS_ENDPOINT_URL not being set to point to dynamodb-local.
    So ddb.py client() calls were failing and giving back exceptions

- Started getting errors related to disk space being full so unable to launch dev container
  - resolved by running
    ```
       docker system prune
    ```


# Homework Summary
Followed along with videos and was able to get the dynamo db working.
- Has been the most challenging week full of issues

Things that I still don't fully understand and will watch the videos again for:
- All the access patterns - Revisit again and understand the implementation of each
- Why did we get rid of REMOVE events in the lambda - I know the remove event didn't have the key: NewImage but is it okay to skip those?

Things I learned:
- AWS_ENDPOINT_URL is an absolute essential environment variable if dynamo db is running local
- I can reach out to my dynamodb using a VPC endpoint: com.amazonaws.ca-central-1.dynamodb and then by calling boto3.client('dynamodb', **attrs), all from within my python library code
- How to create an inline policy easily using the Visual Editor, which is now a part of AWS console
- There is a difference in how Dev Containers treat environment variables, the container doesn't recognize localhost keyword when used for psql, but it does recognize what docker-compose.yml exposes. The normal terminal in dev contiainer doesn't understand the db with psql and to connect to psql locally from terminal, we need to use localhost.

# Issues faced:
- The backend flask app started giving errors all of a sudden when it wouldn't connect to the psql local db
  - Found out that I had CONNECTION_URL set as localhost:5432 - it used to work like that but then I changed it to db:5432 so that the backend could connect
    to the local db successfully
- The message groups tab wouldn't load up, no matter what I did, i was getting an exception. 
  - After tons of debugging and effort I found out that it was due the environment variable: AWS_ENDPOINT_URL not being set to point to dynamodb-local.
    So ddb.py client() calls were failing and giving back exceptions

- Started getting errors related to disk space being full so unable to launch dev container
  - resolved by running: docker system prune