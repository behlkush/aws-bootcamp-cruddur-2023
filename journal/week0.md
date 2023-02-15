# Week 0 — Billing and Architecture





SNS Topic Creation

aws sns subscribe \
    --topic-arn=arn:aws:sns:ca-central-1:MYACCOUNTID:billing-alarm \
    --protocol=email \
    --notification-endpoint=myEMAIL@gmail.com
    
    
CloudWatch alarm:

Created using:
aws cloudwatch put-metric-alarm --cli-input-json file://aws/json/alarm_config.json

alarm_config.json - checked in

